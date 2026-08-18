-- Dossier d'Éclat — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → New Query → Run.
-- Safe to re-run: drops and recreates both tables from scratch.

drop table if exists reviews;
drop table if exists products;

-- ── PRODUCTS ──────────────────────────────────────────────
-- This table is your product catalog. Add/edit/delete rows directly in
-- Supabase's Table Editor (Database → Table Editor → products) — that IS
-- the admin panel, no extra login or app needed. The website only ever
-- reads this table; it can't write to it.
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
  fallback_icon text not null default '💄', -- emoji shown if image_url is blank or the image fails to load
  tag text,                             -- small badge e.g. "Bestseller" — leave blank for none
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);

alter table products enable row level security;

create policy "Public can read products"
  on products for select
  using (true);
-- No insert/update/delete policy on purpose: only you (via the Supabase
-- dashboard, logged in as project owner) can change products. The public
-- website has no way to write to this table.

-- ── REVIEWS ───────────────────────────────────────────────
-- Visitors submit reviews from the website. New reviews start hidden
-- (approved = false) so nothing appears publicly until you approve it:
-- Database → Table Editor → reviews → set `approved` to true on the row.
create table reviews (
  id bigint generated always as identity primary key,
  name text not null,
  stars int not null check (stars between 1 and 5),
  text text not null,
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
-- No update/delete policy for the public — only you can approve/edit/remove
-- reviews, via the dashboard.

-- ── SEED DATA ─────────────────────────────────────────────
-- The 5 products that survived the hotlinked-image cleanup (the other 22
-- were pulled from Walmart/Ulta/Sephora and got deleted from the site).
insert into products (name, brand, category, price, description, image_url, fallback_icon, tag) values
  ('Vanilla Skin Body Mist', 'PHLUR', 'fragrance', 180, 'Warm vanilla · Pink pepper, cashmere wood & sandalwood. The TikTok viral scent.', 'vanilla mist.jpeg', '🌿', 'Viral Scent'),
  ('Missing Person EDP', 'PHLUR', 'fragrance', 250, 'Skin musk · Bergamot, jasmine & blonde wood. Evokes the lingering scent of your lover''s skin.', 'missing phur.jpeg', '🌸', 'Bestseller'),
  ('Vanilla Skin Eau de Parfum', 'PHLUR', 'fragrance', 300, 'Higher concentration EDP. Pink pepper, sugar crystals & cozy sandalwood. Long-wear.', 'eau de parfum.jpeg', '✨', 'Travel Size'),
  ('Lipliner Pencil', 'Relove by Revolution', 'liner', 45, '8 stunning shades — deep brown to nude. Creamy formula, precise line. Budget-friendly queen.', null, '✏️', null),
  ('Feminine Body Mist', 'Body Mist Collection', 'fragrance', 65, 'Delicate long-lasting fragrance mist. Soft florals for everyday luxury. Ask us about current scents.', null, '🌸', null);
