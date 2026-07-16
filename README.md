# BlankMarket

A premium, dark-and-gold marketplace for digital goods — software licenses,
e-books & courses, gift cards, design templates, and official subscription
group-plan slots. Vanilla HTML/CSS/JS front end, Supabase (Postgres + Auth)
back end.

## What's inside

```
blankmarket/
├── index.html              Hero, search, stats ticker, featured product
├── login.html               Sign in
├── register.html             Create account
├── forgot-password.html      Email reset (real) + phone OTP (simulated demo)
├── dashboard.html             Balance, currency switcher, Add Funds, transactions
├── profile-setup.html          Personal info, change password, preferences
├── marketplace.html             Category grid
├── sub-products.html             Product listings, filtering, Buy Now
├── checkout.html                  Order summary, wallet balance check, pay
├── orders.html                     Order history
├── order-success.html               Post-purchase confirmation + code reveal
├── css/style.css                     Design system (dark/gold theme)
├── js/                                 One file per page + shared helpers
└── supabase/schema.sql                  Full DB schema, RLS, functions, seed data
```

## Setup (10 minutes)

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Run the schema.** Open the SQL Editor and paste the entire contents of
   `supabase/schema.sql`, then run it. This creates every table, security
   policy, function, and ~20 seed products across 5 categories.
3. **Connect the front end.** In `js/supabaseClient.js`, replace:
   ```js
   const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
   ```
   with the values from Project Settings → API.
4. **Auth settings.** In Authentication → Providers, Email is on by default.
   If you don't want new users to confirm their email before logging in,
   turn off "Confirm email" under Authentication → Settings — otherwise the
   register flow will ask them to check their inbox first (this is handled
   in `js/register.js` either way).
5. **Serve the files.** Any static file server works — e.g. `npx serve .`,
   a GitHub Pages deploy, or Netlify/Vercel static hosting. There's no build
   step.

## How the money side works

- **Ledger currency:** every amount is stored in NGN in Postgres. USD is a
  **display-only** conversion using a fixed rate in `js/currency.js`
  (`EXCHANGE_RATE_USD_TO_NGN`). Swap that constant for a live FX API call
  before relying on it in production.
- **Balance security:** the `authenticated` Postgres role has no `UPDATE`
  grant on `profiles.balance` — see the `revoke`/`grant` statements in
  `schema.sql`. Balance only ever changes inside two `SECURITY DEFINER`
  functions, `add_funds()` and `purchase_product()`, which run with the
  function owner's privileges. A user can't set their own balance from
  devtools.
- **Add Funds is simulated.** Both Bank Transfer and Crypto (USDT) credit the
  wallet immediately after the user clicks "I've sent the payment," so the
  whole add-funds → checkout → order flow is testable end-to-end without a
  real payment processor. Before launch:
  - Replace the placeholder bank account and USDT address in
    `js/dashboard.js` (`fundsInstructions`) with your real merchant account
    or a payment gateway (Paystack/Flutterwave for NGN, a crypto payment
    processor for USDT).
  - Change `add_funds()` in `schema.sql` to insert a `'pending'` transaction
    instead of crediting instantly, and only mark it `'completed'` (and bump
    the balance) from a server-side webhook once the payment is actually
    confirmed.
- **Phone OTP is simulated.** Supabase Phone Auth requires a paid SMS
  provider (e.g. Twilio) to send real texts. Until that's configured, the
  phone tab on `forgot-password.html` generates a demo code and shows it
  directly in a toast, clearly labeled `[DEMO MODE]`. The **email** reset tab
  is real — it uses Supabase's built-in `resetPasswordForEmail()`.

## Digital delivery

Every product has a pool of codes in `product_codes` (license keys, gift
card codes, or access links — seeded with demo values). `purchase_product()`
atomically claims one unused row per sale (`FOR UPDATE SKIP LOCKED`, so
concurrent buyers never get the same code), attaches it to the order, and
marks it used. Top up real inventory by inserting more rows into
`product_codes` for a given `product_id`.

## Row Level Security summary

| Table | Who can read | Who can write |
|---|---|---|
| `profiles` | Owner only | Owner (name/phone/currency only) + RPCs (balance) |
| `categories`, `products` | Everyone (public catalog) | Nobody from the client |
| `product_codes` | Nobody directly | Only via `purchase_product()` |
| `orders`, `transactions` | Owner only | Only via `add_funds()` / `purchase_product()` |

## Customizing the catalog

Products, categories, and starting inventory all live in the seed section at
the bottom of `schema.sql`. Add, edit, or remove `insert into public.products
(...)` blocks and re-run just that section — or manage the catalog through
the Supabase Table Editor once it's live.
