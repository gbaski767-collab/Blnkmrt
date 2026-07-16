-- ============================================================================
-- BlankMarket — Supabase Database Schema
-- ============================================================================
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New Query.
-- It creates every table, security policy, and function the app needs.
--
-- Ledger currency: every money value is stored in NGN (Nigerian Naira),
-- kobo-free (i.e. plain decimal Naira, e.g. 15000.00). USD is a DISPLAY-ONLY
-- conversion done in the front end (see js/currency.js) using a fixed demo
-- exchange rate. This keeps the ledger unambiguous and avoids rounding drift
-- between two stored currencies. Swap in a live FX API before production.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES — one row per auth user. Created automatically on sign up.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  default_currency text not null default 'NGN' check (default_currency in ('NGN', 'USD')),
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can only ever see or touch their own profile row.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Column-level grants: authenticated users may UPDATE their own profile, but
-- NOT the `balance` column directly. Balance can only change through the
-- security-definer functions below (add_funds / purchase_product), which run
-- with elevated privileges. This is what actually prevents a user from
-- opening devtools and setting their own balance to a billion Naira.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, default_currency) on public.profiles to authenticated;

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 2. CATEGORIES — product categories shown on marketplace.html
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon text not null default 'box',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

-- Categories are public catalog data — anyone (even signed-out visitors) can
-- browse the marketplace, but only the schema/admin can write to it.
create policy "categories_select_all"
  on public.categories for select
  using (true);


-- ----------------------------------------------------------------------------
-- 3. PRODUCTS — items for sale within a category
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  slug text unique not null,
  short_description text,
  full_description text,
  price_ngn numeric(14, 2) not null check (price_ngn > 0),
  image_emoji text default '📦', -- lightweight stand-in for a product image
  is_active boolean not null default true,
  is_featured boolean not null default false,
  delivery_type text not null default 'code' check (delivery_type in ('code', 'link')),
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "products_select_active"
  on public.products for select
  using (is_active = true);


-- ----------------------------------------------------------------------------
-- 4. PRODUCT CODES — the actual digital inventory (license keys, gift card
--    codes, course access links, etc). One row is claimed per unit sold.
-- ----------------------------------------------------------------------------
create table if not exists public.product_codes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  code text not null,
  is_used boolean not null default false,
  order_id uuid,
  created_at timestamptz not null default now()
);

alter table public.product_codes enable row level security;
-- No public select policy: codes are only ever revealed to their buyer,
-- through the `orders` row that references them (see purchase_product below).
-- The client never queries this table directly.


-- ----------------------------------------------------------------------------
-- 5. ORDERS — one row per completed (or failed) purchase
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_name text not null,       -- denormalized snapshot at time of purchase
  unit_price_ngn numeric(14, 2) not null,
  quantity int not null default 1 check (quantity > 0),
  total_ngn numeric(14, 2) not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  delivered_code text,              -- the license key / gift card code / link handed to the buyer
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = user_id);

-- No insert/update policy for the authenticated role: orders are only ever
-- created by the purchase_product() function below, which runs as
-- security definer and bypasses this restriction intentionally.


