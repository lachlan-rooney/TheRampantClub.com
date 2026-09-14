-- ═══════════════════════════════════════════════════════════════════════════
-- THE SEVEN-DAY ROTA POLICY — the facts the rules need
-- ───────────────────────────────────────────────────────────────────────────
-- Opening seven days without adding hours is a rota problem, and the rota had
-- no way to express the four rules it has to keep:
--
--   1. EVERY PERSON REACHES THEIR CONTRACTED HOURS. Nowhere in the system said
--      what those hours were, so "did this week short someone?" could not be
--      asked, let alone answered.
--   2. ONE FIXED MORNING EACH, ON A NAMED WEEKDAY. Mr Sĩ Monday, Tiên
--      Tuesday, Hiếu Wednesday, Nhi Thursday, Bình Friday. These do NOT
--      rotate — they are the week's fixed points, for prep, deliveries, stock
--      and the shift tasks, and everything else moves around them.
--   3. SIX DAYS EACH — one day off a week, everybody. Hiếu's and Bình's two
--      days off were tried and dropped on 2026-09-14: two days off plus a
--      morning leaves four evenings, and four evenings is 40 hours against a
--      48-hour contract. Hiếu keeps Sunday, Bình keeps Monday. A rotating rota is the
--      difference between "everyone shares the weekends" and "the newest
--      person always works Saturday".
--   4. NOBODY IS OFF BOTH WEEKEND DAYS. Saturday and Sunday together is the
--      one pair the rota may never hand out — it is the pattern that quietly
--      becomes permanent and that everyone else then pays for.
--
-- Shift types also carried no TIMES, only names (Open/Mid/Close), so hours
-- could not be computed from a plan at all — the durations in the existing
-- rows vary from 5 to 6 hours and many rows have no end time.
--
-- Four additions, no behaviour change on its own:
--   team_members.weekly_hours       contracted hours; null = not recorded
--   team_members.morning_weekday    0=Sunday … 6=Saturday; null = no anchor
--   team_members.fixed_days_off     the standing arrangements; null = rotates
--   rota_shift_types.start_time/end_time/hours  what a shift actually is
--
-- The Morning type is added because the policy needs it and it did not exist.
-- Its times are a STARTING VALUE (10:00–15:00) — the club has never recorded
-- what the morning shift actually is, and it is editable in the rota's shift
-- types. Everything that counts hours reads it from there, so correcting it
-- there corrects the checks.
--
-- NOTHING IS ROSTERED BY THIS FILE. It records what the rules need to read.
-- The 48-hour week is Lachlan's, stated 2026-09-14, and is set for the five
-- people on the rota; anyone else is left NULL rather than assumed, because a
-- contracted hour is a term of somebody's employment.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.team_members') is null then
    raise exception 'team_members does not exist here — wrong database?';
  end if;
  if to_regclass('public.rota_shift_types') is null then
    raise exception 'rota_shift_types does not exist here — the rota is not installed';
  end if;
end $$;

alter table team_members add column if not exists weekly_hours numeric(4,1);
alter table team_members add column if not exists morning_weekday smallint;
-- Days this person is off EVERY week, by arrangement. Empty/NULL = they rotate.
alter table team_members add column if not exists fixed_days_off smallint[];
-- The one evening shift this person always works, where that is the
-- arrangement. Mr Sĩ closes: he is the boss, he is there at the end of the
-- night, and he is on no mids.
alter table team_members add column if not exists always_shift text;

alter table team_members drop constraint if exists team_members_morning_weekday_valid;
alter table team_members add constraint team_members_morning_weekday_valid
  check (morning_weekday is null or morning_weekday between 0 and 6);

alter table team_members drop constraint if exists team_members_weekly_hours_sane;
alter table team_members add constraint team_members_weekly_hours_sane
  check (weekly_hours is null or (weekly_hours > 0 and weekly_hours <= 60));

comment on column team_members.weekly_hours is
  'Contracted hours per week. NULL = not recorded, and the rota check will say so rather than assume 40.';
alter table team_members drop constraint if exists team_members_fixed_days_off_valid;
alter table team_members add constraint team_members_fixed_days_off_valid
  check (
    fixed_days_off is null
    or (
      -- every entry a real weekday …
      not exists (select 1 from unnest(fixed_days_off) d where d < 0 or d > 6)
      -- … and never Saturday AND Sunday together, which is the pair the rota
      -- may not hand out to anyone, arrangement or not.
      and not (0 = any(fixed_days_off) and 6 = any(fixed_days_off))
    )
  );

comment on column team_members.always_shift is
  'The evening shift this person always works (e.g. Close). NULL = any. Their fixed morning is separate '
  'and unaffected — always_shift governs the EVENINGS only.';
comment on column team_members.fixed_days_off is
  'Weekdays this person is off every week by arrangement (0=Sunday … 6=Saturday). '
  'NULL or empty = their days off rotate. Saturday+Sunday together is refused by constraint.';
