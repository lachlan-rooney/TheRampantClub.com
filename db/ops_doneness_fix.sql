-- Run once in the Supabase SQL editor.
--
-- TRC Operations Hub — DONE-NESS FIX. Tasks created directly INTO a done-semantics
-- column (the 87-row import) had their column set but completion never stamped:
-- status='open', completed_at=null. So the overdue rule (due_date < today & not
-- completed) flagged them red on the board AND the Gantt, and Phase 7 progress
-- under-counted them. Two parts:
--
--   A1 — backfill the already-wrong rows (completed_at = the task's due_date, a
--        "done around its due date" proxy — NOT now(), which would falsely spike
--        Phase 7's "completed this week").
--   A2 — fix the cause: ops_create_task now stamps status='done' + completed_at
--        when the target column is_done_column, so future create-into-Done is
--        correct. (The move path ops_move_task already stamps on drag-to-Done.)
--
-- Idempotent: A1 only touches done-column rows missing completion; A2 is create-
-- or-replace. Safe to re-run.

begin;

-- ── A1: backfill ──
update tasks t
   set status       = 'done',
       completed_at = coalesce(t.due_date::timestamptz, now()),
       updated_at   = now()
  from board_columns c
 where t.column_id = c.id
   and c.is_done_column = true
   and t.completed_at is null;

-- ── A2: stamp completion when a task is created into a done-semantics column ──
create or replace function ops_create_task(
  p_project_id uuid, p_column_id uuid, p_title text,
  p_description text default null, p_assignee uuid default null,
  p_priority text default 'normal', p_due_date date default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_task uuid; v_sort integer; v_col_name text; v_is_done boolean;
begin
  select coalesce(max(sort_order) + 1, 0) into v_sort from tasks where column_id = p_column_id;
  select name, is_done_column into v_col_name, v_is_done from board_columns where id = p_column_id;
  insert into tasks (project_id, column_id, title, description, assignee, priority, due_date, sort_order, created_by, status, completed_at)
  values (p_project_id, p_column_id, p_title, p_description, p_assignee, p_priority, p_due_date, v_sort, auth.uid(),
          case when v_is_done then 'done' else 'open' end,
          case when v_is_done then now() else null end)
  returning id into v_task;
  perform ops_emit_event('created', 'task', v_task, p_project_id,
    jsonb_build_object('title', p_title, 'column_id', p_column_id, 'column_name', v_col_name,
                       'assignee', p_assignee, 'assignee_name', ops_team_member_name(p_assignee)));
  return v_task;
end$$;

commit;

-- Quick check: done-column tasks should now all have completed_at set.
select count(*) filter (where t.completed_at is null) as still_unstamped,
       count(*)                                       as done_column_total
from tasks t join board_columns c on c.id = t.column_id
where c.is_done_column = true;
