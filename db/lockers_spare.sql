-- ═══════════════════════════════════════════════════════════════════════════
-- SPARE LOCKERS ARE NOT OCCUPIED · A LOCKER IS OCCUPIED ONLY BY A MEMBER
-- ───────────────────────────────────────────────────────────────────────────
-- Lachlan, 2026-09-14: "Those lockers are spare until a member occupies it.
-- It's currently got random whiskies from us in there."
--
-- On the wall, 24 lockers read 'occupied' but only ONE had a member (A-06,
-- TRC-M003). The other 23 are spares holding house bottles — labelled LACHLAN,
-- SHAWN or MERCH, or unlabelled. They got there because the status buttons on
-- /admin/lockers accepted 'occupied' with nobody assigned. The dashboard read
-- the wall as 57% taken (24 of 42) when one member holds a locker.
--
-- 1. The 23 become 'empty' — shown on the page as SPARE. Nothing else about
--    them changes: label, notes and every bottle in locker_contents stay
--    exactly where they are. Assigning a member later sets 'occupied' as it
--    always has.
--
-- 2. The rule, in the database: status 'occupied' requires a member_no. The
--    API now refuses it with a plain message too, but the constraint is what
--    makes the wrong state impossible rather than merely discouraged.
--    'reserved' is untouched and may still have no member.
--
-- Not written to locker_activity: this corrects a status that was never true,
-- rather than recording a change on the wall. The change is findable here.
--
-- THE WAY BACK: drop the constraint (lockers_occupied_needs_member). The 23
-- were every row with status 'occupied' and member_no null on 2026-09-14.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare v_before int;
begin
  select count(*) into v_before from lockers where status = 'occupied' and member_no is null;
  raise notice 'occupied with no member, before: %', v_before;
end $$;

update lockers
   set status = 'empty', updated_at = now()
 where status = 'occupied' and member_no is null;

alter table lockers drop constraint if exists lockers_occupied_needs_member;
alter table lockers add constraint lockers_occupied_needs_member
  check (status <> 'occupied' or member_no is not null);

-- ── Proof, printed by the run ─────────────────────────────────────────────
do $$
declare r record; v_bottles_in_spares int;
begin
  for r in select status, count(*) as n, count(member_no) as with_member
             from lockers group by status order by status
  loop
    raise notice '% — % locker(s), % with a member', r.status, r.n, r.with_member;
  end loop;

  select count(*) into v_bottles_in_spares
    from locker_contents c join lockers l on l.locker_no = c.locker_no
   where l.status = 'empty';
  raise notice 'house bottles kept in spare lockers: %', v_bottles_in_spares;

  if exists (select 1 from lockers where status = 'occupied' and member_no is null) then
    raise exception 'an occupied locker still has no member';
  end if;
end $$;

commit;
