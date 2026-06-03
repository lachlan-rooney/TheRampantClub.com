-- TRC Operations Hub — PHASE 5 LINKS PROBE
-- Run in the Supabase SQL editor AFTER ops_hub_phase1..5 migrations.
--
-- Proves cross-site links, with the new failure mode (deletion) as the headline:
--   • link a card → 'linked' event snapshots the object's label at link time
--   • rename the target → the OLD event keeps the OLD label (enrich-at-write)
--   • DELETE the target → the task's link ref SURVIVES (no FK cascade) and the
--     event stays honest — deletion is a non-event by construction, not a 500
--   • unlink → clears the ref, emits 'unlinked'
-- (The card rendering "no longer exists" for a deleted target is the eyeball;
--  this probe proves the data side: no cascade, snapshot honest.)
-- Self-asserting, ROLLS BACK, prints a visible PASS row.

begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '3e1583db-b881-42ec-aadb-6f69a22fad80', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

do $$
declare
  v_project uuid; v_backlog uuid; v_task uuid;
  v_type text; v_id text; v_label text;
begin
  v_project := ops_create_project('LINKS PROBE', 'temp');
  select id into v_backlog from board_columns where project_id = v_project and sort_order = 0;
  v_task := ops_create_task(v_project, v_backlog, 'Follow up');

  -- a real member to link to
  insert into members (member_no, full_name, tier) values ('TRC-LNKTST', 'Link Target', 'Pioneer')
    on conflict (member_no) do update set full_name = excluded.full_name;

  -- link → stored on task + snapshotted on the event
  perform ops_link_task(v_task, 'member', 'TRC-LNKTST', 'Link Target');
  select linked_object_type, linked_object_id into v_type, v_id from tasks where id = v_task;
  if v_type <> 'member' or v_id <> 'TRC-LNKTST' then raise exception 'FAIL: link not stored on the task (%, %)', v_type, v_id; end if;
  select metadata->>'linked_label' into v_label from activity_events where object_id = v_task and verb = 'linked';
  if v_label <> 'Link Target' then raise exception 'FAIL: linked event label = % (expected Link Target)', v_label; end if;

  -- rename target → the OLD event keeps the OLD label
  update members set full_name = 'Renamed Target' where member_no = 'TRC-LNKTST';
  select metadata->>'linked_label' into v_label from activity_events where object_id = v_task and verb = 'linked';
  if v_label <> 'Link Target' then raise exception 'FAIL: HISTORY REWRITTEN — linked event now reads "%" after target rename', v_label; end if;

  -- ── HEADLINE: delete the target → task link ref SURVIVES (no cascade) ──
  delete from members where member_no = 'TRC-LNKTST';
  select linked_object_id into v_id from tasks where id = v_task;
  if v_id is distinct from 'TRC-LNKTST' then
    raise exception 'FAIL: DELETION CASCADED — task lost its link ref when the target was deleted (a dangling text ref should survive; the resolver renders it dead)';
  end if;
  select metadata->>'linked_label' into v_label from activity_events where object_id = v_task and verb = 'linked';
  if v_label <> 'Link Target' then raise exception 'FAIL: linked event corrupted after target delete (got %)', v_label; end if;

  -- unlink → clears the ref + emits 'unlinked'
  perform ops_unlink_task(v_task, 'Link Target');
  select linked_object_type into v_type from tasks where id = v_task;
  if v_type is not null then raise exception 'FAIL: unlink did not clear the link'; end if;
  if not exists (select 1 from activity_events where object_id = v_task and verb = 'unlinked') then
    raise exception 'FAIL: no unlinked event emitted';
  end if;

  raise notice '✓ LINKS OK';
end$$;

rollback;

-- Visible PASS row (editor hides RAISE NOTICE). Only reached if no assertion threw.
select '✓ LINKS OK — link stored + event snapshots label; target rename did NOT rewrite the old event; DELETING the target left the task ref intact (no cascade — degrades, never breaks) with the event still honest; unlink clears + emits. Non-destructive; re-run anytime.' as result;
