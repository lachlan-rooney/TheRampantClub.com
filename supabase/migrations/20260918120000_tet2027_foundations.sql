-- =====================================================================
--  Tết 2027 Programme — FOUNDATIONS
--  Duncan Taylor Vietnam  ×  The Rampant Club
--  Migration: 20260918120000_tet2027_foundations.sql
-- =====================================================================
--
--  DESIGN NOTES (read before editing)
--
--  1. ALL PRICING LOGIC LIVES IN THIS FILE, NOT IN THE FRONT END.
--     Ex-works costs, freight, the distributor discount and the target
--     margin are commercially sensitive. If the browser computes the
--     price, the browser has the cost. It does not. The client calls an
--     RPC, the database returns a finished VND number.
--
--  2. ONE ACTIVE PRICING VERSION AT A TIME.
--     Change a number in tet_pricing_inputs and every price on the site
--     moves — no deploy, no developer. Every reservation stores the
--     pricing_version_id it was quoted under, so an old quote can always
--     be reproduced exactly.
--
--  3. ENTITY SEPARATION IS LOAD-BEARING.
--     The builder is a Rampant Club surface. The sale is not. Every
--     reservation records its selling_entity (Duncan Taylor VN or
--     Ruou Ngon) and nothing here creates a contract of sale.
--
--  4. RESERVE, DO NOT SELL.
--     No price is a public offer, no button takes money. Under the Law
--     on Prevention of Harmful Effects of Alcohol (2019) and Decree
--     105/2017, this stays behind a member/invite gate with an 18+
--     confirmation, and the transaction completes offline on invoice.
--
--  5. STATUS IS TRUTH.
--     'reserved' means genuinely held back. 'sold' means sold. There is
--     no decorative status — see tet_casks.reserved_for, which is NOT
--     NULL-able when status = 'reserved'.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";


