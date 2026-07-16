// ============================================================================
// login.html — logic
// ============================================================================

redirectIfAuthed();
wirePasswordToggles();

const loginForm = document.getElementById('loginForm');
const loginSubmit = document.getElementById('loginSubmit');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showToast('Please fill in both fields.', 'error');
    return;
  }

  loginSubmit.disabled = true;
  loginSubmit.innerHTML = '<span class="spinner"></span> Signing in…';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showToast(friendlyError(error), 'error');
    loginSubmit.disabled = false;
    loginSubmit.innerHTML = '<span class="btn-label">Sign in</span>';
    return;
  }

  showToast('Welcome back!', 'success');
  const redirect = qs('redirect') || 'dashboard.html';
  window.location.href = redirect;
});
