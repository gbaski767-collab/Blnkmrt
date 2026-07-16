// ============================================================================
// dashboard.html — logic
// ============================================================================

let currentUser = null;
let currentProfile = null;
let displayCurrency = getPreferredCurrency();

const ICONS = { bank_transfer: '🏦', crypto_usdt: '₮', wallet: '🛒' };

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('full_name, balance, default_currency')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    showToast(friendlyError(error), 'error');
    return;
  }

  currentProfile = profile;
  displayCurrency = profile.default_currency || displayCurrency;
  document.getElementById('currencySelect').value = displayCurrency;
  document.getElementById('currencyFlag').textContent = CURRENCIES[displayCurrency].flag;

  const name = profile.full_name || currentUser.email.split('@')[0];
  document.getElementById('greeting').textContent = `Welcome back, ${name}`;

  renderBalance();
  loadStats();
  loadTransactions();
}

function renderBalance() {
  document.getElementById('balanceAmount').textContent = formatMoney(currentProfile.balance, displayCurrency);
}

document.getElementById('currencySelect').addEventListener('change', async (e) => {
  displayCurrency = e.target.value;
  document.getElementById('currencyFlag').textContent = CURRENCIES[displayCurrency].flag;
  setPreferredCurrency(displayCurrency);
  renderBalance();
  loadStats();
  loadTransactions();

  // Persist as the user's account-wide preference too (allowed column).
  await supabaseClient.from('profiles').update({ default_currency: displayCurrency }).eq('id', currentUser.id);
});

async function loadStats() {
  const { count: orderCount } = await supabaseClient
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', currentUser.id);

  const { data: deposits } = await supabaseClient
    .from('transactions')
    .select('amount_ngn')
    .eq('user_id', currentUser.id)
    .eq('type', 'deposit')
    .eq('status', 'completed');

  const totalDepositedNgn = (deposits || []).reduce((sum, d) => sum + Number(d.amount_ngn), 0);

  document.getElementById('statOrders').textContent = orderCount ?? 0;
  document.getElementById('statDeposits').textContent = formatMoney(totalDepositedNgn, displayCurrency);
}

async function loadTransactions() {
  const card = document.getElementById('transactionsCard');
  const { data: txns, error } = await supabaseClient
    .from('transactions')
    .select('*, orders(product_name)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) {
    card.innerHTML = `<p style="color:var(--muted);font-size:0.9rem;">Couldn't load transactions.</p>`;
    return;
  }

  if (!txns || txns.length === 0) {
    card.innerHTML = `
      <div class="empty-state" style="padding:30px 10px;">
        <div class="empty-icon">🧾</div>
        <h3>No transactions yet</h3>
        <p>Add funds or make a purchase to see your activity here.</p>
      </div>`;
    return;
  }

  card.innerHTML = txns.map((t) => {
    const isDeposit = t.type === 'deposit';
    const title = isDeposit
      ? `Wallet top-up — ${t.method === 'bank_transfer' ? 'Bank Transfer' : 'Crypto USDT'}`
      : `Purchase — ${escapeHtml(t.orders?.product_name || 'Product')}`;
    const icon = isDeposit ? ICONS[t.method] : ICONS.wallet;
    const amountClass = isDeposit ? 'positive' : 'negative';
    const sign = isDeposit ? '+' : '−';

    return `
      <div class="txn-row">
        <div class="txn-left">
          <div class="txn-icon">${icon}</div>
          <div>
            <div class="txn-title">${title}</div>
            <div class="txn-date">${formatDate(t.created_at)}</div>
          </div>
        </div>
        <div class="txn-amount ${amountClass}">${sign}${formatMoney(t.amount_ngn, displayCurrency)}</div>
      </div>`;
  }).join('');
}

// ============================================================================
// Add Funds modal
// ============================================================================
const overlay = document.getElementById('addFundsOverlay');
const step1 = document.getElementById('fundsStep1');
const step2 = document.getElementById('fundsStep2');
let pendingAmountNgn = 0;
let pendingMethod = 'bank_transfer';
let pendingReference = '';

