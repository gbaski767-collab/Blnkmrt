// ============================================================================
// Auth guards
// ============================================================================

// Call at the top of any protected page (dashboard, orders, checkout, etc).
// Resolves with the logged-in user, or redirects to login.html and resolves
// with null.
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    const here = (window.location.pathname.split('/').pop() || 'index.html') + window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent(here)}`;
    return null;
  }
  return session.user;
}

// Call at the top of login.html / register.html to bounce an already-logged
// in visitor straight to their dashboard.
async function redirectIfAuthed() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    window.location.href = 'dashboard.html';
  }
}
