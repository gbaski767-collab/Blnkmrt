// ============================================================================
// order-success.html — logic
// ============================================================================

async function init() {
  const user = await requireAuth();
  if (!user) return;

  const orderId = qs('order');
  const body = document.getElementById('successBody');

  if (!orderId) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">❓</div><h3>No order specified</h3><p>Head to your orders page to find what you're looking for.</p><a href="orders.html" class="btn btn-primary mt-16">View orders</a></div>`;
    return;
  }

  const { data: profile } = await supabaseClient.from('profiles').select('default_currency').eq('id', user.id).single();
  const currency = profile?.default_currency || getPreferredCurrency();

  // RLS ensures this only ever returns a row if it belongs to the logged-in user.
  const { data: order, error } = await supabaseClient.from('orders').select('*').eq('id', orderId).single();

  if (error || !order) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">❓</div><h3>Order not found</h3><p>We couldn't find that order on your account.</p><a href="orders.html" class="btn btn-primary mt-16">View orders</a></div>`;
    return;
  }

  body.innerHTML = `
    <div class="success-icon">✓</div>
    <h1>Order confirmed</h1>
    <p>Your ${escapeHtml(order.product_name)} is ready below.</p>

    <div class="card mt-24 text-center" style="text-align:left;">
      <div class="summary-row"><span>Product</span><span class="val">${escapeHtml(order.product_name)}</span></div>
      <div class="summary-row"><span>Amount paid</span><span class="val">${formatMoney(order.total_ngn, currency)}</span></div>
      <div class="summary-row"><span>Date</span><span class="val">${formatDate(order.created_at)}</span></div>
      <div class="summary-row"><span>Order ID</span><span class="val">${order.id.slice(0, 8)}</span></div>

      ${order.delivered_code ? `
        <p style="font-size:0.85rem;color:var(--muted);margin:18px 0 8px;">Your ${order.delivered_code.startsWith('http') ? 'access link' : 'code'}</p>
        <div class="code-reveal">${escapeHtml(order.delivered_code)}</div>
      ` : ''}
    </div>

    <div style="display:flex;gap:10px;margin-top:24px;flex-wrap:wrap;">
      <a href="orders.html" class="btn btn-outline-gold" style="flex:1;">View all orders</a>
      <a href="marketplace.html" class="btn btn-primary" style="flex:1;">Continue shopping</a>
    </div>
  `;
}

init();
