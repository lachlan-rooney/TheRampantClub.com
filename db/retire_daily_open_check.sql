-- ═══════════════════════════════════════════════════════════════════════════
-- RETIRE "DAILY OPEN CHECK".  REVIEW, then run. Idempotent, transactional.
-- ───────────────────────────────────────────────────────────────────────────
-- 95 cards generated since 3 June. ONE completed (9 June). 93 lapsed, 1 open.
--
-- The floor has obviously been opening every day, so this is not work anyone
-- failed to do — it is a card nobody was ever going to tick. It had NO default
-- assignee, exactly like the stocktake, and it sat on a board nobody works from.
--
-- Leaving it running is the real cost: it teaches the team that "lapsed" is a
-- normal state for a task to be in. That habit would kill the new shift board
-- too, which is the one place we have just made completion mean something.
--
-- The work itself already lives in the opening/closing checklist. What was
-- missing was anyone VERIFYING the checklist gets completed — so that becomes
-- Mr Sĩ's Monday task, where it has a name against it by construction.
--
-- THE RULE THIS SETS: a task lapsing three weeks running is a design fault, not
-- a discipline problem. Either it gets a name against it or it stops existing.
-- The Monday review now surfaces these so nobody has to notice at 95 cards.
--
-- The 93 lapsed rows are LEFT IN PLACE. They are the argument for the change.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $retire$
declare
  v_tpl uuid := 'f6b0b574-d080-4e9b-963b-41e8298c7c33';
  v_total int; v_done int; v_lapsed int; v_open int;
begin
  select count(*) filter (where true),
         count(*) filter (where status = 'done'),
         count(*) filter (where status = 'lapsed'),
         count(*) filter (where status not in ('done','lapsed'))
    into v_total, v_done, v_lapsed, v_open
    from tasks where template_id = v_tpl;

  update task_templates set
    active = false,
    description = 'RETIRED 2026-09-09. ' || v_total || ' cards generated since 3 June; ' || v_done ||
      ' completed. It had NO ASSIGNEE and sat on a board nobody works from, so it lapsed daily while the ' ||
      'floor opened normally every one of those days — a card nobody was ever going to tick, not work ' ||
      'anyone failed to do. The opening/closing checklist already holds this work; VERIFYING it is ' ||
      'completed is now Mr Sĩ''s Monday task, where it has a name against it. The lapsed rows are left ' ||
      'in place deliberately: they are the argument for the change.',
    updated_at = now()
  where id = v_tpl;

  if not found then raise exception 'Daily Open Check template % not found — nothing changed.', v_tpl; end if;

  -- The one still-open card would otherwise sit on the board forever with a
  -- retired parent. Close it as lapsed so the record is honest rather than tidy.
  update tasks set status = 'lapsed', updated_at = now()
   where template_id = v_tpl and status not in ('done','lapsed');

  raise notice 'Daily Open Check retired — % cards (% done, % lapsed, % open→lapsed). Rows kept.',
    v_total, v_done, v_lapsed, v_open;
end $retire$;

-- ═══ ITS NEW HOME: Mr Sĩ verifies the checklist is actually being done ══════
insert into shift_template_tasks (template_id, sort, title_en, title_vi, is_prospect_task)
select t.id, 9,
  'Check last week''s opening checklists were completed and sealed. Any day missing, find out why before the review.',
  'Kiểm tra các phiếu mở cửa tuần trước đã hoàn thành và niêm phong. Ngày nào thiếu, tìm hiểu nguyên nhân trước buổi rà soát.',
  false
from shift_templates t
where t.slug = 'operations_stock'
  and not exists (select 1 from shift_template_tasks x where x.template_id = t.id and x.sort = 9);

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_active boolean; v_open int; v_kept int; v_new int;
begin
  select active into v_active from task_templates where id = 'f6b0b574-d080-4e9b-963b-41e8298c7c33';
  if v_active then raise exception 'SELF-CHECK: Daily Open Check is still active'; end if;

  select count(*) into v_open from tasks
   where template_id = 'f6b0b574-d080-4e9b-963b-41e8298c7c33' and status not in ('done','lapsed');
  if v_open > 0 then raise exception 'SELF-CHECK: % card(s) still open under a retired template', v_open; end if;

  select count(*) into v_kept from tasks
   where template_id = 'f6b0b574-d080-4e9b-963b-41e8298c7c33' and status = 'lapsed';
  if v_kept < 90 then raise exception 'SELF-CHECK: only % lapsed rows remain — the record was destroyed', v_kept; end if;

  select count(*) into v_new from shift_template_tasks tt
    join shift_templates t on t.id = tt.template_id
   where t.slug = 'operations_stock' and tt.sort = 9;
  if v_new <> 1 then raise exception 'SELF-CHECK: the verification task did not land (found %)', v_new; end if;

  raise notice 'Retired. % lapsed rows kept as the record. Verification is now Mr Sĩ #9.', v_kept;
end $check$;

commit;
