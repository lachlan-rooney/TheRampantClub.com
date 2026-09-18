-- ═══════════════════════════════════════════════════════════════════════════
-- FUJIYAMA'S MENU, THREE MORE LOGOS, AND THE FICTION SWITCHED OFF
-- ───────────────────────────────────────────────────────────────────────────
-- FUJIYAMA sent food while still marked as arriving on 23 September, which
-- forced a decision: the board used to show a date INSTEAD of the dishes.
-- That is wrong now. A restaurant that has already sent its menu should show
-- it — a preview is the only interesting thing about a place that has not
-- opened — so the board now prints the date ABOVE the list rather than in
-- place of it.
--
-- That change would have resurfaced the stand-in dishes I invented for El
-- Gaucho and Le Corto, which nobody has agreed to. They are switched off here
-- rather than deleted: is_active = false keeps the rows for the day those two
-- send their real lists, and keeps them out of a member's hands tonight.
--
-- ⚠ THE 20% IS ASSUMED. The owner said "add 20% onto each dish" of Iberico's
--   menu, and I have read that as the club's markup rather than a one-off. So
--   FUJIYAMA's card is cost_vnd and the member price is cost × 1.2. If the
--   deal with FUJIYAMA is different, one UPDATE fixes it — the arithmetic is
--   printed at the bottom of this file.
--
-- ⚠ FOUR THINGS I CHANGED OR INFERRED IN THEIR MENU:
--
--   1. "DB02 WAGYU DON" — DB02 is an item code from their own system, not part
--      of the dish name. Dropped from what a member sees.
--   2. "SALMON AVOCADO ROLL 300.000 / 330,000" carried TWO prices and one
--      description mentioning cream cheese, so it is two rows: the plain roll
--      at 300,000 and the cream cheese roll at 330,000. If that is one dish
--      with two sizes, tell me and I will merge them.
--   3. Their Vietnamese had two typos — "món ăn kẻm" and "phỏ mai" — corrected
--      to "món ăn kèm" and "phô mai". Their English had "Wagyu becf".
--   4. THE SECTIONS ARE MINE. Omakase / Donburi / Sashimi / Rolls is how a
--      sushi menu normally reads, but FUJIYAMA did not ask for it. Rename or
--      clear them in /admin/menus.
--
--   Raw is marked where it is true by definition — a sashimi assortment, and
--   the Shokado box whose own description lists sashimi. Whether their salmon
--   rolls are raw is a question for the kitchen. Allergens unconfirmed
--   throughout, so every dish says "ask your server". No lead times.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Logos ──────────────────────────────────────────────────────────────────
-- Applied only where one is absent, so a re-run cannot blank artwork uploaded
-- through /admin/menus since.
update public.menu_venues set logo_path = '/images/partners/fujiyama-sushi-600.webp'
 where slug = 'fujiyama-sushi' and logo_path is null;
update public.menu_venues set logo_path = '/images/partners/rico-taco-600.webp'
 where slug = 'rico-taco' and logo_path is null;
update public.menu_venues set logo_path = '/images/partners/hoa-tuc-600.webp'
 where slug = 'hoa-tuc' and logo_path is null;

-- ── Iberico is live ────────────────────────────────────────────────────────
-- Confirmed by the owner. Belt and braces: it must have no arriving date, or
-- its menu sits under a "coming soon" line.
update public.menu_venues
   set arriving_on = null, is_placeholder = false
 where slug = 'iberico';

-- ── The invented dishes, switched off ──────────────────────────────────────
-- El Gaucho's and Le Corto's stand-ins only. Livannah's, Iberico's and the
-- charcuterie platter are real and carry is_placeholder = false, so this
-- cannot touch them — but the venues are named as well, not just the flag.
update public.menu_items i
   set is_active = false
  from public.menu_venues v
 where v.id = i.venue_id
   and v.slug in ('el-gaucho', 'le-corto')
   and i.is_placeholder;

