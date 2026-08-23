-- Dossier d'Éclat — Admin page migration
-- Paste this into Supabase → SQL Editor → New Query → Run.
-- This is ADDITIVE ONLY — unlike supabase-schema.sql, it does NOT drop or
-- touch the existing products/reviews tables or data. Safe to run once you
-- already have real products/reviews in place.
--
-- Safe to re-run from scratch as many times as needed — every policy is
-- dropped-if-exists right before it's recreated, so a partial/failed
-- previous run won't cause "already exists" errors here.
--
-- Run this AFTER creating her login: Authentication → Users → Add user.

-- ── STORAGE for product photos ───────────────────────────────
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public can view product photos" on storage.objects;
create policy "Public can view product photos"
  on storage.objects for select
  using (bucket_id = 'product-photos');

drop policy if exists "Logged-in users can upload product photos" on storage.objects;
create policy "Logged-in users can upload product photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-photos');

drop policy if exists "Logged-in users can replace product photos" on storage.objects;
create policy "Logged-in users can replace product photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-photos');

drop policy if exists "Logged-in users can delete product photos" on storage.objects;
create policy "Logged-in users can delete product photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-photos');

-- ── PRODUCTS: allow the admin page to write ──────────────────
-- (previously only readable — the admin page needs a logged-in user to be
-- able to add/edit/delete products)
drop policy if exists "Logged-in users can add products" on products;
create policy "Logged-in users can add products"
  on products for insert
  to authenticated
  with check (true);

drop policy if exists "Logged-in users can edit products" on products;
create policy "Logged-in users can edit products"
  on products for update
  to authenticated
  using (true);

drop policy if exists "Logged-in users can delete products" on products;
create policy "Logged-in users can delete products"
  on products for delete
  to authenticated
  using (true);

-- ── REVIEWS: allow the admin page to moderate ────────────────
-- (public can still only read approved reviews and submit new ones,
-- unchanged from supabase-schema.sql)
drop policy if exists "Logged-in users can approve/edit reviews" on reviews;
create policy "Logged-in users can approve/edit reviews"
  on reviews for update
  to authenticated
  using (true);

drop policy if exists "Logged-in users can delete reviews" on reviews;
create policy "Logged-in users can delete reviews"
  on reviews for delete
  to authenticated
  using (true);

-- ── ICONS: migrate fallback_icon from emoji to Font Awesome classes ──
-- Products seeded before this change still have emoji (🌿🌸✨✏️) in
-- fallback_icon — the site now expects a Font Awesome class there instead.
-- Safe to re-run: only touches rows that still hold an old emoji value.
alter table products alter column fallback_icon set default 'fa-solid fa-heart';

update products set fallback_icon = 'fa-solid fa-spray-can-sparkles' where fallback_icon in ('🌿', '🌸', '✨');
update products set fallback_icon = 'fa-solid fa-pen' where fallback_icon = '✏️';
update products set fallback_icon = 'fa-solid fa-droplet' where fallback_icon = '💄';
update products set fallback_icon = 'fa-solid fa-heart' where fallback_icon !~ '^fa-';

-- ── FEATURED: lets the admin panel flag products for the homepage ────
alter table products add column if not exists featured boolean not null default false;

-- ── MULTI-PHOTO: up to 3 photos per product ──────────────────────────
-- image_url stays the main/first photo. These two are optional extras —
-- the shop page shows swipeable dots under the product photo when either
-- is filled in.
alter table products add column if not exists image_url_2 text;
alter table products add column if not exists image_url_3 text;

-- ── ORDERS: lightweight sales log, written at WhatsApp checkout ──────
-- No customer identity is captured here (that still happens in the
-- WhatsApp conversation itself) — this table exists purely so she can see
-- what's selling and rough revenue, since today an order only ever exists
-- as a WhatsApp message thread.
create table if not exists orders (
  id bigint generated always as identity primary key,
  items jsonb not null,
  total numeric not null,
  status text not null default 'new' check (status in ('new', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

drop policy if exists "Public can log an order" on orders;
create policy "Public can log an order"
  on orders for insert
  with check (true);
-- No public select/update/delete — sales data is only visible to a logged-in user.

drop policy if exists "Logged-in users can view orders" on orders;
create policy "Logged-in users can view orders"
  on orders for select
  to authenticated
  using (true);

drop policy if exists "Logged-in users can update orders" on orders;
create policy "Logged-in users can update orders"
  on orders for update
  to authenticated
  using (true);

-- ── VALIDATION HARDENING: cap what the public insert policies accept ─
-- The anon key can insert into reviews/orders directly via the Supabase
-- REST API, bypassing whatever the website's JS checks — these constraints
-- enforce sane limits at the database itself so a scripted/bot submission
-- can't stuff huge text blobs or malformed rows into either table.
alter table reviews drop constraint if exists reviews_name_length_check;
alter table reviews add constraint reviews_name_length_check check (char_length(name) between 1 and 60);

alter table reviews drop constraint if exists reviews_text_length_check;
alter table reviews add constraint reviews_text_length_check check (char_length(text) between 1 and 400);

alter table orders drop constraint if exists orders_total_check;
alter table orders add constraint orders_total_check check (total >= 0);

alter table orders drop constraint if exists orders_items_check;
alter table orders add constraint orders_items_check check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0);

drop policy if exists "Logged-in users can delete orders" on orders;
create policy "Logged-in users can delete orders"
  on orders for delete
  to authenticated
  using (true);

-- ── PRODUCT VARIANTS: optional shades/flavors per product ────────────
-- Entirely optional — a product with zero rows here still sells exactly
-- as before. Added/edited from the product's Edit form in the admin
-- panel; the shop page shows a shade picker instead of an instant Add to
-- Cart for any product that has rows here.
create table if not exists product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  image_url text,
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);

alter table product_variants enable row level security;

drop policy if exists "Public can read variants" on product_variants;
create policy "Public can read variants"
  on product_variants for select
  using (true);

drop policy if exists "Logged-in users can add variants" on product_variants;
create policy "Logged-in users can add variants"
  on product_variants for insert
  to authenticated
  with check (true);

drop policy if exists "Logged-in users can edit variants" on product_variants;
create policy "Logged-in users can edit variants"
  on product_variants for update
  to authenticated
  using (true);

drop policy if exists "Logged-in users can delete variants" on product_variants;
create policy "Logged-in users can delete variants"
  on product_variants for delete
  to authenticated
  using (true);
