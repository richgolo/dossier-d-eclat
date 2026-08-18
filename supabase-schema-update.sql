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
