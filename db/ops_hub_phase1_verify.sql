-- TRC Operations Hub — PHASE 1 SPINE VERIFICATION
-- Run in the Supabase SQL editor AFTER ops_hub_phase1.sql.
--
-- This is the headline check: it exercises every Phase 1 action and ASSERTS
-- that each one wrote a correct activity_events row — proving the spine works
-- even though no feed UI exists yet. It runs as a simulated authenticated admin
-- (the SQL editor has no JWT, so we set the claim by hand) and ROLLS BACK at the
-- end, so it leaves no test data behind.
--
-- Pre-filled with the admin profiles.id below — just run it. (A profiles.id is a
-- row id, not a credential; harmless in-repo. Re-point it if the admin changes.)

begin;

-- Simulate that admin as the authenticated caller (auth.uid() reads this claim).
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '3e1583db-b881-42ec-aadb-6f69a22fad80', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_project uuid;
  v_backlog uuid;
  v_done    uuid;
  v_task    uuid;
  v_meta    jsonb;
  n int;
begin
  -- 1. create project (also seeds 4 columns + owner membership + 'created' event)
  v_project := ops_create_project('SPINE VERIFY', 'temporary verification board');
  select id into v_backlog from board_columns where project_id = v_project and sort_order = 0;
  select id into v_done    from board_columns where project_id = v_project and is_done_column;

  -- 2. create a task (→ 'created' task event)
  v_task := ops_create_task(v_project, v_backlog, 'verify card');

  -- 3. assign it (→ 'assigned')  [null assignee is fine — we're proving the event fires]
  perform ops_assign_task(v_task, null);

  -- 4. move it to the done column (→ 'moved' WITH from/to metadata, AND 'completed')
  perform ops_move_task(v_task, v_done, 0);

  -- 5. archive the project (→ 'archived')

  perform ops_archive_project(v_project);

  -- ── ASSERTIONS ──────────────────────────────────────────────────────
  select count(*) into n from activity_events where object_id = v_project and object_type='project' and verb='created';
  if n <> 1 then raise exception 'FAIL: project "created" event missing (got %)', n; end if;

  select count(*) into n from activity_events where object_id = v_task and verb='created';
  if n <> 1 then raise exception 'FAIL: task "created" event missing (got %)', n; end if;

  select count(*) into n from activity_events where object_id = v_task and verb='assigned';
  if n <> 1 then raise exception 'FAIL: "assigned" event missing (got %)', n; end if;

  -- the move event must carry from/to columns in metadata
  select metadata into v_meta from activity_events where object_id = v_task and verb='moved' order by created_at desc limit 1;
  if v_meta is null then raise exception 'FAIL: "moved" event missing'; end if;
  if (v_meta->>'from_column')::uuid <> v_backlog or (v_meta->>'to_column')::uuid <> v_done then
    raise exception 'FAIL: "moved" metadata wrong: %', v_meta;
  end if;

  select count(*) into n from activity_events where object_id = v_task and verb='completed';
  if n <> 1 then raise exception 'FAIL: "completed" event not emitted on entering done column (got %)', n; end if;

  select count(*) into n from activity_events where object_id = v_project and verb='archived';
  if n <> 1 then raise exception 'FAIL: "archived" event missing (got %)', n; end if;

  -- actor must be stamped server-side (the simulated admin), never null/forged
  select count(*) into n from activity_events where project_id = v_project and actor is distinct from auth.uid();
  if n <> 0 then raise exception 'FAIL: % event(s) had an actor other than the caller', n; end if;

  raise notice '✓ SPINE OK — % events emitted for the verification board, all correct (created/assigned/moved+from-to/completed/archived, actor stamped).',
    (select count(*) from activity_events where project_id = v_project);
end$$;

-- Non-destructive: nothing above is kept. (Swap to COMMIT if you'd rather keep
-- the board and inspect the events in a direct select.)
rollback;
