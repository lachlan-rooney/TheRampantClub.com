-- Run once in the Supabase SQL editor, AFTER ops_hub_phase1..7.
--
-- TRC Operations Hub — GANTT support. Tasks gain an OPTIONAL start_date so the
-- board's Gantt view can draw ranged tasks (start→due) as BARS and due-only
-- tasks as MILESTONE diamonds — every task visible, none given a fabricated span.
--
-- start_date is NULLABLE: creation stays fast, the recurring materialiser is
-- untouched (it supplies due/materialised dates, not start → recurring tasks
-- stay milestones), and existing rows are non-breaking (NULL → milestone).
--
-- Idempotent / re-runnable.

begin;

-- The only schema change: a nullable start_date. Existing rows → NULL → milestones.
alter table tasks add column if not exists start_date date;

-- Extend ops_update_task with an optional start_date (the card editor's new
-- field). Drop the old 4-date-arg signature first so there's no overload
-- ambiguity — a single function, six args.
drop function if exists ops_update_task(uuid, text, text, text, date);
create or replace function ops_update_task(
  p_task_id uuid, p_title text, p_description text, p_priority text,
  p_due_date date, p_start_date date default null
) returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid;
begin
  -- coherent range only (defense-in-depth; the editor also guards)
  if p_start_date is not null and p_due_date is not null and p_start_date > p_due_date then
    raise exception 'invalid range: start_date (%) is after due_date (%)', p_start_date, p_due_date;
  end if;
  update tasks
     set title = p_title, description = p_description, priority = p_priority,
         due_date = p_due_date, start_date = p_start_date, updated_at = now()
   where id = p_task_id
   returning project_id into v_project;
  if v_project is null then raise exception 'update not permitted'; end if;
  perform ops_emit_event('updated', 'task', p_task_id, v_project, jsonb_build_object('title', p_title));
end$$;

-- Dedicated reschedule path for the Gantt drag — atomically writes both dates
-- and emits a 'rescheduled' event with SNAPSHOTTED labels (so the drag shows in
-- the activity feed like every other mutation, and renames don't rewrite it).
-- The Gantt writes through THIS (gateway-allowlisted), never a side path.
create or replace function ops_reschedule_task(p_task_id uuid, p_start_date date, p_due_date date)
returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_title text;
begin
  -- server-side guard: never persist an incoherent range (UI also clamps)
  if p_start_date is not null and p_due_date is not null and p_start_date > p_due_date then
    raise exception 'invalid range: start_date (%) is after due_date (%)', p_start_date, p_due_date;
  end if;
  update tasks set start_date = p_start_date, due_date = p_due_date, updated_at = now()
   where id = p_task_id
   returning project_id, title into v_project, v_title;
  if v_project is null then raise exception 'reschedule not permitted'; end if;
  perform ops_emit_event('rescheduled', 'task', p_task_id, v_project,
    jsonb_build_object('title', v_title, 'start_date', p_start_date, 'due_date', p_due_date));
end$$;

grant execute on function ops_update_task(uuid, text, text, text, date, date) to authenticated;
grant execute on function ops_reschedule_task(uuid, date, date)               to authenticated;

commit;

-- Verify (after this migration): run ops_hub_gantt_verify.sql.
