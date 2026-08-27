-- ═══════════════════════════════════════════════════════════════════════════
-- Staff time off & public holidays — for the internal admin calendar
-- ═══════════════════════════════════════════════════════════════════════════
-- People over a date RANGE (who's off, when). A row is either:
--   • a staff member's leave  (team_member_id set)  — annual / sick / unpaid
--   • a club-wide public holiday (team_member_id null) — kind 'public_holiday'
-- Staff-only. Writes go through the admin API (service role); RLS below is
-- defense-in-depth. Renders as a distinct strip on /admin/calendar.

create table if not exists staff_time_off (
  id             uuid primary key default gen_random_uuid(),
  team_member_id uuid references team_members(id) on delete cascade,   -- null = club-wide public holiday
  member_name    text,               -- snapshot of the person's name for display
  kind           text not null check (kind in ('annual_leave','public_holiday','sick','unpaid')),
  start_date     date not null,
  end_date       date not null,
  note           text,
  created_by     text,
  created_at     timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists idx_time_off_range  on staff_time_off (start_date, end_date);
create index if not exists idx_time_off_member on staff_time_off (team_member_id);

alter table staff_time_off enable row level security;
drop policy if exists "time_off admin" on staff_time_off;
create policy "time_off admin" on staff_time_off
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));
