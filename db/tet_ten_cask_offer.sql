-- ═══════════════════════════════════════════════════════════════════════════
-- TẾT 2027 — the offer is TEN casks, not twenty.    REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-11-06: "It is 10. total is 10 now" and "it's to be the same as
-- the embassy, only 10".
--
-- ═══ WHY IN THE DATA AND NOT IN THE PAGE ═══════════════════════════════════
-- The Embassy page reaches ten with an allow-list in the code. That was right
-- when the Embassy offered a subset of a larger club board. It is the wrong
-- shape now that TEN IS THE WHOLE OFFER, for two reasons:
--
--   1 · There are two pages. /tet and /embassy/tet are forks of one component,
--       so a list in the code has to be kept in step in two places — and the
--       fork is exactly why the map bug and the wrong cask count survived on
--       the club page for weeks after the Embassy copy existed.
--   2 · A display filter leaves the BACK END believing twenty are on offer.
--       tet_quote_cask would still price a withdrawn cask, a reservation could
--       still be taken against one, and the admin board would still list it.
--
-- tet_cask_board filters on is_active, so this is the switch the schema
-- already has for "not on the board".
--
-- ═══ IT SAYS "NOT ON THE BOARD", NOT "SOLD" ════════════════════════════════
-- is_active is deliberately chosen over status = 'withdrawn' or 'sold'. Those
-- are commercial statements about a cask's fate; this is only a statement
-- about what the page shows. Every status is left exactly as it is, so nothing
-- here asserts anything that might not be true.
--
-- ═══ WHAT CHANGES ══════════════════════════════════════════════════════════
-- Ten casks come off the board. The ten that remain are the owner's list, and
-- they are named here so this file can be read without the application:
--
--   KEPT    Q5364 Auchentoshan · Q5088 Burnside · Q5134 Teaninich
--           Q5423 Invergordon  · Q5177 Aultmore · Q5430 Miltonduff
--           Q5057 Tullibardine · Q5113 Craigellachie
--           Q5439 Islay Single Malt · Q5358 North British
--
--   OFF     Q5062 Glenrothes · Q5074 Girvan     · Q5086 Burnside
--           Q5133 Teaninich  · Q5148 Tamnavulin · Q5169 Aultmore
--           Q5172 Aultmore   · Q5176 Aultmore   · Q5429 Miltonduff
--           Q5435 Miltonduff
--
-- Both pages then show ten from ONE source, and the standfirst follows by
-- itself — its count is derived from the board, so /tet stops saying "Twenty"
-- the moment this runs. No deploy needed.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

-- Refuse rather than half-apply if the data is not what this file was written
-- against. Ten named casks must exist and be active, or something has moved.
do $prereq$
declare n int;
begin
  select count(*) into n from public.tet_casks
   where cask_ref in ('Q5364','Q5088','Q5134','Q5423','Q5177',
                      'Q5430','Q5057','Q5113','Q5439','Q5358')
     and is_active;
  if n <> 10 then
    raise exception 'expected the 10 offered casks to be active, found %', n
      using hint = 'Nothing applied. Re-read the board before changing it.';
  end if;
end $prereq$;

update public.tet_casks
   set is_active = false,
       updated_at = now()
 where is_active
   and cask_ref not in ('Q5364','Q5088','Q5134','Q5423','Q5177',
                        'Q5430','Q5057','Q5113','Q5439','Q5358');

do $report$
declare n int;
begin
  select count(*) into n from public.tet_cask_board;
  raise notice 'tet_cask_board now shows % casks', n;
  if n <> 10 then
    raise exception 'the board shows % casks, expected 10', n
      using hint = 'Rolled back.';
  end if;
end $report$;

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
--   select count(*) from public.tet_cask_board;            → 10
--   select cask_ref, distillery from public.tet_cask_board order by cask_ref;
--
-- Nothing was marked sold or withdrawn — only taken off the board:
--   select status, count(*) from public.tet_casks group by 1;
--
-- Then reload /tet and /embassy/tet: both show ten, and the club's standfirst
-- says "Ten single casks" without a deploy, because the count is derived.
--
-- Then: node scripts/verify-tet-map.mjs   and   MAP_PATH=/tet node scripts/verify-tet-map.mjs

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Puts all twenty back on the board. Nothing was destroyed — is_active is a
-- switch, and every cask's row, price and status is untouched:
--   update public.tet_casks set is_active = true, updated_at = now()
--    where cask_ref in ('Q5062','Q5074','Q5086','Q5133','Q5148',
--                       'Q5169','Q5172','Q5176','Q5429','Q5435');
