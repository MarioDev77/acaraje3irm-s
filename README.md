# Acarajé 3 Irmãs — Sistema de Pedidos Online

Sistema completo (frontend + backend) de vendas online para a **Acarajé 3 Irmãs**
(Itamira - BA). Rebuild completo do projeto anterior, com identidade visual e
cardápio novos.

## Estrutura

```
acaraje-3-irmas/
├── backend/     Express + MySQL (API, autenticação admin, pedidos)
└── frontend/    Next.js 14 (loja para o cliente + painel admin)
```

## Como rodar

### 1. Banco de dados
Crie um banco MySQL e rode `backend/schema.sql` nele (ou apenas configure as
variáveis de ambiente — o servidor cria as tabelas e sincroniza o cardápio
sozinho na primeira subida, via migração idempotente).

### 2. Backend
```bash
cd backend
cp .env.example .env   # preencha DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET
npm install
npm run dev             # http://localhost:3001
```

Crie o primeiro usuário administrador:
```bash
npm run create-admin -- meu_usuario minha_senha_forte_123
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev             # http://localhost:3000
```

- Loja do cliente: `http://localhost:3000`
- Painel admin: `http://localhost:3000/admin/login`

## Cardápio (não alterar preços/nomes)

| Produto | Preço |
|---|---|
| Acarajé no papel com camarão | R$ 12,00 |
| Acarajé no papel sem camarão | R$ 10,00 |
| Acarajé com camarão no prato | R$ 15,00 |
| Acarajé sem camarão no prato | R$ 13,00 |
| Acarajé na marmita | R$ 15,00 |
| Porção com 10 mini acarajés | R$ 35,00 |
| Cerveja lata | R$ 5,00 |
| Refrigerante lata | R$ 5,00 |
| Refrigerante 1L | R$ 8,00 |
| Taxa de entrega | R$ 2,00 |

O cardápio fica no banco (`products`), mas a fonte de verdade que a migração
sincroniza a cada subida é `backend/src/scripts/migrate.js` — para alterar
preço/nome de verdade, mude ali (e em `schema.sql`, por documentação).

## O que foi reaproveitado do projeto anterior

A base de segurança do projeto original ("Última Fatia") era muito boa e foi
mantida quase integralmente: hashing de senha com bcrypt, sessão admin em
cookie httpOnly + JWT, proxy same-origin do Next.js (evita problemas de cookie
cross-site no celular), rate limiting por rota, Helmet/CSP, validação de
entrada com listas fechadas, preço sempre recalculado no backend (nunca
confia no valor enviado pelo cliente), logs de auditoria e token de acesso
aleatório (não sequencial) para consulta pública de pedido.

## O que mudou de propósito (e por quê)

O sistema anterior era para **retirada agendada na escola**, pago
antecipadamente só por Pix com comprovante conferido manualmente pelo admin
(QR Code, upload/foto do comprovante, análise de imagem, disponibilidade por
data, relatórios PDF/Excel). O novo pedido é um **delivery** com pagamento na
entrega em três formas (Pix, dinheiro com troco, cartão) — um modelo de
negócio diferente. Por isso essas features foram **removidas** em vez de
adaptadas: geração de QR Pix, upload/análise de comprovante, disponibilidade
diária por produto, calendário de pedidos e relatórios PDF/Excel. O painel
admin atual cobre o essencial do novo fluxo: dashboard do dia, lista de
pedidos com filtro por status, atualização de status e log de segurança.

Se quiser esses recursos de volta (ex.: um relatório de vendas, ou confirmação
de pagamento Pix com comprovante), consigo montar isso numa próxima etapa.

## Fluxo do cliente

Home (hero + mais pedidos + destaques) → cardápio por categoria (Acarajé /
Bebidas) → adicionar ao carrinho com controle de quantidade → carrinho
(subtotal + taxa de entrega + total) → checkout (nome, telefone/WhatsApp,
endereço, referência, observação, forma de pagamento, troco se dinheiro) →
confirmação com número do pedido.
# acarajé3irm-s
