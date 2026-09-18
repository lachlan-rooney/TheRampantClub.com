-- ═══════════════════════════════════════════════════════════════════════════
-- MENUS — FIRST CONTENT
-- ───────────────────────────────────────────────────────────────────────────
-- Run AFTER 20260918210000_menus.sql. Safe to re-run: everything is an upsert
-- keyed on slug.
--
-- Only ONE thing in here is real: the charcuterie platter, which the club
-- already serves, made by Cure & Pickle. El Gaucho and Le Corto are seeded as
-- venues so the admin screens have something to hang off, and are marked
-- is_placeholder until the owner comes back from visiting them with dishes,
-- prices and permission.
--
-- NOTHING here has a price. A made-up price on a menu is worse than no menu:
-- the surface renders "price on request" and nobody is misled.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The venues ─────────────────────────────────────────────────────────────

insert into public.menu_venues (slug, name, kind, tagline_en, tagline_vn, display_order, is_placeholder)
values
  ('the-rampant-club', 'The Rampant Club', 'house',
   'From our own kitchen', 'Từ bếp của chúng tôi', 10, false),

  -- Cure & Pickle make the charcuterie platter the club already serves. Their
  -- logo is in the repo; the tagline is deliberately null rather than invented.
  ('cure-and-pickle', 'Cure & Pickle', 'partner',
   null, null, 15, false),

  ('el-gaucho', 'El Gaucho', 'partner',
   'Argentinian steakhouse', 'Nhà hàng bít tết Argentina', 20, true),

  -- No tagline: their logo already reads "WINE DINING" under the wordmark, so
  -- a tagline beneath it would print the same words twice.
  ('le-corto', 'Le Corto', 'partner',
   null, null, 30, true)
on conflict (slug) do update
  set name        = excluded.name,
      kind        = excluded.kind,
      tagline_en  = excluded.tagline_en,
      tagline_vn  = excluded.tagline_vn,
      display_order = excluded.display_order;

-- Logos for the two partners who have sent artwork. Kept out of the insert
-- above so that re-running this file never blanks a logo an admin has since
-- uploaded through /admin/menus over the top of these.
update public.menu_venues set logo_path = '/images/partners/cure-and-pickle-600.webp'
 where slug = 'cure-and-pickle' and logo_path is null;
update public.menu_venues set logo_path = '/images/partners/le-corto-600.webp'
 where slug = 'le-corto' and logo_path is null;


-- ── The one dish we actually serve ─────────────────────────────────────────
--
-- It belongs to CURE & PICKLE, who make it — not to our own kitchen. I had
-- this wrong first time round: "a cure and pickle platter" read to me as
-- "cured and pickled" rather than as the supplier's name, and the house/partner
-- split decides whose name sits above the dish on a menu members read.
--
-- ⚠ TWO THINGS FOR THE OWNER, both deliberate and both flagged rather than
--   quietly decided:
--
--   1. SPELLING. The list as handed to me read "Duck Rilette", "Bressaola" and
--      "Zaatar". On a menu these are conventionally "Duck Rillettes",
--      "Bresaola" and "Za'atar". I have used the conventional spellings —
--      change them back in /admin/menus in ten seconds if the kitchen writes
--      them the other way on purpose.
--
--   2. ALLERGENS ARE NOT FILLED IN. I can be certain of gluten (crackers) and
--      dairy (fromage), but a PARTIAL allergen list reads as a complete one,
--      which is the specific way this goes badly wrong. `allergens_confirmed`
--      is false, so the menu will say "ask your server" until the kitchen
--      confirms the full list. Do not tick that box on anyone's behalf.
--
--   The Vietnamese is mine and has not been reviewed by Miss Châu. Charcuterie
--   terms mostly stay in French/Italian on Vietnamese menus too, so the VN
--   line names the dish and leaves the components alone.

with maker as (select id from public.menu_venues where slug = 'cure-and-pickle')
insert into public.menu_items (
  venue_id, slug, name_en, name_vn, description_en, description_vn,
  dietary, allergens, allergens_confirmed,
  display_order, is_active, is_placeholder
)
select
  maker.id, 'charcuterie-platter',
  'Charcuterie Platter',
  'Đĩa nguội tổng hợp',
  'Cauliflower za''atar, beer pickles, duck rillettes, duck prosciutto, bresaola, chestnut lonza, salami picante, crackers, cornichons, fromage du jour, olives.',
  'Súp lơ za''atar, dưa muối bia, pa-tê vịt rillettes, ức vịt muối, bresaola, lonza hạt dẻ, salami cay, bánh quy giòn, dưa chuột bao tử, phô mai trong ngày, ô-liu.',
  array['pork']::text[],
  '{}'::text[],
  false,
  10, true, false
from maker
on conflict (venue_id, slug) do update
  set name_en        = excluded.name_en,
      name_vn        = excluded.name_vn,
      description_en = excluded.description_en,
      description_vn = excluded.description_vn,
      dietary        = excluded.dietary;


-- ── What is still missing ──────────────────────────────────────────────────
select * from public.menu_placeholder_audit();
