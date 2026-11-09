-- ═══════════════════════════════════════════════════════════════════════════
-- IS THE VIETNAMESE REVIEWED, OR IS IT A DRAFT?
-- ───────────────────────────────────────────────────────────────────────────
-- On 2026-11-09 the whole of the Rizal Fathoni guide was translated into
-- Vietnamese in one pass — ten statements, the biography, the canapés, every
-- medium line, about 17,400 characters — because the doors opened the next day
-- and half the room reads Vietnamese. A flagged draft beats an English-only
-- guide. But nothing on any surface said it was a draft, and unreviewed
-- Vietnamese that nobody flags simply becomes the house Vietnamese.
--
-- ── WHY A COLUMN AND NOT A NOTE IN THE PAGE ───────────────────────────────
-- A hardcoded "under review" banner is wrong the day somebody reviews it, and
-- nobody is prompted to go and delete it. This codebase already has that
-- lesson written down in components/home/MemberBenefits: the castle's line
-- read "slated to open in 2027", a sentence that is wrong the day it opens.
-- Dates are data, not prose. So is review status.
--
-- NULL means nobody has checked it. A timestamp means somebody has, and the
-- admin stops saying so. That is the whole mechanism.
--
-- ⚠ THE CODE DOES NOT REQUIRE THIS TO HAVE BEEN RUN. The admin reads the flag
--   in a request of its own and treats a failure as "not reviewed", so the
--   guide can ship tonight either way and this can follow. Running it only
--   makes the notice dismissible.
-- ═══════════════════════════════════════════════════════════════════════════

alter table collaborations
  add column if not exists vn_reviewed_at timestamptz,
  add column if not exists vn_reviewed_by text;

comment on column collaborations.vn_reviewed_at is
  'NULL = the Vietnamese has not been checked by a native speaker. Set when it has.';

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- alter table collaborations drop column if exists vn_reviewed_at, drop column if exists vn_reviewed_by;
