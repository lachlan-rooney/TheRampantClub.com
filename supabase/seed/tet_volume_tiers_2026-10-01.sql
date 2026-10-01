-- ═══════════════════════════════════════════════════════════════════════════
-- TẾT · THE VOLUME LADDER, RE-CUT.  Record of what was applied 2026-10-01.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner: "make the slide discount go 5,6,7,8,9,10,11,12%, staged reasonably
-- from 50 up. Not big brackets."
--
-- It was four wide steps — 50 at nothing, 100 at 5%, 250 at 8%, 500 at 12% —
-- so a buyer at 120 bottles was 130 away from the next thing worth having. It
-- is eight now, tight where the orders actually sit and widening as they grow:
--
--     50 → 5%     75 → 6%     100 → 7%     150 →  8%
--    200 → 9%    300 → 10%    400 → 11%    500 → 12%
--
-- ⚠ THE FLOOR MOVED. Fifty bottles used to earn nothing and now earns 5%.
-- That is a commercial change, not a presentational one, and it was asked for
-- directly.
--
-- SLEEVE PRICES ARE NOT TOUCHED. They are Huntly's quote at their own break
-- points — 50,000 below 100, 40,000 from 100, 30,000 from 250, 25,000 from 500
-- — so each new tier inherits the price of the ORIGINAL bracket it falls
-- inside. Inventing a sleeve price for 75 or 300 would be quoting a supplier's
-- number that the supplier never gave.
--
-- Nothing references a tier by id (the order record carries tier_min_bottles,
-- a number), so the rows are replaced wholesale rather than edited in place.
-- Idempotent: re-running restores exactly this ladder.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'tet_volume_tiers') then
    raise exception 'PREREQUISITES MISSING — tet_volume_tiers' using hint = 'Nothing applied.';
  end if;
end $prereq$;

delete from public.tet_volume_tiers;

insert into public.tet_volume_tiers
  (label_en, label_vn, min_bottles, max_bottles, discount_pct, sleeve_price_vnd, display_order)
values
  ('50–74 bottles',   '50–74 chai',    50,   74, 0.05, 50000, 1),
  ('75–99 bottles',   '75–99 chai',    75,   99, 0.06, 50000, 2),
  ('100–149 bottles', '100–149 chai', 100,  149, 0.07, 40000, 3),
  ('150–199 bottles', '150–199 chai', 150,  199, 0.08, 40000, 4),
  ('200–299 bottles', '200–299 chai', 200,  299, 0.09, 40000, 5),
  ('300–399 bottles', '300–399 chai', 300,  399, 0.10, 30000, 6),
  ('400–499 bottles', '400–499 chai', 400,  499, 0.11, 30000, 7),
  ('500+ bottles',    '500+ chai',    500, null, 0.12, 25000, 8);

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- select min_bottles, max_bottles, (discount_pct*100)::int as pct, sleeve_price_vnd
--   from public.tet_volume_tiers order by display_order;
-- Eight rows, 5 through 12, no gap and no overlap between max and the next min.

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- delete from public.tet_volume_tiers;
-- insert into public.tet_volume_tiers
--   (label_en, label_vn, min_bottles, max_bottles, discount_pct, sleeve_price_vnd, display_order)
-- values
--   ('50–99 bottles',   '50–99 chai',    50,  99, 0.00, 50000, 1),
--   ('100–249 bottles', '100–249 chai', 100, 249, 0.05, 40000, 2),
--   ('250–499 bottles', '250–499 chai', 250, 499, 0.08, 30000, 3),
--   ('500+ bottles',    '500+ chai',    500, null, 0.12, 25000, 4);
