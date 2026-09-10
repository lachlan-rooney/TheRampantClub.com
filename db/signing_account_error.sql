-- ═══════════════════════════════════════════════════════════════════════════
-- SIGNING · record it when an account could not be made. REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- /api/sign now creates the member's login at the moment they sign, stamped
-- with their member_no. If that fails — email already registered, a rate limit,
-- anything — the agreement is still signed and the member is still Active,
-- because unwinding a signed agreement over a mail-server hiccup would be worse.
--
-- But it must not vanish. The reason is written here, and the member shows up in
-- the admin dashboard's unlinked count, which is a queue somebody already reads.
-- A member Active with no account and nobody told is the exact failure this
-- whole change exists to remove.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
alter table signing_invitations add column if not exists account_error text;
comment on column signing_invitations.account_error is
  'Why the login could not be created at signing. NULL is the normal case. Non-null means that member is Active with no way in — cross-check /admin/members/link.';
commit;
