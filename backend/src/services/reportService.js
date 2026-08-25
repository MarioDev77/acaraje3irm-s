const db = require('../config/db');

const PAYMENT_LABELS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' };
const STATUS_LABELS = {
  recebido: 'Recebido',
  em_preparo: 'Em preparo',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

// Busca todos os pedidos (com itens) criados entre startDate e endDate
// (ambos "YYYY-MM-DD", inclusivos, no fuso do próprio MySQL). Nunca
// recebe texto livre — as datas já vêm validadas pela rota.
async function getOrdersInRange(startDate, endDate) {
  const [orders] = await db.query(
    `SELECT id, public_order_number, customer_name, customer_phone, fulfillment_type, delivery_address,
            payment_method, subtotal_cents, delivery_fee_cents, total_amount_cents, status, created_at
     FROM orders
     WHERE DATE(created_at) BETWEEN ? AND ?
     ORDER BY created_at ASC`,
    [startDate, endDate]
  );

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const [items] = await db.query(
    `SELECT oi.order_id, oi.quantity, oi.unit_price_cents, oi.subtotal_cents, pr.name AS product_name
     FROM order_items oi
     JOIN products pr ON pr.id = oi.product_id
     WHERE oi.order_id IN (?)`,
    [orderIds]
  );

  const itemsByOrder = new Map();
  for (const it of items) {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push(it);
  }

  return orders.map((o) => ({ ...o, items: itemsByOrder.get(o.id) || [] }));
}

// Calcula o resumo estatístico a partir da lista de pedidos já carregada
// (nada de nova query aqui — só matemática em cima do que já veio do banco).
function buildSummary(orders) {
  const valid = orders.filter((o) => o.status !== 'cancelado');
  const cancelados = orders.length - valid.length;

  const revenueCents = valid.reduce((sum, o) => sum + o.total_amount_cents, 0);
  const deliveryFeeCents = valid.reduce((sum, o) => sum + o.delivery_fee_cents, 0);
  const avgTicketCents = valid.length ? Math.round(revenueCents / valid.length) : 0;

  const byFulfillment = { entrega: 0, retirada: 0 };
  const byPayment = { pix: 0, dinheiro: 0, cartao: 0 };
  const byStatus = {};
  const productQty = new Map(); // nome -> { qty, revenueCents }

  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    if (o.status === 'cancelado') continue;
    byFulfillment[o.fulfillment_type] = (byFulfillment[o.fulfillment_type] || 0) + 1;
    byPayment[o.payment_method] = (byPayment[o.payment_method] || 0) + 1;
    for (const it of o.items) {
      const cur = productQty.get(it.product_name) || { qty: 0, revenueCents: 0 };
      cur.qty += it.quantity;
      cur.revenueCents += it.subtotal_cents;
      productQty.set(it.product_name, cur);
    }
  }

  const topProducts = [...productQty.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, revenueCents: v.revenueCents }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return {
    totalOrders: orders.length,
    validOrders: valid.length,
    canceledOrders: cancelados,
    revenueCents,
    deliveryFeeCents,
    avgTicketCents,
    byFulfillment,
    byPayment,
    byStatus,
    topProducts,
  };
}

// Texto do balancete gerado 100% localmente (sem chamada de IA) a partir
// dos números já calculados — mesmo padrão usado no Última Fatia.
function buildNarrative(summary, startDate, endDate) {
  const lines = [];
  const fmt = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (summary.validOrders === 0) {
    lines.push(`Nenhum pedido válido registrado entre ${startDate} e ${endDate}.`);
    return lines.join(' ');
  }

  lines.push(
    `No período de ${startDate} a ${endDate}, a Acarajé 3 Irmãs faturou ${fmt(summary.revenueCents)} em ${summary.validOrders} pedido(s) válido(s), com ticket médio de ${fmt(summary.avgTicketCents)}.`
  );

  if (summary.canceledOrders > 0) {
    const taxa = ((summary.canceledOrders / summary.totalOrders) * 100).toFixed(1);
    lines.push(`Houve ${summary.canceledOrders} cancelamento(s), uma taxa de ${taxa}% sobre o total de pedidos.`);
  }

  const entrega = summary.byFulfillment.entrega || 0;
  const retirada = summary.byFulfillment.retirada || 0;
  lines.push(`Do total, ${entrega} pedido(s) foram por entrega e ${retirada} por retirada no estabelecimento.`);

  if (summary.topProducts.length > 0) {
    const top = summary.topProducts[0];
    lines.push(`O item mais vendido foi "${top.name}", com ${top.qty} unidade(s) e ${fmt(top.revenueCents)} em receita.`);
  }

  const pagamentos = Object.entries(summary.byPayment)
    .filter(([, count]) => count > 0)
    .map(([method, count]) => `${count} em ${PAYMENT_LABELS[method] || method}`)
    .join(', ');
  if (pagamentos) lines.push(`Formas de pagamento: ${pagamentos}.`);

  return lines.join(' ');
}

module.exports = { getOrdersInRange, buildSummary, buildNarrative, PAYMENT_LABELS, STATUS_LABELS };
