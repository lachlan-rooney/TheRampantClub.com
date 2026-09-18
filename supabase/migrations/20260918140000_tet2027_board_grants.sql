-- =====================================================================
--  Tết 2027 — THE BOARDS COULD NOT BE READ
--  Migration: 20260918140000_tet2027_board_grants.sql
--  Run after the other three migrations. Safe to re-run.
-- =====================================================================
--
--  Caught by testing as anon against the live database, 18 Sept 2026:
--
--    select * from public.tet_cask_board;
--    ERROR: permission denied for function tet_quote_cask
--
--  My earlier correction made the two *_public wrappers SECURITY DEFINER
--  so the browser could price things. It did not fix the two VIEWS, which
--  call tet_quote_cask and tet_quote_blends directly in their bodies —
--  and those are exactly the functions anon may not execute, because the
--  admin flag on them returns cost and margin.
--
--  So: the views call the wrappers instead. The wrappers pass p_admin =>
--  false and have no parameter that could change it, so the cost model
--  stays where it was. The alternative — granting anon EXECUTE on the raw
--  functions — would have handed the browser a way to ask for the margin.
--
--  create or replace view keeps the existing grants; the column list is
--  unchanged, so nothing downstream moves.
-- =====================================================================

create or replace view public.tet_cask_board as
select
  c.cask_ref,
  c.distillery,
  c.region,
  c.vintage_year,
  c.age_years,
  c.cask_type,
  c.wood,
  c.abv_pct                                   as cask_abv_pct,
  c.status,
  c.tasting_note_en,
  c.tasting_note_vn,
  c.colour_hex,
  c.image_path,
  c.display_order,
  c.is_placeholder,
  (q_cs ->> 'bottles')::int                   as bottles_cask_strength,
  (q_cs ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_cask_strength,
  (q_cs ->> 'cask_total_vnd')::numeric        as total_vnd_cask_strength,
  (q_50 ->> 'bottles')::int                   as bottles_reduced,
  (q_50 ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_reduced,
  (q_50 ->> 'cask_total_vnd')::numeric        as total_vnd_reduced,
  (q_50 ->> 'bottles')::int - (q_cs ->> 'bottles')::int as extra_bottles
from public.tet_casks c
cross join lateral public.tet_quote_cask_public(c.cask_ref, null)  as q_cs
cross join lateral public.tet_quote_cask_public(c.cask_ref, 50.00) as q_50
where c.is_active;

comment on view public.tet_cask_board is
  'Everything the browser is allowed to know about a cask. No ex-works, no margin. '
  'Prices come through tet_quote_cask_public, which cannot be asked for cost.';


create or replace view public.tet_blend_board as
select
  p.sku, p.name_en, p.name_vn, p.expression, p.age_years, p.abv_pct,
  p.bottle_size_ml, p.case_size, p.tasting_note_en, p.tasting_note_vn,
  p.image_path, p.min_order_bottles, p.display_order, p.is_placeholder,
  cat.slug as category_slug,
  (public.tet_quote_blends_public(
      jsonb_build_array(jsonb_build_object('sku', p.sku, 'qty', t.min_bottles)),
      true) -> 'lines' -> 0 ->> 'unit_inc_vat_vnd')::numeric as unit_vnd_with_sleeve,
  t.min_bottles as tier_min_bottles,
  t.label_en    as tier_label_en
from public.tet_products p
join public.tet_categories cat on cat.id = p.category_id
cross join public.tet_volume_tiers t
where p.is_active;

grant select on public.tet_cask_board  to anon, authenticated;
grant select on public.tet_blend_board to anon, authenticated;

-- =====================================================================
--  CHECK IT, AS THE BROWSER:
--    set local role anon;
--    select cask_ref, bottles_cask_strength, bottles_reduced, extra_bottles
--      from public.tet_cask_board order by display_order limit 3;
--    select sku, tier_min_bottles, unit_vnd_with_sleeve
--      from public.tet_blend_board order by sku, tier_min_bottles limit 4;
--    reset role;
--
--  Expect OCT-2027-01 at 70 → 84 bottles (+14), and DT-12YO at 50
--  bottles priced 1,635,000₫.
-- =====================================================================
