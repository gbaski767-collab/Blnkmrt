// ============================================================================
// Shared navigation behavior
// Every page includes the same header + drawer markup (see any .html file's
// <body> opening section). This script wires it up: hamburger toggle, active
// link highlighting, and the auth-aware account block (guest vs signed-in).
// ============================================================================

(function initNav() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const drawer = document.getElementById('drawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerClose = document.getElementById('drawerClose');

  function openDrawer() {
    drawer.classList.add('is-open');
    drawerOverlay.classList.add('is-visible');
    hamburgerBtn.classList.add('is-open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawerOverlay.classList.remove('is-visible');
    hamburgerBtn.classList.remove('is-open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
  }

  hamburgerBtn?.addEventListener('click', () => {
    drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
  });
  drawerOverlay?.addEventListener('click', closeDrawer);
  drawerClose?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  // Highlight the current page's link in the drawer.
  const currentPage = (window.location.pathname.split('/').pop() || 'index.html').replace('.html', '');
  document.querySelectorAll('.drawer-links a[data-page]').forEach((link) => {
    if (link.dataset.page === currentPage) link.classList.add('is-active');
  });

  // Populate the account block based on auth state, and keep it in sync.
  async function renderAccountBlock() {
    const el = document.getElementById('drawerAccount');
    const logoutBtn = document.getElementById('logoutBtn');
    if (!el) return;

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      el.innerHTML = `
        <div class="guest-actions">
          <a href="login.html" class="btn btn-outline-gold btn-block btn-sm">Sign in</a>
          <a href="register.html" class="btn btn-primary btn-block btn-sm">Create account</a>
        </div>`;
      if (logoutBtn) logoutBtn.hidden = true;
      return;
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name, balance, default_currency')
      .eq('id', session.user.id)
      .single();

    const name = profile?.full_name || session.user.email.split('@')[0];
    const initial = name.charAt(0).toUpperCase();
    const currency = profile?.default_currency || getPreferredCurrency();
    const balanceText = formatMoney(profile?.balance || 0, currency);

    el.innerHTML = `
      <div class="authed-block">
        <div class="drawer-avatar">${initial}</div>
        <div>
          <div class="authed-name">${escapeHtml(name)}</div>
          <div class="authed-balance">${balanceText}</div>
        </div>
      </div>`;

    if (logoutBtn) {
      logoutBtn.hidden = false;
      logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
      };
    }
  }

  renderAccountBlock();
  supabaseClient.auth.onAuthStateChange(() => renderAccountBlock());
})();
