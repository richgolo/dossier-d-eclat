-- Dossier d'Éclat — Supabase schema (full, from scratch)
-- Paste this whole file into Supabase → SQL Editor → New Query → Run.
--
-- ⚠️ DESTRUCTIVE: drops and recreates every table from scratch. Only use
-- this for a brand-new project. On a live project with real data, use
-- supabase-schema-update.sql instead — that one is additive/safe to re-run.

drop table if exists orders;
drop table if exists reviews;
drop table if exists product_variants;
drop table if exists products;

-- ── PRODUCTS ──────────────────────────────────────────────
-- This table is your product catalog. Add/edit/delete rows from the admin
-- panel (admin.html) once you're logged in — that's the intended way to
-- manage products day-to-day. Supabase's own Table Editor works too.
--
-- `category` must be one of the 6 values below to show up under the
-- matching filter tab on the shop page (gloss / liner / balm / brow /
-- fragrance / wipes). Adding a brand-new category name also needs a new
-- filter button added to shop.html — that's a code change, not self-serve.
create table products (
  id bigint generated always as identity primary key,
  name text not null,
  brand text not null,
  category text not null check (category in ('gloss', 'liner', 'balm', 'brow', 'fragrance', 'wipes')),
  price numeric not null check (price >= 0),
  description text not null default '',
  image_url text,                       -- filename or full URL; leave blank to show the fallback_icon instead
  image_url_2 text,                     -- optional 2nd photo, shown via dots on the shop card
  image_url_3 text,                     -- optional 3rd photo, shown via dots on the shop card
  fallback_icon text not null default 'fa-solid fa-heart', -- Font Awesome class shown if image_url is blank or the image fails to load
  tag text,                             -- small badge e.g. "Bestseller" — leave blank for none
  in_stock boolean not null default true,
  featured boolean not null default false, -- shows on the homepage's preview section (up to 3)
  created_at timestamptz not null default now()
);

alter table products enable row level security;

create policy "Public can read products"
  on products for select
  using (true);

create policy "Logged-in users can add products"
  on products for insert
  to authenticated
  with check (true);

create policy "Logged-in users can edit products"
  on products for update
  to authenticated
  using (true);

create policy "Logged-in users can delete products"
  on products for delete
  to authenticated
  using (true);
-- Writes require a logged-in user (created via Authentication → Users →
-- Add user) — the public website/API key can only ever read this table.

-- ── PRODUCT VARIANTS ──────────────────────────────────────
-- Optional shades/flavors/colors for a product (e.g. a lipgloss sold in
-- several shades) — entirely optional, added from the product's Edit form
-- in the admin panel. A product with zero rows here just sells as-is, same
-- as before this table existed; one with rows shows a shade picker on the
-- shop page instead of an instant Add to Cart.
create table product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60), -- e.g. "Cherry Red"
  image_url text,                       -- optional photo of this specific shade; falls back to the product's own photos if blank
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);

alter table product_variants enable row level security;

create policy "Public can read variants"
  on product_variants for select
  using (true);

create policy "Logged-in users can add variants"
  on product_variants for insert
  to authenticated
  with check (true);

create policy "Logged-in users can edit variants"
  on product_variants for update
  to authenticated
  using (true);

create policy "Logged-in users can delete variants"
  on product_variants for delete
  to authenticated
  using (true);

-- ── REVIEWS ───────────────────────────────────────────────
-- Visitors submit reviews from the website. New reviews start hidden
-- (approved = false) so nothing appears publicly until approved from the
-- admin panel's Reviews tab.
create table reviews (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 60),
  stars int not null check (stars between 1 and 5),
  text text not null check (char_length(text) between 1 and 400),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table reviews enable row level security;

create policy "Public can read approved reviews"
  on reviews for select
  using (approved = true);

create policy "Public can submit a review, but never pre-approved"
  on reviews for insert
  with check (approved = false);

create policy "Logged-in users can approve/edit reviews"
  on reviews for update
  to authenticated
  using (true);

create policy "Logged-in users can delete reviews"
  on reviews for delete
  to authenticated
  using (true);

-- ── ORDERS ────────────────────────────────────────────────
-- A lightweight sales log written automatically at WhatsApp checkout — no
-- customer identity is captured (that happens in the WhatsApp chat itself),
-- just what sold and for how much, viewable from the admin panel's Orders
-- tab.
create table orders (
  id bigint generated always as identity primary key,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  total numeric not null check (total >= 0),
  status text not null default 'new' check (status in ('new', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

create policy "Public can log an order"
  on orders for insert
  with check (true);

create policy "Logged-in users can view orders"
  on orders for select
  to authenticated
  using (true);

create policy "Logged-in users can update orders"
  on orders for update
  to authenticated
  using (true);

create policy "Logged-in users can delete orders"
  on orders for delete
  to authenticated
  using (true);

-- ── SEED DATA ─────────────────────────────────────────────
-- The 5 products that survived the hotlinked-image cleanup (the other 22
-- were pulled from Walmart/Ulta/Sephora and got deleted from the site).
insert into products (name, brand, category, price, description, image_url, fallback_icon, tag) values
  ('Vanilla Skin Body Mist', 'PHLUR', 'fragrance', 180, 'Warm vanilla · Pink pepper, cashmere wood & sandalwood. The TikTok viral scent.', 'vanilla mist.jpeg', 'fa-solid fa-spray-can-sparkles', 'Viral Scent'),
  ('Missing Person EDP', 'PHLUR', 'fragrance', 250, 'Skin musk · Bergamot, jasmine & blonde wood. Evokes the lingering scent of your lover''s skin.', 'missing phur.jpeg', 'fa-solid fa-spray-can-sparkles', 'Bestseller'),
  ('Vanilla Skin Eau de Parfum', 'PHLUR', 'fragrance', 300, 'Higher concentration EDP. Pink pepper, sugar crystals & cozy sandalwood. Long-wear.', 'eau de parfum.jpeg', 'fa-solid fa-spray-can-sparkles', 'Travel Size'),
  ('Lipliner Pencil', 'Relove by Revolution', 'liner', 45, '8 stunning shades — deep brown to nude. Creamy formula, precise line. Budget-friendly queen.', null, 'fa-solid fa-pen', null),
  ('Feminine Body Mist', 'Body Mist Collection', 'fragrance', 65, 'Delicate long-lasting fragrance mist. Soft florals for everyday luxury. Ask us about current scents.', null, 'fa-solid fa-spray-can-sparkles', null);
