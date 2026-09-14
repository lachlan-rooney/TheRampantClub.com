-- ═══════════════════════════════════════════════════════════════════════════
-- MISS NI AND MISS CHAU IN THE OFFICE, EVERY WEEKDAY · MINH IS NOT ON THE ROTA
-- ───────────────────────────────────────────────────────────────────────────
-- Both from Lachlan, 2026-09-14:
--
--   "add Miss Ni and Chau in on office shifts, Monday to Friday.
--    Miss Ni 8-4, Miss Chau 9-5. Every weekday."
--   "Minh is my codirector. Not on the rota."
--
-- 1. A STANDING SHIFT. The rota had no way to say "this person does this shift
--    every week" — every week was written out, and autofill only fills cells
--    by function. So a person can now carry a standing pattern: a shift name,
--    their own start and end, and the weekdays. The rota page's autofill
--    proposes it for any week it is missing from; this file writes it into the
--    weeks already on the rota so nobody has to press anything today.
--
--      Miss Ni    Office  08:00 – 16:00   Mon–Fri
--      Miss Chau  Office  09:00 – 17:00   Mon–Fri
--
--    Their times are on each shift row, not on the Office type. The type stays
--    10:00–16:00: that is the floor staff's fixed morning (Sĩ Mon, Tiên Tue,
--    Hiếu Wed, Nhi Thu, Bình Fri), and those are unchanged — Ni and Chau are
--    ADDED to the office, nobody is taken out of it.
--
--    ⚠ NO BREAK IS RECORDED. The Office type carries an unpaid hour for lunch;
--    whether Ni's and Chau's eight-hour days do is not on record, and the hours
--    report reads start-to-end, so until it is known they read as 8h days.
--
-- 2. ON THE ROTA, OR NOT. Minh stays an ACTIVE team member — team_members is
--    also the kiosk staff picker, checklists and the Ops boards, and a
--    co-director belongs on those. He is only taken off the rota page: time
--    off, the pickers and autofill. The switch is on the page (Team &
--    functions → On rota) so this is undone with a click, not another file.
--
-- Weekdays use the rota's existing convention: 0 = Sunday … 6 = Saturday, the
-- same as morning_weekday. Monday to Friday is {1,2,3,4,5}.
--
-- The shifts written here go straight into rota_shifts rather than through
-- ops_create_shift, so they emit no 'assigned' events to the activity feed —
-- the SQL editor has no signed-in admin to be the actor. Anything added from
-- the page afterwards logs as normal.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from rota_shift_types where name = 'Office') then
    raise exception 'There is no Office shift type — run db/rota_office_shift.sql first';
  end if;
  if not exists (select 1 from team_members where display_name = 'Miss Ni' and active) then
    raise exception 'No active team member called Miss Ni';
  end if;
  if not exists (select 1 from team_members where display_name = 'Miss Chau' and active) then
    raise exception 'No active team member called Miss Chau';
  end if;
end $$;

-- ── The columns ───────────────────────────────────────────────────────────
alter table team_members add column if not exists on_rota           boolean not null default true;
alter table team_members add column if not exists standing_shift    text;
alter table team_members add column if not exists standing_start    time;
alter table team_members add column if not exists standing_end      time;
alter table team_members add column if not exists standing_weekdays smallint[];

-- A standing pattern is all-or-nothing: a shift with no days, or days with no
-- times, is a pattern autofill would either skip silently or write wrong.
alter table team_members drop constraint if exists team_members_standing_complete;
alter table team_members add constraint team_members_standing_complete
  check (
    (standing_shift is null and standing_start is null and standing_end is null and standing_weekdays is null)
    or (standing_shift is not null and standing_start is not null and standing_end is not null
        and cardinality(standing_weekdays) > 0
        and standing_weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
  );

comment on column team_members.on_rota is
  'false = an active team member who is not rostered (e.g. a director). Hidden from the rota page only; still on kiosks, checklists and boards.';
comment on column team_members.standing_shift is
  'A shift this person works every week on standing_weekdays (0=Sun…6=Sat), standing_start–standing_end. Autofill proposes it for any week missing it.';

-- ── Minh ──────────────────────────────────────────────────────────────────
update team_members set on_rota = false where display_name = 'Minh';

-- ── The two standing patterns ─────────────────────────────────────────────
update team_members
   set standing_shift = 'Office', standing_start = '08:00', standing_end = '16:00',
       standing_weekdays = array[1,2,3,4,5]::smallint[]
 where display_name = 'Miss Ni';

update team_members
   set standing_shift = 'Office', standing_start = '09:00', standing_end = '17:00',
       standing_weekdays = array[1,2,3,4,5]::smallint[]
 where display_name = 'Miss Chau';

-- ── Write them into the weeks already on the rota ─────────────────────────
-- From today's week to the last date anything is rostered. A day is skipped if
-- the person already has a shift on it or has that day marked off — so a
-- re-run adds nothing twice, and booked leave is respected.
insert into rota_shifts (member, shift_date, shift_name, start_time, end_time)
select tm.id, d::date, tm.standing_shift, tm.standing_start, tm.standing_end
  from team_members tm
 cross join generate_series(date '2026-09-14', (select max(shift_date) from rota_shifts), interval '1 day') d
 where tm.display_name in ('Miss Ni', 'Miss Chau')
   and tm.active and tm.on_rota and tm.standing_shift is not null
   and extract(dow from d)::smallint = any(tm.standing_weekdays)
   and not exists (select 1 from rota_shifts s where s.member = tm.id and s.shift_date = d::date)
   and not exists (select 1 from rota_unavailability u where u.member = tm.id and u.off_date = d::date);

-- ── Proof, printed by the run ─────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select tm.display_name, count(s.id) as n, min(s.shift_date) as first, max(s.shift_date) as last,
           string_agg(distinct to_char(s.start_time, 'HH24:MI') || '–' || to_char(s.end_time, 'HH24:MI'), ', ') as hours
      from team_members tm
      left join rota_shifts s on s.member = tm.id and s.shift_name = 'Office' and s.shift_date >= date '2026-09-14'
     where tm.display_name in ('Miss Ni', 'Miss Chau')
     group by tm.display_name
  loop
    raise notice '% — % office shifts, % to %, at %', r.display_name, r.n, r.first, r.last, r.hours;
    if r.n = 0 then raise warning '% has no office shifts written', r.display_name; end if;
  end loop;
  raise notice 'off the rota: %',
    (select coalesce(string_agg(display_name, ', ' order by display_name), 'nobody')
       from team_members where active and not on_rota);
end $$;

commit;
