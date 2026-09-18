-- ═══════════════════════════════════════════════════════════════════════════
-- THE CHARCUTERIE PLATTER GETS ITS PRICE
-- ───────────────────────────────────────────────────────────────────────────
-- 950,000₫. It had been showing "on request" since the menu was built, which
-- was right while nobody had said, and wrong the moment somebody did.
--
-- ⚠ READ AS WHAT THE MEMBER PAYS, NOT AS COST. The owner wrote "the price for
--   the Charcuterie Platter is 950k" with no mention of an uplift, where every
--   previous menu arrived as a restaurant's own card followed by an explicit
--   instruction to add 20%. So price_vnd = 950,000 and no margin is applied on
--   top.
--
--   If 950,000 is what Cure & Pickle charge the club, this is wrong by
--   190,000₫ a platter and the fix is one line:
--
--     update public.menu_items
--        set cost_vnd = 950000, price_vnd = 1140000
--      where slug = 'charcuterie-platter';
--
-- ⚠ COST IS STILL UNKNOWN. This is the only priced dish on the menu with no
--   cost_vnd, so it is the one dish the club cannot report a margin on. Worth
--   asking Cure & Pickle what they charge, even though the price is settled.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

update public.menu_items
   set price_vnd = 950000
 where slug = 'charcuterie-platter';

-- Every priced dish, and whether the club knows what it makes on it.
select v.name as venue, i.name_en,
       to_char(i.price_vnd, 'FM999,999,999') || '₫' as member_pays,
       coalesce(to_char(i.cost_vnd, 'FM999,999,999') || '₫', '⚠ cost unknown') as they_charge_us,
       case when i.cost_vnd is null then '—'
            else round(((i.price_vnd::numeric / i.cost_vnd) - 1) * 100, 1) || '%' end as uplift
  from public.menu_items i
  join public.menu_venues v on v.id = i.venue_id
 where i.price_vnd is not null and i.is_active
 order by v.display_order, i.display_order;