-- ── FUJIYAMA's menu ────────────────────────────────────────────────────────
with f as (select id from public.menu_venues where slug = 'fujiyama-sushi')
insert into public.menu_items (
  venue_id, slug, section_en, section_vn, name_en, name_vn,
  description_en, description_vn,
  allergens, dietary, allergens_confirmed,
  cost_vnd, price_vnd, display_order, is_active, is_placeholder
)
select f.id, v.slug, v.sec_en, v.sec_vn, v.name_en, v.name_vn, v.desc_en, v.desc_vn,
       '{}'::text[], v.dietary, false,
       v.cost, (v.cost * 12) / 10, v.ord, true, false
from f, (values
  ('shokado-box', 'Omakase', 'Omakase', 'Shokado Box', 'Hộp Shokado',
   'Three kinds of sashimi, three side dishes, four pieces of nigiri sushi, two pieces of sushi roll. Includes miso soup and dessert.',
   '3 loại sashimi, 3 món ăn kèm, 4 miếng nigiri sushi, 2 miếng sushi cuộn. Bao gồm súp miso & tráng miệng.',
   array['raw']::text[], 660000, 10),

  ('wagyu-don', 'Donburi', 'Cơm tô Donburi', 'Wagyu Don', 'Cơm tô bò Wagyu',
   'Wagyu beef rice bowl.', 'Cơm tô thịt bò Wagyu.',
   '{}'::text[], 290000, 20),

  ('chicken-katsu-don', 'Donburi', 'Cơm tô Donburi', 'Chicken Katsu Don', 'Cơm tô gà Katsu',
   'Chicken cutlet rice bowl.', 'Cơm tô gà chiên xù.',
   '{}'::text[], 190000, 30),

  ('3-shu-mori', 'Sashimi', 'Sashimi', '3 Shu Mori', 'Sashimi 3 loại',
   'Three kinds of sashimi assortment.', 'Sashimi thập cẩm 3 loại.',
   array['raw']::text[], 495000, 40),

  ('salmon-avocado-roll', 'Rolls', 'Sushi cuộn', 'Salmon Avocado Roll', 'Cuộn cá hồi, bơ',
   null, null,
   '{}'::text[], 300000, 50),

  ('salmon-avocado-cream-cheese-roll', 'Rolls', 'Sushi cuộn',
   'Salmon Avocado Cream Cheese Roll', 'Cuộn cá hồi, bơ và phô mai kem',
   null, null,
   '{}'::text[], 330000, 60)
) as v(slug, sec_en, sec_vn, name_en, name_vn, desc_en, desc_vn, dietary, cost, ord)
on conflict (venue_id, slug) do update
  set section_en     = excluded.section_en,
      section_vn     = excluded.section_vn,
      name_en        = excluded.name_en,
      name_vn        = excluded.name_vn,
      description_en = excluded.description_en,
      description_vn = excluded.description_vn,
      dietary        = excluded.dietary,
      cost_vnd       = excluded.cost_vnd,
      price_vnd      = excluded.price_vnd,
      display_order  = excluded.display_order;

-- ── Read it back ───────────────────────────────────────────────────────────
select v.name as venue,
       coalesce(v.arriving_on::text, 'serving now') as status,
       case when v.logo_path is null then '⚠ no logo' else 'logo ✓' end as logo,
       count(i.id) filter (where i.is_active) as dishes_live,
       count(i.id) filter (where not i.is_active) as dishes_hidden
  from public.menu_venues v
  left join public.menu_items i on i.venue_id = v.id
 group by v.id, v.name, v.arriving_on, v.logo_path, v.display_order
 order by v.display_order;

select i.name_en,
       coalesce(i.section_en,'—') as section,
       to_char(i.cost_vnd,'FM999,999,999') || '₫'  as they_charge_us,
       to_char(i.price_vnd,'FM999,999,999') || '₫' as member_pays,
       round(((i.price_vnd::numeric / i.cost_vnd) - 1) * 100, 1) || '%' as uplift,
       case when i.price_vnd % 1000 = 0 then 'ok' else '⚠ not a round thousand' end as rounding
  from public.menu_items i
  join public.menu_venues v on v.id = i.venue_id
 where v.slug = 'fujiyama-sushi'
 order by i.display_order;
