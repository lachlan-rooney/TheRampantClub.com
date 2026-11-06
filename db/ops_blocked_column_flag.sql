-- ═══════════════════════════════════════════════════════════════════════════
-- OPS HUB — a BLOCKED column flag, and blocked work out of "overdue".
--                                                        REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-11-06: blocked tasks should not count as overdue; they should
-- carry their own count, and a passed date should still show red on the card.
--
-- ═══ WHY A FLAG AND NOT A NAME TEST ════════════════════════════════════════
-- The brief was explicit about done: "use the flag, not the column name".
-- There is an is_done_column flag. There is NO blocked flag — so excluding
-- blocked work today would mean matching on the literal string 'Blocked',
-- which is the exact fragility the done rule exists to avoid. Rename the
-- column, translate it, or add a board whose holding column is called
-- "Waiting on supplier", and a name test silently stops working.
--
-- So this adds the flag, mirroring is_done_column, and sets it on the four
-- columns currently named Blocked. One-time name matching to BACKFILL a flag
-- is fine; name matching at read time, forever, is not.
--
-- ═══ WHAT THIS CHANGES, MEASURED ═══════════════════════════════════════════
-- Measured 2026-11-06 across the 10 active boards: 213 open tasks, 120 with a
-- due date in the past, of which 8 sit in a Blocked column.
--
--   overdue   120 -> 112
--   blocked     — ->   8   (new, its own count)
--
-- ⚠ IT IS NOT A DISPLAY BUG. 112 of 213 open tasks really are past due. The
--   only miscount was the 8 blocked ones. The number is high because the work
--   is late, not because the page is counting it wrong.
--
-- ⚠ NOTE ALSO: 0 open tasks sit in a done-flagged column, so the done side of
--   the audit passes today. That is upheld by ops_doneness_fix.sql (create
--   path) and ops_move_task (move path), not by the read, which is worth
--   knowing if either is ever changed.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

alter table public.board_columns
  add column if not exists is_blocked_column boolean not null default false;

comment on column public.board_columns.is_blocked_column is
  'Work parked waiting on something else. Excluded from overdue and due-soon counts and reported separately. Mirrors is_done_column: never test the column NAME at read time.';

-- One-time backfill from the current names. After this, the flag is the truth.
update public.board_columns
   set is_blocked_column = true
 where is_done_column = false
   and name ~* '^\s*blocked\s*$';

-- ── the progress functions stop counting blocked work as overdue ──────────
-- Signatures are unchanged on purpose: /admin/ops/[project_id]/progress and
-- /admin/ops/reports read these by position, and widening the return type
-- would break both pages. Blocked is surfaced in the UI from the flag.
create or replace function public.ops_project_progress(p_project_id uuid)
returns table (
  total integer, open_count integer, done integer, lapsed integer,
  overdue integer, completed_this_week integer, pct_complete numeric
) language sql stable security invoker set search_path = public as $$
  select
    count(*)::int,
    count(*) filter (where t.status = 'open')::int,
    count(*) filter (where t.status = 'done')::int,
    count(*) filter (where t.status = 'lapsed')::int,
    -- OVERDUE: open, past due, and NOT parked. Blocked work is waiting on
    -- someone else; calling it overdue tells the assignee to chase themselves.
    count(*) filter (
      where t.status = 'open' and t.due_date is not null
        and t.due_date < ops_today_vn()
        and coalesce(c.is_blocked_column, false) = false
        and coalesce(c.is_done_column, false) = false
    )::int,
    count(*) filter (where t.completed_at is not null
      and (t.completed_at at time zone 'Asia/Ho_Chi_Minh')::date
          >= (ops_today_vn() - interval '7 days')::date)::int,
    case when count(*) = 0 then 0
         else round(count(*) filter (where t.status = 'done') * 100.0 / count(*), 1) end
  from tasks t
  left join board_columns c on c.id = t.column_id
  where t.project_id = p_project_id;
$$;

create or replace function public.ops_all_boards_progress()
returns table (
  project_id uuid, name text, total integer, done integer,
  overdue integer, pct_complete numeric
) language sql stable security invoker set search_path = public as $$
  select
    p.id, p.name,
    count(t.id)::int,
    count(t.id) filter (where t.status = 'done')::int,
    count(t.id) filter (
      where t.status = 'open' and t.due_date is not null
        and t.due_date < ops_today_vn()
        and coalesce(c.is_blocked_column, false) = false
        and coalesce(c.is_done_column, false) = false
    )::int,
    case when count(t.id) = 0 then 0
         else round(count(t.id) filter (where t.status = 'done') * 100.0 / count(t.id), 1) end
  from projects p
  left join tasks t on t.project_id = p.id
  left join board_columns c on c.id = t.column_id
  where p.status = 'active' and p.deleted_at is null
  group by p.id, p.name
  order by p.name;
$$;

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- The flag landed on exactly the Blocked columns and nothing else:
--   select name, is_done_column, is_blocked_column from board_columns
--    where is_blocked_column order by name;
--   → 4 rows, all named Blocked
--
-- No column is both:
--   select count(*) from board_columns where is_done_column and is_blocked_column;
--   → 0
--
-- The counts moved by exactly the blocked eight:
--   select sum(overdue) from ops_all_boards_progress();
--   → 112  (was 120)
--
-- Then: node scripts/verify-ops-overdue.mjs

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Restores both functions to counting blocked work as overdue, and drops the
-- flag. The column list and the tasks are untouched either way:
--   alter table public.board_columns drop column if exists is_blocked_column;
--   -- then re-run db/ops_hub_phase7_reports.sql to restore the two functions.
