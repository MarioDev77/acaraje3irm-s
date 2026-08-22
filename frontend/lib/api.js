// As chamadas de API vão para o próprio domínio do frontend (caminho
// relativo /api/...) — o next.config.js faz o proxy pro backend por trás
// dos panos. Isso é o que faz o cookie de sessão do admin funcionar de
// forma confiável em qualquer navegador (inclusive no celular).
async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // resposta sem corpo
  }

  if (!res.ok) {
    const message = (data && data.error) || 'Ocorreu um erro. Tente novamente.';
    throw new Error(message);
  }
  return data;
}

export const api = {
  getMenu: () => request('/api/menu'),
  createOrder: (payload) => request('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getOrder: (token) => request(`/api/orders/${encodeURIComponent(token)}`),

  adminLogin: (username, password) =>
    request('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  adminLogout: () => request('/api/admin/auth/logout', { method: 'POST' }),
  adminMe: () => request('/api/admin/auth/me'),
  adminDashboard: () => request('/api/admin/dashboard'),
  adminOrders: (status) => request(`/api/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  adminOrderDetail: (id) => request(`/api/admin/orders/${id}`),
  adminOrderByNumber: (number) => request(`/api/admin/orders/by-number/${encodeURIComponent(number.trim())}`),
  adminUpdateOrderStatus: (id, status) =>
    request(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  adminConfirmPixPayment: (id) => request(`/api/admin/orders/${id}/pix/confirm`, { method: 'PATCH' }),
};

export function formatCents(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
