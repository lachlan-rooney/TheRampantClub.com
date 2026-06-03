-- Run once in the Supabase SQL editor.
--
-- TRC Operations Hub — PHASE 1: boards, tasks, people + the activity-event spine.
--
-- This migration creates ONLY the Phase 1 tables (projects, board_columns,
-- project_members, tasks, task_checklists, team_members) plus the immutable
-- activity_events spine. Later-phase tables (task_templates, rota_shifts,
-- notifications) are intentionally NOT created here — they were designed up
-- front (see operations_hub_build_plan.md) and the Phase 1 shapes leave room
-- for them without a reshape.
--
-- ── The two non-negotiables baked into this schema ──
-- 1. THE EVENT SPINE IS UNBYPASSABLE. activity_events has a SELECT policy but
--    NO insert/update/delete policy. The ONLY writer is ops_emit_event(), a
--    SECURITY DEFINER function that bypasses RLS. So events can never be
--    forged or skipped by a client, and the log is append-only by construction.
--    Every mutation RPC below calls ops_emit_event in the SAME transaction, so
--    write+emit are atomic — a write can't land without its event.
-- 2. PRIVATE BY DESIGN (latent). activity_events / projects / tasks reads are
--    scoped to "admin sees all; a project member sees their projects'/own".
--    Today only admins reach /admin so the member branch is dormant, but the
--    privacy rule lives in RLS now, not as a future UI afterthought.
--
-- People split (D1=b):
--   • project_members.member → profiles.id   = who has ACCESS (auth users; drives RLS/visibility)
--   • tasks.assignee         → team_members  = who the work is assigned to (may be a name-only person)

begin;

-- ════════════════════════════════════════════════════════════════════
--  TABLES
-- ════════════════════════════════════════════════════════════════════

