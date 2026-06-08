-- Per-member taste profile — the persisted foundation the recommendation engine
-- reads (built to scale: stored vector, pluggable derivation). Additive.
--
-- vector: {category_slug: intensity 0-4 (may be fractional, averaged)} — read
-- like a whisky's spokes by the engine + radar. sources: provenance of what fed
-- it (loved distilleries/bottles, consumption row count). Re-derived by
-- scripts/derive-taste-profiles.mjs as sources thicken (loved bottles today;
-- consumption when the Harmony Log feeds member_consumption).

create table if not exists member_taste_profiles (
  member_no    varchar(12) primary key references members(member_no) on delete cascade,
  vector       jsonb not null default '{}'::jsonb,
  sources      jsonb not null default '{}'::jsonb,
  source_count int  not null default 0,
  updated_at   timestamptz not null default now()
);

alter table member_taste_profiles enable row level security;

-- Admins read/write all.
drop policy if exists "admins rw member_taste_profiles" on member_taste_profiles;
create policy "admins rw member_taste_profiles" on member_taste_profiles for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- A member reads their OWN rows, keyed on the profiles.member_no FK (Phase 0a).
-- Dormant until profiles are linked (member_no null → `= null` → no rows match;
-- never matches all). Admins read all via the admin policy above.
drop policy if exists "members read own taste" on member_taste_profiles;
create policy "members read own taste" on member_taste_profiles for select using (
  member_no = (select member_no from profiles where id = auth.uid())
);
