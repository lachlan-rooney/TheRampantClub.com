-- ═══════════════════════════════════════════════════════════════════════════
-- OFFICE REPLACES MORNING · MID IS RETIRED · THE OPENER ARRIVES BEFORE THE DOORS
-- ───────────────────────────────────────────────────────────────────────────
-- Three changes, all of them from 2026-09-14.
--
-- 1. MORNING BECOMES OFFICE. The name was wrong for what the shift is. It is
--    not an early bar shift — nobody is served before three. It is the desk:
--    deliveries, stock, orders, the shift tasks, the paperwork. Calling it
--    Morning invited the question "morning of what?" every time a new person
--    read the rota. 10:00–16:00, an hour for lunch between twelve and one,
--    five paid hours.
--
-- 2. MID IS REMOVED. It ran 16:00–00:30, which is exactly the Close — a second
--    name for the same shift, left over from the club that ran to 3am. Two
--    shift TYPES now, three or four PEOPLE on them each night. The 63 shifts
--    already worked as Mid keep the word: rota_shifts.shift_name is a text
--    snapshot by design (db/ops_hub_phase4_rota.sql), not a foreign key, so
--    history reads as it was worked and the type can go. The last one was
--    2026-09-12; nothing future-dated is touched.
--
-- 3. THE OPENER NOW STARTS AT 14:30, NOT 15:00. Lachlan caught this: the doors
--    open at three and the Open shift began at three, so the first member
--    through the door arrived to a dark room, a cold till and nobody behind
--    the bar. Mon–Fri the Office shift covers it by accident — that person is
--    in until four — but Saturday and Sunday have no Office shift at all, so
--    on the two busiest days there was nobody in the building before opening.
--    Half an hour of set-up, seven days:
--
--      Office  10:00 – 16:00   5.0h paid (1h unpaid lunch)   weekdays only
--      Open    14:30 – 23:00   8.5h   in at half two, doors at three, out at last call
--      Close   16:00 – 00:30   8.5h   the peak, last call, the room cleared, the lock
--
--    STILL 8.5 HOURS. The shift moved, it did not grow — the six-day week is
--    still 47.5h against the 48-hour ceiling, and no rota already written
--    needs regenerating. Only the clock times on it change.
--
-- Safe to run more than once. Also re-adds the two columns from
-- db/rota_policy.sql that an older copy of that file did not have, so this
-- runs correctly whichever version was used.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if to_regclass('public.rota_shift_types') is null then
    raise exception 'rota_shift_types does not exist here — the rota is not installed';
  end if;
end $$;

-- From db/rota_policy.sql; repeated because an earlier copy of that file was
-- the one run, and it had neither column. Both are no-ops if already present.
alter table rota_shift_types add column if not exists start_time    time;
alter table rota_shift_types add column if not exists end_time      time;
alter table rota_shift_types add column if not exists hours         numeric(4,2);
alter table rota_shift_types add column if not exists break_minutes int not null default 0;
alter table team_members     add column if not exists works_evenings boolean not null default true;

-- ── 1 · Office ────────────────────────────────────────────────────────────
-- The new type goes in BEFORE the shifts are repointed and the old type is
-- dropped, so that at no moment does a shift name a type that isn't there.
insert into rota_shift_types (name, sort_order, start_time, end_time, hours, break_minutes) values
  ('Office', -1, '10:00', '16:00', 5.0, 60)
on conflict (name) do update set
  sort_order = excluded.sort_order, start_time = excluded.start_time,
  end_time = excluded.end_time, hours = excluded.hours, break_minutes = excluded.break_minutes;

-- Every shift ever rostered as Morning becomes Office, past and future alike.
-- This IS a rewrite of history, and deliberately so: unlike Mid, nothing about
-- the shift changed but its name, so leaving the old word on last month's rota
-- would mean two names for one thing rather than a record of a real difference.
update rota_shifts set shift_name = 'Office', updated_at = now()
 where shift_name = 'Morning';

delete from rota_shift_types where name = 'Morning';

-- ── 2 · Mid, gone ─────────────────────────────────────────────────────────
-- The type only. The shifts worked under the name stay as they were worked.
delete from rota_shift_types where name = 'Mid';

-- The coverage panel seeded a floor and a bar for Mid; with no Mid to roster
-- these are rows nobody can ever satisfy, which is how a coverage panel starts
-- being ignored.
delete from rota_coverage_targets where shift_name = 'Mid';

-- ── 3 · The opener arrives before the doors ───────────────────────────────
update rota_shift_types set start_time = '14:30', end_time = '23:00', hours = 8.5 where name = 'Open';
update rota_shift_types set start_time = '16:00', end_time = '00:30', hours = 8.5 where name = 'Close';

-- Shifts already rostered carry their own clock times, copied from the type at
-- the time they were written. The four proposed weeks were written with the old
-- 15:00 start, so they are corrected here — a rota that says three when the
-- rule says half two is worse than no times at all. Past shifts are left alone:
-- they record when people actually came in.
update rota_shifts set start_time = '14:30', end_time = '23:00', updated_at = now()
 where shift_name = 'Open' and shift_date >= current_date;
update rota_shifts set start_time = '10:00', end_time = '16:00', updated_at = now()
 where shift_name = 'Office' and shift_date >= current_date;

-- ── Proof, printed by the run ─────────────────────────────────────────────
do $$
declare v_morning int; v_mid int; v_office int; v_open_start time; v_hist_mid int;
begin
  select count(*) into v_morning from rota_shift_types where name = 'Morning';
  select count(*) into v_mid     from rota_shift_types where name = 'Mid';
  select count(*) into v_office  from rota_shift_types where name = 'Office';
  select start_time into v_open_start from rota_shift_types where name = 'Open';
  select count(*) into v_hist_mid from rota_shifts where shift_name = 'Mid';

  if v_morning > 0 then raise exception 'the Morning type is still here'; end if;
  if v_mid     > 0 then raise exception 'the Mid type is still here'; end if;
  if v_office  < 1 then raise exception 'the Office type did not arrive'; end if;
  if v_open_start <> time '14:30' then
    raise exception 'Open still starts at % — the doors open at 15:00 and somebody has to be in before them', v_open_start;
  end if;

  raise notice 'shift types now: %', (select string_agg(name || ' ' || to_char(start_time,'HH24:MI') || '-' || to_char(end_time,'HH24:MI') || ' (' || hours || 'h)', ' · ' order by sort_order) from rota_shift_types);
  raise notice 'Office shifts on the rota: %', (select count(*) from rota_shifts where shift_name = 'Office');
  raise notice 'historical shifts still named Mid: % (kept — that is what was worked)', v_hist_mid;
end $$;

commit;
