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
cp .env.example .env   # preencha DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, PIX_KEY, WHATSAPP_NUMBER
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
antecipadamente só por Pix. O novo pedido é um **delivery** com pagamento na
entrega em três formas (Pix, dinheiro com troco, cartão) — um modelo de
negócio diferente. Por isso a maior parte das features específicas de escola
foi **removida**: disponibilidade diária por produto, calendário de pedidos,
assistente de matemática financeira e relatórios PDF/Excel.

A geração de QR Code Pix e o envio de comprovante pelo WhatsApp, porém,
**foram trazidos de volta** (do projeto "Última Fatia"), com uma diferença
importante: **não existe upload nem armazenamento de comprovante no banco de
dados**. O fluxo agora é:

1. Ao escolher "Pix" no checkout, o backend gera o payload EMV/BR Code e o
   QR Code na hora (via `pixService.js`) e devolve pro cliente — só o
   payload ("copia e cola") é salvo em `payments.pix_payload`, nunca uma
   imagem de comprovante.
2. O cliente paga e toca no botão **"Enviar comprovante no WhatsApp"**, que
   abre uma conversa (`wa.me`) já com o número do pedido e o valor
   preenchidos — o print do comprovante é anexado e enviado direto pelo
   WhatsApp da loja, sem passar pelo servidor.
3. A chave Pix e o número de WhatsApp são o **mesmo número**
   (`+55 75 99903-6961`), configurados em `PIX_KEY` e `WHATSAPP_NUMBER` no
   `.env` do backend.
4. O admin confere o comprovante na própria conversa do WhatsApp e confirma
   o pagamento manualmente no painel (`PATCH /api/admin/orders/:id/pix/confirm`),
   o que marca `payments.status = 'confirmado'`.

O painel admin cobre: dashboard do dia, lista de pedidos com filtro por
status e status do pagamento Pix, confirmação manual do Pix, atualização de
status do pedido e log de segurança.

Se quiser voltar a ter algum dos recursos removidos (ex.: relatório de
vendas), consigo montar isso numa próxima etapa.

## Fluxo do cliente

Home (hero + mais pedidos + destaques) → cardápio por categoria (Acarajé /
Bebidas) → adicionar ao carrinho com controle de quantidade → carrinho
(subtotal + taxa de entrega + total) → checkout (nome, telefone/WhatsApp,
endereço, referência, observação, forma de pagamento, troco se dinheiro) →
confirmação com número do pedido.
