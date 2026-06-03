-- Run once in the Supabase SQL editor, AFTER ops_hub_phase1..4.
--
-- TRC Operations Hub — PHASE 5 (cross-site links). The in-house justification:
-- a card LINKS to a real object elsewhere (member / whisky / checklist) and
-- deep-links to it. Uses the reserved tasks.linked_object_type / linked_object_id
-- columns from Phase 1 — NO new table.
--
-- Design:
--  • LIVE POINTER, not a snapshot. The task stores only (type, id); the card
--    resolves the object's CURRENT label/state at render. A link points at a live
--    thing — if it's renamed the chip shows the new name; if it's deleted the
--    resolver returns "no longer exists". Because linked_object_id is plain TEXT
--    with NO foreign key, a deleted target can't cascade or 500 — the dangling
--    ref just renders dead. Deletion-resilience is structural, not handled.
--  • The link EVENT, by contrast, snapshots the label at link time (enrich-at-
--    write) so the feed line "linked to 'Lagavulin 16'" stays honest forever.
--
-- Idempotent / re-runnable.

begin;

create or replace function ops_link_task(p_task_id uuid, p_object_type text, p_object_id text, p_label text)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid;
begin
  update tasks set linked_object_type = p_object_type, linked_object_id = p_object_id, updated_at = now()
   where id = p_task_id
   returning project_id into v_project;
  if v_project is null then raise exception 'link not permitted'; end if;
  perform ops_emit_event('linked', 'task', p_task_id, v_project,
    jsonb_build_object('linked_type', p_object_type, 'linked_id', p_object_id, 'linked_label', p_label));
end$$;

create or replace function ops_unlink_task(p_task_id uuid, p_label text default null)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_type text; v_id text;
begin
  select project_id, linked_object_type, linked_object_id into v_project, v_type, v_id
    from tasks where id = p_task_id;
  if v_project is null then raise exception 'task not found'; end if;
  update tasks set linked_object_type = null, linked_object_id = null, updated_at = now()
   where id = p_task_id;
  if not found then raise exception 'unlink not permitted'; end if;
  perform ops_emit_event('unlinked', 'task', p_task_id, v_project,
    jsonb_build_object('linked_type', v_type, 'linked_id', v_id, 'linked_label', p_label));
end$$;

grant execute on function ops_link_task(uuid, text, text, text) to authenticated;
grant execute on function ops_unlink_task(uuid, text)            to authenticated;

commit;

-- Verify (after this migration): run ops_hub_phase5_verify.sql.
