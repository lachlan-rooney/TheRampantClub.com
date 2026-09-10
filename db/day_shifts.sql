-- ═══════════════════════════════════════════════════════════════════════════
-- DAY SHIFTS — self-contained history, Not Required, one-off tasks, and the
-- end of "not yours".   REVIEW, then run. Idempotent, transactional.
-- ───────────────────────────────────────────────────────────────────────────
-- Four changes, and the first is the one that matters most.
--
-- ═══ 1 · A PAST WEEK MUST RENDER FROM ITS OWN ROWS ═════════════════════════
-- Today a week is drawn by walking the CURRENT template and looking up each
-- instance. That makes history quietly wrong in three directions:
--
--   · a task retired today VANISHES from a week where somebody did it
--   · a task added today appears across every past week as UNDONE, so last
--     month retroactively looks like it was failing
--   · a one-off could not exist at all
--
-- Nobody catches any of it, because the CURRENT week always looks right.
--
-- The cheap fix — reverse the join, drop the `active` filter — leaves the same
-- class of bug quieter: reword a template task today and last month's record
-- changes wording with it. So the title is SNAPSHOTTED onto the instance. After
-- this, a week is readable with no reference to the template at all, which is
-- the only version that is actually true.
--
-- ═══ 2 · NOT REQUIRED IS A THIRD STATE, NOT A SHADE OF DONE ════════════════
-- A task nobody needed is not a task completed, and a supervisor reading the
-- week must tell them apart at a glance. It carries who and when through
-- shift_task_events — provenance, not a bare flag — and it is reversible.
--
-- ONE INSTANCE PER TASK PER WEEK (idx_shift_instance_once, and each template
-- task belongs to exactly one day). So "this week" and "this day" are the SAME
-- SCOPE here. The label is honest, but only for that reason — if a task ever
-- occurs twice in a week, this comment is the thing that was wrong.
--
-- ═══ 3 · ONE-OFF TASKS DO NOT RECUR ════════════════════════════════════════
-- template_task_id becomes nullable and the instance carries its own title.
-- shift_materialise_week only ever inserts FROM template tasks, so a one-off
-- cannot follow you into next week — that is structural, not a rule someone has
-- to remember. Carry-over keys on template_task_id, which is null here, so a
-- one-off also cannot carry.
--
-- ═══ 4 · THE ROSTER IS THE EXPECTATION, NOT THE PERMISSION ═════════════════
-- shift_task_update refused anyone but the assignee ('not_yours'). That was not
-- asked for; it was invented here and then defended by a test, which made it
-- look more decided than it was. Its real effect: someone covering a colleague's
-- day cannot tick ANYTHING, and the only way round is a supervisor revert. That
-- is a live problem in a club of five with a moving roster.
--
-- Now any active staff member may act, and completed_by records WHO ACTUALLY
-- DID IT. A supervisor reading the week sees Tiên did Wednesday though Sy was
-- rostered — which is more useful than the task sitting undone and a lie by
-- omission. Turning back a done or a not-required still costs a NOTE, from
-- anybody, because the trail is the part worth keeping.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if to_regclass('public.shift_task_instances') is null then
    raise exception 'DAY SHIFTS: run db/shift_tasks.sql first' using hint = 'Nothing applied.';
  end if;
end $prereq$;

-- ═══ 1 · THE INSTANCE CARRIES ITS OWN WORDING ══════════════════════════════
alter table shift_task_instances add column if not exists title_en text;
alter table shift_task_instances add column if not exists title_vi text;
alter table shift_task_instances add column if not exists is_one_off boolean not null default false;
alter table shift_task_instances add column if not exists created_by uuid references team_members(id);

-- Backfill from the template BEFORE the column is made compulsory. Existing
-- rows have a template task, so this cannot lose anything.
update shift_task_instances i
   set title_en = tt.title_en, title_vi = tt.title_vi
  from shift_template_tasks tt
 where tt.id = i.template_task_id
   and i.title_en is null;

do $backfill$
declare v_null int;
begin
  select count(*) into v_null from shift_task_instances where title_en is null;
  if v_null > 0 then
    raise exception 'BACKFILL INCOMPLETE — % instance(s) still have no title. Not making the column NOT NULL.', v_null;
  end if;
