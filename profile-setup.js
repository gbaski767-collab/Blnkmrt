// ============================================================================
// profile-setup.html — logic
// ============================================================================

wirePasswordToggles();
wireAccordions();

let profileUser = null;

async function init() {
  profileUser = await requireAuth();
  if (!profileUser) return;

  document.getElementById('email').value = profileUser.email;

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('full_name, phone, default_currency')
    .eq('id', profileUser.id)
    .single();

  if (error) {
    showToast(friendlyError(error), 'error');
    return;
  }

  document.getElementById('fullName').value = profile.full_name || '';
  document.getElementById('phone').value = profile.phone || '';
  document.getElementById('defaultCurrency').value = profile.default_currency || 'NGN';
}

// ---- Personal info ----
document.getElementById('personalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('savePersonalBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  const { error } = await supabaseClient
    .from('profiles')
    .update({
      full_name: document.getElementById('fullName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
    })
    .eq('id', profileUser.id);

  btn.disabled = false;
  btn.textContent = 'Save changes';

  if (error) { showToast(friendlyError(error), 'error'); return; }
  showToast('Profile updated.', 'success');
});

// ---- Change password ----
// The Supabase JS SDK has no direct "verify current password" call, so we
// re-authenticate with signInWithPassword() using the entered old password.
// If that succeeds, we know it was correct, and can safely call
// auth.updateUser() to set the new one.
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmNewPassword = document.getElementById('confirmNewPassword').value;

  if (newPassword !== confirmNewPassword) {
    showToast("New passwords don't match.", 'error');
    return;
  }
  if (newPassword.length < 6) {
    showToast('New password must be at least 6 characters.', 'error');
    return;
  }

  const btn = document.getElementById('savePasswordBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Updating…';

  const { error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: profileUser.email,
    password: oldPassword,
  });

  if (signInError) {
    btn.disabled = false;
    btn.textContent = 'Update password';
    showToast('Current password is incorrect.', 'error');
    return;
  }

  const { error: updateError } = await supabaseClient.auth.updateUser({ password: newPassword });

  btn.disabled = false;
  btn.textContent = 'Update password';

  if (updateError) { showToast(friendlyError(updateError), 'error'); return; }

  document.getElementById('passwordForm').reset();
  showToast('Password updated.', 'success');
});

// ---- Preferences ----
document.getElementById('savePrefsBtn').addEventListener('click', async () => {
  const currency = document.getElementById('defaultCurrency').value;
  setPreferredCurrency(currency);

  const { error } = await supabaseClient
    .from('profiles')
    .update({ default_currency: currency })
    .eq('id', profileUser.id);

  if (error) { showToast(friendlyError(error), 'error'); return; }
  showToast('Preference saved.', 'success');
});

init();
