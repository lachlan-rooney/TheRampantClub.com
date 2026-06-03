-- TRC Operations Hub — GANTT PROBE
-- Run AFTER ops_hub_phase1..7 + ops_hub_gantt.sql.
--
-- The honest-representation rule + the spine-write rule, executable:
--   • a task WITH start + due → has a start_date (renders as a BAR)
--   • a due-ONLY task → start_date stays NULL (a MILESTONE, never a fake bar)
--   • reschedule moves BOTH dates AND lands a 'rescheduled' event on the spine
--     with snapshotted {title, start_date, due_date}
--   • an invalid range (start > due) is PREVENTED server-side
-- Self-asserting, ROLLS BACK, prints PASS row.

begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '3e1583db-b881-42ec-aadb-6f69a22fad80', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_project uuid; v_backlog uuid; v_bar uuid; v_ms uuid;
  v_today date := ops_today_vn();
  v_start date; v_due date; v_n int; v_raised boolean := false;
begin
  v_project := ops_create_project('GANTT PROBE', 'temp');
  select id into v_backlog from board_columns where project_id = v_project and sort_order = 0;

  -- BAR: a task given both a start and a due
  v_bar := ops_create_task(v_project, v_backlog, 'Bar task', null, null, 'normal', v_today + 5);
  perform ops_reschedule_task(v_bar, v_today, v_today + 5);
  select start_date, due_date into v_start, v_due from tasks where id = v_bar;
  if v_start is null then raise exception 'FAIL: bar task has no start_date (should render as a bar)'; end if;
  if v_start <> v_today or v_due <> v_today + 5 then raise exception 'FAIL: bar dates wrong (%/%)', v_start, v_due; end if;

  -- MILESTONE: a due-only task keeps start_date NULL — no fabricated bar
  v_ms := ops_create_task(v_project, v_backlog, 'Milestone task', null, null, 'normal', v_today + 2);
  select start_date into v_start from tasks where id = v_ms;
  if v_start is not null then raise exception 'FAIL: due-only task got a start_date (should be a milestone, no fake bar)'; end if;

  -- RESCHEDULE moves both dates AND emits a snapshotted 'rescheduled' event
  perform ops_reschedule_task(v_bar, v_today + 1, v_today + 6);
  select start_date, due_date into v_start, v_due from tasks where id = v_bar;
  if v_start <> v_today + 1 or v_due <> v_today + 6 then raise exception 'FAIL: reschedule did not move both dates'; end if;
  select count(*) into v_n from activity_events
    where object_id = v_bar and verb = 'rescheduled'
      and (metadata->>'start_date')::date = v_today + 1
      and (metadata->>'due_date')::date   = v_today + 6
      and metadata->>'title' = 'Bar task';
  if v_n < 1 then raise exception 'FAIL: no rescheduled event with snapshotted labels landed on the spine'; end if;

  -- INVALID RANGE (start > due) is PREVENTED
  begin
    perform ops_reschedule_task(v_bar, v_today + 10, v_today + 3);
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;   -- our own assert, re-raise
    v_raised := true;                              -- the guard fired → good
  end;
  if not v_raised then raise exception 'FAIL: invalid range (start>due) was NOT prevented'; end if;
  -- and the invalid attempt left the bar unchanged
  select start_date, due_date into v_start, v_due from tasks where id = v_bar;
  if v_start <> v_today + 1 or v_due <> v_today + 6 then raise exception 'FAIL: invalid reschedule mutated the row'; end if;

  raise notice '✓ GANTT OK';
end$$;

rollback;

select '✓ GANTT OK — ranged task has a start_date (bar); due-only task keeps start_date NULL (milestone, no fabricated bar); reschedule moved both dates AND emitted a snapshotted ''rescheduled'' event on the spine; invalid range (start>due) prevented and left the row untouched. Non-destructive.' as result;
