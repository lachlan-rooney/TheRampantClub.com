-- ═══════════════════════════════════════════════════════════════════════════
-- WHERE THE MONEY GOES — a piece that is raising funds says so, with a mark.
-- ───────────────────────────────────────────────────────────────────────────
-- Rainforest is an auction piece and a significant portion of what it raises
-- goes to the Borneo Nature Foundation. That belongs on the guide, under the
-- work, where somebody standing in front of it reads about it — and it belongs
-- beside the Foundation's own logo, because a charity credit in plain type
-- looks like a disclaimer rather than a partnership.
--
-- ── WHY NOT `provenance` ──────────────────────────────────────────────────
-- It is the nearest existing field and it is the wrong one. Provenance is
-- where a work has BEEN; this is where its proceeds are GOING. And provenance
-- renders small and dimmed, which is right for a line of history and wrong for
-- a commitment the club is making in public. It also has nowhere to put a
-- logo.
--
-- ── IT IS PER PIECE, NOT PER EXHIBITION ───────────────────────────────────
-- One work in this show is the auction piece, not all nine. Hanging it off
-- the collaboration would put the Foundation's name under paintings it has
-- nothing to do with.
--
-- ⚠ NOTHING BREAKS IF THIS IS NOT RUN. The guide selects * from
--   collaboration_pieces, so the columns are simply absent until they exist
--   and the block renders only when there is something to render.
-- ═══════════════════════════════════════════════════════════════════════════

alter table collaboration_pieces
  add column if not exists beneficiary_en text,
  add column if not exists beneficiary_vn text,
  -- A public URL in the event-media bucket, same convention as image_path.
  add column if not exists beneficiary_logo_path text,
  -- The organisation's own site. Optional: a guest who wants to check that the
  -- money is going where the label says should be one tap from doing so.
  add column if not exists beneficiary_url text;

comment on column collaboration_pieces.beneficiary_en is
  'Where proceeds from this piece go. Shown under the work, with the logo if there is one.';

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- alter table collaboration_pieces
--   drop column if exists beneficiary_en, drop column if exists beneficiary_vn,
--   drop column if exists beneficiary_logo_path, drop column if exists beneficiary_url;
