-- Run once in the Supabase SQL editor, AFTER ops_hub_phase1.sql and ops_hub_phase2_feed.sql.
--
-- TRC Operations Hub — PHASE 3 (recurring tasks). The ⚠ hard phase. Three traps,
-- all handled deliberately:
--
--  • TRAP 1 — TIMEZONE. "Today"/"this week" are Vietnam-local. ops_today_vn()
--    returns (now() at time zone 'Asia/Ho_Chi_Minh')::date, and the daily Vercel
--    cron is scheduled at 00:05 VN (17:05 UTC). The job keys off the VN date.
--
--  • TRAP 2 — CARRY-OVER = (c) auto-lapse + fresh. On each daily run, any recurring
--    instance from a PRIOR day still un-done is marked 'lapsed' and emits a
--    'lapsed' event carrying its snapshotted title + the due-date ("…lapsed — was
--    due Mon 3 Jun"); today's fresh instance materialises regardless.
--
--  • TRAP 3 — DECOUPLING (third proof of the snapshot principle, after the sealed
--    checklists and enrich-at-write). Materialising COPIES the template's content
--    into the task row; a later template edit changes only FUTURE instances.
--
-- Idempotency is a DB GUARANTEE: a partial unique index on (template_id,
-- materialised_for) means a double-fired / retried cron cannot create two
-- instances for the same template+day — un-raceable, unlike an app-level check.
--
-- Idempotent / re-runnable.

begin;

-- ════════════════════════════════════════════════════════════════════
--  TABLE: task_templates  (create BEFORE the tasks FK below)
-- ════════════════════════════════════════════════════════════════════
-- recurrence jsonb shapes (Phase 3 — deliberately minimal):
--   { "freq": "daily" }
--   { "freq": "weekly", "weekdays": [1,3,5] }   -- ISO weekday 1=Mon … 7=Sun
create table if not exists task_templates (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  column_id          uuid not null references board_columns(id) on delete cascade,
  title              text not null,
  description        text,
  priority           varchar(8) not null default 'normal' check (priority in ('low','normal','high','urgent')),
  default_assignee   uuid references team_members(id) on delete set null,
  recurrence         jsonb not null default '{"freq":"daily"}'::jsonb,
  active             boolean not null default true,
  last_materialised_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_task_templates_project on task_templates(project_id);

-- ── tasks gains the recurrence link + the materialisation-day marker ──
alter table tasks add column if not exists template_id      uuid references task_templates(id) on delete set null;
alter table tasks add column if not exists materialised_for date;

-- Idempotency guarantee: at most ONE materialised instance per template per day.
-- Partial — ordinary (non-recurring) tasks have template_id null and are exempt.
create unique index if not exists ux_tasks_template_day
  on tasks (template_id, materialised_for)
  where template_id is not null;

-- ════════════════════════════════════════════════════════════════════
--  TRAP 1 — the Vietnam-local "today"
-- ════════════════════════════════════════════════════════════════════
create or replace function ops_today_vn()
  returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

-- ════════════════════════════════════════════════════════════════════
--  Refinement 2 — ops_emit_event gains an EXPLICIT actor-name override.
--  Human RPCs pass nothing → actor_name = the real profile name (or null →
--  "Someone", a visible anomaly). Only callers that pass p_actor_name (the
--  materialiser passes 'Recurring') get a system label — never a blanket
--  coalesce that could silently mislabel a broken human action as "Recurring".
-- ════════════════════════════════════════════════════════════════════
drop function if exists ops_emit_event(text, text, uuid, uuid, jsonb);
create or replace function ops_emit_event(
  p_verb text, p_object_type text, p_object_id uuid, p_project_id uuid,
  p_metadata jsonb default '{}'::jsonb, p_actor_name text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_actor_name text;
begin
  -- explicit label wins ONLY when given; otherwise the real human's name.
  v_actor_name := coalesce(p_actor_name, ops_profile_name(auth.uid()));
  insert into activity_events (actor, verb, object_type, object_id, project_id, metadata)
  values (
    auth.uid(), p_verb, p_object_type, p_object_id, p_project_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('actor_name', v_actor_name)
  )
  returning id into v_id;
  return v_id;
end$$;

-- ════════════════════════════════════════════════════════════════════
--  Template CRUD (INVOKER → table RLS enforces editor role)
-- ════════════════════════════════════════════════════════════════════
create or replace function ops_create_template(
  p_project_id uuid, p_column_id uuid, p_title text,
  p_description text default null, p_priority text default 'normal',
  p_default_assignee uuid default null, p_recurrence jsonb default '{"freq":"daily"}'::jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into task_templates (project_id, column_id, title, description, priority, default_assignee, recurrence)
  values (p_project_id, p_column_id, p_title, p_description, p_priority, p_default_assignee, p_recurrence)
  returning id into v_id;
  perform ops_emit_event('created', 'template', v_id, p_project_id,
    jsonb_build_object('title', p_title, 'recurrence', p_recurrence));
  return v_id;
end$$;

create or replace function ops_update_template(
  p_id uuid, p_title text, p_description text, p_priority text,
  p_default_assignee uuid, p_recurrence jsonb, p_active boolean
) returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid;
begin
  update task_templates
     set title = p_title, description = p_description, priority = p_priority,
         default_assignee = p_default_assignee, recurrence = p_recurrence,
         active = p_active, updated_at = now()
   where id = p_id
   returning project_id into v_project;
  if v_project is null then raise exception 'update not permitted'; end if;
  perform ops_emit_event('updated', 'template', p_id, v_project,
    jsonb_build_object('title', p_title));
end$$;

create or replace function ops_set_template_active(p_id uuid, p_active boolean)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid;
begin
  update task_templates set active = p_active, updated_at = now()
   where id = p_id returning project_id into v_project;
  if v_project is null then raise exception 'not permitted'; end if;
  perform ops_emit_event('updated', 'template', p_id, v_project,
    jsonb_build_object('active', p_active));
end$$;

-- ════════════════════════════════════════════════════════════════════
--  THE MATERIALISER — lapse pass (Trap 2) + create pass (Trap 3 snapshot),
--  keyed on the VN date (Trap 1), idempotent by the unique index.
--  SECURITY DEFINER: runs from cron (service role, no auth.uid()) or a manual
--  admin trigger; the work is a system action.
--  Returns a summary jsonb: { run_date, created, lapsed }.
-- ════════════════════════════════════════════════════════════════════
create or replace function ops_materialise_due(p_run_date date default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_date    date := coalesce(p_run_date, ops_today_vn());
  v_isodow  int  := extract(isodow from coalesce(p_run_date, ops_today_vn()))::int;
  v_created int  := 0;
  v_lapsed  int  := 0;
  tmpl      task_templates%rowtype;
  inst      record;
  v_due     boolean;
  v_task    uuid;
  v_sort    int;
  v_col_name text;
begin
  -- ── Pass 1: carry-over (c) — lapse PRIOR-day un-done recurring instances ──
  for inst in
    select id, project_id, title, materialised_for
      from tasks
     where template_id is not null
       and materialised_for < v_date
       and completed_at is null
       and status <> 'lapsed'
  loop
    update tasks set status = 'lapsed', updated_at = now() where id = inst.id;
    perform ops_emit_event('lapsed', 'task', inst.id, inst.project_id,
      jsonb_build_object('title', inst.title, 'due_date', inst.materialised_for),
      'Recurring');
    v_lapsed := v_lapsed + 1;
  end loop;

  -- ── Pass 2: materialise today's due instances (snapshot template content) ──
  for tmpl in select * from task_templates where active loop
    if (tmpl.recurrence->>'freq') = 'daily' then
      v_due := true;
    elsif (tmpl.recurrence->>'freq') = 'weekly' then
      v_due := exists (
        select 1 from jsonb_array_elements_text(coalesce(tmpl.recurrence->'weekdays', '[]'::jsonb)) w
        where w::int = v_isodow
      );
    else
      v_due := false;
    end if;
    if not v_due then continue; end if;

    select coalesce(max(sort_order) + 1, 0) into v_sort from tasks where column_id = tmpl.column_id;

    -- The unique index makes this un-raceable: a concurrent/duplicate run that
    -- already created today's instance simply inserts nothing.
    insert into tasks (project_id, column_id, title, description, assignee, priority,
                       due_date, sort_order, created_by, template_id, materialised_for)
    values (tmpl.project_id, tmpl.column_id, tmpl.title, tmpl.description, tmpl.default_assignee,
            tmpl.priority, v_date, v_sort, null, tmpl.id, v_date)
    on conflict (template_id, materialised_for) where template_id is not null do nothing
    returning id into v_task;

    if v_task is not null then
      select name into v_col_name from board_columns where id = tmpl.column_id;
      perform ops_emit_event('created', 'task', v_task, tmpl.project_id,
        jsonb_build_object('title', tmpl.title, 'column_name', v_col_name,
                           'from_template', true, 'template_id', tmpl.id,
                           'assignee', tmpl.default_assignee,
                           'assignee_name', ops_team_member_name(tmpl.default_assignee)),
        'Recurring');
      update task_templates set last_materialised_at = now() where id = tmpl.id;
      v_created := v_created + 1;
    end if;
  end loop;

  return jsonb_build_object('run_date', v_date, 'created', v_created, 'lapsed', v_lapsed);
end$$;

-- ════════════════════════════════════════════════════════════════════
--  RLS  (same model as tasks: member reads, editor writes)
-- ════════════════════════════════════════════════════════════════════
alter table task_templates enable row level security;

drop policy if exists "templates select" on task_templates;
create policy "templates select" on task_templates
  for select using (is_project_member(project_id, auth.uid()));
drop policy if exists "templates write" on task_templates;
create policy "templates write" on task_templates
  for all
  using      (is_project_editor(project_id, auth.uid()))
  with check (is_project_editor(project_id, auth.uid()));

-- ════════════════════════════════════════════════════════════════════
--  GRANTS
-- ════════════════════════════════════════════════════════════════════
grant execute on function ops_today_vn()                                          to authenticated;
grant execute on function ops_emit_event(text, text, uuid, uuid, jsonb, text)     to authenticated;
grant execute on function ops_create_template(uuid, uuid, text, text, text, uuid, jsonb) to authenticated;
grant execute on function ops_update_template(uuid, text, text, text, uuid, jsonb, boolean) to authenticated;
grant execute on function ops_set_template_active(uuid, boolean)                  to authenticated;
grant execute on function ops_materialise_due(date)                               to authenticated, service_role;

commit;

-- Verify (after this migration): run ops_hub_phase3_verify.sql.
