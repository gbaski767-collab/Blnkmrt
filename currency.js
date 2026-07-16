// ============================================================================
// Currency helpers
// ----------------------------------------------------------------------------
// The database stores every amount in NGN — that's the single source of
// truth (the "ledger currency"). USD is a DISPLAY-ONLY conversion using the
// static rate below. Swap EXCHANGE_RATE_USD_TO_NGN for a live FX API call in
// production; everywhere else in the app already reads from this one place.
// ============================================================================

const EXCHANGE_RATE_USD_TO_NGN = 1600; // demo rate — 1 USD = 1600 NGN

const CURRENCIES = {
  NGN: { code: 'NGN', symbol: '₦', flag: '🇳🇬', name: 'Naira' },
  USD: { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
};

function convertFromNGN(amountNgn, toCurrency) {
  if (toCurrency === 'USD') return amountNgn / EXCHANGE_RATE_USD_TO_NGN;
  return amountNgn;
}

function convertToNGN(amount, fromCurrency) {
  if (fromCurrency === 'USD') return amount * EXCHANGE_RATE_USD_TO_NGN;
  return amount;
}

// Formats a NGN-denominated amount for display in the given currency.
function formatMoney(amountNgn, currency = 'NGN') {
  const converted = convertFromNGN(amountNgn, currency);
  const symbol = CURRENCIES[currency]?.symbol ?? '';
  return `${symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// A small "(≈ $x.xx)" helper used next to NGN prices.
function formatUsdApprox(amountNgn) {
  return `≈ ${formatMoney(amountNgn, 'USD')}`;
}

// Lightweight, non-sensitive UI preference — not session/security data, so
// localStorage is the right, standard tool for it on a real deployed site.
function getPreferredCurrency() {
  return localStorage.getItem('bm_currency') || 'NGN';
}
function setPreferredCurrency(code) {
  localStorage.setItem('bm_currency', code);
}
