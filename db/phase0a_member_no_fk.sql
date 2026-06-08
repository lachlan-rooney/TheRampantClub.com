-- ─────────────────────────────────────────────────────────────────────────
-- Phase 0a — profiles.member_no FK + FK-keyed member-own RLS.
--
-- Retires the brittle link key. Before: a profile's member is found by
-- building 'TRC-M' || lpad(profiles.member_number::text, 3, '0') at every read
-- site (3 places) — breaks at member_number ≥ 1000, no FK integrity, three
-- conventions for one identity. After: a real FK column compared directly.
--
-- KEEPS profiles.member_number for now (the admin link-setter UI still writes
-- it; retire that column in a later cleanup once 0b replaces the setter).
-- Additive + idempotent. All profiles are unlinked today, so this touches no
-- live access.
-- ─────────────────────────────────────────────────────────────────────────

-- The link column: a profile's member record (null = not linked; admins stay null).
alter table profiles add column if not exists member_no text references members(member_no);
create index if not exists idx_profiles_member_no on profiles(member_no);

-- ── Member-own RLS, FK-keyed (same semantics: a member reads only their own) ──
-- NULL behaviour (the critical check): for an admin/unlinked session, the
-- subquery returns NULL, so `member_no = NULL` is NULL → NO rows match. An
-- unlinked session reads NOTHING via this policy (it does NOT match all rows).
-- Admins still read everything via their separate admin policy.

drop policy if exists "members read own taste" on member_taste_profiles;
create policy "members read own taste" on member_taste_profiles for select using (
  member_no = (select member_no from profiles where id = auth.uid())
);

drop policy if exists "members read own consumption" on member_consumption;
create policy "members read own consumption" on member_consumption for select using (
  member_no = (select member_no from profiles where id = auth.uid())
);
