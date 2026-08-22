const express = require('express');
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { requireAdmin } = require('../middleware/auth');
const { adminApiLimiter } = require('../middleware/rateLimit');
const { isPositiveInt, isValidOrderNumber } = require('../utils/validators');

const router = express.Router();

router.use(requireAdmin, adminApiLimiter);

const VALID_STATUSES = ['recebido', 'em_preparo', 'saiu_para_entrega', 'entregue', 'cancelado'];

// ---------- Dashboard ----------
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const [statusCounts] = await db.query(
      `SELECT status, COUNT(*) AS total FROM orders WHERE DATE(created_at) = CURDATE() GROUP BY status`
    );

    const [revenueRows] = await db.query(
      `SELECT COALESCE(SUM(total_amount_cents), 0) AS revenue_cents, COUNT(*) AS order_count
       FROM orders WHERE DATE(created_at) = CURDATE() AND status != 'cancelado'`
    );

    const [topProducts] = await db.query(
      `SELECT pr.name AS product_name, COALESCE(SUM(oi.quantity), 0) AS total_qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products pr ON pr.id = oi.product_id
       WHERE DATE(o.created_at) = CURDATE() AND o.status != 'cancelado'
       GROUP BY pr.id
       ORDER BY total_qty DESC
       LIMIT 5`
    );

    res.json({
      status_counts: statusCounts,
      revenue_cents: revenueRows[0].revenue_cents,
      order_count: revenueRows[0].order_count,
      top_products: topProducts,
    });
  })
);

// ---------- Pedidos ----------
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const status = VALID_STATUSES.includes(req.query.status) ? req.query.status : null;
    const conditions = [];
    const params = [];
    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [orders] = await db.query(
      `SELECT o.id, o.public_order_number, o.customer_name, o.customer_phone, o.fulfillment_type, o.delivery_address, o.payment_method,
              o.total_amount_cents, o.status, o.created_at, p.status AS payment_status
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT 300`,
      params
    );
    res.json(orders);
  })
);

router.get(
  '/orders/by-number/:number',
  asyncHandler(async (req, res) => {
    const raw = req.params.number;
    if (!isValidOrderNumber(raw)) {
      return res.status(400).json({ error: 'Número de pedido inválido (ex: A3I-284193).' });
    }
    const orderNumber = raw.trim().toUpperCase();

    const [rows] = await db.query('SELECT id FROM orders WHERE public_order_number = ?', [orderNumber]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado. Confira o número (ex: A3I-284193).' });
    }
    res.redirect(`/api/admin/orders/${rows[0].id}`);
  })
);

router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    if (!isPositiveInt(orderId, Number.MAX_SAFE_INTEGER)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Pedido não encontrado.' });

    const [items] = await db.query(
      `SELECT oi.quantity, oi.unit_price_cents, oi.subtotal_cents, pr.name AS product_name
       FROM order_items oi
       JOIN products pr ON pr.id = oi.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    // pix_payload não é segredo, mas não tem por que trafegar aqui —
    // só o status do pagamento interessa pro admin nesta tela.
    const [payments] = await db.query(
      'SELECT status, amount_cents, expires_at, confirmed_at FROM payments WHERE order_id = ?',
      [orderId]
    );

    res.json({ ...orders[0], items, payment: payments[0] || null });
  })
);

// Confirma manualmente o pagamento Pix de um pedido, depois de o admin
// conferir o comprovante recebido pelo WhatsApp da loja. Não há upload
// nem armazenamento de comprovante nesse sistema — a conferência é
// feita fora daqui, direto na conversa do WhatsApp.
router.patch(
  '/orders/:id/pix/confirm',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    if (!isPositiveInt(orderId, Number.MAX_SAFE_INTEGER)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const [rows] = await db.query(
      `SELECT o.payment_method, p.status AS payment_status
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.id = ?`,
      [orderId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (rows[0].payment_method !== 'pix' || !rows[0].payment_status) {
      return res.status(400).json({ error: 'Este pedido não tem um pagamento Pix associado.' });
    }

    const [result] = await db.query(
      `UPDATE payments SET status = 'confirmado', confirmed_by_admin_id = ?, confirmed_at = NOW()
       WHERE order_id = ? AND status = 'pendente'`,
      [req.admin.id, orderId]
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Pagamento já estava confirmado ou não está pendente.' });
    }

    await db.query('INSERT INTO security_logs (admin_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
      req.admin.id,
      'pix_payment_confirmed',
      `Pedido ${orderId}`,
      req.ip,
    ]);

    res.json({ message: 'Pagamento confirmado.' });
  })
);

router.patch(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.id);
    const { status } = req.body || {};
    if (!isPositiveInt(orderId, Number.MAX_SAFE_INTEGER) || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }

    const [result] = await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Pedido não encontrado.' });

    await db.query('INSERT INTO security_logs (admin_id, action, details, ip_address) VALUES (?, ?, ?, ?)', [
      req.admin.id,
      'order_status_change',
      `Pedido ${orderId} -> ${status}`,
      req.ip,
    ]);

    res.json({ message: 'Status atualizado.' });
  })
);

// ---------- Cardápio (somente leitura — preços são fixos por definição do negócio) ----------
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const [products] = await db.query('SELECT * FROM products ORDER BY category, sort_order');
    res.json(products);
  })
);

// ---------- Logs de segurança ----------
router.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const [logs] = await db.query(
      `SELECT sl.id, sl.action, sl.details, sl.ip_address, sl.created_at, au.username
       FROM security_logs sl
       LEFT JOIN admin_users au ON au.id = sl.admin_id
       ORDER BY sl.created_at DESC
       LIMIT 200`
    );
    res.json(logs);
  })
);

module.exports = router;
