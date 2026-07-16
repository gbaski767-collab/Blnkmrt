// ============================================================================
// orders.html — logic
// ============================================================================

async function init() {
  const user = await requireAuth();
  if (!user) return;

  const { data: profile } = await supabaseClient.from('profiles').select('default_currency').eq('id', user.id).single();
  const currency = profile?.default_currency || getPreferredCurrency();

  const { data: orders, error } = await supabaseClient
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const listEl = document.getElementById('ordersList');

  if (error) {
    listEl.innerHTML = `<p style="color:var(--muted);">Couldn't load your orders.</p>`;
    return;
  }

  if (!orders || orders.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧾</div>
        <h3>No orders yet</h3>
        <p>Everything you buy will show up here, with the delivered code or link attached.</p>
        <a href="marketplace.html" class="btn btn-primary mt-16">Browse marketplace</a>
      </div>`;
    return;
  }

  const badgeClass = { completed: 'badge-completed', pending: 'badge-pending', failed: 'badge-failed' };

  listEl.innerHTML = orders.map((o, i) => `
    <div class="accordion-item ${i === 0 ? 'is-open' : ''}">
      <button class="accordion-trigger" data-accordion="order-${o.id}">
        <span style="display:flex;flex-direction:column;gap:4px;text-align:left;">
          <span>${escapeHtml(o.product_name)}</span>
          <span style="font-size:0.76rem;color:var(--muted-2);font-weight:400;">${formatDate(o.created_at)}</span>
        </span>
        <span style="display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:12px;">
          <span class="mono" style="font-size:0.88rem;">${formatMoney(o.total_ngn, currency)}</span>
          <span class="badge ${badgeClass[o.status] || 'badge-pending'}">${o.status}</span>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      <div class="accordion-panel">
        <div class="accordion-panel-inner">
          <div class="summary-row"><span>Order ID</span><span class="val">${o.id.slice(0, 8)}</span></div>
          <div class="summary-row"><span>Unit price</span><span class="val">${formatMoney(o.unit_price_ngn, currency)}</span></div>
          <div class="summary-row"><span>Quantity</span><span class="val">${o.quantity}</span></div>
          ${o.delivered_code ? `
            <p style="font-size:0.8rem;color:var(--muted);margin:14px 0 6px;">Your ${o.delivered_code.startsWith('http') ? 'access link' : 'code'}</p>
            <div class="code-reveal">${escapeHtml(o.delivered_code)}</div>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');

  wireAccordions();
}

init();