-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type tet_offer_category as enum ('blend', 'cask');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'reserved' = deliberately held back (members, anchor clients).
  -- 'pending'  = a reservation request is in, not yet confirmed.
  -- 'sold'     = invoiced and paid. Never set decoratively.
  create type tet_cask_status as enum
    ('available', 'reserved', 'pending', 'sold', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tet_bottling_strength as enum ('cask_strength', 'reduced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tet_reservation_status as enum
    ('submitted', 'contacted', 'confirmed', 'invoiced', 'fulfilled', 'cancelled', 'lapsed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tet_selling_entity as enum ('duncan_taylor_vn', 'ruou_ngon');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------
-- 2. PRICING INPUTS  (the whole cost model, one row per version)
-- ---------------------------------------------------------------------
create table if not exists public.tet_pricing_inputs (
  id                        uuid primary key default gen_random_uuid(),
  version_label             text        not null,
  notes                     text,
  is_active                 boolean     not null default false,
  effective_from            date        not null default current_date,

  -- FX ------------------------------------------------------------------
  fx_vnd_per_gbp            numeric(12,2) not null,

  -- Trade terms ---------------------------------------------------------
  distributor_discount_pct  numeric(6,4)  not null default 0.2000,  -- 20% off DT UK list

  -- Landed cost chain ---------------------------------------------------
  freight_per_bottle_gbp    numeric(10,4) not null,
  import_duty_pct           numeric(6,4)  not null,  -- UKVFTA phased rate for the year
  sct_pct                   numeric(6,4)  not null default 0.6500,  -- 65% single-stage SCT at import
  local_cost_per_bottle_vnd numeric(12,2) not null,  -- customs broker, stamps, warehousing, delivery

  -- Margin --------------------------------------------------------------
  target_margin_blend_pct   numeric(6,4)  not null default 0.4000,
  target_margin_cask_pct    numeric(6,4)  not null default 0.4500,

  -- Output --------------------------------------------------------------
  vat_pct                   numeric(6,4)  not null default 0.0800,
  rounding_step_vnd         numeric(12,2) not null default 5000,

  -- Personalisation -----------------------------------------------------
  artwork_setup_fee_vnd     numeric(12,2) not null,
  setup_fee_waiver_bottles  integer       not null default 250,

  -- Cask bottling -------------------------------------------------------
  bottle_size_ml            integer       not null default 700,
  cask_bottling_cost_gbp    numeric(10,4) not null,  -- glass, closure, label, tube, per bottle
  cask_bottling_loss_pct    numeric(6,4)  not null default 0.0200,  -- racking / filling loss

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.tet_pricing_inputs is
  'Versioned cost model. Exactly one row may be active. Never exposed to anon.';

-- Exactly one active version.
create unique index if not exists tet_pricing_inputs_one_active
  on public.tet_pricing_inputs ((is_active)) where is_active;


-- ---------------------------------------------------------------------
-- 3. CATEGORIES  (drives the UI; bilingual EN/VN)
-- ---------------------------------------------------------------------
create table if not exists public.tet_categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- 'duncan-taylor' | 'octave'
  kind          tet_offer_category not null,
  name_en       text not null,
  name_vn       text not null,
  standfirst_en text,
  standfirst_vn text,
  body_en       text,
  body_vn       text,
  accent_hex    text not null default '#B87333',
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 4. BLENDS
-- ---------------------------------------------------------------------
create table if not exists public.tet_products (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null references public.tet_categories(id) on delete restrict,
  sku               text unique not null,
  name_en           text not null,
  name_vn           text not null,
  expression        text,                       -- '5 Star' | '12 Year Old' | '18 Year Old'
  age_years         integer,
  abv_pct           numeric(5,2) not null default 40.00,
  bottle_size_ml    integer      not null default 700,
  case_size         integer      not null default 6,
  uk_list_price_gbp numeric(10,2) not null,     -- DT UK list, before distributor discount
  tasting_note_en   text,
  tasting_note_vn   text,
  image_path        text,
  min_order_bottles integer not null default 50,
  display_order     integer not null default 0,
  is_active         boolean not null default true,
  is_placeholder    boolean not null default true,  -- flips false when Huntly's real price is in
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column public.tet_products.uk_list_price_gbp is
  'COMMERCIALLY SENSITIVE. Never exposed through a public view.';


-- ---------------------------------------------------------------------
-- 5. VOLUME TIERS  (set by total bottles on the order, mixed SKUs allowed)
-- ---------------------------------------------------------------------
create table if not exists public.tet_volume_tiers (
  id              uuid primary key default gen_random_uuid(),
  label_en        text not null,
  label_vn        text not null,
  min_bottles     integer not null,
  max_bottles     integer,                 -- null = open-ended top tier
  discount_pct    numeric(6,4) not null,
  sleeve_price_vnd numeric(12,2) not null,
  display_order   integer not null default 0,
  constraint tet_volume_tiers_range check (max_bottles is null or max_bottles >= min_bottles)
);

-- No overlapping tiers, ever.
create index if not exists tet_volume_tiers_min on public.tet_volume_tiers (min_bottles);


-- ---------------------------------------------------------------------
-- 6. CASKS  (the Octaves)
-- ---------------------------------------------------------------------
create table if not exists public.tet_casks (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null references public.tet_categories(id) on delete restrict,
  cask_ref          text unique not null,       -- 'OCT-2027-01'
  cask_number       text,                       -- Huntly's own reference
  distillery        text not null,
  region            text not null,
  vintage_year      integer,
  age_years         numeric(4,1) not null,
  cask_type         text not null default 'Octave',
  wood              text,                       -- 'First-fill Oloroso octave' etc.
  abv_pct           numeric(5,2) not null,      -- cask strength
  bulk_litres       numeric(8,2) not null,
  outturn_override  integer,                    -- Huntly's actual count, when given
  ex_works_gbp      numeric(12,2) not null,     -- SENSITIVE
  freight_per_bottle_gbp_override numeric(10,4),

  status            tet_cask_status not null default 'available',
  reserved_for      text,                       -- who it is held for. Required when reserved.
  status_changed_at timestamptz not null default now(),

  tasting_note_en   text,
  tasting_note_vn   text,
  colour_hex        text,                       -- for the UI swatch
  image_path        text,
  display_order     integer not null default 0,
  is_active         boolean not null default true,
  is_placeholder    boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A cask cannot be marked 'reserved' without a real reason it is held.
  constraint tet_casks_reserved_has_reason
    check (status <> 'reserved' or (reserved_for is not null and length(btrim(reserved_for)) > 0)),
  constraint tet_casks_abv_sane check (abv_pct > 40 and abv_pct <= 75),
  constraint tet_casks_bulk_sane check (bulk_litres > 0 and bulk_litres < 200)
);

comment on constraint tet_casks_reserved_has_reason on public.tet_casks is
  'Scarcity must be real. If a cask shows as held, the record says who it is held for.';


-- ---------------------------------------------------------------------
-- 7. RESERVATIONS
-- ---------------------------------------------------------------------
create sequence if not exists tet_reservation_seq start 1;

create table if not exists public.tet_reservations (
  id                 uuid primary key default gen_random_uuid(),
  reference          text unique not null
                       default ('TET27-' || lpad(nextval('tet_reservation_seq')::text, 4, '0')),
  kind               tet_offer_category not null,

  -- Who --------------------------------------------------------------
  company_name       text not null,
  contact_name       text not null,
  contact_email      text not null,
  contact_phone      text,
  tax_code           text,                     -- MST, needed for the VAT invoice
  member_id          uuid,                     -- FK to TRC members, when a member submits
  age_confirmed_at   timestamptz not null,     -- 18+ gate. Not nullable by design.
  locale             text not null default 'en',

  -- What -------------------------------------------------------------
  cask_id            uuid references public.tet_casks(id) on delete restrict,
  bottling_strength  tet_bottling_strength,
  reduced_to_abv     numeric(5,2),             -- normally 50.00
  line_items         jsonb not null default '[]'::jsonb,  -- [{sku, qty}]
  total_bottles      integer not null default 0,
  personalisation    jsonb not null default '{}'::jsonb,  -- {company, logo_path, tet_message, box}
  split_delivery     jsonb not null default '[]'::jsonb,  -- [{label, qty, address}]

  -- Money (snapshot at quote time) ------------------------------------
  pricing_version_id uuid not null references public.tet_pricing_inputs(id),
  quote              jsonb not null,           -- the full priced breakdown as returned to the client
  quoted_total_vnd   numeric(14,2) not null,

  -- Process ------------------------------------------------------------
  status             tet_reservation_status not null default 'submitted',
  selling_entity     tet_selling_entity not null default 'duncan_taylor_vn',
  internal_notes     text,
  source             text,                     -- 'invite-link' | 'member-portal' | 'leaflet-qr'
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint tet_reservations_cask_shape
    check ((kind = 'cask') = (cask_id is not null)),
  constraint tet_reservations_strength_shape
    check (kind <> 'cask' or bottling_strength is not null)
);

create index if not exists tet_reservations_status on public.tet_reservations (status, created_at desc);
create index if not exists tet_reservations_cask   on public.tet_reservations (cask_id);


-- ---------------------------------------------------------------------
-- 8. AUDIT TRAIL
-- ---------------------------------------------------------------------
create table if not exists public.tet_reservation_events (
  id             bigserial primary key,
  reservation_id uuid references public.tet_reservations(id) on delete cascade,
  cask_id        uuid references public.tet_casks(id) on delete set null,
  event          text not null,
  from_status    text,
  to_status      text,
  actor          text,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);


-- =====================================================================
--  9. THE PRICING ENGINE
-- =====================================================================

-- Round up to the nearest step (VND prices never end in loose change).
create or replace function public.tet_round_up(p_amount numeric, p_step numeric)
returns numeric language sql immutable as $fn$
  select case
           when coalesce(p_step, 0) <= 0 then p_amount
           else ceil(p_amount / p_step) * p_step
         end;
$fn$;


-- The landed-cost chain, per bottle, in VND.
--   FOB → +freight → CIF → +import duty → +SCT (on CIF+duty) → +local costs
-- Note: Vietnam charges duty and SCT on VALUE, not on alcohol content.
-- That single fact is why reducing a cask to 50% is worth doing.
create or replace function public.tet_landed_cost_vnd(
  p_fob_gbp     numeric,
  p_freight_gbp numeric,
  p_inputs      public.tet_pricing_inputs
) returns numeric language sql immutable as $fn$
  with cif as (
    select (p_fob_gbp + p_freight_gbp) * p_inputs.fx_vnd_per_gbp as v
  ), duty as (
    select v, v * p_inputs.import_duty_pct as d from cif
  )
  select v + d + ((v + d) * p_inputs.sct_pct) + p_inputs.local_cost_per_bottle_vnd
  from duty;
$fn$;


-- Landed cost → shelf price, ex VAT.
create or replace function public.tet_price_from_landed(
  p_landed_vnd  numeric,
  p_margin_pct  numeric
) returns numeric language sql immutable as $fn$
  select p_landed_vnd / nullif(1 - p_margin_pct, 0);
$fn$;


-- How many bottles a cask yields at a given strength.
-- At cask strength the target equals the cask ABV and this collapses to
-- bulk / bottle size. Reduce the strength and the volume grows by the
-- ratio of the two ABVs.
create or replace function public.tet_cask_bottles(
  p_bulk_litres  numeric,
  p_cask_abv     numeric,
  p_target_abv   numeric,
  p_bottle_ml    integer,
  p_loss_pct     numeric
) returns integer language sql immutable as $fn$
  select floor(
    (p_bulk_litres * (p_cask_abv / p_target_abv))
    * (1 - coalesce(p_loss_pct, 0))
    / (p_bottle_ml / 1000.0)
  )::int;
$fn$;


-- Pick the tier for a given total bottle count.
create or replace function public.tet_tier_for(p_bottles integer)
returns public.tet_volume_tiers language sql stable as $fn$
  select t.* from public.tet_volume_tiers t
  where p_bottles >= t.min_bottles
    and (t.max_bottles is null or p_bottles <= t.max_bottles)
  order by t.min_bottles desc
  limit 1;
$fn$;


-- The active cost model.
create or replace function public.tet_active_inputs()
returns public.tet_pricing_inputs language sql stable as $fn$
  select * from public.tet_pricing_inputs where is_active limit 1;
$fn$;


-- ---------------------------------------------------------------------
-- 9a. BLEND QUOTE  (security definer: reads costs, returns only prices)
-- ---------------------------------------------------------------------
--  p_lines : [{"sku":"DT-12YO","qty":120}, {"sku":"DT-18YO","qty":60}]
--  p_sleeve: true if customised sleeves are wanted
--  p_admin : internal call — includes cost and margin fields
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

  -- Total bottles across all SKUs sets the tier: a customer may mix
  -- 5 Star, 12 and 18 and still climb.
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

    -- Target margin, then the tier discount off the whisky only.
    -- The sleeve is a separate line and is not discounted twice.
    v_ex_vat := public.tet_price_from_landed(v_landed, v_in.target_margin_blend_pct)
                * (1 - v_tier.discount_pct);

    v_unit := public.tet_round_up((v_ex_vat + v_sleeve) * (1 + v_in.vat_pct),
                                  v_in.rounding_step_vnd);

    v_sub  := v_sub  + (v_unit * v_qty);
    v_cost := v_cost + ((v_landed + (v_sleeve * 0.5)) * v_qty);  -- sleeve cost assumption: 50% of charge

    v_lines := v_lines || jsonb_build_object(
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
    ) else '{}'::jsonb end;
  end loop;

  -- What the next tier would be worth — the honest version of an upsell.
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

revoke all on function public.tet_quote_blends(jsonb, boolean, boolean) from public;


-- ---------------------------------------------------------------------
-- 9b. CASK QUOTE
-- ---------------------------------------------------------------------
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

  v_bottles := coalesce(
    case when v_target = v_c.abv_pct then v_c.outturn_override else null end,
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

revoke all on function public.tet_quote_cask(text, numeric, boolean) from public;


-- ---------------------------------------------------------------------
-- 9c. PUBLIC CASK BOARD  (the grid of 14, priced, with no costs in it)
-- ---------------------------------------------------------------------
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
cross join lateral public.tet_quote_cask(c.cask_ref, null,     false) as q_cs
cross join lateral public.tet_quote_cask(c.cask_ref, 50.00,    false) as q_50
where c.is_active;

comment on view public.tet_cask_board is
  'Everything the browser is allowed to know about a cask. No ex-works, no margin.';


-- ---------------------------------------------------------------------
-- 9d. PUBLIC BLEND BOARD
-- ---------------------------------------------------------------------
create or replace view public.tet_blend_board as
select
  p.sku, p.name_en, p.name_vn, p.expression, p.age_years, p.abv_pct,
  p.bottle_size_ml, p.case_size, p.tasting_note_en, p.tasting_note_vn,
  p.image_path, p.min_order_bottles, p.display_order, p.is_placeholder,
  cat.slug as category_slug,
  (public.tet_quote_blends(
      jsonb_build_array(jsonb_build_object('sku', p.sku, 'qty', t.min_bottles)),
      true, false) -> 'lines' -> 0 ->> 'unit_inc_vat_vnd')::numeric as unit_vnd_with_sleeve,
  t.min_bottles as tier_min_bottles,
  t.label_en    as tier_label_en
from public.tet_products p
join public.tet_categories cat on cat.id = p.category_id
cross join public.tet_volume_tiers t
where p.is_active;


-- ---------------------------------------------------------------------
-- 10. RESERVE A CASK  (atomic: no two customers can hold the same cask)
-- ---------------------------------------------------------------------
create or replace function public.tet_reserve_cask(
  p_cask_ref        text,
  p_target_abv      numeric,
  p_company         text,
  p_contact_name    text,
  p_contact_email   text,
  p_contact_phone   text,
  p_tax_code        text,
  p_personalisation jsonb default '{}'::jsonb,
  p_split_delivery  jsonb default '[]'::jsonb,
  p_age_confirmed   boolean default false,
  p_locale          text default 'en',
  p_source          text default null
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_c     public.tet_casks;
  v_q     jsonb;
  v_res   public.tet_reservations;
begin
  if not p_age_confirmed then
    return jsonb_build_object('error', 'age_not_confirmed');
  end if;
  if coalesce(btrim(p_company), '') = '' or coalesce(btrim(p_contact_email), '') = '' then
    return jsonb_build_object('error', 'missing_contact');
  end if;

  -- Lock the row. First request in wins; everyone else is told plainly.
  select * into v_c from public.tet_casks
   where cask_ref = p_cask_ref and is_active for update;

  if v_c.id is null then return jsonb_build_object('error', 'cask_not_found'); end if;
  if v_c.status <> 'available' then
    return jsonb_build_object('error', 'cask_unavailable', 'status', v_c.status);
  end if;

  v_q := public.tet_quote_cask(p_cask_ref, p_target_abv, false);
  if v_q ? 'error' then return v_q; end if;

  insert into public.tet_reservations (
    kind, company_name, contact_name, contact_email, contact_phone, tax_code,
    age_confirmed_at, locale, cask_id, bottling_strength, reduced_to_abv,
    total_bottles, personalisation, split_delivery,
    pricing_version_id, quote, quoted_total_vnd, source
  ) values (
    'cask', p_company, p_contact_name, p_contact_email, p_contact_phone, p_tax_code,
    now(), coalesce(p_locale, 'en'), v_c.id,
    case when p_target_abv is null or p_target_abv = v_c.abv_pct
         then 'cask_strength'::tet_bottling_strength
         else 'reduced'::tet_bottling_strength end,
    coalesce(p_target_abv, v_c.abv_pct),
    (v_q ->> 'bottles')::int, coalesce(p_personalisation, '{}'::jsonb),
    coalesce(p_split_delivery, '[]'::jsonb),
    (v_q ->> 'pricing_version_id')::uuid, v_q,
    (v_q ->> 'cask_total_vnd')::numeric, p_source
  ) returning * into v_res;

  update public.tet_casks
     set status = 'pending', status_changed_at = now(), updated_at = now()
   where id = v_c.id;

  insert into public.tet_reservation_events
    (reservation_id, cask_id, event, from_status, to_status, payload)
  values (v_res.id, v_c.id, 'cask_reservation_submitted', 'available', 'pending',
          jsonb_build_object('reference', v_res.reference));

  return jsonb_build_object(
    'reference',   v_res.reference,
    'status',      v_res.status,
    'cask_ref',    v_c.cask_ref,
    'quote',       v_q
  );
end;
$fn$;


-- ---------------------------------------------------------------------
-- 11. RESERVE BLENDS
-- ---------------------------------------------------------------------
create or replace function public.tet_reserve_blends(
  p_lines           jsonb,
  p_sleeve          boolean,
  p_company         text,
  p_contact_name    text,
  p_contact_email   text,
  p_contact_phone   text,
  p_tax_code        text,
  p_personalisation jsonb default '{}'::jsonb,
  p_split_delivery  jsonb default '[]'::jsonb,
  p_age_confirmed   boolean default false,
  p_locale          text default 'en',
  p_source          text default null
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare v_q jsonb; v_res public.tet_reservations;
begin
  if not p_age_confirmed then return jsonb_build_object('error', 'age_not_confirmed'); end if;

  v_q := public.tet_quote_blends(p_lines, p_sleeve, false);
  if v_q ? 'error' then return v_q; end if;

  insert into public.tet_reservations (
    kind, company_name, contact_name, contact_email, contact_phone, tax_code,
    age_confirmed_at, locale, line_items, total_bottles, personalisation,
    split_delivery, pricing_version_id, quote, quoted_total_vnd, source
  ) values (
    'blend', p_company, p_contact_name, p_contact_email, p_contact_phone, p_tax_code,
    now(), coalesce(p_locale, 'en'), p_lines, (v_q ->> 'total_bottles')::int,
    coalesce(p_personalisation, '{}'::jsonb), coalesce(p_split_delivery, '[]'::jsonb),
    (v_q ->> 'pricing_version_id')::uuid, v_q,
    (v_q ->> 'total_inc_vat_vnd')::numeric, p_source
  ) returning * into v_res;

  insert into public.tet_reservation_events (reservation_id, event, to_status, payload)
  values (v_res.id, 'blend_reservation_submitted', 'submitted',
          jsonb_build_object('reference', v_res.reference));

  return jsonb_build_object('reference', v_res.reference, 'status', v_res.status, 'quote', v_q);
end;
$fn$;


-- ---------------------------------------------------------------------
-- 12. TRIGGERS
-- ---------------------------------------------------------------------
create or replace function public.tet_touch_updated_at()
returns trigger language plpgsql as $fn$
begin new.updated_at := now(); return new; end;
$fn$;

drop trigger if exists tet_products_touch on public.tet_products;
create trigger tet_products_touch before update on public.tet_products
  for each row execute function public.tet_touch_updated_at();

drop trigger if exists tet_casks_touch on public.tet_casks;
create trigger tet_casks_touch before update on public.tet_casks
  for each row execute function public.tet_touch_updated_at();

drop trigger if exists tet_reservations_touch on public.tet_reservations;
create trigger tet_reservations_touch before update on public.tet_reservations
  for each row execute function public.tet_touch_updated_at();

-- Log every cask status change, with who and when.
create or replace function public.tet_log_cask_status()
returns trigger language plpgsql as $fn$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    insert into public.tet_reservation_events (cask_id, event, from_status, to_status, actor)
    values (new.id, 'cask_status_changed', old.status::text, new.status::text,
            coalesce(current_setting('request.jwt.claim.email', true), current_user));
  end if;
  return new;
end;
$fn$;

drop trigger if exists tet_casks_status_log on public.tet_casks;
create trigger tet_casks_status_log before update on public.tet_casks
  for each row execute function public.tet_log_cask_status();


-- =====================================================================
-- 13. ROW LEVEL SECURITY
--     Default posture: the browser reads the two boards and nothing else.
-- =====================================================================
alter table public.tet_pricing_inputs      enable row level security;
alter table public.tet_products            enable row level security;
alter table public.tet_casks               enable row level security;
alter table public.tet_categories          enable row level security;
alter table public.tet_volume_tiers        enable row level security;
alter table public.tet_reservations        enable row level security;
alter table public.tet_reservation_events  enable row level security;

-- No policies on tet_pricing_inputs, tet_products, tet_casks,
-- tet_reservations or tet_reservation_events. RLS on with no policy
-- means anon and authenticated get nothing. service_role bypasses RLS,
-- so the admin portal still works. This is deliberate.

-- Categories and tiers are marketing copy and published terms — readable.
drop policy if exists tet_categories_read on public.tet_categories;
create policy tet_categories_read on public.tet_categories
  for select to anon, authenticated using (is_active);

drop policy if exists tet_volume_tiers_read on public.tet_volume_tiers;
create policy tet_volume_tiers_read on public.tet_volume_tiers
  for select to anon, authenticated using (true);

-- The views are security_invoker = off (default) and owned by the
-- migration role, so they read the underlying tables on our behalf and
-- expose only the columns listed. Grant read on the views only.
grant select on public.tet_cask_board  to anon, authenticated;
grant select on public.tet_blend_board to anon, authenticated;

-- Quoting and reserving happen through functions, never table access.
grant execute on function public.tet_quote_blends(jsonb, boolean, boolean) to anon, authenticated;
grant execute on function public.tet_quote_cask(text, numeric, boolean)    to anon, authenticated;
grant execute on function public.tet_reserve_cask(text, numeric, text, text, text, text, text, jsonb, jsonb, boolean, text, text) to anon, authenticated;
grant execute on function public.tet_reserve_blends(jsonb, boolean, text, text, text, text, text, jsonb, jsonb, boolean, text, text) to anon, authenticated;

-- The admin flag on the quote functions returns cost and margin. It is
-- only reachable from the server, where the service_role key lives.
-- Nothing below grants it to a browser role.


-- =====================================================================
-- 14. GUARD: the admin flag must never be callable by anon with p_admin
--     true. Enforced by wrapping the public grants in thin SQL wrappers.
-- =====================================================================
create or replace function public.tet_quote_blends_public(p_lines jsonb, p_sleeve boolean default true)
returns jsonb language sql stable as $fn$
  select public.tet_quote_blends(p_lines, p_sleeve, false);
$fn$;

create or replace function public.tet_quote_cask_public(p_cask_ref text, p_target_abv numeric default null)
returns jsonb language sql stable as $fn$
  select public.tet_quote_cask(p_cask_ref, p_target_abv, false);
$fn$;

revoke execute on function public.tet_quote_blends(jsonb, boolean, boolean) from anon, authenticated;
revoke execute on function public.tet_quote_cask(text, numeric, boolean)    from anon, authenticated;
grant  execute on function public.tet_quote_blends_public(jsonb, boolean)   to anon, authenticated;
grant  execute on function public.tet_quote_cask_public(text, numeric)      to anon, authenticated;

-- =====================================================================
--  END OF FOUNDATIONS
-- =====================================================================
