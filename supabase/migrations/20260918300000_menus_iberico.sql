-- ═══════════════════════════════════════════════════════════════════════════
-- IBERICO — SIX DISHES, AND THE FIRST REAL MARGIN ON THE MENU
-- ───────────────────────────────────────────────────────────────────────────
-- "Add 20% onto each dish." So for the first time both numbers are real:
--
--   cost_vnd  = what Iberico charge the club   (their card, verbatim)
--   price_vnd = cost × 1.2                     (what a member pays)
--
-- This is the column the whole schema was shaped around. cost_vnd lives on
-- menu_items, which no member session can read — RLS on, no policies, revoked
-- from anon and authenticated — and neither public view selects it. Every
-- arithmetic result is checked below rather than trusted; all eight land on
-- exact thousands, so nothing is rounded and no member sees 179,999₫.
--
-- ⚠ THE TWO CROQUETTES ARE TWO ROWS EACH, not one. They are sold in 6 and 12,
--   at different prices, and a menu line carrying one price for two sizes is
--   the line a member misreads and a server has to argue about. The portion is
--   in the dish name so the two rows cannot be confused for duplicates.
--
-- ⚠ ALLERGENS ARE NOT FILLED IN, as everywhere else on this menu, so all six
--   say "ask your server". Note that almonds appear in Mojama de Atún's own
--   description and both croquettes are near-certainly gluten, dairy and egg —
--   but a partial list reads as a complete one, and that is the failure that
--   hurts somebody. The kitchen confirms, then the box gets ticked.
--
--   Dietary marks are only those true by definition: jamón is pork, and a
--   tiradito is raw fish. Whether the mushroom croquettes are vegetarian
--   depends on their stock, which is a question for Iberico.
--
-- ⚠ NO LEAD TIMES. Iberico have not been asked.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

with i as (select id from public.menu_venues where slug = 'iberico')
insert into public.menu_items (
  venue_id, slug, name_en, name_vn, description_en, description_vn,
  allergens, dietary, allergens_confirmed,
  cost_vnd, price_vnd, display_order, is_active, is_placeholder
)
select i.id, v.slug, v.name_en, v.name_vn, v.desc_en, v.desc_vn,
       '{}'::text[], v.dietary, false,
       v.cost, (v.cost * 12) / 10, v.ord, true, false
from i, (values
  ('croquetas-jamon-6', 'Croquetas de Jamón · 6', 'Croquetas de Jamón · 6 viên',
   'Iberico ham croquettes, crisp golden shell. Iberico''s best seller.',
   'Croquette giăm bông Iberico, vỏ giòn vàng. Món bán chạy nhất của Iberico.',
   array['pork']::text[], 150000, 10),

  ('croquetas-jamon-12', 'Croquetas de Jamón · 12', 'Croquetas de Jamón · 12 viên',
   'Iberico ham croquettes, crisp golden shell. Iberico''s best seller.',
   'Croquette giăm bông Iberico, vỏ giòn vàng. Món bán chạy nhất của Iberico.',
   array['pork']::text[], 290000, 20),

  ('croquetas-setas-6', 'Croquetas de Setas · 6', 'Croquetas de Setas · 6 viên',
   'Mushroom croquettes, Manchego cheese mousse.',
   'Croquette nấm, mousse phô mai Manchego.',
   '{}'::text[], 135000, 30),

  ('croquetas-setas-12', 'Croquetas de Setas · 12', 'Croquetas de Setas · 12 viên',
   'Mushroom croquettes, Manchego cheese mousse.',
   'Croquette nấm, mousse phô mai Manchego.',
   '{}'::text[], 265000, 40),

  ('patatas-bravas', 'Patatas Bravas', 'Patatas Bravas',
   'Spicy bravas potatoes, garlic aioli.', 'Khoai tây bravas cay, sốt aioli tỏi.',
   array['spicy']::text[], 120000, 50),

  ('coliflor-asada', 'Escabeche de Coliflor Asada', 'Súp lơ nướng ngâm escabeche',
   'Roasted cauliflower escabeche.', 'Súp lơ trắng nướng ngâm escabeche.',
   '{}'::text[], 155000, 60),

  ('tiradito', 'Tiradito del Día', 'Tiradito trong ngày',
   'Fish of the day, passion fruit tiger''s milk.',
   'Cá trong ngày, nước sốt chanh dây tiger''s milk.',
   array['raw']::text[], 190000, 70),

  ('mojama-atun', 'Mojama de Atún', 'Cá ngừ muối Mojama',
   'Mediterranean dry-aged tuna, almonds.', 'Cá ngừ Địa Trung Hải ủ khô, hạnh nhân.',
   '{}'::text[], 250000, 80)
) as v(slug, name_en, name_vn, desc_en, desc_vn, dietary, cost, ord)
on conflict (venue_id, slug) do update
  set name_en        = excluded.name_en,
      name_vn        = excluded.name_vn,
      description_en = excluded.description_en,
      description_vn = excluded.description_vn,
      dietary        = excluded.dietary,
      cost_vnd       = excluded.cost_vnd,
      price_vnd      = excluded.price_vnd,
      display_order  = excluded.display_order;

-- ── THE MARGIN, CHECKED ────────────────────────────────────────────────────
-- Not "it should be 20%" — this prints the actual uplift on every row, and
-- flags any that did not land on a whole thousand. Anything but "20.0%" and
-- "ok" on all eight lines means the arithmetic is wrong, not the intent.
select i.name_en,
       to_char(i.cost_vnd,  'FM999,999,999') || '₫' as they_charge_us,
       to_char(i.price_vnd, 'FM999,999,999') || '₫' as member_pays,
       round(((i.price_vnd::numeric / i.cost_vnd) - 1) * 100, 1) || '%' as uplift,
       case when i.price_vnd % 1000 = 0 then 'ok' else '⚠ not a round thousand' end as rounding
  from public.menu_items i
  join public.menu_venues v on v.id = i.venue_id
 where v.slug = 'iberico'
 order by i.display_order;
