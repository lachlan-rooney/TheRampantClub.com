-- ═══════════════════════════════════════════════════════════════════════════
--  Migration: 20260924100000_tet2027_measured_colour.sql
--  A cask's colour as Huntly MEASURED it, not as we guessed it from a swatch.
-- ───────────────────────────────────────────────────────────────────────────
--  Owner, 2026-09-24, on Duncan Taylor's cask summary ("Entry Colour TWELVE /
--  Current Color FIFTEEN"): "it is the beer scale, spectrometer."
--
--  WHAT CHANGES. lib/tet/colour.ts has always been honest that its EBC/SRM was
--  DERIVED FROM THE DISPLAY SWATCH — every surface printed "≈" and said so in
--  words (EBC_IS_ESTIMATED). A number off a spectrometer is a different kind
--  of fact and deserves its own column, so that:
--    · a cask with a measured colour shows it WITHOUT the "≈";
--    · a cask without one still shows the estimate, still hedged;
--    · nobody has to remember which is which — the data says.
--
--  SRM, and EBC derived from it (EBC = SRM × 1.97), which is the same pair the
--  page already prints. The assessment's own colour word is kept beside it, so
--  "FIFTEEN" survives in the record it came from rather than only as a number.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.tet_casks
  add column if not exists colour_srm numeric(4,1)
    check (colour_srm is null or (colour_srm > 0 and colour_srm <= 80)),
  add column if not exists colour_source text;

comment on column public.tet_casks.colour_srm is
  'Measured colour on the beer scale (SRM). EBC = SRM x 1.97. Null = no measurement; the page then estimates from colour_hex and says so.';
comment on column public.tet_casks.colour_source is
  'Where the measurement came from, e.g. "Duncan Taylor assessment 17/09/2026 — current colour FIFTEEN".';

-- ── The board carries it, so the page never reads the base table ───────────
-- Appended at the END of the column list: `create or replace view` will not
-- reorder or remove columns, and every existing reader keeps its positions.
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
  (q_45 ->> 'bottles')::int                   as bottles_45,
  (q_45 ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_45,
  (q_45 ->> 'cask_total_vnd')::numeric        as total_vnd_45,
  (q_45 ->> 'bottles')::int - (q_cs ->> 'bottles')::int as extra_bottles_45,
  (q_40 ->> 'bottles')::int                   as bottles_40,
  (q_40 ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_40,
  (q_40 ->> 'cask_total_vnd')::numeric        as total_vnd_40,
  (q_40 ->> 'bottles')::int - (q_cs ->> 'bottles')::int as extra_bottles_40,
  -- Measured colour, on the end (2026-09-24).
  c.colour_srm,
  c.colour_source
from public.tet_casks c
cross join lateral public.tet_quote_cask_public(c.cask_ref, null)  as q_cs
cross join lateral public.tet_quote_cask_public(c.cask_ref, 50.00) as q_50
cross join lateral public.tet_quote_cask_public(c.cask_ref,
  case when c.abv_pct > 55.00 then 55.00 else null end)            as q_55
cross join lateral public.tet_quote_cask_public(c.cask_ref,
  case when c.abv_pct > 45.00 then 45.00 else null end)            as q_45
cross join lateral public.tet_quote_cask_public(c.cask_ref,
  case when c.abv_pct > 40.00 then 40.00 else null end)            as q_40
where c.is_active;

grant select on public.tet_cask_board to anon, authenticated;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Recreate the view from 20260921150000_tet2027_45_and_40.sql, then:
-- alter table public.tet_casks
--   drop column if exists colour_srm, drop column if exists colour_source;