-- ----------------------------------------------------------------------------
-- 6. TRANSACTIONS — wallet ledger: deposits and purchases
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('deposit', 'purchase')),
  amount_ngn numeric(14, 2) not null,
  method text not null check (method in ('bank_transfer', 'crypto_usdt', 'wallet')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  reference text not null,
  order_id uuid references public.orders (id),
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

-- Same as orders: writes only happen via the functions below.


-- ============================================================================
-- SECURE RPC FUNCTIONS
-- These are the only way balance can move. Both are SECURITY DEFINER, so they
-- run with the privileges of the function owner (not the calling user) and
-- can update columns the `authenticated` role has no direct grant on.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- add_funds: credits a user's wallet after a deposit.
--
-- DEMO BEHAVIOUR: this credits the balance immediately so the add-funds →
-- credit balance → checkout flow is fully testable end-to-end. In a real
-- deployment, swap the "instant credit" section for inserting a 'pending'
-- transaction, and only flip it to 'completed' (and increment balance) from
-- a webhook handler once Paystack/Flutterwave (bank transfer) or a crypto
-- payment processor (USDT) confirms the payment server-side.
-- ----------------------------------------------------------------------------
create or replace function public.add_funds(
  p_amount_ngn numeric,
  p_method text,
  p_reference text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.transactions;
begin
  if p_amount_ngn <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_method not in ('bank_transfer', 'crypto_usdt') then
    raise exception 'Invalid payment method';
  end if;

  update public.profiles
  set balance = balance + p_amount_ngn
  where id = auth.uid();

  insert into public.transactions (user_id, type, amount_ngn, method, status, reference)
  values (auth.uid(), 'deposit', p_amount_ngn, p_method, 'completed', p_reference)
  returning * into v_txn;

  return v_txn;
end;
$$;

grant execute on function public.add_funds(numeric, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- purchase_product: atomically checks stock + balance, deducts the wallet,
-- claims one unused product_codes row, and writes the order + transaction.
-- ----------------------------------------------------------------------------
create or replace function public.purchase_product(
  p_product_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_balance numeric(14, 2);
  v_code_row public.product_codes;
  v_order public.orders;
  v_reference text;
begin
  select * into v_product from public.products where id = p_product_id and is_active = true;
  if not found then
    raise exception 'Product not available';
  end if;

  select balance into v_balance from public.profiles where id = auth.uid() for update;
  if v_balance < v_product.price_ngn then
    raise exception 'Insufficient balance';
  end if;

  -- Claim one unused code row for this product, skipping rows another
  -- concurrent purchase may already be locking.
  select * into v_code_row
  from public.product_codes
  where product_id = p_product_id and is_used = false
  for update skip locked
  limit 1;

  if not found then
    raise exception 'Out of stock';
  end if;

  update public.profiles
  set balance = balance - v_product.price_ngn
  where id = auth.uid();

  v_reference := 'BM-' || upper(substr(md5(random()::text), 1, 10));

  insert into public.orders (
    user_id, product_id, product_name, unit_price_ngn, quantity, total_ngn, status, delivered_code
  ) values (
    auth.uid(), v_product.id, v_product.name, v_product.price_ngn, 1, v_product.price_ngn, 'completed', v_code_row.code
  )
  returning * into v_order;

  update public.product_codes
  set is_used = true, order_id = v_order.id
  where id = v_code_row.id;

  insert into public.transactions (user_id, type, amount_ngn, method, status, reference, order_id)
  values (auth.uid(), 'purchase', v_product.price_ngn, 'wallet', 'completed', v_reference, v_order.id);

  return v_order;
end;
$$;

grant execute on function public.purchase_product(uuid) to authenticated;


-- ============================================================================
-- SEED DATA — 5 categories, ~4 products each, a handful of demo codes per
-- product so the purchase flow works end-to-end out of the box.
-- ============================================================================
insert into public.categories (slug, name, description, icon, sort_order) values
  ('software', 'Software & Licenses', 'Genuine license codes for productivity, security and design tools.', 'key', 1),
  ('courses', 'E-Books & Courses', 'Self-paced guides and video courses across tech, business and design.', 'book', 2),
  ('gift-cards', 'Gift Cards', 'Instant-delivery gift cards for the platforms you already use.', 'gift', 3),
  ('templates', 'Digital Art & Templates', 'Ready-to-edit design assets for creators and small businesses.', 'palette', 4),
  ('subscriptions', 'Subscription & Group Plans', 'Official multi-user plan slots at a shared, lower price.', 'users', 5)
on conflict (slug) do nothing;

-- Software & Licenses
insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, is_featured, delivery_type)
select id, 'NovaSuite Office Pro — 1 Year', 'novasuite-office-pro-1y', 'Full productivity suite, 1 device, 1 year.', 'Docs, sheets, slides and cloud sync for one device, activated instantly with your own account.', 42000, '🗝️', true, 'code' from public.categories where slug = 'software'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'ShieldGuard Antivirus Total', 'shieldguard-antivirus-total', 'Real-time protection for up to 3 devices.', 'Malware, ransomware and phishing protection with a 1-year license for up to 3 devices.', 18500, '🛡️', 'code' from public.categories where slug = 'software'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'PixelForge Design Studio', 'pixelforge-design-studio', 'Vector + raster design app, 1-year license.', 'Professional design software license for illustration, layout and photo editing.', 35000, '🎨', 'code' from public.categories where slug = 'software'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'VaultKey Password Manager Pro', 'vaultkey-password-manager', 'Encrypted password vault, 1-year license.', 'Cross-device encrypted vault with autofill and breach monitoring, 1-year license key.', 12000, '🔐', 'code' from public.categories where slug = 'software'
on conflict (slug) do nothing;

-- E-Books & Courses
insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, is_featured, delivery_type)
select id, 'Freelancing From Zero — Video Course', 'freelancing-from-zero', 'Full course access link, lifetime.', '6-hour video course on landing and delivering freelance work, with lifetime access link.', 15000, '💻', true, 'link' from public.categories where slug = 'courses'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'The Product Design Handbook (E-Book)', 'product-design-handbook', 'PDF + EPUB download link.', 'A practical, 220-page guide to product design fundamentals and portfolio building.', 8500, '📘', 'link' from public.categories where slug = 'courses'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'Personal Finance Starter Kit', 'personal-finance-starter-kit', 'E-book + budget templates, instant link.', 'A beginner-friendly guide to budgeting and saving, bundled with editable spreadsheet templates.', 6000, '📗', 'link' from public.categories where slug = 'courses'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'Digital Marketing Bootcamp', 'digital-marketing-bootcamp', 'Full video course, lifetime access link.', 'A 10-module bootcamp covering social, SEO and paid ads fundamentals.', 22000, '📈', 'link' from public.categories where slug = 'courses'
on conflict (slug) do nothing;

-- Gift Cards
insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, is_featured, delivery_type)
select id, 'Amazon Gift Card — $25', 'amazon-gift-card-25', 'Instant code delivery.', 'A $25 Amazon US gift card code, delivered instantly to your order.', 41000, '🛍️', true, 'code' from public.categories where slug = 'gift-cards'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'Steam Wallet Code — $20', 'steam-wallet-20', 'Instant code delivery.', 'A $20 Steam Wallet code for games, DLC and in-game purchases.', 33000, '🎮', 'code' from public.categories where slug = 'gift-cards'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'Google Play Gift Card — $15', 'google-play-15', 'Instant code delivery.', 'A $15 Google Play code redeemable for apps, games and subscriptions.', 25000, '▶️', 'code' from public.categories where slug = 'gift-cards'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'iTunes Gift Card — $25', 'itunes-gift-card-25', 'Instant code delivery.', 'A $25 iTunes/App Store gift card code, delivered instantly.', 41500, '🎵', 'code' from public.categories where slug = 'gift-cards'
on conflict (slug) do nothing;

-- Digital Art & Templates
insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, is_featured, delivery_type)
select id, 'Canva Template Pack — Social Media (50 designs)', 'canva-social-pack-50', 'Editable Canva link, instant access.', '50 editable Canva templates for Instagram and Facebook posts and stories.', 9000, '🖼️', true, 'link' from public.categories where slug = 'templates'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'UI Kit — Mobile App Screens (Figma)', 'ui-kit-mobile-figma', 'Figma file link, instant access.', 'A 120-screen mobile UI kit in Figma, organized into ready-to-use components.', 17500, '📱', 'link' from public.categories where slug = 'templates'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'Stock Photo Bundle — Business & Lifestyle', 'stock-photo-bundle', 'Download link, 300 images.', '300 high-resolution stock photos for marketing, decks and websites.', 14000, '📸', 'link' from public.categories where slug = 'templates'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'Pitch Deck Template (PowerPoint + Keynote)', 'pitch-deck-template', 'Download link, instant access.', 'A 20-slide investor pitch deck template, fully editable and brand-ready.', 11000, '📊', 'link' from public.categories where slug = 'templates'
on conflict (slug) do nothing;

