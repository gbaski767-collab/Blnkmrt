// ============================================================================
// Toast notifications
// Every page includes: <div id="toast-container" class="toast-container"></div>
// ============================================================================

function showToast(message, type = 'info', duration = 3800) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// Reads a friendly message out of a Supabase/Postgres error.
function friendlyError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const msg = error.message || String(error);

  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('User already registered')) return 'An account with this email already exists.';
  if (msg.includes('Insufficient balance')) return 'Your wallet balance is too low for this purchase.';
  if (msg.includes('Out of stock')) return 'This item just sold out. Please check back soon.';
  if (msg.includes('Password should be at least')) return 'Password must be at least 6 characters.';
  return msg;
}
