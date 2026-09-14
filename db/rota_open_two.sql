-- ═══════════════════════════════════════════════════════════════════════════
-- THE OPENER STARTS AT TWO · OUT AT HALF TEN
-- ───────────────────────────────────────────────────────────────────────────
-- Lachlan, 2026-09-14: "Open shifts must begin at 2pm. Not 2:30, we open at 3."
--
--   Open    14:00 – 22:30   8.5h   (was 14:30 – 23:00)
--
-- An hour before the doors, not half an hour: the room, the till, the bar set
-- and somebody's head clear before the first member walks in at three.
--
-- WHY IT ENDS AT 22:30 AND NOT 23:00. Starting half an hour earlier and keeping
-- the 23:00 finish makes Open a nine-hour shift, and the six-day week was built
-- to 47.5h against a 48h ceiling. At nine hours, measured on the four weeks
-- already written: Tiên 50h, Hiếu and Nhi 49–49.5h, Bình 48–48.5h — four of the
-- five over the maximum every week (Mr Sĩ, who always closes, unaffected).
-- Lachlan chose to move the finish rather than add an unpaid break or rebuild
-- the week. So the shift MOVED; it did not grow. Every weekly total stays
-- exactly where it was and no rota already written needs regenerating.
--
-- THE COST, SAID PLAINLY. The opener now leaves half an hour BEFORE last call
-- (23:00). Last call, the room cleared and the lock are the Close shift's
-- (16:00 – 00:30), which is unchanged. The proof block below warns about any
-- night that has an opener and no closer — that night would have nobody on
-- the floor after half ten.
--
-- ALSO CHANGED, so this cannot be undone by accident: db/rota_policy.sql and
-- db/rota_office_shift.sql both SET Open to 14:30 – 23:00, and the second also
-- REFUSED to finish unless it was 14:30. Both now write 14:00 – 22:30, so
-- re-running either leaves this in place.
--
-- Shifts already on the rota carry their own times (the chips read them), so
-- future Open shifts at the old 14:30 – 23:00 are moved too. Any Open shift
-- somebody has deliberately given other times is left alone, and so is
-- everything before today.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from rota_shift_types where name = 'Open') then
    raise exception 'There is no Open shift type here';
  end if;
end $$;

update rota_shift_types
   set start_time = '14:00', end_time = '22:30', hours = 8.5, break_minutes = 0
 where name = 'Open';

update rota_shifts
   set start_time = '14:00', end_time = '22:30', updated_at = now()
 where shift_name = 'Open'
   and shift_date >= date '2026-09-14'
   and start_time = time '14:30' and end_time = time '23:00';

-- ── The rule, enforced rather than remembered ─────────────────────────────
do $$
declare v_start time; v_end time; v_hours numeric;
begin
  select start_time, end_time, hours into v_start, v_end, v_hours from rota_shift_types where name = 'Open';
  if v_start <> time '14:00' then
    raise exception 'Open starts at % — it begins at two, an hour before the doors', v_start;
  end if;
  if v_end <> time '22:30' or v_hours <> 8.5 then
    raise exception 'Open is %–% (%h) — it is 14:00–22:30, 8.5h, so the six-day week stays under 48h', v_start, v_end, v_hours;
  end if;
end $$;

-- ── Proof, printed by the run ─────────────────────────────────────────────
do $$
declare r record; v_old int; v_unclosed text;
begin
  for r in
    select to_char(start_time, 'HH24:MI') || '–' || to_char(end_time, 'HH24:MI') as times, count(*) as n
      from rota_shifts where shift_name = 'Open' and shift_date >= date '2026-09-14'
     group by 1 order by 1
  loop
    raise notice 'Open shifts from 14 Sep at %: %', r.times, r.n;
  end loop;

  select count(*) into v_old from rota_shifts
   where shift_name = 'Open' and shift_date >= date '2026-09-14' and start_time = time '14:30';
  if v_old > 0 then
    raise warning '% future Open shifts still start at 14:30', v_old;
  end if;

  -- a night with an opener and no closer has nobody on the floor after 22:30
  select string_agg(to_char(d, 'Dy DD Mon'), ', ' order by d) into v_unclosed
    from (select distinct shift_date as d from rota_shifts
           where shift_name = 'Open' and shift_date >= date '2026-09-14') o
   where not exists (select 1 from rota_shifts c where c.shift_date = o.d and c.shift_name = 'Close');
  if v_unclosed is not null then
    raise warning 'Nights with an opener but NO closer — nobody on after 22:30: %', v_unclosed;
  else
    raise notice 'every night with an opener also has a closer on until 00:30';
  end if;
end $$;

commit;