-- People. A team member may be a name-only person OR linked to an auth user.
create table if not exists team_members (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references profiles(id) on delete set null,  -- null = name-only (no auth account)
  display_name  text not null,
  role_title    text,
  division      text,                                             -- e.g. 'TRC' / 'DT'
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_team_members_profile on team_members(profile_id);

-- A project == a board.
create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  status       varchar(12) not null default 'active' check (status in ('active','archived')),
  colour       text,
  start_date   date,
  target_date  date,
  owner        uuid references profiles(id),                      -- auth user who owns the board
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Kanban columns per board. is_done_column drives completion semantics +
-- the Phase 7 progress aggregation (% of cards in a done column).
create table if not exists board_columns (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  name           text not null,
  sort_order     integer not null default 0,
  is_done_column boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_board_columns_project on board_columns(project_id, sort_order);

-- Who has access to a board, and at what role. member → profiles (auth users)
-- because this is what the per-user visibility RLS keys on (auth.uid()).
create table if not exists project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  member      uuid not null references profiles(id) on delete cascade,
  role        varchar(12) not null default 'contributor' check (role in ('owner','contributor','viewer')),
  created_at  timestamptz not null default now(),
  unique (project_id, member)
);
create index if not exists idx_project_members_member  on project_members(member);
create index if not exists idx_project_members_project on project_members(project_id);

-- The cards. assignee → team_members (the person doing the work, may be name-only).
-- linked_object_* are RESERVED for Phase 5 cross-site links — created now, unused.
create table if not exists tasks (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  column_id           uuid not null references board_columns(id) on delete cascade,
  title               text not null,
  description         text,
  assignee            uuid references team_members(id) on delete set null,
  priority            varchar(8) not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date            date,
  sort_order          integer not null default 0,
  status              varchar(12) not null default 'open',
  created_by          uuid references profiles(id),
  completed_at        timestamptz,
  linked_object_type  text,   -- Phase 5 (reserved, unused this phase)
  linked_object_id    text,   -- Phase 5 (reserved, unused this phase)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_column  on tasks(column_id, sort_order);

-- Optional sub-items within a card. (No activity events for sub-item toggles in
-- Phase 1 — too granular; the card-level events are the spine's grain.)
create table if not exists task_checklists (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  label       text not null,
  checked     boolean not null default false,
  sort_order  integer not null default 0
);
create index if not exists idx_task_checklists_task on task_checklists(task_id, sort_order);

-- ── THE SPINE ── append-only. Written ONLY by ops_emit_event (SECURITY DEFINER).
create table if not exists activity_events (
  id           uuid primary key default gen_random_uuid(),
  actor        uuid references profiles(id),       -- the auth user who acted (stamped server-side)
  verb         text not null,                      -- created | moved | assigned | completed | updated | archived | deleted | member_added | member_removed
  object_type  text not null,                      -- task | project | column
  object_id    uuid,
  project_id   uuid references projects(id) on delete set null,  -- for project-scoped feed filtering
  metadata     jsonb not null default '{}'::jsonb, -- e.g. { from_column, to_column } on a move
  created_at   timestamptz not null default now()
);
create index if not exists idx_activity_events_project on activity_events(project_id, created_at desc);
create index if not exists idx_activity_events_actor   on activity_events(actor, created_at desc);
create index if not exists idx_activity_events_when    on activity_events(created_at desc);

-- ════════════════════════════════════════════════════════════════════
--  HELPERS — SECURITY DEFINER so their internal lookups bypass RLS.
--  This is what prevents RLS recursion (a tasks policy that reads
--  project_members would otherwise re-trigger project_members' own policy).
-- ════════════════════════════════════════════════════════════════════

create or replace function is_admin_uid(p_uid uuid)
  returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = p_uid and is_admin = true);
$$;

create or replace function is_project_member(p_project_id uuid, p_uid uuid)
  returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = p_uid and is_admin = true)
      or exists (select 1 from project_members where project_id = p_project_id and member = p_uid);
$$;

create or replace function is_project_editor(p_project_id uuid, p_uid uuid)
  returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = p_uid and is_admin = true)
      or exists (select 1 from project_members
                 where project_id = p_project_id and member = p_uid and role in ('owner','contributor'));
$$;

-- ════════════════════════════════════════════════════════════════════
--  THE EMIT FUNCTION — the single, unbypassable writer of the spine.
-- ════════════════════════════════════════════════════════════════════
create or replace function ops_emit_event(
  p_verb text, p_object_type text, p_object_id uuid,
  p_project_id uuid, p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into activity_events (actor, verb, object_type, object_id, project_id, metadata)
  values (auth.uid(), p_verb, p_object_type, p_object_id, p_project_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end$$;

-- ════════════════════════════════════════════════════════════════════
--  ACTION RPCs — each does mutation + emit in ONE transaction.
--  All but ops_create_project are SECURITY INVOKER, so the underlying
--  table RLS still enforces roles (a viewer's UPDATE affects 0 rows →
--  the function raises and NO event is written). ops_create_project is
--  DEFINER because it must bootstrap the first owner-membership (a
--  chicken-and-egg RLS case) and is gated by an explicit admin check.
-- ════════════════════════════════════════════════════════════════════

-- Create a board: project + default columns + creator-as-owner + 'created' event.
create or replace function ops_create_project(
  p_name text, p_description text default null, p_colour text default null,
  p_start_date date default null, p_target_date date default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  if not is_admin_uid(auth.uid()) then
    raise exception 'not authorized: only admins create projects';
  end if;

  insert into projects (name, description, colour, start_date, target_date, owner)
  values (p_name, p_description, p_colour, p_start_date, p_target_date, auth.uid())
  returning id into v_project;

  insert into board_columns (project_id, name, sort_order, is_done_column) values
    (v_project, 'Backlog',     0, false),
    (v_project, 'In progress', 1, false),
    (v_project, 'Blocked',     2, false),
    (v_project, 'Done',        3, true);

  insert into project_members (project_id, member, role)
  values (v_project, auth.uid(), 'owner')
  on conflict (project_id, member) do nothing;

  perform ops_emit_event('created', 'project', v_project, v_project,
    jsonb_build_object('name', p_name));
  return v_project;
end$$;

create or replace function ops_archive_project(p_project_id uuid)
  returns void language plpgsql security invoker set search_path = public as $$
begin
  update projects set status = 'archived', updated_at = now() where id = p_project_id;
  if not found then raise exception 'archive not permitted'; end if;
  perform ops_emit_event('archived', 'project', p_project_id, p_project_id, '{}'::jsonb);
end$$;

create or replace function ops_create_column(p_project_id uuid, p_name text, p_is_done boolean default false)
  returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_sort integer;
begin
  select coalesce(max(sort_order) + 1, 0) into v_sort from board_columns where project_id = p_project_id;
  insert into board_columns (project_id, name, sort_order, is_done_column)
  values (p_project_id, p_name, v_sort, p_is_done)
  returning id into v_id;
  perform ops_emit_event('created', 'column', v_id, p_project_id, jsonb_build_object('name', p_name));
  return v_id;
end$$;

create or replace function ops_rename_column(p_column_id uuid, p_name text)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid;
begin
  update board_columns set name = p_name where id = p_column_id returning project_id into v_project;
  if v_project is null then raise exception 'rename not permitted'; end if;
  perform ops_emit_event('updated', 'column', p_column_id, v_project, jsonb_build_object('name', p_name));
end$$;

create or replace function ops_create_task(
  p_project_id uuid, p_column_id uuid, p_title text,
  p_description text default null, p_assignee uuid default null,
  p_priority text default 'normal', p_due_date date default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_task uuid; v_sort integer;
begin
  select coalesce(max(sort_order) + 1, 0) into v_sort from tasks where column_id = p_column_id;
  insert into tasks (project_id, column_id, title, description, assignee, priority, due_date, sort_order, created_by)
  values (p_project_id, p_column_id, p_title, p_description, p_assignee, p_priority, p_due_date, v_sort, auth.uid())
  returning id into v_task;
  perform ops_emit_event('created', 'task', v_task, p_project_id,
    jsonb_build_object('title', p_title, 'column_id', p_column_id, 'assignee', p_assignee));
  return v_task;
end$$;

create or replace function ops_update_task(
  p_task_id uuid, p_title text, p_description text, p_priority text, p_due_date date
) returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid;
begin
  update tasks
     set title = p_title, description = p_description, priority = p_priority,
         due_date = p_due_date, updated_at = now()
   where id = p_task_id
   returning project_id into v_project;
  if v_project is null then raise exception 'update not permitted'; end if;
  perform ops_emit_event('updated', 'task', p_task_id, v_project, jsonb_build_object('title', p_title));
end$$;

-- Move/reorder. Emits 'moved' (with from/to columns); also emits 'completed'
-- when the card first enters a done-column, and clears completion when it leaves.
create or replace function ops_move_task(p_task_id uuid, p_to_column_id uuid, p_to_sort integer)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_from_column uuid; v_was_completed timestamptz; v_to_done boolean;
begin
  select project_id, column_id, completed_at into v_project, v_from_column, v_was_completed
    from tasks where id = p_task_id;
  if v_project is null then raise exception 'task not found'; end if;
  select is_done_column into v_to_done from board_columns where id = p_to_column_id;

  update tasks
     set column_id    = p_to_column_id,
         sort_order   = p_to_sort,
         completed_at = case when v_to_done then coalesce(completed_at, now()) else null end,
         status       = case when v_to_done then 'done' else 'open' end,
         updated_at   = now()
   where id = p_task_id;
  if not found then raise exception 'move not permitted'; end if;

  perform ops_emit_event('moved', 'task', p_task_id, v_project,
    jsonb_build_object('from_column', v_from_column, 'to_column', p_to_column_id));
  if v_to_done and v_was_completed is null then
    perform ops_emit_event('completed', 'task', p_task_id, v_project, '{}'::jsonb);
  end if;
end$$;

create or replace function ops_assign_task(p_task_id uuid, p_assignee uuid)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid;
begin
  update tasks set assignee = p_assignee, updated_at = now()
   where id = p_task_id returning project_id into v_project;
  if v_project is null then raise exception 'assign not permitted'; end if;
  perform ops_emit_event('assigned', 'task', p_task_id, v_project, jsonb_build_object('assignee', p_assignee));
end$$;

create or replace function ops_delete_task(p_task_id uuid)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid;
begin
  delete from tasks where id = p_task_id returning project_id into v_project;
  if v_project is null then raise exception 'delete not permitted'; end if;
  perform ops_emit_event('deleted', 'task', p_task_id, v_project, '{}'::jsonb);
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
    jsonb_build_object('member', p_member, 'role', p_role));
  return v_id;
end$$;

create or replace function ops_remove_project_member(p_project_id uuid, p_member uuid)
  returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from project_members where project_id = p_project_id and member = p_member;
  if not found then raise exception 'remove not permitted'; end if;
  perform ops_emit_event('member_removed', 'project', p_project_id, p_project_id,
    jsonb_build_object('member', p_member));
end$$;

-- ════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════

alter table team_members    enable row level security;
alter table projects        enable row level security;
alter table board_columns   enable row level security;
alter table project_members enable row level security;
alter table tasks           enable row level security;
alter table task_checklists enable row level security;
alter table activity_events enable row level security;

-- team_members: admin-managed roster (the assignee picker). Admin-all for now.
drop policy if exists "admin all on team_members" on team_members;
create policy "admin all on team_members" on team_members
  for all
  using      (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

-- projects: members can read theirs; admins read all. Create = admin.
-- Update = admin or the board owner. Delete = admin.
drop policy if exists "projects select" on projects;
create policy "projects select" on projects
  for select using (is_project_member(id, auth.uid()));
drop policy if exists "projects insert" on projects;
create policy "projects insert" on projects
  for insert with check (is_admin_uid(auth.uid()));
drop policy if exists "projects update" on projects;
create policy "projects update" on projects
  for update using (is_admin_uid(auth.uid()) or owner = auth.uid())
            with check (is_admin_uid(auth.uid()) or owner = auth.uid());
drop policy if exists "projects delete" on projects;
create policy "projects delete" on projects
  for delete using (is_admin_uid(auth.uid()));

-- board_columns: read = member, write = editor (owner/contributor or admin).
drop policy if exists "columns select" on board_columns;
create policy "columns select" on board_columns
  for select using (is_project_member(project_id, auth.uid()));
drop policy if exists "columns write" on board_columns;
create policy "columns write" on board_columns
  for all
  using      (is_project_editor(project_id, auth.uid()))
  with check (is_project_editor(project_id, auth.uid()));

-- project_members: read = member, write = editor.
drop policy if exists "members select" on project_members;
create policy "members select" on project_members
  for select using (is_project_member(project_id, auth.uid()));
drop policy if exists "members write" on project_members;
create policy "members write" on project_members
  for all
  using      (is_project_editor(project_id, auth.uid()))
  with check (is_project_editor(project_id, auth.uid()));

-- tasks: read = member (viewer included); write = editor (viewer cannot edit).
drop policy if exists "tasks select" on tasks;
create policy "tasks select" on tasks
  for select using (is_project_member(project_id, auth.uid()));
drop policy if exists "tasks insert" on tasks;
create policy "tasks insert" on tasks
  for insert with check (is_project_editor(project_id, auth.uid()));
drop policy if exists "tasks update" on tasks;
create policy "tasks update" on tasks
  for update using (is_project_editor(project_id, auth.uid()))
            with check (is_project_editor(project_id, auth.uid()));
drop policy if exists "tasks delete" on tasks;
create policy "tasks delete" on tasks
  for delete using (is_project_editor(project_id, auth.uid()));

-- task_checklists: inherit the parent task's project access.
drop policy if exists "checklists select" on task_checklists;
create policy "checklists select" on task_checklists
  for select using (exists (
    select 1 from tasks t where t.id = task_checklists.task_id and is_project_member(t.project_id, auth.uid())
  ));
drop policy if exists "checklists write" on task_checklists;
create policy "checklists write" on task_checklists
  for all
  using (exists (
    select 1 from tasks t where t.id = task_checklists.task_id and is_project_editor(t.project_id, auth.uid())
  ))
  with check (exists (
    select 1 from tasks t where t.id = task_checklists.task_id and is_project_editor(t.project_id, auth.uid())
  ));

-- activity_events: SELECT only, scoped to the visibility rule. NO insert/update/
-- delete policy → the table is append-only and writable ONLY by ops_emit_event
-- (SECURITY DEFINER, which bypasses RLS). This is the structural guarantee.
drop policy if exists "events select" on activity_events;
create policy "events select" on activity_events
  for select using (
    is_admin_uid(auth.uid())
    or actor = auth.uid()
    or is_project_member(project_id, auth.uid())
  );

-- ════════════════════════════════════════════════════════════════════
--  GRANTS — expose helpers + RPCs to the authenticated role (PostgREST).
-- ════════════════════════════════════════════════════════════════════
grant execute on function is_admin_uid(uuid)                                  to authenticated;
grant execute on function is_project_member(uuid, uuid)                       to authenticated;
grant execute on function is_project_editor(uuid, uuid)                       to authenticated;
grant execute on function ops_emit_event(text, text, uuid, uuid, jsonb)       to authenticated;
grant execute on function ops_create_project(text, text, text, date, date)    to authenticated;
grant execute on function ops_archive_project(uuid)                           to authenticated;
grant execute on function ops_create_column(uuid, text, boolean)              to authenticated;
grant execute on function ops_rename_column(uuid, text)                       to authenticated;
grant execute on function ops_create_task(uuid, uuid, text, text, uuid, text, date) to authenticated;
grant execute on function ops_update_task(uuid, text, text, text, date)       to authenticated;
grant execute on function ops_move_task(uuid, uuid, integer)                  to authenticated;
grant execute on function ops_assign_task(uuid, uuid)                         to authenticated;
grant execute on function ops_delete_task(uuid)                               to authenticated;
grant execute on function ops_add_project_member(uuid, uuid, text)            to authenticated;
grant execute on function ops_remove_project_member(uuid, uuid)               to authenticated;

commit;

-- Verify (run after the migration):
--   select count(*) as projects from projects;
--   select count(*) as events_so_far from activity_events;
