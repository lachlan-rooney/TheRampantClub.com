-- ─────────────────────────────────────────────────────────────────────────
-- Rota availability — who CAN'T work, per day. Completes autofill: it stops
-- proposing people on their day off (hard constraint), and manual drag warns.
--
-- Per-day grain (whole-day off — leave / sick / day off). One marker per
-- person-day (unique). `note` is human-readable only ('leave', 'sick', …) —
-- the autofill only cares WHETHER they're off, not why. Admin-RLS. Re-runnable.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists rota_unavailability (
  id         uuid primary key default gen_random_uuid(),
  member     uuid not null references team_members(id) on delete cascade,
  off_date   date not null,
  note       text,
  created_at timestamptz not null default now(),
  unique (member, off_date)
);
create index if not exists idx_rota_unavailability_date on rota_unavailability(off_date);

alter table rota_unavailability enable row level security;
drop policy if exists "admin all on rota_unavailability" on rota_unavailability;
create policy "admin all on rota_unavailability" on rota_unavailability for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));
