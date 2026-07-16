// ============================================================================
// marketplace.html — logic
// ============================================================================

document.getElementById('marketSearchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const query = document.getElementById('marketSearchInput').value.trim();
  if (query) {
    window.location.href = `sub-products.html?search=${encodeURIComponent(query)}`;
  }
});

async function loadCategories() {
  const grid = document.getElementById('categoryGrid');
  const { data: categories, error } = await supabaseClient
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !categories || categories.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">📭</div>
        <h3>No categories yet</h3>
        <p>Run supabase/schema.sql to populate the catalog.</p>
      </div>`;
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

loadCategories();
