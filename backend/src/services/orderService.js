const crypto = require('crypto');
const db = require('../config/db');

function generatePublicOrderNumber() {
  const n = crypto.randomInt(100000, 999999);
  return `A3I-${n}`;
}

function generateAccessToken() {
  // 32 bytes aleatórios -> string base64url (imprevisível, não sequencial)
  return crypto.randomBytes(32).toString('base64url');
}

// Cria pedido + itens dentro de uma transação. Retorna dados públicos
// (nunca o id interno).
async function createOrder({
  customerName,
  customerPhone,
  deliveryAddress,
  referencePoint,
  orderNote,
  paymentMethod,
  changeForCents,
  resolvedItems,
  subtotalCents,
  deliveryFeeCents,
  totalCents,
}) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let publicOrderNumber;
    let attempts = 0;
    // Garante unicidade do número público (colisão é raríssima, mas trata).
    while (attempts < 5) {
      publicOrderNumber = generatePublicOrderNumber();
      const [existing] = await conn.query('SELECT id FROM orders WHERE public_order_number = ?', [publicOrderNumber]);
      if (existing.length === 0) break;
      attempts++;
    }

    const accessToken = generateAccessToken();

    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (public_order_number, access_token, customer_name, customer_phone, delivery_address,
         reference_point, order_note, payment_method, change_for_cents,
         subtotal_cents, delivery_fee_cents, total_amount_cents, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recebido')`,
      [
        publicOrderNumber,
        accessToken,
        customerName,
        customerPhone,
        deliveryAddress,
        referencePoint || null,
        orderNote || null,
        paymentMethod,
        changeForCents === undefined ? null : changeForCents,
        subtotalCents,
        deliveryFeeCents,
        totalCents,
      ]
    );

    const orderId = orderResult.insertId;

    for (const item of resolvedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, subtotal_cents)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.unit_price_cents, item.subtotal_cents]
      );
    }

    await conn.commit();
    return { orderId, publicOrderNumber, accessToken };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Consulta segura: SÓ retorna o pedido se o token bater. Nunca por ID sequencial.
async function getOrderByToken(token) {
  const [rows] = await db.query(
    `SELECT public_order_number, customer_name, customer_phone, delivery_address, reference_point,
            order_note, payment_method, change_for_cents, subtotal_cents, delivery_fee_cents,
            total_amount_cents, status, created_at
     FROM orders
     WHERE access_token = ?`,
    [token]
  );
  if (rows.length === 0) return null;

  const [items] = await db.query(
    `SELECT oi.quantity, oi.unit_price_cents, oi.subtotal_cents, pr.name AS product_name
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN products pr ON pr.id = oi.product_id
     WHERE o.access_token = ?`,
    [token]
  );

  return { ...rows[0], items };
}

module.exports = { createOrder, getOrderByToken };
