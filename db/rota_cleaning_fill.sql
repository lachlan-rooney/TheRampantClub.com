-- ═══════════════════════════════════════════════════════════════════════════
-- THE CLEANERS, ROSTERED FOR FOUR WEEKS · NO EARLY CLEAN ON TUESDAY OR WEDNESDAY
-- ───────────────────────────────────────────────────────────────────────────
-- Lachlan, 2026-09-14:
--
--   "Fill the cleaners at random the next 4 weeks, they can be moved by mr sy.
--    Tuesday and Wednesday we only need evening cleaners."
--
-- 1. A SHIFT CAN RUN ON SOME WEEKDAYS ONLY. rota_shift_types.weekdays
--    (0 = Sunday … 6 = Saturday, NULL = every day). Clean Early is set to
--    Sun, Mon, Thu, Fri, Sat. On Tuesday and Wednesday the rota page wants
--    nobody on it, shows no red cell, autofill leaves it alone, and rule 8
--    stops asking for it. Clean Late stays every day.
--
-- 2. FOUR WEEKS, 14 SEP – 11 OCT, 48 SHIFTS. Drawn at random — but a random
--    draw of two people across two shifts can easily produce a week nobody
--    should be handed, so the draw was made only from patterns that pass:
--
--      • 12 HOURS BETWEEN SHIFTS. Late ends 23:00 and Early starts 09:00 —
--        ten hours. A late is therefore never followed by an early the next
--        day (Vietnam's Labour Code wants at least 12h between shifts).
--      • SIX SHIFTS EACH, EVERY WEEK. 42 hours, under the 48h ceiling, and
--        one day off in every calendar week.
--      • EVEN. 10 earlies and 14 lates each over the four weeks.
--
--    Of all 32 patterns that pass the first two, six are even; this is one of
--    those six, chosen at random.
--
--    ⚠ THE TRADE-OFF, SAID PLAINLY. The 12-hour rest makes the pattern sticky:
--    whoever is late on a run of two-cleaner days has to stay late until a
--    Tuesday or Wednesday lets them swap. Holding everyone to six days in a
--    row as well leaves only patterns where ONE person is late almost every
--    night (23 lates against 5). So this allows up to SEVEN in a row, across
--    a week boundary, when the late/early roles swap. Every calendar week
--    still has a day off.
--
-- MR SĨ CAN MOVE ANY OF THESE. They are ordinary shifts on the rota page —
-- drag, or click to edit. Nothing here locks them.
--
-- The shifts go straight into rota_shifts, so they log no 'assigned' events
-- (the SQL editor has no signed-in actor). Moves made on the page do log.
--
-- Safe to run more than once: a shift is skipped if that cleaning shift on
-- that date already has anyone on it, or if the cleaner already has a shift
-- that day or has it marked off.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from rota_shift_types where name = 'Clean Early')
     or not exists (select 1 from rota_shift_types where name = 'Clean Late') then
    raise exception 'The cleaning shifts do not exist — run db/rota_cleaning.sql first';
  end if;
  if (select count(*) from team_members where display_name in ('Miss Lan', 'Mr Van') and active) <> 2 then
    raise exception 'Expected exactly one active Miss Lan and one active Mr Van';
  end if;
end $$;

-- ── Which weekdays a shift runs ───────────────────────────────────────────
alter table rota_shift_types add column if not exists weekdays smallint[];

alter table rota_shift_types drop constraint if exists rota_shift_types_weekdays_valid;
alter table rota_shift_types add constraint rota_shift_types_weekdays_valid
  check (weekdays is null or (cardinality(weekdays) > 0 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]));

comment on column rota_shift_types.weekdays is
  'Weekdays this shift runs, 0=Sun…6=Sat. NULL = every day. Coverage, autofill and the rota check all read it.';

update rota_shift_types set weekdays = array[0,1,4,5,6]::smallint[] where name = 'Clean Early';
update rota_shift_types set weekdays = null                         where name = 'Clean Late';

