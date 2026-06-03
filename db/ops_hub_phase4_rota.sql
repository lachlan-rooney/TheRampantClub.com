-- Run once in the Supabase SQL editor, AFTER ops_hub_phase1/2/3.
--
-- TRC Operations Hub — PHASE 4 (weekly rota). A club-wide staff rota: assign
-- team_members to named shifts on dates, see weekly coverage. SEPARATE model
-- from tasks/kanban; NOT the shift_checklists (that's open/close sheet content,
-- this is who-works-when). The simpler phase — no recurrence, no cron, no tz gate.
--
-- Decisions (confirmed):
--  • CLUB-WIDE single rota — not project-scoped. So RLS is admin-scoped
--    (is_admin_uid), not is_project_member. project_id is kept NULLABLE (default
--    null = the club rota) so a per-project overlay is possible later with no
--    reshape — same forward-proofing as the reserved tasks.linked_object_* cols.
--  • NAMED shifts, NOT a DB enum. shift_name is plain text; the editable name-set
--    lives in rota_shift_types (seeded Open/Mid/Close), renameable without a
--    migration. rota_shifts.shift_name is a varchar SNAPSHOT of the chosen name,
--    so renaming a type later never rewrites past shifts (decoupling principle).
--  • Rota changes EMIT through the spine (human actor — no 'Recurring' label),
--    snapshotting member name + shift label + date (enrich-at-write).
--
-- Idempotent / re-runnable.

begin;

-- ── Editable shift-name suggestions (the lightest persistent, shared, runtime-
--    editable list — not an enum, not a heavyweight CRUD surface) ──
create table if not exists rota_shift_types (
  name        text primary key,
  sort_order  integer not null default 0
);
insert into rota_shift_types (name, sort_order) values ('Open', 0), ('Mid', 1), ('Close', 2)
  on conflict (name) do nothing;

-- ── The rota itself ──
create table if not exists rota_shifts (
  id          uuid primary key default gen_random_uuid(),
  member      uuid not null references team_members(id) on delete cascade,
  shift_date  date not null,
  shift_name  text not null,                       -- varchar SNAPSHOT (not enum)
  start_time  time,                                -- optional clock times
  end_time    time,
  role        text,
  project_id  uuid references projects(id) on delete cascade,  -- null = club-wide rota
  notes       text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_rota_shifts_date on rota_shifts(shift_date);
create index if not exists idx_rota_shifts_member on rota_shifts(member);

-- ════════════════════════════════════════════════════════════════════
--  RPCs — atomic write+emit, HUMAN actor (no 'Recurring' override).
--  INVOKER so admin-RLS on rota_shifts enforces (a non-admin write hits 0 rows
--  → raise → no event). Each emits 'shift' events with snapshotted labels.
-- ════════════════════════════════════════════════════════════════════
create or replace function ops_create_shift(
  p_member uuid, p_shift_date date, p_shift_name text,
  p_start_time time default null, p_end_time time default null,
  p_role text default null, p_notes text default null, p_project_id uuid default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into rota_shifts (member, shift_date, shift_name, start_time, end_time, role, project_id, notes, created_by)
  values (p_member, p_shift_date, p_shift_name, p_start_time, p_end_time, p_role, p_project_id, p_notes, auth.uid())
  returning id into v_id;
  perform ops_emit_event('assigned', 'shift', v_id, p_project_id,
    jsonb_build_object('member', p_member, 'member_name', ops_team_member_name(p_member),
                       'shift_name', p_shift_name, 'shift_date', p_shift_date, 'role', p_role));
  return v_id;
end$$;

create or replace function ops_update_shift(
  p_id uuid, p_member uuid, p_shift_name text,
  p_start_time time, p_end_time time, p_role text, p_notes text
) returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_date date;
begin
  update rota_shifts
     set member = p_member, shift_name = p_shift_name, start_time = p_start_time,
         end_time = p_end_time, role = p_role, notes = p_notes, updated_at = now()
   where id = p_id
   returning project_id, shift_date into v_project, v_date;
  if not found then raise exception 'update not permitted'; end if;
  perform ops_emit_event('updated', 'shift', p_id, v_project,
    jsonb_build_object('member', p_member, 'member_name', ops_team_member_name(p_member),
                       'shift_name', p_shift_name, 'shift_date', v_date, 'role', p_role));
end$$;

create or replace function ops_delete_shift(p_id uuid)
  returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_member uuid; v_name text; v_date date;
begin
  delete from rota_shifts where id = p_id
    returning project_id, member, shift_name, shift_date into v_project, v_member, v_name, v_date;
  if v_member is null then raise exception 'remove not permitted'; end if;
  perform ops_emit_event('removed', 'shift', p_id, v_project,
    jsonb_build_object('member', v_member, 'member_name', ops_team_member_name(v_member),
                       'shift_name', v_name, 'shift_date', v_date));
end$$;

-- ════════════════════════════════════════════════════════════════════
--  RLS — admin-scoped (club-wide rota isn't project-scoped). Latent future:
--  a team member sees their own shifts — add when members get Hub access.
-- ════════════════════════════════════════════════════════════════════
alter table rota_shifts      enable row level security;
alter table rota_shift_types enable row level security;

drop policy if exists "admin all on rota_shifts" on rota_shifts;
create policy "admin all on rota_shifts" on rota_shifts
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

drop policy if exists "admin all on rota_shift_types" on rota_shift_types;
create policy "admin all on rota_shift_types" on rota_shift_types
  for all using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

grant execute on function ops_create_shift(uuid, date, text, time, time, text, text, uuid) to authenticated;
grant execute on function ops_update_shift(uuid, uuid, text, time, time, text, text)        to authenticated;
grant execute on function ops_delete_shift(uuid)                                            to authenticated;

commit;

-- Verify (after this migration): run ops_hub_phase4_verify.sql.
