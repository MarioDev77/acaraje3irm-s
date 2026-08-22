const db = require('../config/db');
const env = require('../config/env');

class PriceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.publicMessage = message;
  }
}

// Recebe os itens BRUTOS do frontend (product_id, quantity) e recalcula
// TUDO com base no que está no banco. Nunca usa preço ou nome de produto
// vindo da requisição.
async function calculateOrderTotal(items) {
  const [products] = await db.query('SELECT * FROM products WHERE active = 1');
  const productMap = new Map(products.map((p) => [p.id, p]));

  const resolvedItems = [];
  let subtotalCents = 0;

  for (const raw of items) {
    const product = productMap.get(raw.product_id);
    if (!product) {
      throw new PriceError('Um dos produtos do pedido não está disponível.');
    }

    const unitPrice = product.price_cents;
    const subtotal = unitPrice * raw.quantity;
    subtotalCents += subtotal;

    resolvedItems.push({
      product_id: product.id,
      product_name: product.name,
      quantity: raw.quantity,
      unit_price_cents: unitPrice,
      subtotal_cents: subtotal,
    });
  }

  const deliveryFeeCents = env.store.deliveryFeeCents;
  const totalCents = subtotalCents + deliveryFeeCents;

  return { items: resolvedItems, subtotalCents, deliveryFeeCents, totalCents };
}

module.exports = { calculateOrderTotal, PriceError };
