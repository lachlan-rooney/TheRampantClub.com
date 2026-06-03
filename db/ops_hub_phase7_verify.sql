-- TRC Operations Hub — PHASE 7 REPORT PROBE
-- Run AFTER ops_hub_phase1..7 migrations.
--
-- Headline = the HONESTY RULE, executable: untimed shifts contribute ZERO
-- fabricated hours, overnight shifts are handled, and every computed figure
-- matches hand-calc. A report someone pays against must not invent numbers.
--
-- Seeds KNOWN data (isolated to a fresh member + fresh board so committed real
-- data can't interfere), asserts against hand-calc, ROLLS BACK, prints PASS row.

begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '3e1583db-b881-42ec-aadb-6f69a22fad80', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_admin uuid := '3e1583db-b881-42ec-aadb-6f69a22fad80';
  v_member uuid; v_project uuid; v_backlog uuid; v_done uuid;
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid;
  v_today date := ops_today_vn();
  r record; v_n int; v_pct numeric;
begin
  -- ── ROTA: 3 timed (8h + 6h + overnight 6h = 20h) + 1 UNTIMED, all today ──
  insert into team_members (display_name) values ('Report Probe Person') returning id into v_member;
  insert into rota_shifts (member, shift_date, shift_name, start_time, end_time, created_by) values
    (v_member, v_today, 'Open',  time '08:00', time '16:00', v_admin),   -- 8h
    (v_member, v_today, 'Mid',   time '16:00', time '22:00', v_admin),   -- 6h
    (v_member, v_today, 'Close', time '20:00', time '02:00', v_admin),   -- overnight → 6h (NOT negative)
    (v_member, v_today, 'Admin', null,         null,         v_admin);   -- UNTIMED → 0 fabricated hours

  select * into r from ops_rota_report(v_today, v_today) where member_id = v_member;
  if r.timed_shifts   <> 3  then raise exception 'FAIL rota: timed_shifts=% (expected 3)', r.timed_shifts; end if;
  if r.untimed_shifts <> 1  then raise exception 'FAIL rota: untimed_shifts=% (expected 1)', r.untimed_shifts; end if;
  if r.total_shifts   <> 4  then raise exception 'FAIL rota: total_shifts=% (expected 4)', r.total_shifts; end if;
  -- THE HONESTY ASSERTION: 8 + 6 + 6 = 20, and the untimed shift adds NOTHING.
  -- If untimed shifts were given any default length, this would be > 20.
  if r.timed_hours    <> 20 then raise exception 'FAIL rota: timed_hours=% (expected 20 — untimed shift must contribute ZERO, overnight must be +6 not negative)', r.timed_hours; end if;

  -- ── PROGRESS: a board with KNOWN card states ──
  v_project := ops_create_project('REPORT PROBE', 'temp');
  select id into v_backlog from board_columns where project_id = v_project and sort_order = 0;
  select id into v_done    from board_columns where project_id = v_project and is_done_column;
  v_t1 := ops_create_task(v_project, v_backlog, 'Done one');
  v_t2 := ops_create_task(v_project, v_backlog, 'Overdue one', null, null, 'normal', v_today - 1);  -- open, past due
  v_t3 := ops_create_task(v_project, v_backlog, 'Lapsed one');
  v_t4 := ops_create_task(v_project, v_backlog, 'Open one');
  perform ops_move_task(v_t1, v_done, 0);                    -- → done, completed_at now (this week)
  update tasks set status = 'lapsed' where id = v_t3;        -- manual lapse for the probe

  select * into r from ops_project_progress(v_project);
  if r.total               <> 4    then raise exception 'FAIL progress: total=% (expected 4)', r.total; end if;
  if r.done                <> 1    then raise exception 'FAIL progress: done=% (expected 1)', r.done; end if;
  if r.lapsed              <> 1    then raise exception 'FAIL progress: lapsed=% (expected 1)', r.lapsed; end if;
  if r.open_count          <> 2    then raise exception 'FAIL progress: open=% (expected 2)', r.open_count; end if;
  if r.overdue             <> 1    then raise exception 'FAIL progress: overdue=% (expected 1)', r.overdue; end if;
  if r.completed_this_week <> 1    then raise exception 'FAIL progress: completed_this_week=% (expected 1)', r.completed_this_week; end if;
  if r.pct_complete        <> 25.0 then raise exception 'FAIL progress: pct_complete=% (expected 25.0)', r.pct_complete; end if;

  -- ── THROUGHPUT: this VN week's bucket holds the one completion ──
  select completed into v_n from ops_project_throughput(v_project)
    where week_start = date_trunc('week', (now() at time zone 'Asia/Ho_Chi_Minh'))::date;
  if coalesce(v_n, 0) <> 1 then raise exception 'FAIL throughput: this week completed=% (expected 1)', coalesce(v_n, 0); end if;

  -- ── ALL-BOARDS overview includes this board with the right figures ──
  select pct_complete into v_pct from ops_all_boards_progress() where project_id = v_project;
  if v_pct <> 25.0 then raise exception 'FAIL all-boards: pct=% (expected 25.0)', v_pct; end if;

  raise notice '✓ REPORT OK';
end$$;

rollback;

select '✓ REPORT OK — honesty holds: untimed shifts contributed ZERO fabricated hours (timed=20 = 8+6+6 with overnight handled), and progress/throughput/all-boards all matched hand-calc (total 4, done 1, lapsed 1, overdue 1, this-week 1, 25.0%). Screen and CSV read these same functions → no export drift. Non-destructive.' as result;
