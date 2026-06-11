-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN STAFF PICKER — "click who you are" on a shared staff login  ·  REVIEW, run
-- ───────────────────────────────────────────────────────────────────────────
-- Depends on db/kiosk_phase1.sql (team_members.pin_hash + kiosk_staff_roster +
-- kiosk_verify_pin — shared between the kiosk and this admin picker).
--
-- A per-account flag: accounts marked requires_staff_pick (the SHARED staff login)
-- must pick who they are (a team_member + PIN) on entering the admin portal — pure
-- ATTRIBUTION, on top of the personal-login + is_admin access (which stays the
-- boundary). Personal admins (Mr Rooney, Shawn) have it false → never prompted.
-- ═══════════════════════════════════════════════════════════════════════════

alter table profiles add column if not exists requires_staff_pick boolean not null default false;

-- Set true on the shared staff login once it exists, e.g.:
--   update profiles set requires_staff_pick = true where id = '<shared-staff-account-uuid>';