function openModal() {
  step1.classList.remove('hidden');
  step2.classList.add('hidden');
  document.getElementById('fundsAmount').value = '';
  overlay.classList.add('is-open');
}
function closeModal() { overlay.classList.remove('is-open'); }

document.getElementById('openAddFundsBtn').addEventListener('click', openModal);
document.getElementById('closeAddFundsBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

// Keep the visual "selected" state of the payment-method cards in sync with
// the underlying radio inputs.
document.querySelectorAll('input[name="fundsMethod"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.pay-method').forEach((el) => el.classList.remove('is-selected'));
    radio.closest('.pay-method').classList.add('is-selected');
  });
});

document.getElementById('continueFundsBtn').addEventListener('click', () => {
  const amountInput = parseFloat(document.getElementById('fundsAmount').value);
  const currency = document.getElementById('fundsCurrency').value;
  const method = document.querySelector('input[name="fundsMethod"]:checked').value;

  if (!amountInput || amountInput <= 0) {
    showToast('Enter an amount greater than zero.', 'error');
    return;
  }

  pendingAmountNgn = convertToNGN(amountInput, currency);
  pendingMethod = method;
  pendingReference = generateReference();

  const instructionsEl = document.getElementById('fundsInstructions');

  if (method === 'bank_transfer') {
    instructionsEl.innerHTML = `
      <div class="deposit-instructions">
        <div class="di-row"><span class="di-label">Bank</span><span class="di-value">BlankMarket Demo Bank</span></div>
        <div class="di-row"><span class="di-label">Account number</span><span class="di-value">0000000000</span></div>
        <div class="di-row"><span class="di-label">Account name</span><span class="di-value">BlankMarket Ltd</span></div>
        <div class="di-row"><span class="di-label">Amount</span><span class="di-value">${formatMoney(pendingAmountNgn, 'NGN')}</span></div>
        <div class="di-row"><span class="di-label">Reference</span><span class="di-value">${pendingReference}</span></div>
      </div>
      <p class="field-hint mt-16">Placeholder account details — replace with your real merchant account or a payment gateway (e.g. Paystack/Flutterwave) before launch. Include the reference in your transfer narration.</p>`;
  } else {
    const usdtAmount = convertFromNGN(pendingAmountNgn, 'USD');
    instructionsEl.innerHTML = `
      <div class="deposit-instructions">
        <div class="di-row"><span class="di-label">Network</span><span class="di-value">TRC20 (USDT)</span></div>
        <div class="di-row"><span class="di-label">Address</span><span class="di-value" style="word-break:break-all;">DEMO-TRC20-ADDRESS-REPLACE-ME</span></div>
        <div class="di-row"><span class="di-label">Amount</span><span class="di-value">${usdtAmount.toFixed(2)} USDT</span></div>
        <div class="di-row"><span class="di-label">Reference</span><span class="di-value">${pendingReference}</span></div>
      </div>
      <p class="field-hint mt-16">Placeholder address — replace with your real wallet address or a crypto payment processor before launch.</p>`;
  }

  step1.classList.add('hidden');
  step2.classList.remove('hidden');
});

document.getElementById('backFundsBtn').addEventListener('click', () => {
  step2.classList.add('hidden');
  step1.classList.remove('hidden');
});

document.getElementById('confirmFundsBtn').addEventListener('click', async () => {
  const btn = document.getElementById('confirmFundsBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Crediting wallet…';

  const { data, error } = await supabaseClient.rpc('add_funds', {
    p_amount_ngn: pendingAmountNgn,
    p_method: pendingMethod,
    p_reference: pendingReference,
  });

  btn.disabled = false;
  btn.innerHTML = '<span class="btn-label">I\'ve sent the payment</span>';

  if (error) {
    showToast(friendlyError(error), 'error');
    return;
  }

  showToast('Funds added to your wallet!', 'success');
  closeModal();

  currentProfile.balance = Number(currentProfile.balance) + Number(pendingAmountNgn);
  renderBalance();
  loadStats();
  loadTransactions();
});

init();
