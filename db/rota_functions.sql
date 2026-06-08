-- ─────────────────────────────────────────────────────────────────────────
-- Rota: staff FUNCTIONS + a cross-day move RPC.
--
-- 1. team_members.functions — the roles a person can cover (bar/floor/host/gm).
--    A text[] (fixed small set, 11 people) — loads with the member, no join.
--    Admin-RLS already covers writes (the "Team & functions" editor updates it
--    directly, like rota_shift_types config writes — no spine event needed).
-- 2. ops_move_shift — moves a rota_shifts row to a new date AND/OR shift_name,
--    emitting to the activity spine (ops_update_shift had no date param, so it
--    couldn't express a cross-day drag). One uniform move path for the DnD.
-- Idempotent / re-runnable.
-- ─────────────────────────────────────────────────────────────────────────

alter table team_members add column if not exists functions text[] not null default '{}';

create or replace function ops_move_shift(
  p_id uuid, p_shift_date date, p_shift_name text
) returns void language plpgsql security invoker set search_path = public as $$
declare v_project uuid; v_member uuid;
begin
  update rota_shifts
     set shift_date = p_shift_date, shift_name = p_shift_name, updated_at = now()
   where id = p_id
   returning project_id, member into v_project, v_member;
  if not found then raise exception 'move not permitted'; end if;
  perform ops_emit_event('updated', 'shift', p_id, v_project,
    jsonb_build_object('member', v_member, 'member_name', ops_team_member_name(v_member),
                       'shift_name', p_shift_name, 'shift_date', p_shift_date, 'moved', true));
end$$;

grant execute on function ops_move_shift(uuid, date, text) to authenticated;
