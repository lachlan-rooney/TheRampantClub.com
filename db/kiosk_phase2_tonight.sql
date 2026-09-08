-- ═══════════════════════════════════════════════════════════════════════════
-- SET THE BOARD FOR TONIGHT — the overnight cold-tap test
-- ───────────────────────────────────────────────────────────────────────────
-- The admin calendar form does not yet offer the board fields (the API accepts
-- them; the form is the last build item). This puts one entry on one board so the
-- tablet has something to show, and something to transition through overnight.
--
-- EDIT THE THREE MARKED VALUES, then run. Re-runnable: it replaces its own row.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 · Which room? Must be the EXACT space string, not the display name.
--     Floor 1 is 'Library Bar' — NOT 'The Library Bar'.
--     Run this first if you want to see the valid list:
--        select distinct space from space_tables order by 1;

delete from calendar_entries where title = 'ZZ-BOARD-TEST';

insert into calendar_entries
  (title, title_vn, entry_date, space, kind, visibility, blocks_space,
   show_on_board, doors_open_at, start_time, end_time, board_note, board_note_vn)
values (
  'ZZ-BOARD-TEST',                          -- title (rename to something real if you like)
  NULL,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date,   -- 2 · tonight
  'Library Bar',                            -- 3 · ← THE ROOM. Must match space_tables exactly.
  'tasting',
  'member',                                 -- member-visible, or the board will not read it
  false,                                    -- informational: does not block bookings
  true,                                     -- ← the board opt-in
  '17:00', '18:00', '23:30',                -- doors · start · end
  'A quiet hour before the pour. Ask the bar for the opening dram.',
  'Một giờ yên tĩnh trước khi rót. Hỏi quầy bar về ly khai vị.'
);

-- What the tablet should show, in club time:
--   before 17:00  → NO EVENT   ("The room is yours")
--   17:00–18:00   → ARRIVAL    ("Doors are open")
--   18:00–23:30   → LIVE
--   23:30–00:15   → WIND DOWN
--   after 00:15   → NO EVENT   ← the overnight transition worth catching
--
-- Leaving it on past 00:15 is the point: the board should reach NO EVENT on its
-- own, with no reload and nobody touching it. If it is still showing WIND DOWN in
-- the morning, the poll is not advancing and that is a real finding.

-- ── Afterwards, remove it ──────────────────────────────────────────────────
-- delete from calendar_entries where title = 'ZZ-BOARD-TEST';
