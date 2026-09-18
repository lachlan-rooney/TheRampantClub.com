-- ═══════════════════════════════════════════════════════════════════════════
-- LE CORTO — THREE PLACEHOLDER DISHES
-- ───────────────────────────────────────────────────────────────────────────
-- Le Corto had a logo and a heading but nothing under it, so the board skipped
-- it entirely: MenuBoard only renders venues that have something to offer,
-- because a restaurant's name over an empty space reads as a fault rather than
-- as "coming soon". That is why they were missing from the menu.
--
-- ⚠ THE SAME WARNING AS EL GAUCHO, AND IT MATTERS MORE HERE. Le Corto have not
--   been asked yet. These three dishes are French bistro standards I chose as
--   stand-ins; they are NOT Le Corto's menu and I have not seen it.
--
--   · NO PRICES — members see "on request".
--   · allergens_confirmed = false — every one says "ask your server".
--   · is_placeholder = true — they appear in menu_placeholder_audit() and
--     under "still to confirm" in /admin/menus.
--
--   Replace the lot the moment Le Corto send a real list. Three clicks each in
--   /admin/menus, or untick "Shown to members" to hide them in one.
--
-- Lead times are set because the first menu's whole promise is speed and a
-- plate with no time on it looks like one nobody has thought about — but they
-- are estimates, not quotes from their kitchen.
--
-- The Vietnamese is mine and unreviewed.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

with c as (select id from public.menu_venues where slug = 'le-corto')
insert into public.menu_items (
  venue_id, slug, name_en, name_vn, description_en, description_vn,
  allergens, dietary, allergens_confirmed,
  price_vnd, lead_time_minutes,
  display_order, is_active, is_placeholder
)
select c.id, v.slug, v.name_en, v.name_vn, v.description_en, v.description_vn,
       '{}'::text[], v.dietary, false,
       null, v.lead,
       v.display_order, true, true
from c, (values
  ('tarte-flambee', 'Tarte Flambée', 'Bánh Tarte Flambée',
   'Crème fraîche, lardons, onion.', 'Kem tươi, thịt xông khói, hành tây.',
   array['pork']::text[], 18, 10),

  ('gougeres', 'Gougères', 'Bánh phô mai Gougères',
   'Comté, black pepper.', 'Phô mai Comté, tiêu đen.',
   '{}'::text[], 12, 20),

  ('rillettes-de-canard', 'Rillettes de Canard', 'Pa-tê vịt Rillettes',
   'Toasted sourdough, cornichons.', 'Bánh mì bột chua nướng, dưa chuột bao tử.',
   '{}'::text[], 10, 30)
) as v(slug, name_en, name_vn, description_en, description_vn, dietary, lead, display_order)
on conflict (venue_id, slug) do update
  set name_en           = excluded.name_en,
      name_vn           = excluded.name_vn,
      description_en    = excluded.description_en,
      description_vn    = excluded.description_vn,
      dietary           = excluded.dietary,
      lead_time_minutes = excluded.lead_time_minutes,
      display_order     = excluded.display_order;

-- El Gaucho's three went in with no lead times, which leaves them looking like
-- dishes nobody has thought about next to Le Corto's. Estimates, same status as
-- everything else on this page: to be replaced by what the kitchen actually
-- says.
update public.menu_items i
   set lead_time_minutes = x.mins
  from (values ('beef-empanadas', 15), ('provoleta', 12), ('chorizo-criollo', 14)) as x(slug, mins)
 where i.slug = x.slug
   and i.lead_time_minutes is null
   and i.venue_id = (select id from public.menu_venues where slug = 'el-gaucho');

select * from public.menu_placeholder_audit();
