// ============================================================================
// sub-products.html — logic
// ============================================================================

let allProducts = [];
const currency = getPreferredCurrency();

function renderProducts(list) {
  const grid = document.getElementById('productGrid');

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">🔍</div>
        <h3>No products found</h3>
        <p>Try a different search term, or browse another category.</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map((p) => `
    <div class="product-card">
      <div class="product-seal" title="Verified">✓</div>
      <div class="product-emoji">${p.image_emoji || '📦'}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <p class="desc">${escapeHtml(p.short_description || '')}</p>
      <div class="product-footer">
        <div class="product-price">
          ${formatMoney(p.price_ngn, currency)}
          <span class="usd-approx">${formatUsdApprox(p.price_ngn)}</span>
        </div>
        <button class="btn btn-primary btn-sm buy-now-btn" data-slug="${p.slug}">Buy now</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.buy-now-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const target = `checkout.html?product=${encodeURIComponent(btn.dataset.slug)}`;
      if (!session) {
        window.location.href = `login.html?redirect=${encodeURIComponent(target)}`;
        return;
      }
      window.location.href = target;
    });
  });
}

async function init() {
  const categorySlug = qs('category');
  const searchTerm = qs('search');
  const titleEl = document.getElementById('pageTitle');
  const subtitleEl = document.getElementById('pageSubtitle');

  let query = supabaseClient.from('products').select('*, categories(name, slug)').eq('is_active', true);

  if (categorySlug) {
    const { data: category } = await supabaseClient.from('categories').select('*').eq('slug', categorySlug).single();
    if (category) {
      titleEl.textContent = category.name;
      subtitleEl.textContent = category.description || '';
      query = query.eq('category_id', category.id);
    } else {
      titleEl.textContent = 'Category not found';
    }
  } else if (searchTerm) {
    titleEl.textContent = `Search results for "${searchTerm}"`;
    subtitleEl.textContent = 'Across every category.';
    query = query.ilike('name', `%${searchTerm}%`);
  } else {
    titleEl.textContent = 'All products';
  }

  const { data: products, error } = await query.order('created_at', { ascending: false });

  if (error) {
    document.getElementById('productGrid').innerHTML = `<p style="color:var(--muted);">Couldn't load products.</p>`;
    return;
  }

  allProducts = products || [];
  renderProducts(allProducts);
}

// Client-side filter on top of whatever set was already loaded — this is
// the fast, no-round-trip "search filtering" layered on top of the DB query.
document.getElementById('filterInput').addEventListener('input', debounce((e) => {
  const term = e.target.value.trim().toLowerCase();
  if (!term) { renderProducts(allProducts); return; }
  const filtered = allProducts.filter((p) =>
    p.name.toLowerCase().includes(term) || (p.short_description || '').toLowerCase().includes(term)
  );
  renderProducts(filtered);
}, 200));

init();
