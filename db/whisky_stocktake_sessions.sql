-- Run once in the Supabase SQL editor.
--
-- Stocktake sessions — one row per completed stocktake, persisted on
-- finish. The detailed line-by-line report is still the CSV download
-- (binder backup), but the session header is durable in the DB so
-- staff can answer "when was the last stocktake?" / "who did the last
-- few?" / "how many bottles got reviewed?" from the UI directly.

begin;

create table if not exists whisky_stocktake_sessions (
  id                    uuid primary key default gen_random_uuid(),
  started_at            timestamptz not null,
  finished_at           timestamptz not null default now(),
  finished_by           text,
  finished_by_email     text,
  reviewed_count        int  not null default 0,
  changed_count         int  not null default 0,
  unchanged_count       int  not null default 0,
  total_catalogue_count int  not null default 0,
  -- Compact JSON summary so a future "details" panel doesn't need a
  -- separate per-whisky table. Shape: [{ id, name, fill_before,
  -- fill_after, changed }]. Big enough for hundreds of rows, small
  -- enough not to blow up a table scan.
  summary               jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists idx_stocktake_sessions_finished_at
  on whisky_stocktake_sessions (finished_at desc);

alter table whisky_stocktake_sessions enable row level security;

drop policy if exists "admin all on whisky_stocktake_sessions"
  on whisky_stocktake_sessions;
create policy "admin all on whisky_stocktake_sessions"
  on whisky_stocktake_sessions
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

commit;

-- Verify.
select count(*) as sessions_so_far from whisky_stocktake_sessions;
