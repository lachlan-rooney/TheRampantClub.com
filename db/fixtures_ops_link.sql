-- Run once in the Supabase SQL editor. Additive, idempotent.
--
-- Fixtures (D): a minimal NAVIGABLE link from a fixture to its Ops Hub board.
-- The Rampant Cup exists as both a member fixture AND the 87-task ops board;
-- this lets them reference each other (a fixture optionally points at one
-- project). It's just a reference field — no data sync, no spine event. Deeper
-- integration (signups auto-populating the invitee task) is a deferred follow-up.

begin;

alter table fixtures
  add column if not exists ops_project_id uuid references projects(id) on delete set null;

commit;
