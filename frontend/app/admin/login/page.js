'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.adminLogin(username, password);
      router.push('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-wrap">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="logo-badge" style={{ margin: '0 auto 10px' }}>🌶️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Acarajé 3 Irmãs</h2>
          <p style={{ fontSize: 13, color: 'var(--brown-soft)', margin: '4px 0 0' }}>Painel administrativo</p>
        </div>

        <div className="form-group">
          <label className="form-label">Usuário</label>
          <input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Senha</label>
          <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button className="checkout-btn" type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
