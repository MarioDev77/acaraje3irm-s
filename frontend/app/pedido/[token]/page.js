'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, formatCents } from '../../../lib/api';

const STATUS_LABELS = {
  recebido: 'Pedido recebido',
  em_preparo: 'Em preparo',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const PAYMENT_LABELS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' };

export default function OrderStatusPage() {
  const params = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params?.token) return;
    api
      .getOrder(params.token)
      .then(setOrder)
      .catch((err) => setError(err.message));
  }, [params?.token]);

  return (
    <div className="container">
      <div className="topbar">
        <div className="topbar-brand">
          <div className="logo-badge">🌶️</div>
          <div>
            <div className="topbar-name">Acarajé 3 Irmãs</div>
            <div className="topbar-location">Itamira - BA</div>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Acompanhar pedido</h2>
      </div>

      {error && <p style={{ padding: '0 16px', color: 'var(--red-danger)' }}>{error}</p>}

      {order && (
        <div style={{ padding: '0 16px' }}>
          <div className="order-number-box">Pedido {order.public_order_number}</div>
          <span className={`status-badge status-${order.status}`}>{STATUS_LABELS[order.status] || order.status}</span>

          <div className="summary-box" style={{ marginTop: 16, textAlign: 'left' }}>
            {order.items.map((item, idx) => (
              <div className="summary-row" key={idx}>
                <span>{item.quantity}x {item.product_name}</span>
                <span>{formatCents(item.subtotal_cents)}</span>
              </div>
            ))}
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatCents(order.subtotal_cents)}</span>
            </div>
            <div className="summary-row">
              <span>Taxa de entrega</span>
              <span>{formatCents(order.delivery_fee_cents)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span className="val">{formatCents(order.total_amount_cents)}</span>
            </div>
          </div>

          <div className="summary-box" style={{ textAlign: 'left' }}>
            <p style={{ margin: '2px 0', fontSize: 13.5 }}><strong>Endereço:</strong> {order.delivery_address}</p>
            {order.reference_point && <p style={{ margin: '6px 0', fontSize: 13.5 }}><strong>Referência:</strong> {order.reference_point}</p>}
            <p style={{ margin: '6px 0', fontSize: 13.5 }}><strong>Pagamento:</strong> {PAYMENT_LABELS[order.payment_method] || order.payment_method}</p>
            {order.order_note && <p style={{ margin: '6px 0', fontSize: 13.5 }}><strong>Observações:</strong> {order.order_note}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
