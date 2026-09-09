-- ═══════════════════════════════════════════════════════════════════════════
-- SHIFT TASKS · CLOSE THE IMPERSONATION HOLE.  REVIEW, then run. RUN THIS.
-- ───────────────────────────────────────────────────────────────────────────
-- db/shift_tasks.sql granted shift_task_update to `authenticated`. The function
-- TAKES the acting team member as a parameter, so any signed-in user could pass
-- anyone's id and act as them. Demonstrated, not theorised:
--
--   authenticated caller, p_actor = Tiên  →  HTTP 200
--   row now: status=done evidence="FORGED — not Tiên"
--
-- That defeats the entire ownership rule. "Nobody ticks anyone else's box" was
-- true of the function's logic and false of the system, because the identity was
-- an argument rather than a fact.
--
-- THE FIX: only the SERVICE ROLE may call it. The server route derives the actor
-- from the trc_admin_staff cookie, which is httpOnly and set only by a verified
-- PIN — a client cannot forge it and cannot reach the function directly.
--
-- The general lesson, for anything similar: a SECURITY DEFINER function that
-- takes "who is doing this" as a parameter must never be callable by the people
-- it is meant to constrain.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

revoke execute on function shift_task_update(uuid,uuid,text,text,text,text,text,text,text) from authenticated;
revoke execute on function shift_task_update(uuid,uuid,text,text,text,text,text,text,text) from anon;

-- Materialisation is a system action too — cron or a manual admin button, both
-- of which run as the service role. Nothing client-side needs it.
revoke execute on function shift_materialise_week(date) from authenticated;
revoke execute on function shift_materialise_week(date) from anon;

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_bad text[] := '{}';
begin
  if has_function_privilege('authenticated',
       'shift_task_update(uuid,uuid,text,text,text,text,text,text,text)', 'execute')
    then v_bad := v_bad || 'shift_task_update/authenticated'; end if;
  if has_function_privilege('anon',
       'shift_task_update(uuid,uuid,text,text,text,text,text,text,text)', 'execute')
    then v_bad := v_bad || 'shift_task_update/anon'; end if;
  if has_function_privilege('authenticated', 'shift_materialise_week(date)', 'execute')
    then v_bad := v_bad || 'shift_materialise_week/authenticated'; end if;

  if array_length(v_bad,1) > 0 then
    raise exception 'SELF-CHECK: still callable by a client — %', array_to_string(v_bad, ', ');
  end if;

  -- And the service role MUST still have it, or the app stops working entirely.
  if not has_function_privilege('service_role',
       'shift_task_update(uuid,uuid,text,text,text,text,text,text,text)', 'execute') then
    raise exception 'SELF-CHECK: service_role lost execute — the app cannot write at all';
  end if;

  raise notice 'Actor is no longer forgeable: only the service role may call these.';
end $check$;

commit;
