// Uso: npm run migrate  (ou: node src/scripts/migrate.js)
//
// Migração idempotente — pode ser rodada quantas vezes for preciso, com
// segurança. Garante que as tabelas existem (caso o schema.sql nunca
// tenha sido rodado manualmente) e mantém o catálogo de produtos
// sincronizado com o cardápio oficial (nomes, categorias e preços não
// devem ser alterados fora daqui).
require('dotenv').config();
const db = require('../config/db');
const logger = require('../utils/logger');

const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS admin_users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,
    category ENUM('acaraje', 'bebida') NOT NULL,
    price_cents INT UNSIGNED NOT NULL,
    badge VARCHAR(60) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    public_order_number VARCHAR(14) NOT NULL UNIQUE,
    access_token CHAR(43) NOT NULL UNIQUE,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    delivery_address VARCHAR(255) NOT NULL,
    reference_point VARCHAR(255) NULL,
    order_note VARCHAR(500) NULL,
    payment_method ENUM('pix', 'dinheiro', 'cartao') NOT NULL,
    change_for_cents INT UNSIGNED NULL,
    subtotal_cents INT UNSIGNED NOT NULL,
    delivery_fee_cents INT UNSIGNED NOT NULL DEFAULT 200,
    total_amount_cents INT UNSIGNED NOT NULL,
    status ENUM('recebido','em_preparo','saiu_para_entrega','entregue','cancelado') NOT NULL DEFAULT 'recebido',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL,
    unit_price_cents INT UNSIGNED NOT NULL,
    subtotal_cents INT UNSIGNED NOT NULL,
    CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL UNIQUE,
    pix_payload TEXT NOT NULL,
    amount_cents INT UNSIGNED NOT NULL,
    status ENUM('pendente','confirmado','expirado') NOT NULL DEFAULT 'pendente',
    confirmed_by_admin_id INT UNSIGNED NULL,
    confirmed_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_admin FOREIGN KEY (confirmed_by_admin_id) REFERENCES admin_users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS security_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id INT UNSIGNED NULL,
    action VARCHAR(60) NOT NULL,
    details VARCHAR(500) NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

// Cardápio oficial — igual ao seed do schema.sql. Nomes, categorias e
// preços NÃO devem ser alterados; use ON DUPLICATE KEY UPDATE (por slug)
// para manter o banco sempre sincronizado com o código.
const CATALOG = [
  { slug: 'acaraje_papel_com_camarao', name: 'Acarajé no papel com camarão', description: 'Crocante por fora, molhadinho por dentro, recheios irresistíveis.', category: 'acaraje', price_cents: 1200, badge: null, sort_order: 1 },
  { slug: 'acaraje_papel_sem_camarao', name: 'Acarajé no papel sem camarão', description: 'Crocante por fora, molhadinho por dentro, recheios irresistíveis.', category: 'acaraje', price_cents: 1000, badge: null, sort_order: 2 },
  { slug: 'acaraje_prato_com_camarao', name: 'Acarajé com camarão no prato', description: 'Servido no prato, com todo o capricho da nossa cozinha.', category: 'acaraje', price_cents: 1500, badge: null, sort_order: 3 },
  { slug: 'acaraje_prato_sem_camarao', name: 'Acarajé sem camarão no prato', description: 'Servido no prato, com todo o capricho da nossa cozinha.', category: 'acaraje', price_cents: 1300, badge: null, sort_order: 4 },
  { slug: 'acaraje_marmita', name: 'Acarajé na marmita', description: 'O sabor que você ama, agora na praticidade que você precisa!', category: 'acaraje', price_cents: 1500, badge: 'Praticidade', sort_order: 5 },
  { slug: 'mini_acaraje_10', name: 'Porção com 10 mini acarajés', description: '10 mini acarajés com recheios separados para você saborear!', category: 'acaraje', price_cents: 3500, badge: 'Pequeno no tamanho, gigante no sabor', sort_order: 6 },
  { slug: 'cerveja_lata', name: 'Cerveja lata', description: 'Bem gelada para acompanhar seu acarajé.', category: 'bebida', price_cents: 500, badge: null, sort_order: 7 },
  { slug: 'refrigerante_lata', name: 'Refrigerante lata', description: 'Bem gelado para acompanhar seu acarajé.', category: 'bebida', price_cents: 500, badge: null, sort_order: 8 },
  { slug: 'refrigerante_1l', name: 'Refrigerante 1L', description: 'Bem gelado para acompanhar seu acarajé.', category: 'bebida', price_cents: 800, badge: null, sort_order: 9 },
];

async function step1_createTables() {
  for (const sql of CREATE_TABLES_SQL) {
    await db.query(sql);
  }
  logger.info('[migrate] Tabelas verificadas/criadas');
}

async function step2_syncCatalog() {
  for (const p of CATALOG) {
    await db.query(
      `INSERT INTO products (slug, name, description, category, price_cents, badge, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), description = VALUES(description), category = VALUES(category),
         price_cents = VALUES(price_cents), badge = VALUES(badge), sort_order = VALUES(sort_order),
         active = 1`,
      [p.slug, p.name, p.description, p.category, p.price_cents, p.badge, p.sort_order]
    );
  }
  logger.info('[migrate] Cardápio sincronizado com o catálogo oficial');
}

async function runStep(name, fn) {
  try {
    await fn();
  } catch (err) {
    logger.error(`[migrate] Passo "${name}" falhou — seguindo para o próximo passo mesmo assim`, {
      error: err.message,
    });
  }
}

async function runMigration() {
  await runStep('createTables', step1_createTables);
  await runStep('syncCatalog', step2_syncCatalog);
  logger.info('[migrate] Migração concluída (ver acima se algum passo falhou).');
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('[migrate] Falhou', { error: err.message });
      process.exit(1);
    });
}

module.exports = { runMigration };
