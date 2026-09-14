-- ═══════════════════════════════════════════════════════════════════════════
-- THE CLEANERS GO ON THE ROTA — nine in the morning to eleven at night
-- ───────────────────────────────────────────────────────────────────────────
-- Cleaning was never on the rota at all, so the one thing about it that matters
-- — that somebody is always here — was held in nobody's head and provable by
-- nobody. Two shifts, and the rule Lachlan gave for them (2026-09-14):
--
--   THEY DO NOT OVERLAP, and between them they cover 09:00 to 23:00.
--
-- That is a TILING, not two shifts that happen to be near each other: the early
-- one ends at the exact minute the late one begins. Written as a constraint at
-- the bottom of this file, so a well-meaning edit to one time that opens a gap
-- is refused rather than discovered on a Saturday.
--
--   Clean Early  09:00 – 16:00   7.0h
--   Clean Late   16:00 – 23:00   7.0h
--
-- Lachlan's times, 2026-09-14 ("early cleaning 9-4, then late 4-11"). They
-- replace a first draft of 10:00–17:00 / 17:00–00:30, which ran the late shift
-- through to the lock. It no longer does: cleaning ends at 23:00, before the
-- Close shift (to 00:30), so the last hour and a half of the night — through
-- the clear-down to lock-up — is on the floor team, not a cleaner. That is a decision,
-- recorded here so nobody "fixes" it back.
--
-- ⚠ NO BREAK IS RECORDED ON EITHER. That is deliberate: the evening floor
-- shifts carry none either, and this file will not invent somebody's terms. But
-- a seven-hour shift almost certainly has one, and until it is
-- recorded the rota reads longer than the day actually is. Set
-- break_minutes and reduce hours to match when the real arrangement is known —
-- the Office shift (10:00–16:00, 60 minutes unpaid, five paid) is the worked
-- example.
--
-- NOT ROSTERED BY THIS FILE. It creates the two shifts, says one person is
-- wanted on each, and marks who the cleaners are. Who works which night is a
-- rota, and a rota is written on the rota.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if to_regclass('public.rota_shift_types') is null then
    raise exception 'rota_shift_types does not exist here — the rota is not installed';
  end if;
  if to_regclass('public.rota_coverage_targets') is null then
    raise exception 'rota_coverage_targets does not exist — run db/rota_coverage.sql first';
  end if;
end $$;

-- Columns this file reads, in case an older copy of db/rota_policy.sql was the
-- one run. All no-ops if already there.
alter table rota_shift_types add column if not exists start_time    time;
alter table rota_shift_types add column if not exists end_time      time;
alter table rota_shift_types add column if not exists hours         numeric(4,2);
alter table rota_shift_types add column if not exists break_minutes int not null default 0;
alter table team_members     add column if not exists works_evenings boolean not null default true;

-- ── The two shifts ────────────────────────────────────────────────────────
-- sort_order 10 and 11: below the floor rota, because the floor is what the
-- grid is read for and cleaning is a band underneath it, not a row among it.
insert into rota_shift_types (name, sort_order, start_time, end_time, hours, break_minutes) values
  ('Clean Early', 10, '09:00', '16:00', 7.0, 0),
  ('Clean Late',  11, '16:00', '23:00', 7.0, 0)
on conflict (name) do update set
  sort_order = excluded.sort_order, start_time = excluded.start_time,
  end_time = excluded.end_time, hours = excluded.hours, break_minutes = excluded.break_minutes;

-- ── One on each, every day ────────────────────────────────────────────────
-- The coverage panel is where "is anybody cleaning on Sunday?" gets answered,
-- and an empty answer there is the whole point of putting cleaning on the rota.
insert into rota_coverage_targets (shift_name, function, count) values
  ('Clean Early', 'clean', 1),
  ('Clean Late',  'clean', 1)
on conflict (shift_name, function) do update set count = excluded.count;

