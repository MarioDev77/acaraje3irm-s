'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatCents } from '../../../lib/api';

const STATUS_LABELS = {
  recebido: 'Pedido recebido',
  em_preparo: 'Em preparo',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);
const PAYMENT_LABELS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' };

export default function AdminDashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  const loadOrders = useCallback((status) => {
    api
      .adminOrders(status)
      .then(setOrders)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    api
      .adminMe()
      .then((me) => setUsername(me.username))
      .catch(() => router.push('/admin/login'));
  }, [router]);

  useEffect(() => {
    if (!username) return;
    api.adminDashboard().then(setDashboard).catch((err) => setError(err.message));
    loadOrders(statusFilter);
  }, [username, statusFilter, loadOrders]);

  async function handleLogout() {
    await api.adminLogout();
    router.push('/admin/login');
  }

  async function handleStatusChange(orderId, status) {
    try {
      await api.adminUpdateOrderStatus(orderId, status);
      loadOrders(statusFilter);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleConfirmPix(orderId) {
    try {
      await api.adminConfirmPixPayment(orderId);
      loadOrders(statusFilter);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!username) return null;

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Acarajé 3 Irmãs</h2>
          <p style={{ fontSize: 12.5, color: 'var(--brown-soft)', margin: '2px 0 0' }}>Olá, {username}</p>
        </div>
        <button className="admin-logout-btn" onClick={handleLogout}>Sair</button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {dashboard && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{formatCents(dashboard.revenue_cents)}</div>
            <div className="stat-label">Faturamento hoje</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{dashboard.order_count}</div>
            <div className="stat-label">Pedidos hoje</div>
          </div>
        </div>
      )}

      <div className="filter-tabs">
        <button className={`filter-tab ${statusFilter === '' ? 'active' : ''}`} onClick={() => setStatusFilter('')}>
          Todos
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            className={`filter-tab ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <p style={{ color: 'var(--brown-soft)', textAlign: 'center', padding: '30px 0' }}>Nenhum pedido encontrado.</p>
      ) : (
        orders.map((order) => (
          <div className="order-row" key={order.id}>
            <div className="order-row-top">
              <span className="order-number">{order.public_order_number}</span>
              <span className="order-total">{formatCents(order.total_amount_cents)}</span>
            </div>
            <div className="order-meta">
              {order.customer_name} · {order.customer_phone} · {PAYMENT_LABELS[order.payment_method] || order.payment_method}
              <br />
              {order.fulfillment_type === 'retirada' ? (
                <strong>Retirada no estabelecimento</strong>
              ) : (
                order.delivery_address
              )}
              <br />
              {new Date(order.created_at).toLocaleString('pt-BR')}
            </div>
            {order.payment_method === 'pix' && order.payment_status && (
              <div style={{ margin: '8px 0' }}>
                <span
                  className={`status-badge ${order.payment_status === 'confirmado' ? 'payment-confirmed-badge' : 'payment-pending-badge'}`}
                >
                  {order.payment_status === 'confirmado' ? 'Pix confirmado' : 'Pix pendente — conferir no WhatsApp'}
                </span>
                {order.payment_status === 'pendente' && (
                  <button
                    className="admin-logout-btn"
                    style={{ marginLeft: 8 }}
                    onClick={() => handleConfirmPix(order.id)}
                  >
                    Confirmar pagamento
                  </button>
                )}
              </div>
            )}
            <select
              className="status-select"
              value={order.status}
              onChange={(e) => handleStatusChange(order.id, e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        ))
      )}
    </div>
  );
}
