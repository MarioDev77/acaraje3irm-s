// Validação centralizada — listas fechadas, nunca confiar em texto livre do frontend
// para nada que afete preço ou controle de acesso.

const NAME_REGEX = /^[A-Za-zÀ-ÿ' \-]{2,120}$/;
// Aceita formatos comuns de telefone/WhatsApp BR: (11) 91234-5678, 11912345678, etc.
const PHONE_REGEX = /^[0-9() +\-]{8,20}$/;
const PAYMENT_METHODS = new Set(['pix', 'dinheiro', 'cartao']);
const FULFILLMENT_TYPES = new Set(['entrega', 'retirada']);

function isValidName(name) {
  return typeof name === 'string' && NAME_REGEX.test(name.trim());
}

function isValidPhone(phone) {
  return typeof phone === 'string' && PHONE_REGEX.test(phone.trim()) && phone.replace(/\D/g, '').length >= 8;
}

function isValidAddress(address) {
  return typeof address === 'string' && address.trim().length >= 5 && address.trim().length <= 255;
}

function isValidOptionalText(text, maxLen) {
  if (text === undefined || text === null || text === '') return true;
  return typeof text === 'string' && text.trim().length <= maxLen;
}

function isValidPaymentMethod(method) {
  return typeof method === 'string' && PAYMENT_METHODS.has(method);
}

function isValidFulfillmentType(type) {
  return typeof type === 'string' && FULFILLMENT_TYPES.has(type);
}

function isPositiveInt(n, max = 1000) {
  return Number.isInteger(n) && n > 0 && n <= max;
}

function isNonNegativeInt(n, max = 10000000) {
  return Number.isInteger(n) && n >= 0 && n <= max;
}

// Formato do número público do pedido gerado em orderService.js: "A3I-" + 6 dígitos.
const ORDER_NUMBER_REGEX = /^A3I-\d{6}$/;

function isValidOrderNumber(orderNumber) {
  return typeof orderNumber === 'string' && ORDER_NUMBER_REGEX.test(orderNumber.trim().toUpperCase());
}

// Valida a lista de itens do pedido antes de qualquer cálculo de preço.
// items: [{ product_id, quantity }]
function isValidItemsArray(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 40) return false;
  return items.every((it) => it && isPositiveInt(it.product_id, 100000) && isPositiveInt(it.quantity, 30));
}

module.exports = {
  isValidName,
  isValidPhone,
  isValidAddress,
  isValidOptionalText,
  isValidPaymentMethod,
  isValidFulfillmentType,
  isPositiveInt,
  isNonNegativeInt,
  isValidItemsArray,
  isValidOrderNumber,
};
