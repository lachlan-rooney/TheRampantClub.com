-- Run once in Supabase SQL editor.
-- Creates the whiskies table that admin/whisky writes to and atlas/members read.

create table if not exists whiskies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  distillery text,
  region text,
  cask_type text,
  age text,
  abv text,
  tasting_notes text,
  committees_pick boolean not null default false,
  in_stock boolean not null default true,
  image_url text,
  added_at timestamptz default now()
);

create index if not exists whiskies_region_idx     on whiskies (region);
create index if not exists whiskies_in_stock_idx   on whiskies (in_stock);
create index if not exists whiskies_added_at_idx   on whiskies (added_at desc);

alter table whiskies enable row level security;

-- Anyone (logged in or not) can browse whiskies that are currently in stock.
drop policy if exists "anon read in-stock whiskies" on whiskies;
create policy "anon read in-stock whiskies" on whiskies
  for select using (in_stock = true);

-- Authenticated members can also see past drams (in_stock = false).
drop policy if exists "members read all whiskies" on whiskies;
create policy "members read all whiskies" on whiskies
  for select using (auth.uid() is not null);

-- Admins can do anything (insert / update / delete).
drop policy if exists "admins write whiskies" on whiskies;
create policy "admins write whiskies" on whiskies
  for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));
