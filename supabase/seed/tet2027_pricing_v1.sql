-- ═══════════════════════════════════════════════════════════════════════════
--  RECORD OF APPLIED DATA — the Tết 2026/27 cost model, v1.
--  Applied 2026-09-24 through the REST API with the service role; this file is
--  the repo's copy of what was written, so the model can be read, reviewed and
--  put back without opening the database.
-- ───────────────────────────────────────────────────────────────────────────
--  Owner, 2026-09-24: "Take the sheet as gospel." Duncan Taylor's own cask
--  summary computes a landed cost that the club now prices from:
--
--      customs value = ex-works per bottle   (no freight, no insurance)
--      import duty   = 6%  of that
--      SCT           = 65% of (value + duty)
--      FX            = 35,000 VND / GBP
--
--  Proven against the sheet before it was applied: Craigellachie Q5113 at
--  £44.92 a bottle → £78.57 landed → 2,749,778₫, which is the sheet's own
--  figure to the dong. The engine then returns 5,500,000₫ a bottle inc VAT at
--  a 45% margin, and 379,500,000₫ for the cask.
--
--  WHAT CHANGED FROM v0-placeholder, and why:
--    duty            15%   → 6%      the sheet
--    FX              33,000 → 35,000 the sheet
--    freight/bottle  £1.20 → £0      the sheet carries no freight line
--    bottling/bottle £9.50 → £0      ex-works is already a BOTTLED case price
--                                    (£269.50 ÷ 6 = £44.92), so adding a
--                                    bottling cost would count it twice
--    VAT             8%    → 10%     spirits, as on the menus
--    distributor     20%   → 0%      owner: "ignore the 20% when pricing".
--                                    The club does receive 20% off the 44.92;
--                                    it is deliberately kept OUT of the cost
--                                    so it falls to the club as margin rather
--                                    than being given away in the price.
--
--  ⚠ STILL A DECISION, NOT A FACT: target_margin_cask_pct 0.45 and
--    target_margin_blend_pct 0.40 are working figures. Everything above comes
--    from Duncan Taylor; these two are the club's to set.
-- ═══════════════════════════════════════════════════════════════════════════

update public.tet_pricing_inputs set is_active = false where is_active;

insert into public.tet_pricing_inputs (
  version_label, notes, is_active, effective_from,
  fx_vnd_per_gbp, distributor_discount_pct, freight_per_bottle_gbp,
  import_duty_pct, sct_pct, local_cost_per_bottle_vnd,
  target_margin_blend_pct, target_margin_cask_pct, vat_pct, rounding_step_vnd,
  artwork_setup_fee_vnd, setup_fee_waiver_bottles,
  bottle_size_ml, cask_bottling_cost_gbp, cask_bottling_loss_pct
) values (
  'v1-dt-sheet-2026-09-24',
  'From Duncan Taylor''s cask summary sheet, taken as gospel by the owner 2026-09-24. The 20% distributor discount is deliberately NOT applied.',
  true, '2026-09-24',
  35000, 0, 0,
  0.06, 0.65, 0,
  0.40, 0.45, 0.10, 5000,
  8000000, 250,
  700, 0, 0.0200
);

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- update public.tet_pricing_inputs set is_active = false
--  where version_label = 'v1-dt-sheet-2026-09-24';
-- update public.tet_pricing_inputs set is_active = true
--  where version_label = 'v0-placeholder';
