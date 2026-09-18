-- ═══════════════════════════════════════════════════════════════════════════
-- EL GAUCHO — THREE PLACEHOLDER DISHES, FOR THE PITCH
-- ───────────────────────────────────────────────────────────────────────────
-- The owner is walking into El Gaucho to offer them a place on the menu and
-- wants the page to show them on it. These are the three dishes from the
-- mockup, so the live page and the picture in the meeting agree.
--
-- ⚠ EL GAUCHO HAVE NOT AGREED TO ANY OF THIS. Everything here is a stand-in,
--   and the row settings say so in three separate ways:
--
--   · NO PRICES. Members see "on request". A number I made up, sitting on the
--     live members' menu, is a price the club would have to honour if a member
--     asked for it — and it would also be the first thing El Gaucho saw,
--     which is a bad way to open a negotiation about money.
--   · allergens_confirmed = false, so every one says "ask your server".
--   · is_placeholder = true, so menu_placeholder_audit() lists them and
--     /admin/menus shows them under "still to confirm".
--
--   They ARE visible to members (is_active = true), because a menu the owner
--   cannot open on a phone in the meeting defeats the point. That is the
--   trade: members may see three dishes the club cannot yet serve. One tick of
--   "Shown to members" in /admin/menus hides any of them instantly, and the
--   whole lot can be deleted in three clicks once El Gaucho send their real
--   list.
--
-- The Vietnamese is mine and unreviewed. The descriptions are mine too — they
-- are plausible for an Argentinian steakhouse, not quotes from El Gaucho.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

with g as (select id from public.menu_venues where slug = 'el-gaucho')
insert into public.menu_items (
  venue_id, slug, name_en, name_vn, description_en, description_vn,
  allergens, dietary, allergens_confirmed,
  price_vnd, lead_time_minutes,
  display_order, is_active, is_placeholder
)
select g.id, v.slug, v.name_en, v.name_vn, v.description_en, v.description_vn,
       '{}'::text[], v.dietary, false,
       null, null,
       v.display_order, true, true
from g, (values
  ('beef-empanadas', 'Beef Empanadas', 'Bánh Empanadas bò',
   'Three to share, chimichurri.', 'Ba chiếc dùng chung, sốt chimichurri.',
   '{}'::text[], 10),

  ('provoleta', 'Provoleta', 'Phô mai Provoleta nướng',
   'Grilled provolone, oregano, chilli.', 'Phô mai provolone nướng, lá oregano, ớt.',
   '{}'::text[], 20),

  -- The one dietary mark I can state without asking: chorizo criollo is pork.
  ('chorizo-criollo', 'Chorizo Criollo', 'Xúc xích Chorizo',
   'Grilled, chimichurri, sourdough.', 'Nướng, sốt chimichurri, bánh mì bột chua.',
   array['pork']::text[], 30)
) as v(slug, name_en, name_vn, description_en, description_vn, dietary, display_order)
on conflict (venue_id, slug) do update
  set name_en        = excluded.name_en,
      name_vn        = excluded.name_vn,
      description_en = excluded.description_en,
      description_vn = excluded.description_vn,
      dietary        = excluded.dietary,
      display_order  = excluded.display_order;

-- Everything that is still a stand-in, most dangerous first.
select * from public.menu_placeholder_audit();
