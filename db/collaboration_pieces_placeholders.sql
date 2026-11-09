-- ═══════════════════════════════════════════════════════════════════════════
-- PLACEHOLDER PIECES — the shape, for looking at. Optional, and reversible.
-- ───────────────────────────────────────────────────────────────────────────
-- Three rows in square brackets so the gallery guide can be seen working
-- before any real piece is entered. They are NOT seeded by
-- db/collaboration_pieces.sql on purpose:
--
--   The live exhibition opens 10 November 2026 and /studio/guide is a PUBLIC
--   URL. Rows reading "[Piece title]" would be on the open internet, under a
--   real artist's exhibition, from the moment the table existed. An empty
--   guide says "no pieces yet" in both languages, which is true; a seeded one
--   would say something false in a gallery's voice.
--
-- So: run this if you want to see the shape, then run the DELETE at the
-- bottom. Or skip it and add the first real piece at /admin/studio, where the
-- same fields are a form.
--
-- It attaches to whichever exhibition is LIVE. If none is, it does nothing
-- rather than guessing.
-- ═══════════════════════════════════════════════════════════════════════════

insert into collaboration_pieces
  (collaboration_id, sort, title_en, title_vn, year, medium_en, medium_vn,
   dimensions, description_en, description_vn, image_path)
select c.id, v.sort, v.title_en, v.title_vn, v.year, v.medium_en, v.medium_vn,
       v.dimensions, v.description_en, v.description_vn, null
from collaborations c
cross join (values
  (1, '[Piece title]',        '[Tên tác phẩm]',        '[Year]',
      '[Medium]',             '[Chất liệu]',           '[00 × 00 cm]',
      '[Description — to be supplied. This is where the story of the piece goes: what the guest is looking at, and what they would not see by looking.]',
      '[Mô tả — sẽ được cung cấp.]'),
  (2, '[Second piece title]', '[Tên tác phẩm thứ hai]', '[Year]',
      '[Medium]',             '[Chất liệu]',           '[00 × 00 cm]',
      '[Description — to be supplied.]',
      '[Mô tả — sẽ được cung cấp.]'),
  (3, '[Third piece title]',  '[Tên tác phẩm thứ ba]',  '[Year]',
      '[Medium]',             '[Chất liệu]',           '[00 × 00 cm]',
      '[Description — to be supplied.]',
      '[Mô tả — sẽ được cung cấp.]')
) as v(sort, title_en, title_vn, year, medium_en, medium_vn, dimensions, description_en, description_vn)
where c.status = 'live';

-- ── THE WAY BACK — run this when you have seen enough ─────────────────────
-- delete from collaboration_pieces where title_en like '[%';
