-- Run once in the Supabase SQL editor, AFTER ops_hub_phase1.sql.
--
-- TRC Operations Hub — PHASE 2 (feed): enrich-at-write.
--
-- The activity feed is a HISTORICAL record: each line must read as it was true
-- AT EVENT TIME, not as the world is now. So every emit snapshots the human
-- labels it needs (actor name, task title, column names, assignee/member names)
-- INTO the event's metadata. The feed then renders purely from that snapshot and
-- never re-joins live tables for its text — otherwise a later rename would
-- retroactively rewrite history (an old "created 'Draft invitations'" line would
-- silently become "Send invitations"). Same snapshot principle as the sealed
-- checklists: the event's copy is historical truth; the source row is current
-- state; they are MEANT to diverge.
--
-- This file supersedes the Phase 1 function bodies (create or replace). It is
-- idempotent — safe to re-run. No table changes; metadata is jsonb so the added
-- labels are purely additive.

begin;

-- ── Name-lookup helpers (SECURITY DEFINER) ──────────────────────────
-- profiles and team_members are not project-scoped-readable by an ordinary
-- editor, so resolving a name inside an INVOKER action RPC would hit RLS and
-- return null. These definer helpers do the lookup safely (read-only, by id).
create or replace function ops_profile_name(p_uid uuid)
  returns text language sql security definer set search_path = public stable as $$
  select display_name from profiles where id = p_uid;
$$;

create or replace function ops_team_member_name(p_id uuid)
  returns text language sql security definer set search_path = public stable as $$
  select display_name from team_members where id = p_id;
$$;

