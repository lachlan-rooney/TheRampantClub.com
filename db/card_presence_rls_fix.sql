-- SECURITY FIX: card_presence was readable by ANY authenticated user
--   ("members read card_presence" using auth.uid() is not null), which let any
-- signed-in member query the ENTIRE membership's full attendance history via
-- PostgREST (member_number + seen_at, no time bound) — a cross-member privacy
-- leak. Attendance is private (mirrors the visits table: admin-only).
--
-- Members get the live "who's in now" count through /api/members/clubhouse-now,
-- which now reads under service-role and returns only a 4-hour, count-bounded
-- view — so no member needs (or gets) direct table access.

drop policy if exists "members read card_presence" on card_presence;
drop policy if exists "admin reads card_presence" on card_presence;
create policy "admin reads card_presence" on card_presence
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  );