end $backfill$;

alter table shift_task_instances alter column title_en set not null;
-- Nullable ONLY now that every row has one, and only after the check above.
alter table shift_task_instances alter column template_task_id drop not null;

-- ═══ 2 · THE THIRD STATE ═══════════════════════════════════════════════════
alter table shift_task_instances drop constraint if exists shift_task_instances_status_check;
alter table shift_task_instances add constraint shift_task_instances_status_check
  check (status in ('not_started','in_progress','done','blocked','not_required'));

-- not_required needs NO evidence — that is the whole point of it. The existing
-- evidence constraint keys on 'done' only, so it already agrees; restated here
-- so a future reader does not have to go and check.
alter table shift_task_events drop constraint if exists shift_task_events_kind_check;
alter table shift_task_events add constraint shift_task_events_kind_check
  check (kind in ('revert','status','note','evidence','not_required','added'));

-- ═══ 3 · GENERATION, NOW SNAPSHOTTING THE WORDING ══════════════════════════
create or replace function shift_materialise_week(p_week_start date default null)
  returns int language plpgsql security definer set search_path = public as $fn$
declare v_week date; v_prev date; v_made int := 0;
begin
  v_week := coalesce(p_week_start,
    (date_trunc('week', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date));
  v_prev := v_week - 7;

  insert into shift_task_instances (
    template_task_id, template_id, week_start, shift_date,
    assignee_team_member_id, carried_over_count, title_en, title_vi)
  select
    tt.id, t.id, v_week, v_week + (t.day_of_week - 1),
    t.assignee_team_member_id,
    coalesce((
      select case when pi.status in ('done','not_required') then 0
                  else pi.carried_over_count + 1 end
        from shift_task_instances pi
       where pi.template_task_id = tt.id and pi.week_start = v_prev
    ), 0),
    -- THE SNAPSHOT. Reword the template tomorrow and this row keeps what it
    -- said on the day, which is what makes a past week self-contained.
    tt.title_en, tt.title_vi
  from shift_template_tasks tt
  join shift_templates t on t.id = tt.template_id
  where tt.active and t.active
  on conflict (template_task_id, week_start) do nothing;

  get diagnostics v_made = row_count;
  return v_made;
end $fn$;
revoke all on function shift_materialise_week(date) from public;
grant execute on function shift_materialise_week(date) to service_role;

-- ═══ 4 · A ONE-OFF, FOR THIS DAY ONLY ══════════════════════════════════════
create or replace function shift_add_one_off(
  p_template uuid, p_week date, p_actor uuid, p_title text
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_day int; v_assignee uuid;
begin
  if p_title is null or btrim(p_title) = '' then raise exception 'a task needs a title'; end if;
  select day_of_week, assignee_team_member_id into v_day, v_assignee
    from shift_templates where id = p_template;
  if not found then raise exception 'unknown shift'; end if;

  -- template_task_id stays NULL. That is what stops it recurring: materialise
  -- reads template tasks, and this is not one.
  insert into shift_task_instances (
    template_task_id, template_id, week_start, shift_date,
    assignee_team_member_id, title_en, is_one_off, created_by)
  values (null, p_template, p_week, p_week + (v_day - 1),
          v_assignee, btrim(p_title), true, p_actor)
  returning id into v_id;

  insert into shift_task_events (instance_id, kind, actor_team_member_id, actor_name, note)
  select v_id, 'added', p_actor, tm.display_name, btrim(p_title)
    from team_members tm where tm.id = p_actor;

  return v_id;
end $fn$;
revoke all on function shift_add_one_off(uuid,date,uuid,text) from public;
grant execute on function shift_add_one_off(uuid,date,uuid,text) to service_role;

-- ═══ 5 · UPDATE — THE ROSTER IS NO LONGER THE PERMISSION ═══════════════════
create or replace function shift_task_update(
  p_instance uuid,
  p_actor    uuid,
  p_status   text default null,
  p_evidence text default null,
  p_blocked_reason text default null,
  p_blocked_unblocker text default null,
  p_note     text default null,
  p_revert_note text default null,
  p_prospect text default null
) returns text language plpgsql security definer set search_path = public as $fn$
declare
  v_row shift_task_instances%rowtype;
  v_actor team_members%rowtype;
  v_old text;
  v_is_revert boolean := false;
  v_kind text;
begin
  select * into v_row from shift_task_instances where id = p_instance for update;
  if not found then return 'unknown'; end if;
  select * into v_actor from team_members where id = p_actor and active;
  if not found then return 'no_actor'; end if;

  v_old := v_row.status;

  -- Turning back a DONE or a NOT REQUIRED is a REVERT and costs a note —
  -- from anyone, including the person who set it. The note is the point; who
  -- is allowed to write it never was.
  if v_old in ('done','not_required') and p_status is not null and p_status <> v_old then
    if p_revert_note is null or btrim(p_revert_note) = '' then return 'revert_needs_note'; end if;
    v_is_revert := true;
  end if;

  update shift_task_instances set
    status            = coalesce(p_status, status),
    evidence          = coalesce(p_evidence, evidence),
    blocked_reason    = coalesce(p_blocked_reason, blocked_reason),
    blocked_unblocker = coalesce(p_blocked_unblocker, blocked_unblocker),
    note              = coalesce(p_note, note),
    prospect_id       = coalesce(p_prospect, prospect_id),
    completed_at      = case when coalesce(p_status, status) = 'done' then now() else null end,
    -- WHO ACTUALLY DID IT, never who was rostered.
    completed_by      = case when coalesce(p_status, status) = 'done' then p_actor else null end,
    updated_at        = now()
  where id = p_instance;

  v_kind := case when v_is_revert then 'revert'
                 when p_status = 'not_required' then 'not_required'
                 else 'status' end;

  if v_is_revert or (p_status is not null and p_status is distinct from v_old) then
    insert into shift_task_events (instance_id, kind, actor_team_member_id, actor_name,
                                   old_status, new_status, note)
    values (p_instance, v_kind, p_actor, v_actor.display_name, v_old, p_status,
            coalesce(nullif(btrim(coalesce(p_revert_note,'')),''), nullif(btrim(coalesce(p_note,'')),'')));
  end if;

  return null;
exception when check_violation then
  return case when p_status = 'done' then 'needs_evidence' else 'needs_reason' end;
end $fn$;
revoke all on function shift_task_update(uuid,uuid,text,text,text,text,text,text,text) from public;
-- SERVICE ROLE ONLY — the actor is a PARAMETER, so anyone able to call this
-- could pass anyone's id. See db/shift_tasks_lock_actor.sql.
grant execute on function shift_task_update(uuid,uuid,text,text,text,text,text,text,text) to service_role;

-- ═══ 6 · SELF-CHECK ════════════════════════════════════════════════════════
do $check$
declare v_no_title int; v_nullable text; v_ok boolean;
begin
  select count(*) into v_no_title from shift_task_instances where title_en is null or btrim(title_en) = '';
  if v_no_title > 0 then raise exception 'SELF-CHECK: % instance(s) with no snapshotted title', v_no_title; end if;

  select is_nullable into v_nullable from information_schema.columns
   where table_name = 'shift_task_instances' and column_name = 'template_task_id';
  if v_nullable <> 'YES' then raise exception 'SELF-CHECK: template_task_id is still NOT NULL — one-offs impossible'; end if;

  -- The new state must be accepted, and the old refusal must be gone.
  select true into v_ok from pg_constraint
   where conname = 'shift_task_instances_status_check'
     and pg_get_constraintdef(oid) like '%not_required%';
  if v_ok is not true then raise exception 'SELF-CHECK: not_required is not an accepted status'; end if;

  if position('not_yours' in pg_get_functiondef(
       'shift_task_update(uuid,uuid,text,text,text,text,text,text,text)'::regprocedure)) > 0 then
    raise exception 'SELF-CHECK: shift_task_update still refuses non-assignees';
  end if;

  raise notice 'Day Shifts ready — titles snapshotted, one-offs possible, not_required live, roster is expectation not permission.';
end $check$;

commit;
