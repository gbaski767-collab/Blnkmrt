// ============================================================================
// index.html — homepage logic
// ============================================================================

// Search bar just hands off to the marketplace's product listing page.
document.getElementById('heroSearchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const query = document.getElementById('heroSearchInput').value.trim();
  if (query) {
    window.location.href = `sub-products.html?search=${encodeURIComponent(query)}`;
  } else {
    window.location.href = 'marketplace.html';
  }
});

async function loadTicker() {
  const track = document.getElementById('tickerTrack');
  const [{ count: categoryCount }, { count: productCount }] = await Promise.all([
    supabaseClient.from('categories').select('*', { count: 'exact', head: true }),
    supabaseClient.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  const items = [
    { value: `${categoryCount ?? 5}`, label: 'verified categories' },
    { value: `${productCount ?? 20}`, label: 'digital products live' },
    { value: 'Instant', label: 'delivery on every order' },
    { value: 'NGN / USD', label: 'multi-currency pricing' },
    { value: 'Secure', label: 'wallet checkout' },
    { value: '24/7', label: 'automated fulfillment' },
  ];

  const renderItems = (list) => list.map(
    (i) => `<div class="ticker-item"><span class="t-value">${i.value}</span><span>${i.label}</span></div>`
  ).join('');

  // Duplicate the list once so the marquee can loop seamlessly at -50%.
  track.innerHTML = renderItems(items) + renderItems(items);
}

async function loadFeatured() {
  const wrap = document.getElementById('featuredWrap');

  let { data: products } = await supabaseClient
    .from('products')
    .select('*, categories(name, slug)')
    .eq('is_active', true)
    .eq('is_featured', true)
    .limit(1);

  if (!products || products.length === 0) {
    const fallback = await supabaseClient
      .from('products')
      .select('*, categories(name, slug)')
      .eq('is_active', true)
      .limit(1);
    products = fallback.data;
  }

  if (!products || products.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🛍️</div><h3>Catalog is warming up</h3><p>Products will appear here once they're added to the database.</p></div>`;
    return;
  }

  const p = products[0];
  const currency = getPreferredCurrency();

  wrap.innerHTML = `
    <div class="featured-card">
      <div class="featured-visual">${p.image_emoji || '📦'}</div>
      <div class="featured-body">
        <span class="featured-badge">Featured</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.short_description || '')}</p>
        <div class="featured-price">${formatMoney(p.price_ngn, currency)} <span style="font-size:0.9rem;color:var(--muted-2);font-weight:400;">${formatUsdApprox(p.price_ngn)}</span></div>
        <a href="sub-products.html?category=${encodeURIComponent(p.categories?.slug || '')}" class="btn btn-primary">View in ${escapeHtml(p.categories?.name || 'marketplace')}</a>
      </div>
    </div>`;
}

async function loadCategoryTeaser() {
  const grid = document.getElementById('categoryGrid');
  const { data: categories, error } = await supabaseClient
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !categories || categories.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h3>No categories yet</h3><p>Run the schema.sql seed data to populate the catalog.</p></div>`;
    return;
  }

  grid.innerHTML = categories.map((c) => `
    <a href="sub-products.html?category=${encodeURIComponent(c.slug)}" class="category-card">
      <div class="cat-icon">${CATEGORY_ICONS[c.icon] || '📦'}</div>
      <h3>${escapeHtml(c.name)}</h3>
      <p>${escapeHtml(c.description || '')}</p>
    </a>
  `).join('');
}

loadTicker();
loadFeatured();
loadCategoryTeaser();
