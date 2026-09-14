-- ═══════════════════════════════════════════════════════════════════════════
-- RETIRE rota_unavailability — ONE RECORD OF WHO IS OFF.
-- REVIEW, then run. Idempotent, transactional.
--
-- ⚠ RUN ONLY AFTER the code that stops reading rota_unavailability is DEPLOYED
--   (the rota page reading staff_time_off). Run it first and the live rota page
--   errors on load until the deploy lands.
-- ───────────────────────────────────────────────────────────────────────────
-- Time off was kept in two tables that never met:
--   • staff_time_off       — ranges, written from /admin/calendar
--   • rota_unavailability  — single days, written from the rota's Time off grid
-- Neither page read the other's. Lachlan's leave from 8–18 October was on the
-- calendar and invisible to rota autofill; a day marked off on the rota never
-- reached the calendar. Two records of the same fact is one record too many,
-- and the one nobody checked would always be the wrong one.
--
-- staff_time_off is the survivor: it already holds ranges, kinds, a name
-- snapshot and who booked it. The rota now reads it (a range check), and its
-- grid writes one-day rows and shrinks/splits a range to clear a single day.
-- Public holidays stay in it too, but take nobody off the rota — the club
-- opens seven days.
--
-- At writing, rota_unavailability holds 0 rows and staff_time_off 1. Any rows
-- that exist when this runs are carried across as one-day annual_leave rows
-- (note kept, created_by marked), skipping days already covered by a range, so
-- a re-run adds nothing twice.
--
-- THE WAY BACK: revert the code change, remove the guard at the top of
-- db/rota_unavailability.sql and run it. Days carried across are findable by
-- created_by = 'rota_unavailability_retire'.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $retire$
declare
  v_before int := 0; v_migrated int := 0; v_uncovered int := 0;
begin
  if to_regclass('public.rota_unavailability') is null then
    raise notice 'rota_unavailability already gone — nothing to migrate.';
    return;
  end if;

  -- Dynamic SQL: on a re-run the table no longer exists, and a static
  -- reference to it would not compile.
  execute 'select count(*) from rota_unavailability' into v_before;

  execute $sql$
    insert into staff_time_off (team_member_id, member_name, kind, start_date, end_date, note, created_by)
    select u.member, tm.display_name, 'annual_leave', u.off_date, u.off_date, u.note, 'rota_unavailability_retire'
      from rota_unavailability u
      join team_members tm on tm.id = u.member
     where not exists (select 1 from staff_time_off o
                        where o.team_member_id = u.member
                          and o.start_date <= u.off_date and o.end_date >= u.off_date)
  $sql$;
  get diagnostics v_migrated = row_count;

  -- Nothing is dropped while a day is still only in the old table.
  execute $sql$
    select count(*) from rota_unavailability u
     where not exists (select 1 from staff_time_off o
                        where o.team_member_id = u.member
                          and o.start_date <= u.off_date and o.end_date >= u.off_date)
  $sql$ into v_uncovered;
  if v_uncovered > 0 then
    raise exception 'SELF-CHECK: % rota_unavailability day(s) not covered in staff_time_off — nothing dropped.', v_uncovered;
  end if;

  raise notice 'rota_unavailability: % row(s) found, % carried into staff_time_off, every day covered.', v_before, v_migrated;
end $retire$;

drop table if exists rota_unavailability;

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_total int; v_carried int;
begin
  if to_regclass('public.rota_unavailability') is not null then
    raise exception 'SELF-CHECK: rota_unavailability still exists';
  end if;
  select count(*) into v_total from staff_time_off;
  select count(*) into v_carried from staff_time_off where created_by = 'rota_unavailability_retire';
  raise notice 'Retired. staff_time_off now holds % row(s), % of them carried from the rota.', v_total, v_carried;
end $check$;

commit;
