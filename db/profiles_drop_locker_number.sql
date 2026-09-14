-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILES · DROP locker_number.   ⚠ RUN ONLY AFTER THE CODE IS DEPLOYED.
-- ───────────────────────────────────────────────────────────────────────────
-- RUN ORDER: deploy the commit that stops reading it FIRST (the member portal
-- and /profile now read GET /api/members/locker; Access & Logins no longer
-- writes it; /api/admin/members no longer selects it). Run it while the old
-- code is still live and every member dashboard's profile select errors.
--
-- (2026-09-14) Why it goes:
--   1. It never held data. Every profile's locker_number is empty, so every
--      member's portal has shown "Locker —" since the field existed.
--   2. The locker wall is the source. `lockers` (db/lockers.sql) is where staff
--      actually assign lockers, at /admin/lockers, with bottles and fill levels
--      alongside. Two places to say which locker is yours means they disagree.
--   3. Members could write it themselves. "Users can update own profile"
--      (db/phase0c_profiles_rls_fix.sql) pins is_admin and member_no but not this,
--      so any member could claim any locker number on their own record.
--
-- GUARDED: if any profile has a non-empty locker_number, this refuses and drops
-- nothing — that value would be the only record of it, and it belongs on the
-- wall (/admin/lockers) before the column is allowed to go.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $guard$
declare v_held int;
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='profiles' and column_name='locker_number') then
    select count(*) into v_held from profiles
     where nullif(btrim(locker_number), '') is not null;
    if v_held > 0 then
      raise exception 'REFUSED — % profile(s) still have a locker_number', v_held
        using hint = 'Move them onto the wall at /admin/lockers first. Nothing dropped.';
    end if;
  end if;
end $guard$;

alter table profiles drop column if exists locker_number;

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_col int; v_wall int;
begin
  select count(*) into v_col from information_schema.columns
   where table_schema='public' and table_name='profiles' and column_name='locker_number';
  if v_col <> 0 then raise exception 'SELF-CHECK: profiles.locker_number is still there'; end if;

  select count(*) into v_wall from lockers where member_no is not null and status <> 'retired';
  raise notice 'profiles.locker_number is gone. The wall holds % locker(s) assigned to a member.', v_wall;
end $check$;

commit;
