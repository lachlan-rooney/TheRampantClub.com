-- TRC Operations Hub — PHASE 2 HISTORY-INTEGRITY PROBE
-- Run in the Supabase SQL editor AFTER ops_hub_phase1.sql AND ops_hub_phase2_feed.sql.
--
-- This proves enrich-at-write delivers its purpose: the activity log is a true
-- HISTORICAL record, not a live-state mirror. It is the direct analogue of the
-- checklist decoupling probe (edit the template → the sealed sheet is unchanged):
--   • rename a task → its OLD event still shows the OLD name (history not rewritten)
--   • delete a task → its events STILL name it (snapshot survives the row)
-- If a renamed task's old event still reads the old name, enrich-at-write worked.
-- If it updates, the feed is re-joining live tables somewhere and history is lying.
--
-- Pre-filled with the admin profiles.id below — just run it. (A profiles.id is a
-- row id, not a credential; harmless in-repo. Re-point it if the admin changes.)

begin;

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
  v_created_title text;
  v_deleted_title text;
  v_actor   text;
  v_move    jsonb;
begin
  v_project := ops_create_project('HISTORY PROBE', 'temp');
  select id into v_backlog from board_columns where project_id = v_project and sort_order = 0;
  select id into v_done    from board_columns where project_id = v_project and is_done_column;

  -- create the task with its ORIGINAL name
  v_task := ops_create_task(v_project, v_backlog, 'Draft invitations');

  -- snapshot label present on the created event?
  select metadata->>'title', metadata->>'actor_name'
    into v_created_title, v_actor
    from activity_events where object_id = v_task and verb = 'created';
  if v_created_title <> 'Draft invitations' then
    raise exception 'FAIL: created event did not snapshot the title (got %)', v_created_title;
  end if;
  if v_actor is null then
    raise exception 'FAIL: created event did not snapshot actor_name';
  end if;

  -- move snapshots column NAMES (not just ids)
  perform ops_move_task(v_task, v_done, 0);
  select metadata into v_move from activity_events where object_id = v_task and verb = 'moved' order by created_at desc limit 1;
  if v_move->>'to_column_name' is null or v_move->>'title' <> 'Draft invitations' then
    raise exception 'FAIL: moved event missing snapshotted column name / title: %', v_move;
  end if;

  -- ── THE PROBE: rename the task ──────────────────────────────────────
  perform ops_update_task(v_task, 'Send invitations', null, 'normal', null);

  -- the LIVE row is now renamed…
  if (select title from tasks where id = v_task) <> 'Send invitations' then
    raise exception 'FAIL: rename did not take on the live row';
  end if;
  -- …but the ORIGINAL created event MUST still read the old name.
  select metadata->>'title' into v_created_title
    from activity_events where object_id = v_task and verb = 'created';
  if v_created_title <> 'Draft invitations' then
    raise exception 'FAIL: HISTORY REWRITTEN — created event now reads "%" after rename (enrich-at-write is not holding; feed is re-joining live)', v_created_title;
  end if;

  -- ── delete the task → events must survive AND still name it ─────────
  perform ops_delete_task(v_task);
  if exists (select 1 from tasks where id = v_task) then
    raise exception 'FAIL: task not actually deleted';
  end if;
  -- created event still names it with the original title
  select metadata->>'title' into v_created_title
    from activity_events where object_id = v_task and verb = 'created';
  if v_created_title <> 'Draft invitations' then
    raise exception 'FAIL: created event lost its name after delete (got %)', v_created_title;
  end if;
  -- deleted event froze the title AS IT WAS AT DELETE TIME (the renamed value)
  select metadata->>'title' into v_deleted_title
    from activity_events where object_id = v_task and verb = 'deleted';
  if v_deleted_title <> 'Send invitations' then
    raise exception 'FAIL: deleted event did not snapshot the title at delete time (got %)', v_deleted_title;
  end if;

  raise notice '✓ HISTORY OK — created event froze "Draft invitations", survived the rename AND the delete; deleted event froze "Send invitations" (the value at delete time). The log is a true historical record, not a live mirror.';
end$$;

rollback;

-- Visible PASS row (the editor hides RAISE NOTICE). Only reached if the DO block
-- raised no exception — i.e. every assertion passed. A FAIL aborts before here.
select '✓ HISTORY OK — enrich-at-write held; rename/delete did not rewrite the log (no exception raised). Non-destructive; re-run anytime.' as result;
