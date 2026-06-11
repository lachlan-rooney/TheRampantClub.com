-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE S1 — write-layer structural guard  ·  REVIEW, then run (after S0 substrate)
-- ───────────────────────────────────────────────────────────────────────────
-- One concierge thread per member, enforced STRUCTURALLY. The get-or-create route
-- (POST /api/social/concierge) relies on this for idempotency under concurrency:
-- a racing second insert fails with 23505 → the route re-selects the existing one.
-- created_by IS the member (a concierge thread is created by its member; staff
-- join as participants on first reply). Partial → direct threads are unconstrained.
-- ═══════════════════════════════════════════════════════════════════════════

create unique index if not exists threads_one_concierge_per_member
  on threads (created_by) where kind = 'concierge';

-- No new policies: staff-participation call (a) inserts the staff participant row
-- via the service-role route, and last_read_at is already the one grantable column
-- (S0 check 7). The substrate's existing RLS covers every read.
