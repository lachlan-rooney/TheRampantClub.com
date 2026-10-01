-- ═══════════════════════════════════════════════════════════════════════════
-- TẾT · THE BOTTLE COUNTS, ON ONE BASIS.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-10-01: "make sure the maths here is accurate" — of the strength
-- toggle: cask strength / 55% / 50% / 45% / 40%.
--
-- It was not, and the page showed it. Q5113 read 69 bottles at cask strength
-- and 68 at 55%, printing "−1 extra bottles" underneath. Sixteen of the twenty
-- casks did the same. Diluting whisky cannot produce fewer bottles.
--
-- ── WHAT WAS WRONG: NOT THE ARITHMETIC, THE BASIS ─────────────────────────
--   · CASK STRENGTH used `outturn_override` — Huntly's ACTUAL bottling count,
--     a real number from a real fill. For Q5113, 69.
--   · EVERY REDUCED STRENGTH was computed from bulk litres and then had our 2%
--     `cask_bottling_loss_pct` deducted. 68.
--
-- A measured bottling count already has its losses in it; they happened. Taking
-- a further 2% off the diluted figures deducts them a second time. So every
-- reduced count was about two bottles short — and at 55%, where diluting from
-- 55.5% gains well under one bottle, the double deduction overtook the gain and
-- the number went backwards.
--
-- ── THE FIX ───────────────────────────────────────────────────────────────
-- Where Huntly have given their own outturn, every strength is derived FROM IT:
--     bottles(target) = floor( outturn × cask_abv / target_abv )
-- Q5113 becomes 69 · 69 · 76 · 85 · 95, which rises as dilution must. Casks
-- with no override are untouched: nothing has been measured there, so the loss
-- has not been accounted for yet and still must be.
--
-- ⚠ THIS MOVES QUOTED NUMBERS. Reduced-strength counts rise by roughly two
-- bottles a cask, and since the cask price is fixed and spread across them,
-- per-bottle prices fall slightly. That IS the correction: the old per-bottle
-- prices divided a real cask by an understated count.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if not exists (select 1 from pg_proc where proname = 'tet_quote_cask') then
    raise exception 'PREREQUISITES MISSING — tet_quote_cask' using hint = 'Nothing applied.';
  end if;
  if not exists (select 1 from pg_proc where proname = 'tet_cask_bottles') then
    raise exception 'PREREQUISITES MISSING — tet_cask_bottles' using hint = 'Nothing applied.';
  end if;
end $prereq$;

-- The rule, on its own so it can be read on its own.
create or replace function public.tet_bottles_from_outturn(
  p_outturn   integer,
  p_cask_abv  numeric,
  p_target    numeric
) returns integer language sql immutable as $fn$
  -- No second loss deduction: a measured outturn already contains its losses.
  select floor(p_outturn * (p_cask_abv / nullif(p_target, 0)))::int;
$fn$;

comment on function public.tet_bottles_from_outturn(integer, numeric, numeric) is
  'Scales Huntly''s own bottling count to a lower strength by the ABV ratio alone. Applying cask_bottling_loss_pct on top would deduct losses the measured count already contains — see db/tet_outturn_basis_fix.sql.';

