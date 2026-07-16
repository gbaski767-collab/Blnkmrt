// ============================================================================
// register.html — logic
// ============================================================================

redirectIfAuthed();
wirePasswordToggles();

const registerForm = document.getElementById('registerForm');
const registerSubmit = document.getElementById('registerSubmit');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  const confirmField = document.getElementById('confirmPassword').closest('.field');

  if (password !== confirmPassword) {
    confirmField.classList.add('has-error');
    showToast("Passwords don't match.", 'error');
    return;
  }
  confirmField.classList.remove('has-error');

  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  registerSubmit.disabled = true;
  registerSubmit.innerHTML = '<span class="spinner"></span> Creating account…';

  // full_name/phone travel in raw_user_meta_data — the handle_new_user()
  // trigger in schema.sql reads them to populate the profiles row.
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
  });

  if (error) {
    showToast(friendlyError(error), 'error');
    registerSubmit.disabled = false;
    registerSubmit.innerHTML = '<span class="btn-label">Create account</span>';
    return;
  }

  // If the Supabase project has "Confirm email" enabled, there is no active
  // session yet and the user must click the link in their inbox first.
  if (!data.session) {
    showToast('Account created — check your email to confirm it, then sign in.', 'success', 6000);
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    return;
  }

  showToast('Account created!', 'success');
  window.location.href = 'dashboard.html';
});
