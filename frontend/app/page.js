'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, formatCents } from '../lib/api';

const EMOJI_BY_SLUG = {
  acaraje_papel_com_camarao: '🥙',
  acaraje_papel_sem_camarao: '🥙',
  acaraje_prato_com_camarao: '🍽️',
  acaraje_prato_sem_camarao: '🍽️',
  acaraje_marmita: '🍱',
  mini_acaraje_10: '🧺',
  cerveja_lata: '🍺',
  refrigerante_lata: '🥤',
  refrigerante_1l: '🥤',
};

const BESTSELLER_SLUGS = ['acaraje_papel_com_camarao', 'acaraje_prato_com_camarao', 'acaraje_marmita', 'mini_acaraje_10'];

const PAYMENT_LABELS = {
  pix: { label: 'Pix', emoji: '💠' },
  dinheiro: { label: 'Dinheiro', emoji: '💵' },
  cartao: { label: 'Cartão', emoji: '💳' },
};

export default function HomePage() {
  const [menu, setMenu] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [activeCategory, setActiveCategory] = useState('acaraje');
  const [cart, setCart] = useState({}); // { [productId]: qty }
  const [sheet, setSheet] = useState(null); // null | 'cart' | 'checkout'
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  useEffect(() => {
    api
      .getMenu()
      .then(setMenu)
      .catch((err) => setLoadError(err.message));
  }, []);

  const productsById = useMemo(() => {
    const map = new Map();
    (menu?.products || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [menu]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const product = productsById.get(Number(id));
        if (!product) return null;
        return { product, qty, subtotal: product.price_cents * qty };
      })
      .filter(Boolean);
  }, [cart, productsById]);

  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const subtotalCents = cartLines.reduce((sum, l) => sum + l.subtotal, 0);
  const deliveryFeeCents = menu?.delivery_fee_cents ?? 200;
  const totalCents = subtotalCents + (cartCount > 0 ? deliveryFeeCents : 0);

  function setQty(productId, qty) {
    setCart((prev) => ({ ...prev, [productId]: Math.max(0, Math.min(30, qty)) }));
  }
  function addItem(productId) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  }
  function removeLine(productId) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  function scrollToCatalog() {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
  }

  if (confirmedOrder) {
    return (
      <div className="container">
        <TopBar cartCount={0} onCartClick={() => {}} />
        <ConfirmationScreen
          order={confirmedOrder}
          onBackHome={() => {
            setConfirmedOrder(null);
            setCart({});
          }}
        />
      </div>
    );
  }

  return (
    <div className="container">
      <TopBar cartCount={cartCount} onCartClick={() => setSheet('cart')} />

      <section className="hero">
        <span className="hero-eyebrow">Itamira · BA</span>
        <h1 className="hero-title">Acarajé 3 Irmãs</h1>
        <p className="hero-slogan">“Sabor que conquista, tradição que encanta!”</p>
        <button className="hero-cta" onClick={scrollToCatalog}>
          FAZER MEU PEDIDO
        </button>
      </section>

      {loadError && (
        <p style={{ padding: '20px', color: 'var(--red-danger)', textAlign: 'center' }}>
          Não foi possível carregar o cardápio agora. Puxe a tela para atualizar. ({loadError})
        </p>
      )}

      {menu && (
        <>
          <section className="section">
            <h2 className="section-title">Os mais pedidos</h2>
            <p className="section-subtitle">Feito com amor, sabor que vira tradição!</p>
          </section>
          <div className="bestseller-scroll">
            {menu.products
              .filter((p) => BESTSELLER_SLUGS.includes(p.slug))
              .map((p) => (
                <div key={p.id} className="bestseller-card" onClick={scrollToCatalog}>
                  <div className="bestseller-emoji">{EMOJI_BY_SLUG[p.slug] || '🌶️'}</div>
                  <div className="bestseller-name">{p.name}</div>
                  <PriceTag cents={p.price_cents} className="bestseller-price" />
                </div>
              ))}
          </div>

          <PromoCard
            product={menu.products.find((p) => p.slug === 'mini_acaraje_10')}
            onAdd={addItem}
          />
          <MarmitaPromo
            product={menu.products.find((p) => p.slug === 'acaraje_marmita')}
            onAdd={addItem}
          />

          <div id="catalogo" />
          <section className="section" style={{ paddingBottom: 0 }}>
            <h2 className="section-title">Cardápio completo</h2>
            <p className="section-subtitle">Experimente e se apaixone!</p>
          </section>

          <div className="category-tabs">
            <button
              className={`category-tab ${activeCategory === 'acaraje' ? 'active' : ''}`}
              onClick={() => setActiveCategory('acaraje')}
            >
              🌶️ Acarajé
            </button>
            <button
              className={`category-tab ${activeCategory === 'bebida' ? 'active' : ''}`}
              onClick={() => setActiveCategory('bebida')}
            >
              🥤 Bebidas
            </button>
          </div>

          <div className="product-list">
            {menu.products
              .filter((p) => p.category === activeCategory)
              .map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  qty={cart[p.id] || 0}
                  onAdd={() => addItem(p.id)}
                  onSetQty={(q) => setQty(p.id, q)}
                />
              ))}
          </div>

          <p className="footer-note">
            Pequeno no tamanho, gigante no sabor! · Entrega em Itamira - BA · Taxa de entrega {formatCents(deliveryFeeCents)}
          </p>
        </>
      )}

      {cartCount > 0 && !sheet && (
        <button className="floating-cart-bar" onClick={() => setSheet('cart')}>
          <span className="fc-left">
            <span className="fc-badge">{cartCount}</span> Ver carrinho
          </span>
          <span className="fc-right">{formatCents(subtotalCents)}</span>
        </button>
      )}

      {sheet === 'cart' && (
        <CartSheet
          lines={cartLines}
          subtotalCents={subtotalCents}
          deliveryFeeCents={deliveryFeeCents}
          totalCents={totalCents}
          onClose={() => setSheet(null)}
          onSetQty={setQty}
          onRemove={removeLine}
          onCheckout={() => setSheet('checkout')}
        />
      )}

      {sheet === 'checkout' && (
        <CheckoutSheet
          cartLines={cartLines}
          subtotalCents={subtotalCents}
          deliveryFeeCents={deliveryFeeCents}
          totalCents={totalCents}
          onClose={() => setSheet('cart')}
          onConfirmed={(order) => {
            setConfirmedOrder(order);
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}

function TopBar({ cartCount, onCartClick }) {
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <div className="logo-badge">🌶️</div>
        <div>
          <div className="topbar-name">Acarajé 3 Irmãs</div>
          <div className="topbar-location">Itamira - BA</div>
        </div>
      </div>
      {cartCount > 0 && (
        <button className="cart-pill" onClick={onCartClick}>
          🛒 <span className="count">{cartCount}</span>
        </button>
      )}
    </div>
  );
}

function PriceTag({ cents, className = 'price-display' }) {
  const value = (cents / 100).toFixed(2).replace('.', ',');
  return (
    <span className={className}>
      <span className="rs">R$</span>
      {value}
    </span>
  );
}

function ProductCard({ product, qty, onAdd, onSetQty }) {
  return (
    <div className="product-card">
      <div className="product-emoji-box">{EMOJI_BY_SLUG[product.slug] || '🌶️'}</div>
      <div className="product-info">
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <p className="product-name">{product.name}</p>
        {product.description && <p className="product-desc">{product.description}</p>}
        <div className="product-footer">
          <PriceTag cents={product.price_cents} />
          {qty === 0 ? (
            <button className="add-btn" onClick={onAdd}>
              Adicionar
            </button>
          ) : (
            <div className="qty-stepper">
              <button onClick={() => onSetQty(qty - 1)}>−</button>
              <span className="qty-num">{qty}</span>
              <button onClick={() => onSetQty(qty + 1)}>+</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PromoCard({ product, onAdd }) {
  if (!product) return null;
  return (
    <div className="promo-card">
      <span className="promo-badge">Destaque especial</span>
      <h3 className="promo-title">Porção com 10 Mini Acarajés</h3>
      <p className="promo-text">“Pequeno no tamanho, gigante no sabor!”</p>
      <div className="promo-features">
        <span>⭐ Crocante por fora</span>
        <span>❤️ Molhadinho por dentro</span>
        <span>🌶️ Com recheios irresistíveis!</span>
      </div>
      <div className="promo-price">
        <span className="rs">R$</span>
        {(product.price_cents / 100).toFixed(2).replace('.', ',')}
      </div>
      <button className="promo-button" onClick={() => onAdd(product.id)}>
        PEDIR AGORA
      </button>
    </div>
  );
}

function MarmitaPromo({ product, onAdd }) {
  if (!product) return null;
  return (
    <div className="promo-card" style={{ marginTop: 12, background: 'linear-gradient(135deg, var(--orange-deep), var(--orange))' }}>
      <h3 className="promo-title">Acarajé na Marmita</h3>
      <p className="promo-text">“O sabor que você ama, agora na praticidade que você precisa!”</p>
      <div className="promo-price">
        <span className="rs">R$</span>
        {(product.price_cents / 100).toFixed(2).replace('.', ',')}
      </div>
      <button className="promo-button" onClick={() => onAdd(product.id)}>
        ADICIONAR AO PEDIDO
      </button>
    </div>
  );
}

function CartSheet({ lines, subtotalCents, deliveryFeeCents, totalCents, onClose, onSetQty, onRemove, onCheckout }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3 className="sheet-title">Seu carrinho</h3>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>

        {lines.length === 0 ? (
          <div className="cart-empty">
            <p>Seu carrinho está vazio.</p>
            <p>Que tal um acarajé bem quentinho? 🌶️</p>
          </div>
        ) : (
          <>
            {lines.map((line) => (
              <div className="cart-item" key={line.product.id}>
                <div style={{ fontSize: 26 }}>{EMOJI_BY_SLUG[line.product.slug] || '🌶️'}</div>
                <div className="cart-item-info">
                  <p className="cart-item-name">{line.product.name}</p>
                  <p className="cart-item-unit">{formatCents(line.product.price_cents)} cada</p>
                  <div className="qty-stepper" style={{ marginTop: 6, display: 'inline-flex' }}>
                    <button onClick={() => onSetQty(line.product.id, line.qty - 1)}>−</button>
                    <span className="qty-num">{line.qty}</span>
                    <button onClick={() => onSetQty(line.product.id, line.qty + 1)}>+</button>
                  </div>
                  <div>
                    <button className="cart-item-remove" onClick={() => onRemove(line.product.id)}>
                      Remover
                    </button>
                  </div>
                </div>
                <div className="cart-item-subtotal">{formatCents(line.subtotal)}</div>
              </div>
            ))}

            <div className="summary-box">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{formatCents(subtotalCents)}</span>
              </div>
              <div className="summary-row">
                <span>Taxa de entrega</span>
                <span>{formatCents(deliveryFeeCents)}</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span className="val">{formatCents(totalCents)}</span>
              </div>
            </div>

            <button className="checkout-btn" onClick={onCheckout}>
              Continuar para entrega
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CheckoutSheet({ cartLines, subtotalCents, deliveryFeeCents, totalCents, onClose, onConfirmed }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [changeFor, setChangeFor] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!name.trim() || name.trim().length < 2) return setError('Informe seu nome.');
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) return setError('Informe um telefone/WhatsApp válido.');
    if (!address.trim() || address.trim().length < 5) return setError('Informe o endereço completo de entrega.');
    if (!paymentMethod) return setError('Escolha a forma de pagamento.');

    let changeForCents;
    if (paymentMethod === 'dinheiro' && changeFor.trim()) {
      const parsed = Math.round(parseFloat(changeFor.replace(',', '.')) * 100);
      if (Number.isNaN(parsed) || parsed < 0) return setError('Valor de troco inválido.');
      changeForCents = parsed;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_address: address.trim(),
        reference_point: reference.trim() || undefined,
        order_note: note.trim() || undefined,
        payment_method: paymentMethod,
        change_for_cents: changeForCents,
        items: cartLines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
      };
      const result = await api.createOrder(payload);
      onConfirmed(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3 className="sheet-title">Finalizar pedido</h3>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Nome</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" />
        </div>
        <div className="form-group">
          <label className="form-label">Telefone / WhatsApp</label>
          <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(75) 99999-9999" />
        </div>
        <div className="form-group">
          <label className="form-label">Endereço de entrega</label>
          <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" />
        </div>
        <div className="form-group">
          <label className="form-label">Ponto de referência (opcional)</label>
          <input className="form-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Perto de..." />
        </div>
        <div className="form-group">
          <label className="form-label">Observações do pedido (opcional)</label>
          <textarea className="form-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sem pimenta, capricha no molho..." />
        </div>

        <div className="form-group">
          <label className="form-label">Forma de pagamento</label>
          <div className="payment-options">
            {Object.entries(PAYMENT_LABELS).map(([key, { label, emoji }]) => (
              <button
                key={key}
                type="button"
                className={`payment-option ${paymentMethod === key ? 'active' : ''}`}
                onClick={() => setPaymentMethod(key)}
              >
                <span className="emoji">{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod === 'dinheiro' && (
          <div className="form-group">
            <label className="form-label">Troco para quanto? (opcional)</label>
            <input
              className="form-input"
              value={changeFor}
              onChange={(e) => setChangeFor(e.target.value)}
              placeholder="Ex: 50,00"
              inputMode="decimal"
            />
          </div>
        )}

        <div className="summary-box">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatCents(subtotalCents)}</span>
          </div>
          <div className="summary-row">
            <span>Taxa de entrega</span>
            <span>{formatCents(deliveryFeeCents)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span className="val">{formatCents(totalCents)}</span>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button className="checkout-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Enviando pedido...' : 'FINALIZAR PEDIDO'}
        </button>
      </div>
    </div>
  );
}

function ConfirmationScreen({ order, onBackHome }) {
  return (
    <div className="confirm-screen">
      <div className="confirm-icon">❤️</div>
      <h2 className="confirm-title">Pedido recebido com sucesso!</h2>
      <p className="confirm-sub">Já vamos preparar seu acarajé com todo o carinho.</p>

      <div className="order-number-box">Pedido {order.order_number}</div>

      <div className="summary-box" style={{ textAlign: 'left' }}>
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
        <div className="summary-row">
          <span>Pagamento</span>
          <span>{PAYMENT_LABELS[order.payment_method]?.label || order.payment_method}</span>
        </div>
      </div>

      <button className="back-home-btn" onClick={onBackHome}>
        Fazer novo pedido
      </button>
    </div>
  );
}
