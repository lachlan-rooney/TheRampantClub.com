-- =====================================================================
--  Tết 2027 — THE BOARD LEARNS 45% AND 40%
--  Migration: 20260921150000_tet2027_45_and_40.sql
--  Run after 20260918180000. Safe to re-run.
-- =====================================================================
--
--  The owner, 21 September: "bottled at cask strength 55% 50% — add in 45%
--  and 40% too."
--
--  Nothing in the pricing needs teaching: tet_quote_cask already takes any
--  target strength and already refuses below 40, because Scotch that is not
--  at least 40% abv is not Scotch. 40% is therefore the last option there
--  will ever be, not an arbitrary stopping point.
--
--  WHY THIS MATTERS MORE AT 45% AND 40% THAN IT DID AT 55%. Duty and tax
--  are charged on value, not on alcohol, so reducing a strong cask buys
--  bottles almost for free. A 60% cask yields 70 bottles at cask strength
--  and around 105 at 40% — the difference between a gift for the board and
--  a gift for the whole company. That argument is invisible until the page
--  can show it, which is what these columns are for.
--
--  Appended to the end of the view rather than placed beside their
--  siblings: create or replace view may add columns at the end and nowhere
--  else, and a drop-and-recreate would take the grants with it.
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
  (q_50 ->> 'bottles')::int - (q_cs ->> 'bottles')::int as extra_bottles,
  (q_55 ->> 'bottles')::int                   as bottles_55,
  (q_55 ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_55,
  (q_55 ->> 'cask_total_vnd')::numeric        as total_vnd_55,
  (q_55 ->> 'bottles')::int - (q_cs ->> 'bottles')::int as extra_bottles_55,
  -- 45% and 40%, on the end (2026-09-21).
  (q_45 ->> 'bottles')::int                   as bottles_45,
  (q_45 ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_45,
  (q_45 ->> 'cask_total_vnd')::numeric        as total_vnd_45,
  (q_45 ->> 'bottles')::int - (q_cs ->> 'bottles')::int as extra_bottles_45,
  (q_40 ->> 'bottles')::int                   as bottles_40,
  (q_40 ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_40,
  (q_40 ->> 'cask_total_vnd')::numeric        as total_vnd_40,
  (q_40 ->> 'bottles')::int - (q_cs ->> 'bottles')::int as extra_bottles_40
from public.tet_casks c
cross join lateral public.tet_quote_cask_public(c.cask_ref, null)  as q_cs
cross join lateral public.tet_quote_cask_public(c.cask_ref, 50.00) as q_50
-- The same guard on every reduced strength: a cask already at or below the
-- target cannot be reduced TO it — the quote would answer
-- cannot_increase_strength and every column here would be null. Ask for the
-- cask's own strength instead, which is the honest answer: there is no 45%
-- bottling of a 43% cask, and the page says so rather than inventing one.
cross join lateral public.tet_quote_cask_public(
  c.cask_ref, case when c.abv_pct > 55.0 then 55.00 else null end) as q_55
cross join lateral public.tet_quote_cask_public(
  c.cask_ref, case when c.abv_pct > 45.0 then 45.00 else null end) as q_45
cross join lateral public.tet_quote_cask_public(
  c.cask_ref, case when c.abv_pct > 40.0 then 40.00 else null end) as q_40
where c.is_active;

grant select on public.tet_cask_board to anon, authenticated;

-- =====================================================================
--  CHECK:
--    select cask_ref, cask_abv_pct, bottles_cask_strength, bottles_55,
--           bottles_reduced, bottles_45, bottles_40
--      from public.tet_cask_board order by display_order;
--      → every column non-null, and the counts rise left to right on any
--        cask stronger than 40%.
-- =====================================================================