-- ── Who cleans ────────────────────────────────────────────────────────────
-- A function, not a job title: the rota reads team_members.functions to know
-- who can cover what, and a cleaner with an empty functions array can be
-- assigned to a bar shift by anybody who clicks the wrong cell.
--
-- The cleaners are MISS LAN and MR VAN — Lachlan, 2026-09-14. Neither was in
-- team_members, so they are added here. A first draft of this file guessed
-- Minh and Miss Ni from "Minh and Ni are different department"; that was
-- wrong, and this file no longer touches either of them.
--
-- display_name is not unique, so "add if missing" is a NOT EXISTS rather than
-- an ON CONFLICT — re-running this file must not make a second Mr Van.
insert into team_members (display_name, role_title, functions, works_evenings)
select v.name, 'Cleaner', array['clean'], false
  from (values ('Miss Lan'), ('Mr Van')) v(name)
 where not exists (select 1 from team_members tm where tm.display_name = v.name);

-- If either was already there (added by hand in the meantime), make sure they
-- carry the function, without dropping any other function they have.
update team_members
   set functions = (select array_agg(distinct f) from unnest(coalesce(functions, '{}') || array['clean']) f)
 where display_name in ('Miss Lan', 'Mr Van');

-- A cleaner is not floor cover. What ACTUALLY keeps them off the floor today is
-- the function above: autofill only offers a person to a cell whose coverage
-- target names a function they have, and 'clean' is the only one these two
-- carry. They also sit outside the floor rules (contracted hours, supervisor,
-- days off), which only apply to people with weekly_hours or morning_weekday
-- set — and neither is set here.
--
-- works_evenings = false is recorded as well, but be clear: as of 2026-09-14
-- NOTHING in the app reads it (it is declared in lib/ops/types.ts and used
-- nowhere). It is intent written down, not a guard. It does not stop them
-- working Clean Late, and it would not stop anyone dragging them onto Close.
update team_members set works_evenings = false where display_name in ('Miss Lan', 'Mr Van');

-- Miss Chau is a shift supervisor who works daytime only. db/rota_policy.sql
-- wrote this, but the live table still had her as works_evenings = true on
-- 2026-09-14, so it did not take. Repeated so the record is right — with the
-- same caveat as above: nothing reads this flag yet.
update team_members set works_evenings = false where display_name = 'Miss Chau';

-- ── The rule, enforced rather than remembered ─────────────────────────────
-- Nine in the morning to eleven at night, with no overlap and no gap.
do $$
declare
  v_e_start time; v_e_end time; v_l_start time; v_l_end time;
begin
  select start_time, end_time into v_e_start, v_e_end from rota_shift_types where name = 'Clean Early';
  select start_time, end_time into v_l_start, v_l_end from rota_shift_types where name = 'Clean Late';

  if v_e_start <> time '09:00' then
    raise exception 'Clean Early starts at % — the cleaners are here from nine', v_e_start;
  end if;
  if v_e_end <> v_l_start then
    raise exception 'Clean Early ends at % and Clean Late begins at % — they must not overlap, and must not leave a gap', v_e_end, v_l_start;
  end if;
  if v_l_end <> time '23:00' then
    raise exception 'Clean Late ends at % — cleaning runs to eleven', v_l_end;
  end if;

  raise notice 'cleaning covers % to % with no overlap, handing over at %', v_e_start, v_l_end, v_e_end;
end $$;

-- ── Proof, printed by the run ─────────────────────────────────────────────
do $$
declare v_cleaners text; v_n int;
begin
  select string_agg(display_name, ', ' order by display_name), count(*)
    into v_cleaners, v_n
    from team_members where active and 'clean' = any(functions);
  raise notice 'cleaners on the roster: % (%)', coalesce(v_cleaners, 'NOBODY'), v_n;
  if v_n = 0 then
    raise warning 'No active team member has the clean function — the shifts exist but nobody can be rostered on them. Edit the names in this file and re-run.';
  end if;
  raise notice 'daytime-only staff: %',
    (select coalesce(string_agg(display_name, ', ' order by display_name), 'none')
       from team_members where active and not works_evenings);
end $$;

commit;
