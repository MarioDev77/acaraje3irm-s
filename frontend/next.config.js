/** @type {import('next').NextConfig} */

// URL do backend, usada só no servidor do Next.js pra fazer o proxy —
// nunca chega no navegador.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Faz o navegador falar sempre com o próprio domínio do frontend, e o
  // Next.js repassa a requisição pro backend por trás dos panos. Isso deixa
  // o cookie de sessão do admin "same-site" de verdade e evita bloqueios de
  // cookie cross-site em navegadores mobile.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
};
module.exports = nextConfig;
