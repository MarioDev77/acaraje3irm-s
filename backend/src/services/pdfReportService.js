const PDFDocument = require('pdfkit');
const { PAYMENT_LABELS, STATUS_LABELS } = require('./reportService');

const BROWN = '#2c1810';
const ORANGE = '#d94e1f';

function fmt(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildPdfReport({ orders, summary, narrative, startDate, endDate }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ---------- Cabeçalho ----------
    doc.fillColor(BROWN).fontSize(20).font('Helvetica-Bold').text('Acarajé 3 Irmãs', { align: 'left' });
    doc.fillColor(ORANGE).fontSize(12).font('Helvetica').text(`Relatório de pedidos — ${startDate} a ${endDate}`);
    doc.moveDown(1);
    doc.strokeColor(ORANGE).lineWidth(1.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.8);

    // ---------- Resumo ----------
    doc.fillColor(BROWN).fontSize(13).font('Helvetica-Bold').text('Resumo do período');
    doc.moveDown(0.3);
    doc.fontSize(10.5).font('Helvetica').fillColor('#222');

    const summaryLines = [
      `Pedidos válidos: ${summary.validOrders}   |   Cancelados: ${summary.canceledOrders}   |   Total: ${summary.totalOrders}`,
      `Faturamento: ${fmt(summary.revenueCents)}   |   Ticket médio: ${fmt(summary.avgTicketCents)}   |   Taxas de entrega: ${fmt(summary.deliveryFeeCents)}`,
      `Entrega: ${summary.byFulfillment.entrega || 0}   |   Retirada: ${summary.byFulfillment.retirada || 0}`,
    ];
    summaryLines.forEach((line) => doc.text(line));

    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').text('Formas de pagamento:', { continued: false });
    doc.font('Helvetica').text(
      Object.entries(summary.byPayment)
        .map(([method, count]) => `${PAYMENT_LABELS[method] || method}: ${count}`)
        .join('   |   ')
    );

    if (summary.topProducts.length > 0) {
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').text('Mais vendidos:');
      doc.font('Helvetica');
      summary.topProducts.forEach((p) => doc.text(`• ${p.name} — ${p.qty} un. (${fmt(p.revenueCents)})`));
    }

    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').text('Análise do período:');
    doc.font('Helvetica').text(narrative, { align: 'justify' });

    doc.moveDown(1);
    doc.strokeColor('#ccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.8);

    // ---------- Tabela de pedidos ----------
    doc.fillColor(BROWN).fontSize(13).font('Helvetica-Bold').text('Pedidos do período');
    doc.moveDown(0.4);

    const colX = { numero: 40, data: 95, cliente: 165, tipo: 260, pagamento: 305, total: 355, status: 410 };
    const colWidth = { cliente: 90, status: 145 };

    function drawTableHeader() {
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#fff');
      const y = doc.y;
      doc.rect(40, y - 2, 515, 16).fill(BROWN);
      doc.fillColor('#fff');
      doc.text('Pedido', colX.numero, y, { width: 50 });
      doc.text('Data', colX.data, y, { width: 65 });
      doc.text('Cliente', colX.cliente, y, { width: colWidth.cliente });
      doc.text('Tipo', colX.tipo, y, { width: 42 });
      doc.text('Pagto', colX.pagamento, y, { width: 45 });
      doc.text('Total', colX.total, y, { width: 50 });
      doc.text('Status', colX.status, y, { width: colWidth.status });
      doc.moveDown(1.1);
    }

    drawTableHeader();
    doc.font('Helvetica').fontSize(8.2).fillColor('#222');

    orders.forEach((o, idx) => {
      if (doc.y > 780) {
        doc.addPage();
        drawTableHeader();
        doc.font('Helvetica').fontSize(8.2).fillColor('#222');
      }
      const y = doc.y;
      if (idx % 2 === 0) {
        doc.rect(40, y - 2, 515, 13).fill('#faf6ef');
        doc.fillColor('#222');
      }
      doc.text(o.public_order_number, colX.numero, y, { width: 50 });
      doc.text(new Date(o.created_at).toLocaleDateString('pt-BR'), colX.data, y, { width: 65 });
      doc.text(o.customer_name, colX.cliente, y, { width: colWidth.cliente, ellipsis: true });
      doc.text(o.fulfillment_type === 'entrega' ? 'Entrega' : 'Retirada', colX.tipo, y, { width: 42 });
      doc.text(PAYMENT_LABELS[o.payment_method] || o.payment_method, colX.pagamento, y, { width: 45 });
      doc.text(fmt(o.total_amount_cents), colX.total, y, { width: 50 });
      doc.text(STATUS_LABELS[o.status] || o.status, colX.status, y, { width: colWidth.status });
      doc.moveDown(0.85);
    });

    if (orders.length === 0) {
      doc.font('Helvetica-Oblique').text('Nenhum pedido encontrado neste período.');
    }

    doc.end();
  });
}

module.exports = { buildPdfReport };
