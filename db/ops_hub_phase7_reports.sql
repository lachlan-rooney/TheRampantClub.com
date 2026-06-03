-- Run once in the Supabase SQL editor, AFTER ops_hub_phase1..6.
--
-- TRC Operations Hub — PHASE 7 (reports). Read-only aggregation over the
-- existing Hub data. NO schema change — only functions.
--
-- ONE SOURCE OF TRUTH: the screen and the CSV export both read these functions,
-- so exported numbers always match the display (no client/export drift).
--
-- HONESTY RULE (rota hours): start_time/end_time are OPTIONAL. Hours are computed
-- ONLY where BOTH exist. Untimed shifts are counted SEPARATELY — never given a
-- fabricated/default length. Output is "X timed hours + Y untimed shifts". A
-- report someone pays against must not invent numbers.
--
-- SECURITY INVOKER → RLS applies as the caller (admins see all; future project
-- members would see only their boards). Idempotent / re-runnable.

begin;

-- Timed-hours expression, honest + overnight-aware (a Close shift 20:00→02:00 is
-- 6h, not negative). Untimed rows contribute 0 — never a fabricated length.
-- (inlined per function below; kept here as the canonical definition)

-- ── ROTA: per-person over [from, to] ──
create or replace function ops_rota_report(p_from date, p_to date)
returns table (
  member_id uuid, display_name text,
  timed_shifts integer, timed_hours numeric, untimed_shifts integer, total_shifts integer
) language sql security invoker set search_path = public stable as $$
  select
    tm.id, tm.display_name,
    count(*) filter (where rs.start_time is not null and rs.end_time is not null)::int as timed_shifts,
    coalesce(round(sum(
      case when rs.start_time is not null and rs.end_time is not null then
        extract(epoch from (
          case when rs.end_time >= rs.start_time then rs.end_time - rs.start_time
               else (rs.end_time - rs.start_time) + interval '24 hours' end
        )) / 3600.0
      else 0 end
    ), 2), 0) as timed_hours,
    count(*) filter (where rs.start_time is null or rs.end_time is null)::int as untimed_shifts,
    count(*)::int as total_shifts
  from rota_shifts rs
  join team_members tm on tm.id = rs.member
  where rs.shift_date between p_from and p_to
  group by tm.id, tm.display_name
  order by tm.display_name;
$$;

-- ── ROTA: breakdown by shift type over [from, to] (reconciles with per-person) ──
create or replace function ops_rota_by_type(p_from date, p_to date)
returns table (
  shift_name text, timed_shifts integer, timed_hours numeric, untimed_shifts integer, total_shifts integer
) language sql security invoker set search_path = public stable as $$
  select
    rs.shift_name,
    count(*) filter (where rs.start_time is not null and rs.end_time is not null)::int,
    coalesce(round(sum(
      case when rs.start_time is not null and rs.end_time is not null then
        extract(epoch from (
          case when rs.end_time >= rs.start_time then rs.end_time - rs.start_time
               else (rs.end_time - rs.start_time) + interval '24 hours' end
        )) / 3600.0
      else 0 end
    ), 2), 0),
    count(*) filter (where rs.start_time is null or rs.end_time is null)::int,
    count(*)::int
  from rota_shifts rs
  where rs.shift_date between p_from and p_to
  group by rs.shift_name
  order by rs.shift_name;
$$;

-- ── PROGRESS: per board ──
create or replace function ops_project_progress(p_project_id uuid)
returns table (
  total integer, open_count integer, done integer, lapsed integer,
  overdue integer, completed_this_week integer, pct_complete numeric
) language sql security invoker set search_path = public stable as $$
  select
    count(*)::int,
    count(*) filter (where status = 'open')::int,
    count(*) filter (where status = 'done')::int,
    count(*) filter (where status = 'lapsed')::int,
    count(*) filter (where status = 'open' and due_date is not null and due_date < ops_today_vn())::int,
    count(*) filter (where completed_at is not null
      and (completed_at at time zone 'Asia/Ho_Chi_Minh')::date
          >= date_trunc('week', (now() at time zone 'Asia/Ho_Chi_Minh'))::date)::int,
    case when count(*) = 0 then 0
         else round(count(*) filter (where status = 'done') * 100.0 / count(*), 1) end
  from tasks
  where project_id = p_project_id;
$$;

-- ── PROGRESS: weekly throughput (completions per VN week, last N weeks) ──
create or replace function ops_project_throughput(p_project_id uuid, p_weeks integer default 12)
returns table (week_start date, completed integer)
language sql security invoker set search_path = public stable as $$
  select
    date_trunc('week', (completed_at at time zone 'Asia/Ho_Chi_Minh'))::date as week_start,
    count(*)::int
  from tasks
  where project_id = p_project_id
    and completed_at is not null
    and (completed_at at time zone 'Asia/Ho_Chi_Minh')::date
        >= (date_trunc('week', (now() at time zone 'Asia/Ho_Chi_Minh')) - (p_weeks || ' weeks')::interval)::date
  group by 1
  order by 1;
$$;

-- ── PROGRESS: all active boards overview ──
create or replace function ops_all_boards_progress()
returns table (
  project_id uuid, name text, total integer, done integer, overdue integer, pct_complete numeric
) language sql security invoker set search_path = public stable as $$
  select
    p.id, p.name,
    count(t.id)::int,
    count(t.id) filter (where t.status = 'done')::int,
    count(t.id) filter (where t.status = 'open' and t.due_date is not null and t.due_date < ops_today_vn())::int,
    case when count(t.id) = 0 then 0
         else round(count(t.id) filter (where t.status = 'done') * 100.0 / count(t.id), 1) end
  from projects p
  left join tasks t on t.project_id = p.id
  where p.status = 'active'
  group by p.id, p.name
  order by p.name;
$$;

grant execute on function ops_rota_report(date, date)        to authenticated;
grant execute on function ops_rota_by_type(date, date)       to authenticated;
grant execute on function ops_project_progress(uuid)         to authenticated;
grant execute on function ops_project_throughput(uuid, integer) to authenticated;
grant execute on function ops_all_boards_progress()          to authenticated;

commit;

-- Verify (after this migration): run ops_hub_phase7_verify.sql.
