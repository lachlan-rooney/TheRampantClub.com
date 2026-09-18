-- =====================================================================
--  Tết 2027 — EVERY BLEND QUOTE RETURNED PHANTOM LINES
--  Migration: 20260918170000_tet2027_blend_lines.sql
--  Run after the others. Safe to re-run.
-- =====================================================================
--
--  Found by asking for a two-SKU quote and counting what came back:
--
--    select public.tet_quote_blends(
--      '[{"sku":"DT-12YO","qty":50},{"sku":"DT-18YO","qty":60}]'::jsonb,
--      true, false);
--
--    → "lines" had FOUR entries: the 12, an empty {}, the 18, an empty {}.
--
--  The cause is one missing pair of brackets in tet_quote_blends:
--
--    v_lines := v_lines || jsonb_build_object(…) || case … end;
--
--  `||` is left-associative, and in Postgres ARRAY || OBJECT appends the
--  object as an ELEMENT. So the line object was appended, and then the
--  admin object (or, publicly, an empty '{}') was appended as a SECOND
--  element rather than merged into the line.
--
--  Two consequences, both live until now:
--    · the buyer's page would render an empty row between every real one
--    · with p_admin, landed_cost_vnd and gross_margin_pct arrived in their
--      own element, so the Quote Builder read the margin as undefined —
--      the number the whole screen exists to show
--
--  The fix is the brackets: merge the two objects, THEN append once. The
--  cask quote never had this problem; it builds one object and returns it.
--
--  Quotes already stored on reservations keep their phantom lines — they
--  are a frozen snapshot of what was quoted and are not rewritten here.
-- =====================================================================

create or replace function public.tet_quote_blends(
  p_lines  jsonb,
  p_sleeve boolean default true,
  p_admin  boolean default false
) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_in        public.tet_pricing_inputs;
  v_tier      public.tet_volume_tiers;
  v_total     integer := 0;
  v_lines     jsonb   := '[]'::jsonb;
  v_line      jsonb;
  v_p         public.tet_products;
  v_qty       integer;
  v_landed    numeric;
  v_ex_vat    numeric;
  v_sleeve    numeric;
  v_unit      numeric;
  v_sub       numeric := 0;
  v_cost      numeric := 0;
  v_setup     numeric := 0;
  v_next      public.tet_volume_tiers;
begin
  v_in := public.tet_active_inputs();
  if v_in.id is null then
    raise exception 'No active pricing version';
  end if;

  select coalesce(sum((e->>'qty')::int), 0) into v_total
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) e;

  if v_total <= 0 then
    return jsonb_build_object('error', 'empty_order');
  end if;

  v_tier := public.tet_tier_for(v_total);
  if v_tier.id is null then
    return jsonb_build_object(
      'error', 'below_minimum',
      'min_bottles', (select min(min_bottles) from public.tet_volume_tiers),
      'total_bottles', v_total
    );
  end if;

  v_sleeve := case when p_sleeve then v_tier.sleeve_price_vnd else 0 end;
  v_setup  := case
                when not p_sleeve then 0
                when v_total >= v_in.setup_fee_waiver_bottles then 0
                else v_in.artwork_setup_fee_vnd
              end;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    select * into v_p from public.tet_products
      where sku = (v_line->>'sku') and is_active;
    continue when v_p.id is null;

    v_qty := greatest((v_line->>'qty')::int, 0);
    continue when v_qty = 0;

    v_landed := public.tet_landed_cost_vnd(
                  v_p.uk_list_price_gbp * (1 - v_in.distributor_discount_pct),
                  v_in.freight_per_bottle_gbp,
                  v_in);

    v_ex_vat := public.tet_price_from_landed(v_landed, v_in.target_margin_blend_pct)
                * (1 - v_tier.discount_pct);

    v_unit := public.tet_round_up((v_ex_vat + v_sleeve) * (1 + v_in.vat_pct),
                                  v_in.rounding_step_vnd);

    v_sub  := v_sub  + (v_unit * v_qty);
    v_cost := v_cost + ((v_landed + (v_sleeve * 0.5)) * v_qty);

    -- THE BRACKETS. Merge the line with its admin fields into ONE object,
    -- then append that object to the array exactly once.
    v_lines := v_lines || (jsonb_build_object(
      'sku',            v_p.sku,
      'name_en',        v_p.name_en,
      'name_vn',        v_p.name_vn,
      'expression',     v_p.expression,
      'qty',            v_qty,
      'unit_ex_vat_vnd', round(public.tet_round_up(v_ex_vat + v_sleeve, v_in.rounding_step_vnd)),
      'sleeve_vnd',      round(v_sleeve),
      'unit_inc_vat_vnd', round(v_unit),
      'line_total_vnd',  round(v_unit * v_qty),
      'is_placeholder',  v_p.is_placeholder
    ) || case when p_admin then jsonb_build_object(
      'landed_cost_vnd',  round(v_landed),
      'gross_margin_pct', round(((v_ex_vat - v_landed) / nullif(v_ex_vat, 0))::numeric, 4)
    ) else '{}'::jsonb end);
  end loop;

  select * into v_next from public.tet_volume_tiers
   where min_bottles > v_tier.min_bottles order by min_bottles asc limit 1;

  return jsonb_build_object(
    'total_bottles',   v_total,
    'tier', jsonb_build_object(
      'label_en',        v_tier.label_en,
      'label_vn',        v_tier.label_vn,
      'discount_pct',    v_tier.discount_pct,
      'sleeve_price_vnd', round(v_tier.sleeve_price_vnd)
    ),
    'next_tier', case when v_next.id is null then null else jsonb_build_object(
      'label_en',       v_next.label_en,
      'min_bottles',    v_next.min_bottles,
      'bottles_away',   v_next.min_bottles - v_total,
      'discount_pct',   v_next.discount_pct,
      'sleeve_price_vnd', round(v_next.sleeve_price_vnd)
    ) end,
    'lines',           v_lines,
    'sleeve_selected', p_sleeve,
    'setup_fee_vnd',   round(v_setup),
    'setup_fee_waived', (p_sleeve and v_setup = 0),
    'subtotal_vnd',    round(v_sub),
    'total_inc_vat_vnd', round(v_sub + (v_setup * (1 + v_in.vat_pct))),
    'vat_pct',         v_in.vat_pct,
    'currency',        'VND',
    'pricing_version_id', v_in.id
  ) || case when p_admin then jsonb_build_object(
    'total_cost_vnd',  round(v_cost),
    'gross_profit_vnd', round((v_sub / (1 + v_in.vat_pct)) - v_cost)
  ) else '{}'::jsonb end;
end;
$fn$;

-- The grants from foundations §14 survive create or replace, but re-assert
-- them so this file can be run on its own without quietly opening the raw
-- function to the browser.
revoke all on function public.tet_quote_blends(jsonb, boolean, boolean) from public;
revoke execute on function public.tet_quote_blends(jsonb, boolean, boolean) from anon, authenticated;

-- =====================================================================
--  CHECK — two SKUs must give exactly TWO lines:
--
--    select jsonb_array_length(
--      public.tet_quote_blends(
--        '[{"sku":"DT-12YO","qty":50},{"sku":"DT-18YO","qty":60}]'::jsonb,
--        true, false) -> 'lines');                       -- expect 2
--
--    select public.tet_quote_blends(
--      '[{"sku":"DT-12YO","qty":50}]'::jsonb, true, true)
--      -> 'lines' -> 0 ->> 'gross_margin_pct';           -- expect 0.4000
-- =====================================================================
