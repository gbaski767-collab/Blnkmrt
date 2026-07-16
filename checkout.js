// ============================================================================
// checkout.html — logic
// ============================================================================

let checkoutUser = null;
let checkoutProduct = null;
let checkoutProfile = null;

async function init() {
  checkoutUser = await requireAuth();
  if (!checkoutUser) return;

  const slug = qs('product');
  const body = document.getElementById('checkoutBody');

  if (!slug) {
    body.innerHTML = emptyState('No product selected', 'Head back to the marketplace and pick something to buy.');
    return;
  }

  const [{ data: product, error: productError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseClient.from('products').select('*, categories(name)').eq('slug', slug).eq('is_active', true).single(),
    supabaseClient.from('profiles').select('balance, default_currency').eq('id', checkoutUser.id).single(),
  ]);

  if (productError || !product) {
    body.innerHTML = emptyState('Product not found', "This item may no longer be available.");
    return;
  }
  if (profileError) {
    showToast(friendlyError(profileError), 'error');
    return;
  }

  checkoutProduct = product;
  checkoutProfile = profile;
  render();
}

function emptyState(title, text) {
  return `<div class="empty-state"><div class="empty-icon">📦</div><h3>${title}</h3><p>${text}</p><a href="marketplace.html" class="btn btn-primary mt-16">Browse marketplace</a></div>`;
}

function render() {
  const currency = checkoutProfile.default_currency || getPreferredCurrency();
  const hasEnough = Number(checkoutProfile.balance) >= Number(checkoutProduct.price_ngn);

  document.getElementById('checkoutBody').innerHTML = `
    <div class="card mb-24">
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:18px;">
        <div style="font-size:2.4rem;">${checkoutProduct.image_emoji || '📦'}</div>
        <div>
          <h3 style="font-size:1.05rem;">${escapeHtml(checkoutProduct.name)}</h3>
          <p style="font-size:0.82rem;color:var(--muted);">${escapeHtml(checkoutProduct.categories?.name || '')}</p>
        </div>
      </div>

      <div class="summary-row"><span>Unit price</span><span class="val">${formatMoney(checkoutProduct.price_ngn, currency)}</span></div>
      <div class="summary-row"><span>Quantity</span><span class="val">1</span></div>
      <div class="summary-row total"><span>Total</span><span class="val">${formatMoney(checkoutProduct.price_ngn, currency)}</span></div>

      <div class="balance-check ${hasEnough ? 'ok' : 'low'}">
        ${hasEnough
          ? `Wallet balance: ${formatMoney(checkoutProfile.balance, currency)} — sufficient for this order.`
          : `Wallet balance: ${formatMoney(checkoutProfile.balance, currency)} — not enough to cover this order.`}
      </div>
    </div>

    ${hasEnough
      ? `<button class="btn btn-primary btn-block" id="payNowBtn"><span class="btn-label">Pay from wallet balance</span></button>`
      : `<a href="dashboard.html" class="btn btn-primary btn-block">Add funds to continue</a>`}
  `;

  document.getElementById('payNowBtn')?.addEventListener('click', handlePayNow);
}

async function handlePayNow() {
  const btn = document.getElementById('payNowBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processing…';

  const { data: order, error } = await supabaseClient.rpc('purchase_product', {
    p_product_id: checkoutProduct.id,
  });

  if (error) {
    showToast(friendlyError(error), 'error');
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-label">Pay from wallet balance</span>';
    // Refresh balance in case it was an insufficient-balance race condition.
    const { data: profile } = await supabaseClient.from('profiles').select('balance, default_currency').eq('id', checkoutUser.id).single();
    if (profile) { checkoutProfile = profile; render(); }
    return;
  }

  showToast('Payment successful!', 'success');
  window.location.href = `order-success.html?order=${encodeURIComponent(order.id)}`;
}

init();
