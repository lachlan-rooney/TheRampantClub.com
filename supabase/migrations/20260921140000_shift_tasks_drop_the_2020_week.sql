-- ═══════════════════════════════════════════════════════════════════════════
-- A WEEK IN JANUARY 2020, GENERATED IN SEPTEMBER 2026
-- ───────────────────────────────────────────────────────────────────────────
-- 45 shift-task instances sit on week_start 2020-01-13, shift dates spread
-- across 13–17 January 2020, every one of them created on 2026-09-10. A year
-- typed wrong when a week was materialised.
--
-- Harmless until somebody browses to that week, and then it is 45 tasks
-- nobody can do, assigned to people who were not employed.
--
-- ── CHECKED BEFORE DELETING, NOT AFTER ────────────────────────────────────
-- All 45: status not_started, no completed_at, no evidence, no note, no
-- blocked_reason, carried_over_count 0, not one-offs, and ZERO rows in
-- shift_task_events point at them. Nothing here is somebody's work.
--
-- The WHERE clause repeats every one of those conditions rather than trusting
-- that check. If a row in that week has since been completed or evidenced,
-- this leaves it alone — a migration that can only destroy junk is worth more
-- than one that destroys what the author happened to look at.
--
-- Instances are MATERIALISED COPIES of the template, so the way back is not a
-- backup: it is regenerating the week. Nothing original is lost.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- What is about to go.
select week_start, count(*) as rows, min(shift_date) as first_shift, max(shift_date) as last_shift
  from public.shift_task_instances
 where week_start < date '2025-01-01'
 group by week_start;

delete from public.shift_task_instances
 where week_start < date '2025-01-01'
   and status = 'not_started'
   and completed_at is null
   and evidence is null
   and note is null
   and blocked_reason is null
   and coalesce(carried_over_count, 0) = 0
   and is_one_off = false;

-- ── STOP IT HAPPENING AGAIN ────────────────────────────────────────────────
-- The club did not exist in 2020 and a week is never generated retrospectively
-- by years. A mistyped year now fails loudly at the moment it is made instead
-- of quietly filling a table nobody looks at.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shift_task_instances_week_sane') then
    alter table public.shift_task_instances
      add constraint shift_task_instances_week_sane
      check (week_start >= date '2025-01-01');
  end if;
end $$;

-- Read it back: every week that remains.
select week_start, count(*) as rows
  from public.shift_task_instances
 group by week_start
 order by week_start;
