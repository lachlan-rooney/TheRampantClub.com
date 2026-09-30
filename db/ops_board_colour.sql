-- ═══════════════════════════════════════════════════════════════════════════
-- OPS HUB · A BOARD'S COLOUR, EDITABLE.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-09-30: "how did you change the colours on the boards? can we add
-- that to the admin abilities?"
--
-- `projects.colour` has been there since Phase 1, and the board list has always
-- painted it as the 3px edge down the left of each card — but NOTHING in the
-- admin ever set it. "New board" sent a name and nothing else; "Edit board"
-- sent a name and a description. So every board carried the fallback grey-green
-- until three were created through the RPC by hand this week, which is what the
-- owner noticed.
--
-- The create function already accepts p_colour. This is the update function
-- catching up.
--
-- ⚠ THE OLD 3-ARG SIGNATURE IS DROPPED FIRST. PostgREST routes by argument
-- shape, so leaving it in place would give two functions that both answer an
-- ops_update_project call — and the old one would silently blank nothing while
-- appearing to work. One function, four args. (Same lesson as the Gantt file's
-- ops_update_task, and as the stale record_my_consent overload.)
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'projects'
                    and column_name = 'colour') then
    raise exception 'PREREQUISITES MISSING — projects.colour (run db/ops_hub_phase1.sql)'
      using hint = 'Nothing applied.';
  end if;
  if not exists (select 1 from pg_proc where proname = 'ops_emit_event') then
    raise exception 'PREREQUISITES MISSING — ops_emit_event' using hint = 'Nothing applied.';
  end if;
end $prereq$;

drop function if exists ops_update_project(uuid, text, text);

create or replace function ops_update_project(
  p_project_id uuid, p_name text, p_description text, p_colour text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_uid(auth.uid()) then
    raise exception 'not authorized: only admins edit boards';
  end if;

  -- A HEX OR NOTHING. The value is interpolated into a style attribute on the
  -- board list, so it is checked here rather than trusted from the client: a
  -- board colour is not a place to accept arbitrary text.
  if p_colour is not null and p_colour !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'colour must be a #rrggbb hex value, got %', p_colour;
  end if;

  update projects
     set name        = p_name,
         description = p_description,
         colour      = p_colour,          -- null clears it back to the default edge
         updated_at  = now()
   where id = p_project_id;

  perform ops_emit_event('updated', 'project', p_project_id, p_project_id,
    jsonb_build_object('name', p_name, 'colour', p_colour));
end$$;

grant execute on function ops_update_project(uuid, text, text, text) to authenticated;

-- The same guard on the way in, so a board cannot be CREATED with a bad colour
-- either. Everything else about this function is unchanged from Phase 1.
create or replace function ops_create_project(
  p_name text, p_description text default null, p_colour text default null,
  p_start_date date default null, p_target_date date default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  if not is_admin_uid(auth.uid()) then
    raise exception 'not authorized: only admins create projects';
  end if;
  if p_colour is not null and p_colour !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'colour must be a #rrggbb hex value, got %', p_colour;
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

grant execute on function ops_create_project(text, text, text, date, date) to authenticated;

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- Exactly one ops_update_project, and it takes four arguments:
--   select proname, pg_get_function_identity_arguments(oid)
--     from pg_proc where proname in ('ops_update_project','ops_create_project');
-- And the colours as they stand:
--   select name, colour from projects where deleted_at is null order by created_at;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- drop function if exists ops_update_project(uuid, text, text, text);
-- …then re-create the 3-arg version from db/ops_hub_phase1.sql. The colours
-- already stored stay stored; only the ability to change them goes.