-- ── The four weeks ────────────────────────────────────────────────────────
insert into rota_shifts (member, shift_date, shift_name, start_time, end_time)
select tm.id, v.d, v.shift, st.start_time, st.end_time
  from (values
  (date '2026-09-14', 'Miss Lan', 'Clean Early'),  -- Mon
  (date '2026-09-14', 'Mr Van',   'Clean Late'),   -- Mon
  (date '2026-09-15', 'Miss Lan', 'Clean Late'),   -- Tue
  (date '2026-09-16', 'Mr Van',   'Clean Late'),   -- Wed
  (date '2026-09-17', 'Miss Lan', 'Clean Early'),  -- Thu
  (date '2026-09-17', 'Mr Van',   'Clean Late'),   -- Thu
  (date '2026-09-18', 'Miss Lan', 'Clean Early'),  -- Fri
  (date '2026-09-18', 'Mr Van',   'Clean Late'),   -- Fri
  (date '2026-09-19', 'Miss Lan', 'Clean Early'),  -- Sat
  (date '2026-09-19', 'Mr Van',   'Clean Late'),   -- Sat
  (date '2026-09-20', 'Miss Lan', 'Clean Early'),  -- Sun
  (date '2026-09-20', 'Mr Van',   'Clean Late'),   -- Sun

  (date '2026-09-21', 'Miss Lan', 'Clean Early'),  -- Mon
  (date '2026-09-21', 'Mr Van',   'Clean Late'),   -- Mon
  (date '2026-09-22', 'Mr Van',   'Clean Late'),   -- Tue
  (date '2026-09-23', 'Miss Lan', 'Clean Late'),   -- Wed
  (date '2026-09-24', 'Miss Lan', 'Clean Late'),   -- Thu
  (date '2026-09-24', 'Mr Van',   'Clean Early'),  -- Thu
  (date '2026-09-25', 'Miss Lan', 'Clean Late'),   -- Fri
  (date '2026-09-25', 'Mr Van',   'Clean Early'),  -- Fri
  (date '2026-09-26', 'Miss Lan', 'Clean Late'),   -- Sat
  (date '2026-09-26', 'Mr Van',   'Clean Early'),  -- Sat
  (date '2026-09-27', 'Miss Lan', 'Clean Late'),   -- Sun
  (date '2026-09-27', 'Mr Van',   'Clean Early'),  -- Sun

  (date '2026-09-28', 'Miss Lan', 'Clean Late'),   -- Mon
  (date '2026-09-28', 'Mr Van',   'Clean Early'),  -- Mon
  (date '2026-09-29', 'Mr Van',   'Clean Late'),   -- Tue
  (date '2026-09-30', 'Miss Lan', 'Clean Late'),   -- Wed
  (date '2026-10-01', 'Miss Lan', 'Clean Late'),   -- Thu
  (date '2026-10-01', 'Mr Van',   'Clean Early'),  -- Thu
  (date '2026-10-02', 'Miss Lan', 'Clean Late'),   -- Fri
  (date '2026-10-02', 'Mr Van',   'Clean Early'),  -- Fri
  (date '2026-10-03', 'Miss Lan', 'Clean Late'),   -- Sat
  (date '2026-10-03', 'Mr Van',   'Clean Early'),  -- Sat
  (date '2026-10-04', 'Miss Lan', 'Clean Late'),   -- Sun
  (date '2026-10-04', 'Mr Van',   'Clean Early'),  -- Sun

  (date '2026-10-05', 'Miss Lan', 'Clean Late'),   -- Mon
  (date '2026-10-05', 'Mr Van',   'Clean Early'),  -- Mon
  (date '2026-10-06', 'Miss Lan', 'Clean Late'),   -- Tue
  (date '2026-10-07', 'Mr Van',   'Clean Late'),   -- Wed
  (date '2026-10-08', 'Miss Lan', 'Clean Early'),  -- Thu
  (date '2026-10-08', 'Mr Van',   'Clean Late'),   -- Thu
  (date '2026-10-09', 'Miss Lan', 'Clean Early'),  -- Fri
  (date '2026-10-09', 'Mr Van',   'Clean Late'),   -- Fri
  (date '2026-10-10', 'Miss Lan', 'Clean Early'),  -- Sat
  (date '2026-10-10', 'Mr Van',   'Clean Late'),   -- Sat
  (date '2026-10-11', 'Miss Lan', 'Clean Early'),  -- Sun
  (date '2026-10-11', 'Mr Van',   'Clean Late')    -- Sun
  ) v(d, person, shift)
  join team_members tm      on tm.display_name = v.person and tm.active
  join rota_shift_types st  on st.name = v.shift
 where not exists (select 1 from rota_shifts s where s.shift_date = v.d and s.shift_name = v.shift)
   and not exists (select 1 from rota_shifts s where s.shift_date = v.d and s.member = tm.id)
   and not exists (select 1 from rota_unavailability u where u.member = tm.id and u.off_date = v.d);

-- ── Proof, printed by the run ─────────────────────────────────────────────
do $$
declare r record; v_tuewed_early int; v_uncovered int; v_short_rest int;
begin
  for r in
    select tm.display_name,
           count(*) filter (where s.shift_name = 'Clean Early') as early,
           count(*) filter (where s.shift_name = 'Clean Late')  as late
      from team_members tm
      join rota_shifts s on s.member = tm.id and s.shift_date between date '2026-09-14' and date '2026-10-11'
     where tm.display_name in ('Miss Lan', 'Mr Van')
     group by tm.display_name order by tm.display_name
  loop
    raise notice '% — % early, % late, % hours', r.display_name, r.early, r.late, 7 * (r.early + r.late);
  end loop;

  select count(*) into v_tuewed_early from rota_shifts
   where shift_name = 'Clean Early' and extract(dow from shift_date) in (2, 3)
     and shift_date between date '2026-09-14' and date '2026-10-11';
  if v_tuewed_early > 0 then
    raise warning '% early cleans on a Tuesday or Wednesday — those are not wanted', v_tuewed_early;
  end if;

  -- every day needs a Clean Late; every day but Tue/Wed a Clean Early
  select count(*) into v_uncovered
    from generate_series(date '2026-09-14', date '2026-10-11', interval '1 day') g(d)
   cross join (values ('Clean Early'), ('Clean Late')) sh(name)
   where not (sh.name = 'Clean Early' and extract(dow from g.d) in (2, 3))
     and not exists (select 1 from rota_shifts s where s.shift_date = g.d::date and s.shift_name = sh.name);
  raise notice 'cleaning shifts still empty in the four weeks: %', v_uncovered;

  -- a late (ends 23:00) followed by the same person's early (09:00) next day
  select count(*) into v_short_rest
    from rota_shifts a
    join rota_shifts b on b.member = a.member and b.shift_date = a.shift_date + 1
   where a.shift_name = 'Clean Late' and b.shift_name = 'Clean Early'
     and a.shift_date between date '2026-09-14' and date '2026-10-11';
  if v_short_rest > 0 then
    raise warning '% late-then-early pairs with only 10 hours rest', v_short_rest;
  else
    raise notice 'no late shift is followed by an early one — 12h rest holds';
  end if;
end $$;

commit;
