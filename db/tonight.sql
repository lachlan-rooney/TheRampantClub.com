-- Run in Supabase SQL editor.
--
-- Backs the "Tonight at The Rampant Club" panel.
--
-- daily_picks   — admin curates dram, vinyl, member quote per calendar date
-- card_presence — every card tap logged so members can see live clubhouse count

create table if not exists daily_picks (
  pick_date date primary key,
  dram_label text,
  dram_note text,
  vinyl_label text,
  vinyl_note text,
  member_quote text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now()
);

create table if not exists card_presence (
  id uuid primary key default gen_random_uuid(),
  member_number text not null,
  seen_at timestamptz default now()
);

create index if not exists card_presence_seen_idx on card_presence (seen_at desc);
create index if not exists card_presence_member_seen_idx on card_presence (member_number, seen_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────
alter table daily_picks enable row level security;
alter table card_presence enable row level security;

drop policy if exists "anyone reads daily_picks" on daily_picks;
create policy "anyone reads daily_picks" on daily_picks
  for select using (true);

drop policy if exists "admin writes daily_picks" on daily_picks;
create policy "admin writes daily_picks" on daily_picks
  for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "members read card_presence" on card_presence;
create policy "members read card_presence" on card_presence
  for select using (auth.uid() is not null);

drop policy if exists "admin writes card_presence" on card_presence;
create policy "admin writes card_presence" on card_presence
  for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));
