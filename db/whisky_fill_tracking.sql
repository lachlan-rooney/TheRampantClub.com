-- Run once in the Supabase SQL editor.
--
-- Whisky-bottle fill tracking — the open bar bottle for each whisky has a
-- current fill % that staff update during their weekly bar walk. Every
-- update is logged to whisky_fill_history with who did it and when, so
-- the trend graph on /admin/whisky shows both the level AND the audit
-- trail (no anonymous updates, no silent corrections).

begin;

-- 1. Current fill % lives on the whisky row for fast reads (no join when
--    rendering the table).
alter table whiskies
  add column if not exists current_fill_pct        int,
  add column if not exists last_fill_updated_at    timestamptz,
  add column if not exists last_fill_updated_by    uuid,
  add column if not exists last_fill_updated_email text;

-- Sensible default for any row that has never been measured.
update whiskies set current_fill_pct = 100 where current_fill_pct is null;

alter table whiskies
  add constraint whiskies_current_fill_pct_check
  check (current_fill_pct is null or (current_fill_pct between 0 and 100))
  not valid;
alter table whiskies validate constraint whiskies_current_fill_pct_check;

-- 2. Full history of every update. One row per staff update — that's the
--    cadence the user chose. previous_fill_pct lets us render the delta
--    on each history row without a self-join at query time.
create table if not exists whisky_fill_history (
  id                  uuid primary key default gen_random_uuid(),
  whisky_id           uuid not null references whiskies(id) on delete cascade,
  fill_pct            int  not null check (fill_pct between 0 and 100),
  previous_fill_pct   int  check (previous_fill_pct is null or (previous_fill_pct between 0 and 100)),
  updated_by          uuid,                          -- auth.uid()
  updated_by_email    text,                          -- frozen at write time so deletions don't orphan the audit trail
  note                text,                          -- optional staff note ("opened new bottle", "spilled", etc.)
  created_at          timestamptz not null default now()
);

create index if not exists idx_whisky_fill_history_whisky on whisky_fill_history (whisky_id, created_at desc);
create index if not exists idx_whisky_fill_history_when   on whisky_fill_history (created_at desc);

-- 3. RLS — admins do everything; nobody else reads or writes.
alter table whisky_fill_history enable row level security;

drop policy if exists "admin all on whisky_fill_history" on whisky_fill_history;
create policy "admin all on whisky_fill_history" on whisky_fill_history
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

commit;

-- Verify.
select
  (select count(*) from whiskies where current_fill_pct is not null) as whiskies_with_fill,
  (select count(*) from whisky_fill_history)                          as history_rows;