-- The quote itself, reprinted in full so this file is runnable on its own.
-- Only the v_bottles block differs from supabase/migrations/20260918120000.
create or replace function public.tet_quote_cask(
  p_cask_ref   text,
  p_target_abv numeric default null,   -- null = cask strength
  p_admin      boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_in       public.tet_pricing_inputs;
  v_c        public.tet_casks;
  v_target   numeric;
  v_bottles  integer;
  v_cs_bott  integer;
  v_freight  numeric;
  v_fob      numeric;
  v_landed   numeric;
  v_ex_vat   numeric;
  v_unit     numeric;
begin
  v_in := public.tet_active_inputs();
  if v_in.id is null then raise exception 'No active pricing version'; end if;

  select * into v_c from public.tet_casks where cask_ref = p_cask_ref and is_active;
  if v_c.id is null then return jsonb_build_object('error', 'cask_not_found'); end if;

  v_target  := coalesce(p_target_abv, v_c.abv_pct);
  if v_target > v_c.abv_pct then
    return jsonb_build_object('error', 'cannot_increase_strength');
  end if;
  if v_target < 40 then
    return jsonb_build_object('error', 'below_legal_minimum_abv');  -- Scotch must be ≥ 40%
  end if;

  v_freight := coalesce(v_c.freight_per_bottle_gbp_override, v_in.freight_per_bottle_gbp);

  -- ── ONE BASIS (2026-10-01) ────────────────────────────────────────────
  -- Cask strength took Huntly's MEASURED outturn while every reduced strength
  -- was computed from bulk and then had our 2% bottling loss deducted. A real
  -- bottling count already contains its losses, so that deducted them twice:
  -- reduced counts came out about two bottles short, and at 55% the double
  -- deduction overtook the gain from diluting 55.5% → 55% and the number went
  -- BACKWARDS. Sixteen of twenty casks printed a negative "extra bottles".
  -- Where an outturn exists, every strength is now scaled from it by the ABV
  -- ratio alone. Casks without one are unchanged.
  v_bottles := coalesce(
    case when v_target = v_c.abv_pct then v_c.outturn_override else null end,
    case when v_c.outturn_override is not null
         then public.tet_bottles_from_outturn(v_c.outturn_override, v_c.abv_pct, v_target)
         else null end,
    public.tet_cask_bottles(v_c.bulk_litres, v_c.abv_pct, v_target,
                            v_in.bottle_size_ml, v_in.cask_bottling_loss_pct));

  v_cs_bott := coalesce(v_c.outturn_override,
    public.tet_cask_bottles(v_c.bulk_litres, v_c.abv_pct, v_c.abv_pct,
                            v_in.bottle_size_ml, v_in.cask_bottling_loss_pct));

  -- The whisky cost is fixed for the cask. Spread it over more bottles
  -- and the declared value per bottle falls — and with it the duty and
  -- the 65% SCT, because both are charged on value.
  v_fob    := (v_c.ex_works_gbp * (1 - v_in.distributor_discount_pct)) / nullif(v_bottles, 0)
              + v_in.cask_bottling_cost_gbp;
  v_landed := public.tet_landed_cost_vnd(v_fob, v_freight, v_in);
  v_ex_vat := public.tet_price_from_landed(v_landed, v_in.target_margin_cask_pct);
  v_unit   := public.tet_round_up(v_ex_vat * (1 + v_in.vat_pct), v_in.rounding_step_vnd);

  return jsonb_build_object(
    'cask_ref',        v_c.cask_ref,
    'distillery',      v_c.distillery,
    'region',          v_c.region,
    'age_years',       v_c.age_years,
    'cask_abv_pct',    v_c.abv_pct,
    'target_abv_pct',  v_target,
    'is_cask_strength', v_target = v_c.abv_pct,
    'status',          v_c.status,
    'bottles',         v_bottles,
    'bottles_at_cask_strength', v_cs_bott,
    'extra_bottles',   v_bottles - v_cs_bott,
    'unit_inc_vat_vnd', round(v_unit),
    'cask_total_vnd',  round(v_unit * v_bottles),
    'vat_pct',         v_in.vat_pct,
    'currency',        'VND',
    'is_placeholder',  v_c.is_placeholder,
    'pricing_version_id', v_in.id
  ) || case when p_admin then jsonb_build_object(
    'landed_cost_vnd',  round(v_landed),
    'gross_margin_pct', round(((v_ex_vat - v_landed) / nullif(v_ex_vat, 0))::numeric, 4),
    'gross_profit_vnd', round((v_ex_vat - v_landed) * v_bottles)
  ) else '{}'::jsonb end;
end;
$fn$;
commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- Nothing may go backwards, on any cask:
--   select cask_ref, bottles_cask_strength, bottles_55, bottles_reduced,
--          bottles_45, bottles_40
--     from public.tet_cask_board order by display_order;
--   → counts rise left to right on every cask stronger than 40%, and Q5113
--     reads 69 · 69 · 76 · 85 · 95.
--
-- No negative gains anywhere:
--   select cask_ref, extra_bottles_55, extra_bottles, extra_bottles_45,
--          extra_bottles_40
--     from public.tet_cask_board
--    where least(extra_bottles_55, extra_bottles, extra_bottles_45,
--                extra_bottles_40) < 0;
--   → no rows.

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Re-run the tet_quote_cask block from
-- supabase/migrations/20260918120000_tet2027_foundations.sql (its v_bottles has
-- no middle branch), then:
--   drop function if exists public.tet_bottles_from_outturn(integer, numeric, numeric);
-- The counts return to two bases and the −1 comes back with them.
