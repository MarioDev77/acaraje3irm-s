const ExcelJS = require('exceljs');
const { PAYMENT_LABELS, STATUS_LABELS } = require('./reportService');

const BROWN = 'FF2C1810';
const GOLD = 'FFF4B93B';

function toReais(cents) {
  return Number((cents / 100).toFixed(2));
}

async function buildExcelReport({ orders, summary, narrative, startDate, endDate }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Acarajé 3 Irmãs';
  workbook.created = new Date();

  // ---------- Aba Resumo ----------
  const resumo = workbook.addWorksheet('Resumo');
  resumo.columns = [{ width: 32 }, { width: 22 }];

  resumo.mergeCells('A1:B1');
  resumo.getCell('A1').value = `Relatório Acarajé 3 Irmãs — ${startDate} a ${endDate}`;
  resumo.getCell('A1').font = { bold: true, size: 14, color: { argb: BROWN } };

  resumo.addRow([]);
  resumo.addRow(['Pedidos válidos', summary.validOrders]);
  resumo.addRow(['Pedidos cancelados', summary.canceledOrders]);
  resumo.addRow(['Total de pedidos', summary.totalOrders]);
  resumo.addRow(['Faturamento', toReais(summary.revenueCents)]);
  resumo.addRow(['Taxas de entrega arrecadadas', toReais(summary.deliveryFeeCents)]);
  resumo.addRow(['Ticket médio', toReais(summary.avgTicketCents)]);
  resumo.addRow(['Pedidos por entrega', summary.byFulfillment.entrega || 0]);
  resumo.addRow(['Pedidos por retirada', summary.byFulfillment.retirada || 0]);

  resumo.addRow([]);
  const headerPagamentos = resumo.addRow(['Formas de pagamento', '']);
  headerPagamentos.font = { bold: true };
  for (const [method, count] of Object.entries(summary.byPayment)) {
    resumo.addRow([PAYMENT_LABELS[method] || method, count]);
  }

  resumo.addRow([]);
  const headerStatus = resumo.addRow(['Status dos pedidos', '']);
  headerStatus.font = { bold: true };
  for (const [status, count] of Object.entries(summary.byStatus)) {
    resumo.addRow([STATUS_LABELS[status] || status, count]);
  }

  resumo.addRow([]);
  const headerTop = resumo.addRow(['Mais vendidos', 'Qtd']);
  headerTop.font = { bold: true };
  for (const p of summary.topProducts) {
    resumo.addRow([p.name, p.qty]);
  }

  resumo.addRow([]);
  resumo.addRow(['Análise do período']);
  resumo.getCell(`A${resumo.rowCount}`).font = { bold: true };
  const narrativeRow = resumo.addRow([narrative]);
  resumo.mergeCells(`A${narrativeRow.number}:B${narrativeRow.number}`);
  resumo.getRow(narrativeRow.number).alignment = { wrapText: true, vertical: 'top' };
  resumo.getRow(narrativeRow.number).height = 60;

  for (let i = 3; i <= 9; i++) {
    resumo.getCell(`A${i}`).font = { bold: true, color: { argb: BROWN } };
  }

  // ---------- Aba Pedidos ----------
  const sheet = workbook.addWorksheet('Pedidos');
  sheet.columns = [
    { header: 'Nº do pedido', key: 'numero', width: 14 },
    { header: 'Data/Hora', key: 'data', width: 18 },
    { header: 'Cliente', key: 'cliente', width: 24 },
    { header: 'Telefone', key: 'telefone', width: 16 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Endereço', key: 'endereco', width: 30 },
    { header: 'Itens', key: 'itens', width: 40 },
    { header: 'Pagamento', key: 'pagamento', width: 12 },
    { header: 'Subtotal (R$)', key: 'subtotal', width: 14 },
    { header: 'Taxa entrega (R$)', key: 'taxa', width: 16 },
    { header: 'Total (R$)', key: 'total', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BROWN } };

  for (const o of orders) {
    sheet.addRow({
      numero: o.public_order_number,
      data: new Date(o.created_at).toLocaleString('pt-BR'),
      cliente: o.customer_name,
      telefone: o.customer_phone,
      tipo: o.fulfillment_type === 'entrega' ? 'Entrega' : 'Retirada',
      endereco: o.fulfillment_type === 'entrega' ? o.delivery_address || '' : 'Estabelecimento',
      itens: o.items.map((it) => `${it.quantity}x ${it.product_name}`).join(', '),
      pagamento: PAYMENT_LABELS[o.payment_method] || o.payment_method,
      subtotal: toReais(o.subtotal_cents),
      taxa: toReais(o.delivery_fee_cents),
      total: toReais(o.total_amount_cents),
      status: STATUS_LABELS[o.status] || o.status,
    });
  }

  sheet.autoFilter = { from: 'A1', to: 'L1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildExcelReport };
