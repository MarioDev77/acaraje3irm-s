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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!params?.token) return;
    function load() {
      api
        .getOrder(params.token)
        .then(setOrder)
        .catch((err) => setError(err.message));
    }
    load();
    // Atualiza a cada 15s pra refletir a confirmação do pagamento assim
    // que o admin conferir o comprovante recebido pelo WhatsApp.
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [params?.token]);

  const isPixPending = order?.payment_method === 'pix' && order?.pix && order.pix.status !== 'confirmado';
  const isDelivery = order?.fulfillment_type ? order.fulfillment_type === 'entrega' : !!order?.delivery_address;

  async function handleCopyPix() {
    if (!order?.pix) return;
    try {
      await navigator.clipboard.writeText(order.pix.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard pode falhar em contexto não seguro; ignora silenciosamente
    }
  }

  function handleSendProofWhatsapp() {
    if (!order) return;
    const linha = (label, value) => `${label}: ${value}`;
    const mensagem = [
      'Olá! Segue o comprovante do meu pedido na Acarajé 3 Irmãs.',
      linha('Pedido nº', order.public_order_number),
      linha('Nome', order.customer_name),
      isDelivery ? linha('Endereço', order.delivery_address) : linha('Retirada', 'No estabelecimento'),
      linha('Total', formatCents(order.total_amount_cents)),
      '',
      '(anexe o comprovante aqui)',
    ].join('\n');
    const numeroWhatsapp = order.whatsapp_number || '5575999036961';
    const url = `https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  }

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

          {order.payment_method === 'pix' && order.pix && (
            <span
              className={`status-badge ${order.pix.status === 'confirmado' ? 'payment-confirmed-badge' : 'payment-pending-badge'}`}
              style={{ marginLeft: 8 }}
            >
              {order.pix.status === 'confirmado' ? 'Pagamento confirmado' : 'Pagamento pendente'}
            </span>
          )}

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
              <span>{isDelivery ? formatCents(order.delivery_fee_cents) : 'Grátis (retirada)'}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span className="val">{formatCents(order.total_amount_cents)}</span>
            </div>
          </div>

          <div className="summary-box" style={{ textAlign: 'left' }}>
            {isDelivery ? (
              <p style={{ margin: '2px 0', fontSize: 13.5 }}><strong>Endereço:</strong> {order.delivery_address}</p>
            ) : (
              <p style={{ margin: '2px 0', fontSize: 13.5 }}><strong>Retirada:</strong> No estabelecimento, Itamira - BA</p>
            )}
            {isDelivery && order.reference_point && <p style={{ margin: '6px 0', fontSize: 13.5 }}><strong>Referência:</strong> {order.reference_point}</p>}
            <p style={{ margin: '6px 0', fontSize: 13.5 }}><strong>Pagamento:</strong> {PAYMENT_LABELS[order.payment_method] || order.payment_method}</p>
            {order.order_note && <p style={{ margin: '6px 0', fontSize: 13.5 }}><strong>Observações:</strong> {order.order_note}</p>}
          </div>

          {isPixPending && (
            <>
              <div className="summary-box" style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 800 }}>Pague com Pix</p>
                <div className="qr-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={order.pix.qr_code_data_url} alt="QR Code Pix" width={220} height={220} />
                </div>
                <div className="pix-code-box">{order.pix.payload}</div>
                <button className="checkout-btn" onClick={handleCopyPix}>
                  {copied ? 'Copiado!' : 'COPIAR PIX'}
                </button>
              </div>

              <div className="summary-box" style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontWeight: 800 }}>Envie o comprovante pelo WhatsApp</p>
                <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--brown-soft)' }}>
                  Assim que pagar, toque no botão, anexe o print do comprovante e envie — é o
                  mesmo número da chave Pix. A gente confirma seu pedido assim que receber.
                </p>
                <button className="btn-whatsapp" onClick={handleSendProofWhatsapp}>
                  <svg viewBox="0 0 32 32" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.29.638 4.43 1.744 6.257L4 29l7.94-1.706A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.727c-1.99 0-3.845-.58-5.405-1.578l-.388-.242-4.71 1.012 1.03-4.59-.253-.397A9.66 9.66 0 0 1 5.273 15c0-5.912 4.812-10.727 10.73-10.727S26.727 9.088 26.727 15 21.918 24.727 16.004 24.727Zm5.902-8.03c-.324-.163-1.915-.945-2.212-1.053-.297-.108-.513-.163-.729.163-.216.325-.837 1.053-1.026 1.27-.189.216-.378.244-.702.081-.324-.163-1.367-.504-2.605-1.607-.963-.859-1.614-1.92-1.803-2.244-.189-.325-.02-.5.143-.663.146-.146.324-.379.486-.568.163-.19.216-.325.324-.541.108-.216.054-.406-.027-.569-.081-.163-.729-1.758-.999-2.408-.263-.633-.53-.547-.729-.557l-.621-.011c-.216 0-.568.081-.865.406-.297.325-1.135 1.108-1.135 2.703 0 1.595 1.162 3.136 1.324 3.352.163.216 2.288 3.494 5.543 4.9.775.334 1.379.534 1.85.684.777.247 1.484.212 2.043.129.623-.093 1.915-.783 2.185-1.539.27-.756.27-1.404.19-1.539-.081-.135-.297-.216-.621-.379Z" />
                  </svg>
                  Enviar comprovante no WhatsApp
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

