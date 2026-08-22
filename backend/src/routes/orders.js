const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const {
  isValidName,
  isValidPhone,
  isValidAddress,
  isValidOptionalText,
  isValidPaymentMethod,
  isValidItemsArray,
  isNonNegativeInt,
} = require('../utils/validators');
const { calculateOrderTotal, PriceError } = require('../services/priceService');
const { createOrder, savePayment, getOrderByToken } = require('../services/orderService');
const { buildPixPayload, buildPixQrCodeDataUrl } = require('../services/pixService');
const { orderCreationLimiter, orderLookupLimiter } = require('../middleware/rateLimit');
const env = require('../config/env');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/orders — cria o pedido. O CLIENTE NUNCA envia preço.
router.post(
  '/',
  orderCreationLimiter,
  asyncHandler(async (req, res) => {
    const {
      customer_name,
      customer_phone,
      delivery_address,
      reference_point,
      order_note,
      payment_method,
      change_for_cents,
      items,
    } = req.body || {};

    if (!isValidName(customer_name)) {
      return res.status(400).json({ error: 'Nome inválido.' });
    }
    if (!isValidPhone(customer_phone)) {
      return res.status(400).json({ error: 'Telefone/WhatsApp inválido.' });
    }
    if (!isValidAddress(delivery_address)) {
      return res.status(400).json({ error: 'Endereço inválido.' });
    }
    if (!isValidOptionalText(reference_point, 255)) {
      return res.status(400).json({ error: 'Ponto de referência inválido.' });
    }
    if (!isValidOptionalText(order_note, 500)) {
      return res.status(400).json({ error: 'Observação inválida.' });
    }
    if (!isValidPaymentMethod(payment_method)) {
      return res.status(400).json({ error: 'Forma de pagamento inválida.' });
    }
    if (payment_method === 'dinheiro' && change_for_cents !== undefined && change_for_cents !== null) {
      if (!isNonNegativeInt(change_for_cents)) {
        return res.status(400).json({ error: 'Valor de troco inválido.' });
      }
    }
    if (!isValidItemsArray(items)) {
      return res.status(400).json({ error: 'Itens do pedido inválidos.' });
    }

    let calculation;
    try {
      calculation = await calculateOrderTotal(items);
    } catch (err) {
      if (err instanceof PriceError) {
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }

    if (
      payment_method === 'dinheiro' &&
      typeof change_for_cents === 'number' &&
      change_for_cents > 0 &&
      change_for_cents < calculation.totalCents
    ) {
      return res.status(400).json({ error: 'O valor do troco deve ser maior ou igual ao total do pedido.' });
    }

    const { orderId, publicOrderNumber, accessToken } = await createOrder({
      customerName: customer_name.trim(),
      customerPhone: customer_phone.trim(),
      deliveryAddress: delivery_address.trim(),
      referencePoint: reference_point ? reference_point.trim() : null,
      orderNote: order_note ? order_note.trim() : null,
      paymentMethod: payment_method,
      changeForCents: payment_method === 'dinheiro' ? change_for_cents ?? null : null,
      resolvedItems: calculation.items,
      subtotalCents: calculation.subtotalCents,
      deliveryFeeCents: calculation.deliveryFeeCents,
      totalCents: calculation.totalCents,
    });

    logger.info('Pedido recebido', { publicOrderNumber, totalCents: calculation.totalCents });

    // Se o pagamento for Pix, já geramos o QR Code/"copia e cola" aqui.
    // Não guardamos nenhum comprovante — o cliente confirma o pagamento
    // enviando o print direto pelo WhatsApp da loja (mesmo número da
    // chave Pix); o admin confirma manualmente depois de conferir.
    let pix = null;
    if (payment_method === 'pix') {
      const pixPayload = buildPixPayload(calculation.totalCents, publicOrderNumber);
      const qrCodeDataUrl = await buildPixQrCodeDataUrl(pixPayload);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min para pagar

      await savePayment(orderId, { pixPayload, amountCents: calculation.totalCents, expiresAt });

      pix = {
        payload: pixPayload,
        qr_code_data_url: qrCodeDataUrl,
        expires_at: expiresAt.toISOString(),
      };
    }

    res.status(201).json({
      order_number: publicOrderNumber,
      access_token: accessToken,
      items: calculation.items,
      subtotal_cents: calculation.subtotalCents,
      delivery_fee_cents: calculation.deliveryFeeCents,
      total_amount_cents: calculation.totalCents,
      payment_method,
      pix,
      whatsapp_number: env.whatsappNumber,
    });
  })
);

// GET /api/orders/:token — consulta pública, mas só com o token secreto do pedido (anti-IDOR).
router.get(
  '/:token',
  orderLookupLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    if (typeof token !== 'string' || token.length < 20 || token.length > 60) {
      return res.status(400).json({ error: 'Token inválido.' });
    }
    const order = await getOrderByToken(token);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    // O payload Pix fica salvo (não é segredo); o QR Code em si nunca é
    // persistido — é regerado aqui a partir do payload sempre que o
    // pedido é consultado. Nenhum comprovante é armazenado em nenhum
    // ponto: o cliente envia direto pelo WhatsApp da loja.
    const { pix_payload, payment_status, payment_expires_at, ...rest } = order;
    let pix = null;
    if (order.payment_method === 'pix' && pix_payload) {
      pix = {
        payload: pix_payload,
        qr_code_data_url: await buildPixQrCodeDataUrl(pix_payload),
        status: payment_status,
        expires_at: payment_expires_at,
      };
    }

    res.json({ ...rest, pix, whatsapp_number: env.whatsappNumber });
  })
);

module.exports = router;
