// ============================================================================
// forgot-password.html — logic
// ----------------------------------------------------------------------------
// Email tab: REAL — uses Supabase Auth's built-in resetPasswordForEmail(),
// which sends an actual password-reset email out of the box.
//
// Phone tab: SIMULATED — Supabase phone auth requires a paid SMS provider
// (e.g. Twilio) to be configured on the project before it can send real
// texts. Without that configured, this tab generates a code client-side and
// displays it directly (clearly marked "DEMO") so the flow can be
// demonstrated end-to-end. Wire this up to a real SMS provider through
// Supabase's Phone Auth settings before relying on it in production.
// ============================================================================

wirePasswordToggles();

const tabEmailBtn = document.getElementById('tabEmailBtn');
const tabPhoneBtn = document.getElementById('tabPhoneBtn');
const emailForm = document.getElementById('emailResetForm');
const phoneForm = document.getElementById('phoneResetForm');

tabEmailBtn.addEventListener('click', () => {
  tabEmailBtn.className = 'btn btn-outline-gold btn-sm';
  tabPhoneBtn.className = 'btn btn-ghost btn-sm';
  emailForm.classList.remove('hidden');
  phoneForm.classList.add('hidden');
});
tabPhoneBtn.addEventListener('click', () => {
  tabPhoneBtn.className = 'btn btn-outline-gold btn-sm';
  tabEmailBtn.className = 'btn btn-ghost btn-sm';
  phoneForm.classList.remove('hidden');
  emailForm.classList.add('hidden');
});

// ---- Email flow (real) ----
emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('resetEmail').value.trim();
  const submitBtn = document.getElementById('emailResetSubmit');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Sending…';

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname.replace('forgot-password.html', 'login.html'),
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Send reset link';

  if (error) {
    showToast(friendlyError(error), 'error');
    return;
  }
  showToast('If that email is registered, a reset link is on its way.', 'success', 5000);
});

// ---- Phone flow (simulated demo OTP) ----
let demoOtp = null;

// The phone form has no single natural submit action (it has two sequential
// steps with their own buttons below), so prevent a stray Enter keypress
// from reloading the page.
phoneForm.addEventListener('submit', (e) => e.preventDefault());

document.getElementById('sendCodeBtn').addEventListener('click', () => {
  const phone = document.getElementById('resetPhone').value.trim();
  if (!phone) {
    showToast('Enter a phone number first.', 'error');
    return;
  }

  demoOtp = String(Math.floor(100000 + Math.random() * 900000));

  document.getElementById('phoneStep1').classList.add('hidden');
  document.getElementById('phoneStep2').classList.remove('hidden');

  // DEMO ONLY — a real implementation sends this via an SMS provider and
  // never exposes it client-side.
  showToast(`[DEMO MODE] Your verification code is ${demoOtp}`, 'info', 8000);
});

document.getElementById('verifyCodeBtn').addEventListener('click', () => {
  const entered = document.getElementById('otpCode').value.trim();
  const newPassword = document.getElementById('newPhonePassword').value;

  if (entered !== demoOtp) {
    showToast('Incorrect code. Please try again.', 'error');
    return;
  }
  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  // There is no real authenticated session in this demo phone flow, so we
  // cannot actually call auth.updateUser() here — that requires the user to
  // be signed in. This confirms the demo flow only; connect Supabase Phone
  // Auth + an SMS provider to make this a real password reset.
  showToast('Demo verified — connect Supabase Phone Auth to make this reset real.', 'success', 6000);
});
