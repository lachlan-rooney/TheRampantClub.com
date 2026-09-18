-- ═══════════════════════════════════════════════════════════════════════════
-- EL GAUCHO — THEIR LOGO
-- ───────────────────────────────────────────────────────────────────────────
-- Rendered from the owner's 4760px ElGaucho.png into
-- public/images/partners/el-gaucho-{600,1200}.webp, trimmed of its transparent
-- margin. Real alpha, so it sits on the club's ground without a white box.
--
-- THE TAGLINE IS CLEARED, for the same reason as Le Corto's: their artwork
-- already reads "ARGENTINIAN STEAKHOUSE" beneath the bull, and my invented
-- "Argentinian steakhouse" underneath it printed the same words twice. The
-- logo says it.
--
-- ⚠ ONE THING FOR THE OWNER, flagged rather than fixed. The mark is pure red
--   (#FF0000), which measures 3.73:1 against the club's green (#052E20). That
--   clears the 3:1 guideline for a graphic, but it is the weakest of the three
--   partner logos — the menu's own cream runs 10.24:1 — and red-on-green is
--   the specific pairing that red-green colour deficiency makes hardest, which
--   is roughly one man in twelve.
--
--   I have NOT recoloured it. Altering a partner's mark to suit our background
--   is not ours to do. Most brands keep a reversed or single-colour version
--   for dark grounds; that is the thing to ask El Gaucho for, and it drops
--   straight in over this one from /admin/menus with no migration.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

update public.menu_venues
   set logo_path  = '/images/partners/el-gaucho-600.webp',
       tagline_en = null,
       tagline_vn = null
 where slug = 'el-gaucho';

select slug, name, logo_path, tagline_en from public.menu_venues order by display_order;
