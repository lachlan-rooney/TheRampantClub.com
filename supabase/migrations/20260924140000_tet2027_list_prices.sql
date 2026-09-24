-- ═══════════════════════════════════════════════════════════════════════════
--  Migration: 20260924140000_tet2027_list_prices.sql
--  A cask carries the price Duncan Taylor Vietnam quotes for it, and what it
--  costs the club — the second of which never leaves the server.
-- ───────────────────────────────────────────────────────────────────────────
--  Owner, 2026-09-24, on Duncan Taylor VN's pricing sheet:
--    · "we buy from them" — the club's cost is the DUNCAN VN SELLING PRICE
--      (their landed cost plus their 10%), not the landed cost itself;
--    · the Tết page quotes the sheet's LIST PRICE.
--
--  WHY THIS IS NOT THE MARGIN ENGINE. tet_quote_cask builds a price from our
--  cost and a margin. That was right while the club was setting its own price.
--  It is not what was decided: the number a buyer sees is Duncan Taylor's list
--  price, a figure that already carries their chain — their 10%, the
--  retailer's 30%, and a 55% channel-and-promotion budget grossed back up. A
--  margin that happened to reproduce it today would drift from their sheet the
--  moment either side changed, and nobody would notice.
--
--  So the sheet's numbers are STORED, and the page prints them.
--
--  WHAT IS SENSITIVE. cost_per_bottle_vnd is what the club pays. It stays on
--  the base table, out of tet_cask_board, exactly as ex_works_gbp does — the
--  board is what a browser may read.
--
--  The engine's columns are left alone: a cask with no list price still quotes
--  the old way, so nothing that exists breaks, and the two can be compared
--  while the changeover settles.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.tet_casks
  -- What the club pays Duncan Taylor Vietnam, per bottle, ex VAT. SENSITIVE.
  add column if not exists cost_per_bottle_vnd bigint
    check (cost_per_bottle_vnd is null or cost_per_bottle_vnd >= 0),
  -- Duncan Taylor Vietnam's list price, per bottle.
  add column if not exists list_price_vnd bigint
    check (list_price_vnd is null or list_price_vnd >= 0),
  add column if not exists list_price_inc_vat_vnd bigint
    check (list_price_inc_vat_vnd is null or list_price_inc_vat_vnd >= 0),
  -- Which sheet these came off, so a figure can always be traced back.
  add column if not exists price_source text;

comment on column public.tet_casks.cost_per_bottle_vnd is
  'SENSITIVE. What the club pays DT Vietnam per bottle, ex VAT. Never in a view a browser can read.';
comment on column public.tet_casks.list_price_vnd is
  'DT Vietnam list price per bottle, ex VAT — what the Tết page quotes.';
comment on column public.tet_casks.price_source is
  'The sheet these came from, e.g. "DT VN pricing sheet, 2026-09-24".';

-- ── The board carries the LIST price only ─────────────────────────────────
-- Appended at the end, so every existing reader keeps its columns.
-- cost_per_bottle_vnd is deliberately absent.
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
  c.colour_srm,
  c.colour_source,
  -- Duncan Taylor Vietnam's own quote (2026-09-24). Cost stays out.
  c.list_price_vnd,
  c.list_price_inc_vat_vnd,
  c.price_source
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
-- Recreate the view from 20260924100000_tet2027_measured_colour.sql, then:
-- alter table public.tet_casks
--   drop column if exists cost_per_bottle_vnd,
--   drop column if exists list_price_vnd,
--   drop column if exists list_price_inc_vat_vnd,
--   drop column if exists price_source;
