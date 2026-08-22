-- ============================================================
-- ACARAJÉ 3 IRMÃS — Schema MySQL
-- Sistema de pedidos para delivery
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- ------------------------------------------------------------
-- 1. Administradores
-- ------------------------------------------------------------
CREATE TABLE admin_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,     -- bcrypt
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. Produtos (catálogo fixo do cardápio)
--    Preço fica SEMPRE aqui — nunca confiar no frontend.
-- ------------------------------------------------------------
CREATE TABLE products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  category ENUM('acaraje', 'bebida') NOT NULL,
  price_cents INT UNSIGNED NOT NULL,       -- preço em centavos (1200 = R$ 12,00)
  badge VARCHAR(60) NULL,                  -- selo opcional, ex: "Mais pedido"
  active TINYINT(1) NOT NULL DEFAULT 1,    -- liga/desliga produto globalmente
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. Pedidos
--    ID interno != número público != token de consulta (IDOR)
-- ------------------------------------------------------------
CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,             -- ID interno (nunca exposto)
  public_order_number VARCHAR(14) NOT NULL UNIQUE,           -- ex: "A3I-284193"
  access_token CHAR(43) NOT NULL UNIQUE,                     -- token aleatório p/ o cliente consultar o próprio pedido
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  delivery_address VARCHAR(255) NOT NULL,
  reference_point VARCHAR(255) NULL,
  order_note VARCHAR(500) NULL,
  payment_method ENUM('pix', 'dinheiro', 'cartao') NOT NULL,
  change_for_cents INT UNSIGNED NULL,                        -- "troco para quanto?" (só faz sentido em dinheiro)
  subtotal_cents INT UNSIGNED NOT NULL,
  delivery_fee_cents INT UNSIGNED NOT NULL DEFAULT 200,
  total_amount_cents INT UNSIGNED NOT NULL,                  -- calculado no backend
  status ENUM(
    'recebido',
    'em_preparo',
    'saiu_para_entrega',
    'entregue',
    'cancelado'
  ) NOT NULL DEFAULT 'recebido',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. Itens do pedido
-- ------------------------------------------------------------
CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  unit_price_cents INT UNSIGNED NOT NULL,   -- snapshot do preço no momento da compra
  subtotal_cents INT UNSIGNED NOT NULL,
  CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. Pagamentos Pix (payload gerado, sem armazenar a chave)
--    Não guardamos comprovante nenhum aqui: o cliente envia o
--    print/comprovante direto pelo WhatsApp da loja, e o admin
--    confirma manualmente o pagamento na tela de Pedidos depois
--    de conferir por lá — não existe upload/armazenamento de
--    comprovante no banco de dados.
-- ------------------------------------------------------------
CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL UNIQUE,
  pix_payload TEXT NOT NULL,                -- "copia e cola" gerado (não é segredo)
  amount_cents INT UNSIGNED NOT NULL,
  status ENUM('pendente','confirmado','expirado') NOT NULL DEFAULT 'pendente',
  confirmed_by_admin_id INT UNSIGNED NULL,
  confirmed_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_admin FOREIGN KEY (confirmed_by_admin_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6. Logs de segurança / auditoria
-- ------------------------------------------------------------
CREATE TABLE security_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,              -- 'login','logout','order_status_change', etc.
  details VARCHAR(500) NULL,                -- NUNCA senha ou token
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED do cardápio — NÃO alterar preços nem nomes aqui.
-- ============================================================
INSERT INTO products (slug, name, description, category, price_cents, badge, sort_order) VALUES
('acaraje_papel_com_camarao', 'Acarajé no papel com camarão', 'Crocante por fora, molhadinho por dentro, recheios irresistíveis.', 'acaraje', 1200, NULL, 1),
('acaraje_papel_sem_camarao', 'Acarajé no papel sem camarão', 'Crocante por fora, molhadinho por dentro, recheios irresistíveis.', 'acaraje', 1000, NULL, 2),
('acaraje_prato_com_camarao', 'Acarajé com camarão no prato', 'Servido no prato, com todo o capricho da nossa cozinha.', 'acaraje', 1500, NULL, 3),
('acaraje_prato_sem_camarao', 'Acarajé sem camarão no prato', 'Servido no prato, com todo o capricho da nossa cozinha.', 'acaraje', 1300, NULL, 4),
('acaraje_marmita', 'Acarajé na marmita', 'O sabor que você ama, agora na praticidade que você precisa!', 'acaraje', 1500, 'Praticidade', 5),
('mini_acaraje_10', 'Porção com 10 mini acarajés', '10 mini acarajés com recheios separados para você saborear!', 'acaraje', 3500, 'Pequeno no tamanho, gigante no sabor', 6),
('cerveja_lata', 'Cerveja lata', 'Bem gelada para acompanhar seu acarajé.', 'bebida', 500, NULL, 7),
('refrigerante_lata', 'Refrigerante lata', 'Bem gelado para acompanhar seu acarajé.', 'bebida', 500, NULL, 8),
('refrigerante_1l', 'Refrigerante 1L', 'Bem gelado para acompanhar seu acarajé.', 'bebida', 800, NULL, 9);
