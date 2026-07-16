// ============================================================================
// General utilities
// ============================================================================

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function generateReference() {
  return 'BM-' + Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString().slice(-4);
}

function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// Wires up every .password-toggle button on the page: clicking it flips its
// target <input> between type="password" and type="text" and swaps the icon.
const EYE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function wirePasswordToggles() {
  document.querySelectorAll('.password-toggle').forEach((btn) => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    btn.innerHTML = EYE_ICON;
    btn.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });
}

// Wires up .accordion-item / .accordion-trigger pairs already present in the
// DOM. Call again after dynamically injecting new accordion items (e.g. the
// orders list) since it only binds elements that exist at call time.
function wireAccordions(container = document) {
  container.querySelectorAll('.accordion-trigger').forEach((trigger) => {
    if (trigger.dataset.wired) return;
    trigger.dataset.wired = 'true';
    trigger.addEventListener('click', () => {
      trigger.closest('.accordion-item').classList.toggle('is-open');
    });
  });
}

// Category icon lookup — small emoji set keyed to the `icon` column so we
// don't need an image asset pipeline for a vanilla-JS demo project.
const CATEGORY_ICONS = {
  key: '🗝️',
  book: '📚',
  gift: '🎁',
  palette: '🎨',
  users: '👥',
  box: '📦',
};