-- Subscription & Group Plans
insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, is_featured, delivery_type)
select id, 'Spotify Duo Slot — 1 Month', 'spotify-duo-slot-1m', 'Official 2-person plan, 1 slot.', 'A shared slot on an official Spotify Duo plan, invited directly through Spotify, 1-month access.', 3500, '🎧', true, 'link' from public.categories where slug = 'subscriptions'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'YouTube Premium Family Slot — 1 Month', 'youtube-premium-family-1m', 'Official family plan, 1 slot.', 'A shared slot on an official YouTube Premium family plan, ad-free with background play, 1-month access.', 3000, '📺', 'link' from public.categories where slug = 'subscriptions'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'Cloud Storage Plan — 2TB / 1 Month', 'cloud-storage-2tb-1m', 'Shared family storage plan, 1 slot.', 'A shared slot on an official 2TB cloud storage family plan, 1-month access.', 4500, '☁️', 'link' from public.categories where slug = 'subscriptions'
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, short_description, full_description, price_ngn, image_emoji, delivery_type)
select id, 'Cloud Gaming Pass — 1 Month', 'cloud-gaming-pass-1m', 'Individual official pass, 1 month.', 'A 1-month cloud gaming subscription pass code, redeemed on your own account.', 9500, '🕹️', 'code' from public.categories where slug = 'subscriptions'
on conflict (slug) do nothing;


-- Demo inventory: a handful of unused codes per product so purchases work.
-- In production you would top these up from your real supplier/back office.
insert into public.product_codes (product_id, code)
select p.id, 'DEMO-' || upper(substr(md5(random()::text || n::text), 1, 12))
from public.products p, generate_series(1, 6) n
where not exists (select 1 from public.product_codes pc where pc.product_id = p.id);

-- ============================================================================
-- End of schema. See README.md for setup steps (auth settings, anon key, etc).
-- ============================================================================