comment on column team_members.morning_weekday is
  'The one weekday this person always works the morning shift. 0=Sunday … 6=Saturday. NULL = no fixed morning. '
  'These do not rotate: they are the fixed points the rest of the week is built around.';

alter table rota_shift_types add column if not exists start_time time;
alter table rota_shift_types add column if not exists end_time   time;
alter table rota_shift_types add column if not exists hours      numeric(4,2);

comment on column rota_shift_types.hours is
  'Length in hours. Held explicitly rather than derived, because a shift that crosses midnight '
  'cannot be subtracted naively — the club closes after 00:00 and "end minus start" goes negative.';

-- The four shifts the seven-day week is built from. Times are the club's own:
-- open at four, last pour late. Existing rows keep their name and gain times.
insert into rota_shift_types (name, sort_order, start_time, end_time, hours) values
  ('Morning', -1, '10:00', '15:00', 5.0)
on conflict (name) do update set
  start_time = excluded.start_time, end_time = excluded.end_time, hours = excluded.hours;

-- THE HOUSE OPENS AT THREE AND CLOSES AT MIDNIGHT (from 2026-09-14). Last call
-- 11pm, the room is empty by 11:30, doors at twelve. Seven days. Every shift here was written for a club
-- that ran to 3am and none of them survive that change: an 18:30–03:00 close
-- is now two and a half hours of a building nobody is in.
--
-- Rebuilt around the new night, staggered half an hour apart so the room is
-- never handed over all at once, and the closer stays an hour past the doors
-- for clean-down:
--
--   Open   15:00 – 23:30   doors at three, out after last call
--   Close  16:00 – 00:30   the peak, the last call, the room cleared, the lock
--   (Mid    16:00 – 00:30   kept as a type for the busy nights, if wanted)
--
-- Still 8.5 hours each, so the six-day week is still 47.5 and still under the
-- ceiling. That is the only number that did not have to move.
update rota_shift_types set start_time = '15:00', end_time = '23:30', hours = 8.5 where name = 'Open';
update rota_shift_types set start_time = '16:00', end_time = '00:30', hours = 8.5 where name = 'Mid';
update rota_shift_types set start_time = '16:00', end_time = '00:30', hours = 8.5 where name = 'Close';

-- ── The arrangements that already exist ───────────────────────────────────
-- Recorded here rather than remembered. One day off each: Hiếu Sunday, Bình
-- Monday. These two are fixed by arrangement; the others' day off falls where
-- the week allows it, which with Mr Sĩ closing every Saturday is Sunday for
-- him and Saturday for Tiên and Nhi.
update team_members set fixed_days_off = '{0}' where display_name = 'Hiếu';
update team_members set fixed_days_off = '{1}' where display_name = 'Bình';

-- The 48-hour CEILING, as stated by the owner: nobody goes over it. The check
-- treats this as a maximum as well as a target — short is a fault, and so is
-- over.
update team_members set weekly_hours = 48
 where display_name in ('Mr Sĩ', 'Tiên', 'Hiếu', 'Nhi', 'Bình');

-- Mr Sĩ closes every night he is on, and is never on a mid.
update team_members set always_shift = 'Close' where display_name = 'Mr Sĩ';

-- The fixed mornings: one person per weekday, Monday to Friday.
update team_members set morning_weekday = 1 where display_name = 'Mr Sĩ';
update team_members set morning_weekday = 2 where display_name = 'Tiên';
update team_members set morning_weekday = 3 where display_name = 'Hiếu';
update team_members set morning_weekday = 4 where display_name = 'Nhi';
update team_members set morning_weekday = 5 where display_name = 'Bình';

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_types int; v_hours int; v_staff int; v_with_hours int;
begin
  select count(*) into v_types from rota_shift_types;
  select count(*) into v_hours from rota_shift_types where hours is not null;
  select count(*) into v_staff from team_members where active;
  select count(*) into v_with_hours from team_members where active and weekly_hours is not null;
  raise notice 'shift types: % (% with hours) · active staff: % (% with contracted hours recorded)',
    v_types, v_hours, v_staff, v_with_hours;
  if v_hours < v_types then raise exception 'a shift type still has no hours — the rota cannot count a week'; end if;
  raise notice 'NEXT: set weekly_hours per person, or the rota check will keep saying it cannot check them.';
  if (select count(*) from team_members where active and morning_weekday is not null) <> 5 then
    raise warning 'the five fixed mornings did not all take — check the names match the roster exactly';
  end if;
  if not exists (select 1 from team_members where display_name = 'Hiếu' and fixed_days_off = '{0}') then
    raise warning 'Hiếu''s fixed Sunday did not take — check the name matches the roster exactly';
  end if;
  if not exists (select 1 from team_members where display_name = 'Bình' and fixed_days_off = '{1}') then
    raise warning 'Bình''s fixed Monday did not take — check the name matches the roster exactly';
  end if;
end $$;
