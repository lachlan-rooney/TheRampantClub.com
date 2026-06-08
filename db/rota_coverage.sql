-- ─────────────────────────────────────────────────────────────────────────
-- Rota coverage — Stage B. How much staff each shift NEEDS, scaled by demand.
--
-- 1. rota_coverage_targets — the BASE headcount per (shift_name × function).
-- 2. rota_scaling_rules — TUNABLE rules (data, not code): when a demand trigger
--    fires for a day, add `delta` to a function's target. The user edits
--    thresholds/deltas/functions in the rota panel — no code change to retune.
--
-- Effective target(date, shift, function) = base(shift, function)
--                                         + Σ active rules (matching function)
--                                           that FIRE for that date's demand.
-- Demand comes from the "What's on" signal (bookings + calendar_entries).
-- Admin-RLS (the rota is admin-only); seeds are a STARTING POINT, re-runnable.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists rota_coverage_targets (
  shift_name text not null,
  function   text not null,
  count      int  not null default 0 check (count >= 0),
  primary key (shift_name, function)
);

create table if not exists rota_scaling_rules (
  id           uuid primary key default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('session_covers', 'event_present', 'day_covers')),
  threshold    int  not null default 0,        -- ignored for event_present (boolean)
  function     text not null,
  delta        int  not null default 1,
  active       boolean not null default true,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

alter table rota_coverage_targets enable row level security;
alter table rota_scaling_rules   enable row level security;
drop policy if exists "admin all on rota_coverage_targets" on rota_coverage_targets;
create policy "admin all on rota_coverage_targets" on rota_coverage_targets for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));
drop policy if exists "admin all on rota_scaling_rules" on rota_scaling_rules;
create policy "admin all on rota_scaling_rules" on rota_scaling_rules for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

-- ── Seeds (STARTING POINT — editable in the panel) ──
-- Base: every shift wants a floor; Mid/Close also want a bar.
insert into rota_coverage_targets (shift_name, function, count) values
  ('Open', 'floor', 1),
  ('Mid',  'floor', 1), ('Mid',  'bar', 1),
  ('Close','floor', 1), ('Close','bar', 1)
on conflict (shift_name, function) do nothing;

-- Scaling: busy session → +floor; an event on the day → +host; busy day → +bar.
insert into rota_scaling_rules (trigger_type, threshold, function, delta, sort_order)
select * from (values
  ('session_covers', 12, 'floor', 1, 0),
  ('event_present',   0, 'host',  1, 1),
  ('day_covers',     24, 'bar',   1, 2)
) as v(trigger_type, threshold, function, delta, sort_order)
where not exists (select 1 from rota_scaling_rules);