-- ── The emit function now stamps actor_name on EVERY event ───────────
create or replace function ops_emit_event(
  p_verb text, p_object_type text, p_object_id uuid,
  p_project_id uuid, p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into activity_events (actor, verb, object_type, object_id, project_id, metadata)
  values (
    auth.uid(), p_verb, p_object_type, p_object_id, p_project_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('actor_name', ops_profile_name(auth.uid()))
  )
  returning id into v_id;
  return v_id;
end$$;

-- ── Enriched action RPCs (snapshot labels into metadata) ─────────────

create or replace function ops_archive_project(p_project_id uuid)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_name text;
begin
  update projects set status = 'archived', updated_at = now()
   where id = p_project_id returning name into v_name;
  if not found then raise exception 'archive not permitted'; end if;
  perform ops_emit_event('archived', 'project', p_project_id, p_project_id,
    jsonb_build_object('name', v_name));
end$$;

create or replace function ops_rename_column(p_column_id uuid, p_name text)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_old text;
begin
  select project_id, name into v_project, v_old from board_columns where id = p_column_id;
  if v_project is null then raise exception 'rename not permitted'; end if;
  update board_columns set name = p_name where id = p_column_id;
  if not found then raise exception 'rename not permitted'; end if;
  perform ops_emit_event('updated', 'column', p_column_id, v_project,
    jsonb_build_object('name', p_name, 'old_name', v_old));
end$$;

create or replace function ops_create_task(
  p_project_id uuid, p_column_id uuid, p_title text,
  p_description text default null, p_assignee uuid default null,
  p_priority text default 'normal', p_due_date date default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_task uuid; v_sort integer; v_col_name text;
begin
  select coalesce(max(sort_order) + 1, 0) into v_sort from tasks where column_id = p_column_id;
  select name into v_col_name from board_columns where id = p_column_id;
  insert into tasks (project_id, column_id, title, description, assignee, priority, due_date, sort_order, created_by)
  values (p_project_id, p_column_id, p_title, p_description, p_assignee, p_priority, p_due_date, v_sort, auth.uid())
  returning id into v_task;
  perform ops_emit_event('created', 'task', v_task, p_project_id,
    jsonb_build_object('title', p_title, 'column_id', p_column_id, 'column_name', v_col_name,
                       'assignee', p_assignee, 'assignee_name', ops_team_member_name(p_assignee)));
  return v_task;
end$$;

create or replace function ops_move_task(p_task_id uuid, p_to_column_id uuid, p_to_sort integer)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_from_column uuid; v_was_completed timestamptz;
        v_to_done boolean; v_title text; v_from_name text; v_to_name text;
begin
  select project_id, column_id, completed_at, title
    into v_project, v_from_column, v_was_completed, v_title
    from tasks where id = p_task_id;
  if v_project is null then raise exception 'task not found'; end if;
  select is_done_column, name into v_to_done, v_to_name from board_columns where id = p_to_column_id;
  select name into v_from_name from board_columns where id = v_from_column;

  update tasks
     set column_id    = p_to_column_id,
         sort_order   = p_to_sort,
         completed_at = case when v_to_done then coalesce(completed_at, now()) else null end,
         status       = case when v_to_done then 'done' else 'open' end,
         updated_at   = now()
   where id = p_task_id;
  if not found then raise exception 'move not permitted'; end if;

  perform ops_emit_event('moved', 'task', p_task_id, v_project,
    jsonb_build_object('title', v_title, 'from_column', v_from_column, 'to_column', p_to_column_id,
                       'from_column_name', v_from_name, 'to_column_name', v_to_name));
  if v_to_done and v_was_completed is null then
    perform ops_emit_event('completed', 'task', p_task_id, v_project,
      jsonb_build_object('title', v_title));
  end if;
end$$;

create or replace function ops_reorder_column(p_column_id uuid, p_ordered_ids uuid[])
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_name text; i int;
begin
  select project_id, name into v_project, v_name from board_columns where id = p_column_id;
  if v_project is null then raise exception 'column not found'; end if;
  if not is_project_editor(v_project, auth.uid()) then raise exception 'reorder not permitted'; end if;
  for i in 1 .. coalesce(array_length(p_ordered_ids, 1), 0) loop
    update tasks set sort_order = i - 1, updated_at = now()
     where id = p_ordered_ids[i] and column_id = p_column_id;
  end loop;
  perform ops_emit_event('reordered', 'column', p_column_id, v_project,
    jsonb_build_object('column_name', v_name, 'count', coalesce(array_length(p_ordered_ids, 1), 0)));
end$$;

create or replace function ops_assign_task(p_task_id uuid, p_assignee uuid)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_title text;
begin
  update tasks set assignee = p_assignee, updated_at = now()
   where id = p_task_id returning project_id, title into v_project, v_title;
  if v_project is null then raise exception 'assign not permitted'; end if;
  perform ops_emit_event('assigned', 'task', p_task_id, v_project,
    jsonb_build_object('title', v_title, 'assignee', p_assignee,
                       'assignee_name', ops_team_member_name(p_assignee)));
end$$;

create or replace function ops_delete_task(p_task_id uuid)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_title text;
begin
  delete from tasks where id = p_task_id returning project_id, title into v_project, v_title;
  if v_project is null then raise exception 'delete not permitted'; end if;
  perform ops_emit_event('deleted', 'task', p_task_id, v_project,
    jsonb_build_object('title', v_title));
end$$;

create or replace function ops_add_project_member(p_project_id uuid, p_member uuid, p_role text default 'contributor')
  returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into project_members (project_id, member, role)
  values (p_project_id, p_member, p_role)
  on conflict (project_id, member) do update set role = excluded.role
  returning id into v_id;
  perform ops_emit_event('member_added', 'project', p_project_id, p_project_id,
    jsonb_build_object('member', p_member, 'member_name', ops_profile_name(p_member), 'role', p_role));
  return v_id;
end$$;

create or replace function ops_remove_project_member(p_project_id uuid, p_member uuid)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_member_name text;
begin
  v_member_name := ops_profile_name(p_member);
  delete from project_members where project_id = p_project_id and member = p_member;
  if not found then raise exception 'remove not permitted'; end if;
  perform ops_emit_event('member_removed', 'project', p_project_id, p_project_id,
    jsonb_build_object('member', p_member, 'member_name', v_member_name));
end$$;

grant execute on function ops_profile_name(uuid)      to authenticated;
grant execute on function ops_team_member_name(uuid)  to authenticated;

commit;
