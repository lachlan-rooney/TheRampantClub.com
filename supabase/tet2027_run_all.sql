-- =====================================================================
--  Tết 2027 Programme — EVERYTHING, IN ORDER, FOR ONE PASTE
--
--  GENERATED FILE. Do not edit. It is the source files joined in the
--  order they must run:
--
--    1. supabase/migrations/20260918120000_tet2027_foundations.sql
--    2. supabase/migrations/20260918123000_tet2027_calendar.sql
--    3. supabase/migrations/20260918130000_tet2027_fixes.sql
--    4. supabase/migrations/20260918140000_tet2027_board_grants.sql
--    5. supabase/seed/tet2027_seed.sql
--
--  Edit those; regenerate this. It exists only because the Supabase SQL
--  editor is one box and this is a one-time run.
--
--  Target: the Rampant Club's own Supabase project (owner's decision,
--  18 September 2026) — the builder is a club page served by this app,
--  and cost stays behind service-role and RLS as the club's other
--  sensitive data does.
--
--  ALREADY RUN ONCE? Only file 4 is new. Run that alone; everything
--  here is safe to re-run, but the seed will simply do nothing the
--  second time (every insert is on conflict do nothing).
-- =====================================================================



-- ===== FILE: supabase/migrations/20260918120000_tet2027_foundations.sql =====

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


-- ===== FILE: supabase/migrations/20260918123000_tet2027_calendar.sql =====

-- =====================================================================
--  Tết 2027 Programme — CALENDAR, CUT-OFFS AND COUNTDOWN
--  Migration: 20260918123000_tet2027_calendar.sql
-- =====================================================================
--
--  Why this is a table and not a constant in the front end:
--
--  The last order date is not a marketing number. It is arithmetic:
--  Tết, minus local delivery, minus customs clearance, minus transit,
--  minus Huntly's bottling lead time, minus a buffer. Single malt must
--  be bottled in Scotland, so the cask cut-off is materially earlier
--  than the blend cut-off and neither is negotiable.
--
--  Put the lead times in, and the cut-off computes itself. Move one
--  lead time and every countdown on the site moves with it — including
--  the one on the offer card and the one in the leaflet QR landing page.
--
--  Tết Đinh Mùi falls on 6 February 2027.
-- =====================================================================

do $$ begin
  create type tet_milestone_kind as enum
    ('order_cutoff', 'artwork_cutoff', 'bottling', 'shipping', 'clearance', 'delivery', 'festival');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------
-- 1. PROGRAMME SETTINGS  (the lead times the cut-offs are derived from)
-- ---------------------------------------------------------------------
create table if not exists public.tet_programme (
  id                        uuid primary key default gen_random_uuid(),
  is_active                 boolean not null default false,
  season_label              text not null default 'Tết Đinh Mùi 2027',
  timezone                  text not null default 'Asia/Ho_Chi_Minh',

  -- The fixed point everything counts back from.
  festival_date             date not null default date '2027-02-06',

  -- Customers want gifts in hand before the office closes, not on the day.
  delivery_before_festival_days integer not null default 14,

  -- Lead times, in weeks. Placeholders until Huntly and the freight
  -- forwarder confirm. Every one of these moves the cut-off.
  bottling_lead_weeks_cask  numeric(5,2) not null default 6.0,
  bottling_lead_weeks_blend numeric(5,2) not null default 2.0,  -- stock bottling, sleeve only
  sleeve_print_lead_weeks   numeric(5,2) not null default 3.0,
  artwork_approval_weeks    numeric(5,2) not null default 1.0,
  transit_weeks             numeric(5,2) not null default 6.0,  -- sea freight UK → Cat Lai
  clearance_weeks           numeric(5,2) not null default 2.0,  -- customs, SCT, stamps
  local_delivery_weeks      numeric(5,2) not null default 1.0,
  buffer_weeks              numeric(5,2) not null default 2.0,

  is_placeholder            boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create unique index if not exists tet_programme_one_active
  on public.tet_programme ((is_active)) where is_active;

create or replace function public.tet_active_programme()
returns public.tet_programme language sql stable as $fn$
  select * from public.tet_programme where is_active limit 1;
$fn$;


-- ---------------------------------------------------------------------
-- 2. DERIVED CUT-OFFS
-- ---------------------------------------------------------------------
--  Counting back from the date gifts must be in the customer's hands:
--
--    in-hand date  = festival − delivery_before_festival_days
--    cask cut-off  = in-hand − (local delivery + clearance + transit
--                               + cask bottling + buffer)
--    blend cut-off = in-hand − (local delivery + clearance + transit
--                               + blend bottling + buffer)
--    sleeve artwork cut-off = blend cut-off − (sleeve print + approval)
--
--  Note the artwork cut-off can land BEFORE the order cut-off. That is
--  not a bug — it means artwork has to be agreed at the point of order,
--  which is exactly what the Quote Builder should tell the salesperson.
create or replace function public.tet_cutoffs()
returns table (
  kind               text,
  applies_to         text,
  cutoff_date        date,
  days_remaining     integer,
  is_past            boolean
) language sql stable as $fn$
  with p as (select * from public.tet_active_programme()),
  base as (
    select
      p.*,
      (p.festival_date - p.delivery_before_festival_days)::date as in_hand_date,
      (p.local_delivery_weeks + p.clearance_weeks + p.transit_weeks + p.buffer_weeks) as common_weeks,
      (current_date at time zone 'UTC')::date as today
    from p
  ),
  d as (
    select
      'order_cutoff'::text as kind, 'cask'::text as applies_to,
      (in_hand_date - ((common_weeks + bottling_lead_weeks_cask) * 7)::int)::date as cutoff_date
    from base
    union all
    select 'order_cutoff', 'blend',
      (in_hand_date - ((common_weeks + bottling_lead_weeks_blend) * 7)::int)::date
    from base
    union all
    select 'artwork_cutoff', 'blend',
      (in_hand_date - ((common_weeks + bottling_lead_weeks_blend
                        + sleeve_print_lead_weeks + artwork_approval_weeks) * 7)::int)::date
    from base
    union all
    select 'delivery', 'all', in_hand_date from base
    union all
    select 'festival', 'all', festival_date from base
  )
  select d.kind, d.applies_to, d.cutoff_date,
         (d.cutoff_date - current_date)::int as days_remaining,
         (d.cutoff_date < current_date)      as is_past
  from d
  order by d.cutoff_date;
$fn$;


-- ---------------------------------------------------------------------
-- 3. MILESTONES  (anything the derived maths does not cover — a
--    distillery shutdown, a shipping line's Tết blank sailing, a
--    printer's holiday. Overrides the derived date when present.)
-- ---------------------------------------------------------------------
create table if not exists public.tet_milestones (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  kind          tet_milestone_kind not null,
  applies_to    tet_offer_category,          -- null = both categories
  name_en       text not null,
  name_vn       text not null,
  note_en       text,
  note_vn       text,
  due_at        timestamptz not null,
  is_hard       boolean not null default true,
  overrides_derived boolean not null default false,
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 4. THE COUNTDOWN  (one call, everything the UI needs)
-- ---------------------------------------------------------------------
create or replace function public.tet_countdown()
returns jsonb language plpgsql stable as $fn$
declare
  v_p     public.tet_programme;
  v_cask  date;
  v_blend date;
  v_art   date;
  v_hand  date;
  v_over_cask  timestamptz;
  v_over_blend timestamptz;
  v_next  jsonb;
begin
  v_p := public.tet_active_programme();
  if v_p.id is null then return jsonb_build_object('error', 'no_active_programme'); end if;

  select cutoff_date into v_cask  from public.tet_cutoffs()
    where kind = 'order_cutoff'  and applies_to = 'cask';
  select cutoff_date into v_blend from public.tet_cutoffs()
    where kind = 'order_cutoff'  and applies_to = 'blend';
  select cutoff_date into v_art   from public.tet_cutoffs()
    where kind = 'artwork_cutoff' and applies_to = 'blend';
  select cutoff_date into v_hand  from public.tet_cutoffs()
    where kind = 'delivery';

  -- A manual milestone marked as overriding wins over the derived date.
  select due_at into v_over_cask from public.tet_milestones
   where is_active and overrides_derived and kind = 'order_cutoff'
     and applies_to = 'cask' order by due_at limit 1;
  select due_at into v_over_blend from public.tet_milestones
   where is_active and overrides_derived and kind = 'order_cutoff'
     and applies_to = 'blend' order by due_at limit 1;

  v_cask  := coalesce(v_over_cask::date,  v_cask);
  v_blend := coalesce(v_over_blend::date, v_blend);

  -- The single number the hero counts down to: the next hard gate
  -- that has not already passed.
  select to_jsonb(x) into v_next from (
    select kind, applies_to, cutoff_date, days_remaining
    from public.tet_cutoffs()
    where not is_past and kind in ('order_cutoff', 'artwork_cutoff')
    order by cutoff_date limit 1
  ) x;

  return jsonb_build_object(
    'season',            v_p.season_label,
    'timezone',          v_p.timezone,
    'now',               now(),
    'festival_date',     v_p.festival_date,
    'days_to_festival',  (v_p.festival_date - current_date),
    'in_hand_date',      v_hand,
    'cutoffs', jsonb_build_object(
      'cask', jsonb_build_object(
        'date',           v_cask,
        'days_remaining', (v_cask - current_date),
        'is_past',        (v_cask < current_date),
        'overridden',     (v_over_cask is not null)),
      'blend', jsonb_build_object(
        'date',           v_blend,
        'days_remaining', (v_blend - current_date),
        'is_past',        (v_blend < current_date),
        'overridden',     (v_over_blend is not null)),
      'artwork', jsonb_build_object(
        'date',           v_art,
        'days_remaining', (v_art - current_date),
        'is_past',        (v_art < current_date))
    ),
    'next_gate',      v_next,
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', slug, 'kind', kind, 'applies_to', applies_to,
        'name_en', name_en, 'name_vn', name_vn,
        'note_en', note_en, 'note_vn', note_vn,
        'due_at', due_at, 'is_hard', is_hard,
        'days_remaining', (due_at::date - current_date)
      ) order by due_at)
      from public.tet_milestones where is_active), '[]'::jsonb),
    'is_placeholder', v_p.is_placeholder
  );
end;
$fn$;


-- ---------------------------------------------------------------------
-- 5. CAN THIS STILL BE ORDERED?  (the builder asks before it takes
--    a reservation, so nobody promises a cask that cannot be bottled
--    in time)
-- ---------------------------------------------------------------------
create or replace function public.tet_ordering_open(p_kind tet_offer_category)
returns boolean language sql stable as $fn$
  select coalesce(
    (public.tet_countdown() -> 'cutoffs' -> p_kind::text ->> 'is_past')::boolean = false,
    false);
$fn$;


-- Wire the gate into both reservation paths.
create or replace function public.tet_assert_ordering_open(p_kind tet_offer_category)
returns void language plpgsql stable as $fn$
begin
  if not public.tet_ordering_open(p_kind) then
    raise exception 'ordering_closed_for_%', p_kind
      using hint = 'The last order date for this category has passed.';
  end if;
end;
$fn$;


alter table public.tet_programme  enable row level security;
alter table public.tet_milestones enable row level security;

drop policy if exists tet_programme_read on public.tet_programme;
create policy tet_programme_read on public.tet_programme
  for select to anon, authenticated using (is_active);

drop policy if exists tet_milestones_read on public.tet_milestones;
create policy tet_milestones_read on public.tet_milestones
  for select to anon, authenticated using (is_active);

grant execute on function public.tet_countdown()                        to anon, authenticated;
grant execute on function public.tet_cutoffs()                          to anon, authenticated;
grant execute on function public.tet_ordering_open(tet_offer_category)  to anon, authenticated;

drop trigger if exists tet_programme_touch on public.tet_programme;
create trigger tet_programme_touch before update on public.tet_programme
  for each row execute function public.tet_touch_updated_at();

-- =====================================================================
--  END OF CALENDAR
-- =====================================================================


-- ===== FILE: supabase/migrations/20260918130000_tet2027_fixes.sql =====

-- =====================================================================
--  Tết 2027 Programme — THREE CORRECTIONS
--  Migration: 20260918130000_tet2027_fixes.sql
--  Run AFTER the foundations and calendar migrations, before the seed.
-- =====================================================================
--
--  Written here rather than edited into the two files they correct, so
--  the originals stay exactly as handed over and every change is legible.
--
--  Reproduce the second fault before applying this, in the SQL editor:
--
--    set local role anon;
--    select public.tet_quote_blends_public('[{"sku":"DT-12YO","qty":50}]'::jsonb, true);
--    reset role;
--
--  Expect: permission denied for function tet_quote_blends.
--  After this migration the same three lines return a price.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE CLOCK IS SAIGON'S, NOT THE SERVER'S
-- ---------------------------------------------------------------------
-- tet_cutoffs() and tet_countdown() counted from current_date, which on
-- Supabase is UTC. Between midnight and 07:00 in Vietnam that is still
-- yesterday, so every countdown read a day high all night — and the cut-
-- offs are end-of-day in Ho Chi Minh City, which is the whole point.
create or replace function public.tet_today()
returns date language sql stable as $fn$
  select (now() at time zone coalesce(
    (select timezone from public.tet_programme where is_active limit 1),
    'Asia/Ho_Chi_Minh'))::date;
$fn$;

grant execute on function public.tet_today() to anon, authenticated;


create or replace function public.tet_cutoffs()
returns table (
  kind               text,
  applies_to         text,
  cutoff_date        date,
  days_remaining     integer,
  is_past            boolean
) language sql stable as $fn$
  with p as (select * from public.tet_active_programme()),
  base as (
    select
      p.*,
      (p.festival_date - p.delivery_before_festival_days)::date as in_hand_date,
      (p.local_delivery_weeks + p.clearance_weeks + p.transit_weeks + p.buffer_weeks) as common_weeks
    from p
  ),
  d as (
    select
      'order_cutoff'::text as kind, 'cask'::text as applies_to,
      (in_hand_date - ((common_weeks + bottling_lead_weeks_cask) * 7)::int)::date as cutoff_date
    from base
    union all
    select 'order_cutoff', 'blend',
      (in_hand_date - ((common_weeks + bottling_lead_weeks_blend) * 7)::int)::date
    from base
    union all
    select 'artwork_cutoff', 'blend',
      (in_hand_date - ((common_weeks + bottling_lead_weeks_blend
                        + sleeve_print_lead_weeks + artwork_approval_weeks) * 7)::int)::date
    from base
    union all
    select 'delivery', 'all', in_hand_date from base
    union all
    select 'festival', 'all', festival_date from base
  )
  select d.kind, d.applies_to, d.cutoff_date,
         (d.cutoff_date - public.tet_today())::int as days_remaining,
         (d.cutoff_date < public.tet_today())      as is_past
  from d
  order by d.cutoff_date;
$fn$;


-- Same body as the original, with every current_date replaced by the
-- club's own date. Output shape is unchanged.
create or replace function public.tet_countdown()
returns jsonb language plpgsql stable as $fn$
declare
  v_p     public.tet_programme;
  v_today date := public.tet_today();
  v_cask  date;
  v_blend date;
  v_art   date;
  v_hand  date;
  v_over_cask  timestamptz;
  v_over_blend timestamptz;
  v_next  jsonb;
begin
  v_p := public.tet_active_programme();
  if v_p.id is null then return jsonb_build_object('error', 'no_active_programme'); end if;

  select cutoff_date into v_cask  from public.tet_cutoffs()
    where kind = 'order_cutoff'  and applies_to = 'cask';
  select cutoff_date into v_blend from public.tet_cutoffs()
    where kind = 'order_cutoff'  and applies_to = 'blend';
  select cutoff_date into v_art   from public.tet_cutoffs()
    where kind = 'artwork_cutoff' and applies_to = 'blend';
  select cutoff_date into v_hand  from public.tet_cutoffs()
    where kind = 'delivery';

  select due_at into v_over_cask from public.tet_milestones
   where is_active and overrides_derived and kind = 'order_cutoff'
     and applies_to = 'cask' order by due_at limit 1;
  select due_at into v_over_blend from public.tet_milestones
   where is_active and overrides_derived and kind = 'order_cutoff'
     and applies_to = 'blend' order by due_at limit 1;

  v_cask  := coalesce(v_over_cask::date,  v_cask);
  v_blend := coalesce(v_over_blend::date, v_blend);

  select to_jsonb(x) into v_next from (
    select kind, applies_to, cutoff_date, days_remaining
    from public.tet_cutoffs()
    where not is_past and kind in ('order_cutoff', 'artwork_cutoff')
    order by cutoff_date limit 1
  ) x;

  return jsonb_build_object(
    'season',            v_p.season_label,
    'timezone',          v_p.timezone,
    'now',               now(),
    'festival_date',     v_p.festival_date,
    'days_to_festival',  (v_p.festival_date - v_today),
    'in_hand_date',      v_hand,
    'cutoffs', jsonb_build_object(
      'cask', jsonb_build_object(
        'date',           v_cask,
        'days_remaining', (v_cask - v_today),
        'is_past',        (v_cask < v_today),
        'overridden',     (v_over_cask is not null)),
      'blend', jsonb_build_object(
        'date',           v_blend,
        'days_remaining', (v_blend - v_today),
        'is_past',        (v_blend < v_today),
        'overridden',     (v_over_blend is not null)),
      'artwork', jsonb_build_object(
        'date',           v_art,
        'days_remaining', (v_art - v_today),
        'is_past',        (v_art < v_today))
    ),
    'next_gate',      v_next,
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', slug, 'kind', kind, 'applies_to', applies_to,
        'name_en', name_en, 'name_vn', name_vn,
        'note_en', note_en, 'note_vn', note_vn,
        'due_at', due_at, 'is_hard', is_hard,
        'days_remaining', (due_at::date - v_today)
      ) order by due_at)
      from public.tet_milestones where is_active), '[]'::jsonb),
    'is_placeholder', v_p.is_placeholder
  );
end;
$fn$;

grant execute on function public.tet_countdown() to anon, authenticated;
grant execute on function public.tet_cutoffs()   to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. THE PUBLIC WRAPPERS COULD NOT CALL WHAT THEY WRAP
-- ---------------------------------------------------------------------
-- Foundations §14 revokes EXECUTE on tet_quote_blends / tet_quote_cask
-- from anon and authenticated — correctly, so nobody can pass p_admin
-- => true and read the cost model. But the wrappers were SECURITY
-- INVOKER, so they ran AS THE CALLER and hit the same wall: every
-- browser price call would have failed with "permission denied for
-- function tet_quote_blends".
--
-- SECURITY DEFINER makes the wrapper run as its owner, which can call
-- the inner function. The admin flag is still unreachable: the wrapper
-- passes false and takes no parameter that could change it.
create or replace function public.tet_quote_blends_public(p_lines jsonb, p_sleeve boolean default true)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select public.tet_quote_blends(p_lines, p_sleeve, false);
$fn$;

create or replace function public.tet_quote_cask_public(p_cask_ref text, p_target_abv numeric default null)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select public.tet_quote_cask(p_cask_ref, p_target_abv, false);
$fn$;

revoke all on function public.tet_quote_blends_public(jsonb, boolean) from public;
revoke all on function public.tet_quote_cask_public(text, numeric)    from public;
grant execute on function public.tet_quote_blends_public(jsonb, boolean) to anon, authenticated;
grant execute on function public.tet_quote_cask_public(text, numeric)    to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. THE ORDERING GATE WAS NEVER WIRED IN
-- ---------------------------------------------------------------------
-- The calendar migration defines tet_assert_ordering_open and says it is
-- wired into both reservation paths. Nothing calls it, so a cask could
-- be reserved in December for a bottling slot that closed in October.
--
-- A trigger rather than an edit to the two reserve functions: it covers
-- every path into the table, including anything added later and anything
-- an admin inserts directly, which is exactly where a late promise would
-- otherwise slip in.
--
-- The deliberate exception: a staff member taking a late order KNOWINGLY
-- sets tet.allow_late for their transaction. Requiring that makes the
-- override a decision somebody made rather than an accident.
create or replace function public.tet_reservations_gate()
returns trigger language plpgsql as $fn$
begin
  if coalesce(current_setting('tet.allow_late', true), '') = 'on' then
    return new;
  end if;
  if not public.tet_ordering_open(new.kind) then
    raise exception 'ordering_closed_for_%', new.kind
      using hint = 'The last order date for this category has passed. '
                || 'A late order is a decision: set tet.allow_late = ''on'' for this transaction.';
  end if;
  return new;
end;
$fn$;

drop trigger if exists tet_reservations_gate on public.tet_reservations;
create trigger tet_reservations_gate before insert on public.tet_reservations
  for each row execute function public.tet_reservations_gate();


-- =====================================================================
--  AFTER RUNNING, CHECK ALL THREE
--
--    -- 1. the clock is Saigon's
--    select public.tet_today(), current_date;
--
--    -- 2. a browser can get a price
--    set local role anon;
--    select public.tet_quote_blends_public('[{"sku":"DT-12YO","qty":50}]'::jsonb, true);
--    select * from public.tet_cask_board order by display_order limit 3;
--    reset role;
--
--    -- 3. the gate bites (expect ordering_closed_for_cask once the date
--    --    has passed; before then it should succeed, which is also the
--    --    proof the trigger is not blocking everything)
--    select public.tet_ordering_open('cask'), public.tet_ordering_open('blend');
-- =====================================================================


-- ===== FILE: supabase/migrations/20260918140000_tet2027_board_grants.sql =====

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


-- ===== FILE: supabase/seed/tet2027_seed.sql =====

-- =====================================================================
--  Tết 2027 Programme — SEED DATA
--  EVERY NUMBER IN THIS FILE IS A PLACEHOLDER.
--
--  Run this after both migrations. It gives you a working, clickable
--  system today. It does not give you a price you can quote. Each row
--  carries is_placeholder = true; the UI shows a marker while that flag
--  is set, and tet_placeholder_audit() lists what is still outstanding.
--
--  The placeholders are not arbitrary — they are set so the system
--  reproduces the figures already in the xlsx model and on the draft
--  leaflet (12 Year Old at ~1.63m with a sleeve at 50 bottles, ~1.42m
--  at 500+, gross margin walking 40% → 32%). Replace them and every
--  number moves together.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. PRICING VERSION
-- ---------------------------------------------------------------------
update public.tet_pricing_inputs set is_active = false where is_active;

insert into public.tet_pricing_inputs (
  version_label, notes, is_active, effective_from,
  fx_vnd_per_gbp, distributor_discount_pct,
  freight_per_bottle_gbp, import_duty_pct, sct_pct, local_cost_per_bottle_vnd,
  target_margin_blend_pct, target_margin_cask_pct,
  vat_pct, rounding_step_vnd,
  artwork_setup_fee_vnd, setup_fee_waiver_bottles,
  bottle_size_ml, cask_bottling_cost_gbp, cask_bottling_loss_pct
) values (
  'v0-placeholder',
  'PLACEHOLDER MODEL. Do not quote from this. Replace FX, duty, freight, '
  || 'ex-works prices and bottling quotes before anything goes to a customer.',
  true, date '2026-09-18',
  33000.00,   -- FX ⚠ PLACEHOLDER — set from your treasury rate, not spot
  0.2000,     -- 20% distributor discount off DT UK list ✔ confirmed term
  1.2000,     -- freight £/bottle ⚠ PLACEHOLDER — forwarder quote needed
  0.1500,     -- UKVFTA duty ⚠ PLACEHOLDER — take 2026 rate from the tariff-phasing model
  0.6500,     -- SCT 65% at import ✔ statutory
  60000.00,   -- local costs VND/bottle ⚠ PLACEHOLDER — broker, stamps, warehousing, delivery
  0.4000,     -- target margin, blends ✔ your decision
  0.4500,     -- target margin, casks ✔ your decision
  0.0800,     -- VAT 8% ⚠ CHECK — confirm the 2027 rate; reverts to 10% if relief lapses
  5000.00,    -- round up to nearest 5,000 VND
  8000000.00, -- artwork + setup fee ⚠ PLACEHOLDER — printer quote needed
  250,        -- setup fee waived from 250 bottles ✔ your decision
  700,
  9.5000,     -- cask bottling £/bottle ⚠ PLACEHOLDER — Huntly quote: glass, closure, label, tube
  0.0200      -- racking/filling loss ⚠ PLACEHOLDER — confirm with Huntly
);


-- ---------------------------------------------------------------------
-- 2. PROGRAMME CALENDAR
-- ---------------------------------------------------------------------
update public.tet_programme set is_active = false where is_active;

insert into public.tet_programme (
  is_active, season_label, timezone, festival_date,
  delivery_before_festival_days,
  bottling_lead_weeks_cask, bottling_lead_weeks_blend,
  sleeve_print_lead_weeks, artwork_approval_weeks,
  transit_weeks, clearance_weeks, local_delivery_weeks, buffer_weeks,
  is_placeholder
) values (
  true, 'Tết Đinh Mùi 2027', 'Asia/Ho_Chi_Minh', date '2027-02-06',
  14,    -- gifts in hand two weeks before Tết, before offices close
  -- Lead times set to land the cask cut-off at 31 Oct 2026 on SEA freight.
  -- This is only true if Huntly commit a three-week bottling slot. If they
  -- come back with six weeks, the cut-off moves to 17 October and no amount
  -- of wishing changes it. Put their real answer in this field.
  3.0,   -- ⚠ CONDITIONAL — Huntly cask bottling slot, assumed booked
  2.0,   -- ⚠ PLACEHOLDER — stock bottling with sleeve
  3.0,   -- ⚠ PLACEHOLDER — sleeve print lead time (Scotland). See note below.
  1.0,   -- artwork approval round
  5.0,   -- ⚠ PLACEHOLDER — direct sea UK → Cát Lái, 30–40 days
  2.0,   -- ⚠ PLACEHOLDER — customs, SCT assessment, stamp application
  1.0,
  1.0,   -- buffer cut to one week to hold the 31 Oct date. This is thin.
  true
);


-- ---------------------------------------------------------------------
-- 3. CATEGORIES
-- ---------------------------------------------------------------------
insert into public.tet_categories
  (slug, kind, name_en, name_vn, standfirst_en, standfirst_vn, accent_hex, display_order)
values
  ('duncan-taylor', 'blend',
   'Duncan Taylor', 'Duncan Taylor',
   'Three blends from Huntly, in a sleeve carrying your company''s name. From fifty bottles.',
   'Ba dòng rượu pha trộn từ Huntly, trong hộp in tên công ty của bạn. Từ năm mươi chai.',
   '#B87333', 1),
  ('octave', 'cask',
   'The Octave Selection', 'Tuyển tập Octave',
   'Fourteen single casks. One company takes the whole cask, and every bottle is numbered.',
   'Mười bốn thùng đơn. Một công ty sở hữu trọn thùng, mỗi chai đều được đánh số.',
   '#7A2E2E', 2)
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------
-- 4. VOLUME TIERS  ✔ your published terms
-- ---------------------------------------------------------------------
delete from public.tet_volume_tiers;
insert into public.tet_volume_tiers
  (label_en, label_vn, min_bottles, max_bottles, discount_pct, sleeve_price_vnd, display_order)
values
  ('50–99 bottles',   '50–99 chai',   50,   99, 0.0000, 50000, 1),
  ('100–249 bottles', '100–249 chai', 100, 249, 0.0500, 40000, 2),
  ('250–499 bottles', '250–499 chai', 250, 499, 0.0800, 30000, 3),
  ('500+ bottles',    '500+ chai',    500, null, 0.1200, 25000, 4);


-- ---------------------------------------------------------------------
-- 5. BLENDS  ⚠ ALL THREE UK LIST PRICES ARE PLACEHOLDERS
-- ---------------------------------------------------------------------
insert into public.tet_products
  (category_id, sku, name_en, name_vn, expression, age_years, abv_pct,
   uk_list_price_gbp, min_order_bottles, display_order, is_placeholder)
select c.id, v.sku, v.name_en, v.name_vn, v.expression, v.age, v.abv,
       v.price, 50, v.ord, true
from public.tet_categories c,
(values
  ('DT-5STAR', 'Duncan Taylor 5 Star', 'Duncan Taylor 5 Star', '5 Star',      null, 40.0, 11.50, 1),
  ('DT-12YO',  'Duncan Taylor 12 Year Old', 'Duncan Taylor 12 Năm', '12 Year Old', 12, 40.0, 14.80, 2),
  ('DT-18YO',  'Duncan Taylor 18 Year Old', 'Duncan Taylor 18 Năm', '18 Year Old', 18, 40.0, 32.00, 3)
) as v(sku, name_en, name_vn, expression, age, abv, price, ord)
where c.slug = 'duncan-taylor'
on conflict (sku) do nothing;


-- ---------------------------------------------------------------------
-- 6. THE FOURTEEN OCTAVES
--    ⚠ Distillery, age, ABV, bulk litres and ex-works are ALL invented
--    placeholders. Replace from Huntly's actual cask list.
--
--    Four are held back. Each has a real reason recorded in reserved_for
--    — the constraint on the table will not let you mark a cask as held
--    without one. If you are not genuinely holding these four, set them
--    back to 'available'.
-- ---------------------------------------------------------------------
insert into public.tet_casks
  (category_id, cask_ref, distillery, region, vintage_year, age_years, wood,
   abv_pct, bulk_litres, ex_works_gbp, status, reserved_for,
   tasting_note_en, colour_hex, display_order, is_placeholder)
select c.id, v.ref, v.dist, v.region, v.vintage, v.age, v.wood, v.abv, v.bulk,
       v.exw, v.status::tet_cask_status, v.held, v.note, v.hex, v.ord, true
from public.tet_categories c,
(values
 ('OCT-2027-01','Glen Placeholder','Speyside',   2015, 11.0,'First-fill Oloroso octave', 60.1, 50.0, 4200,'available', null, 'PLACEHOLDER tasting note.','#8C3A1E', 1),
 ('OCT-2027-02','Glen Placeholder','Speyside',   2014, 12.0,'Refill barrel, octave finish',59.1,50.0, 3900,'available', null, 'PLACEHOLDER tasting note.','#A0522D', 2),
 ('OCT-2027-03','Placeholder Isle','Islay',      2013, 13.0,'First-fill bourbon octave',  57.4, 50.0, 4600,'available', null, 'PLACEHOLDER tasting note.','#C08A3E', 3),
 ('OCT-2027-04','Placeholder Glen','Highland',   2012, 14.0,'PX octave',                  56.2, 50.0, 4800,'available', null, 'PLACEHOLDER tasting note.','#7A2E2E', 4),
 ('OCT-2027-05','Placeholder Burn','Speyside',   2011, 15.0,'First-fill Oloroso octave',  55.0, 50.0, 5100,'available', null, 'PLACEHOLDER tasting note.','#6B2B20', 5),
 ('OCT-2027-06','Placeholder Loch','Highland',   2010, 16.0,'Refill hogshead, octave finish',54.1,50.0,5400,'available', null, 'PLACEHOLDER tasting note.','#9C5221', 6),
 ('OCT-2027-07','Placeholder Isle','Islay',      2009, 17.0,'Refill barrel, octave finish',53.2,50.0, 5800,'available', null, 'PLACEHOLDER tasting note.','#5E3A1E', 7),
 ('OCT-2027-08','Glen Placeholder','Speyside',   2008, 18.0,'First-fill Oloroso octave',  52.4, 50.0, 6100,'available', null, 'PLACEHOLDER tasting note.','#7B3F1D', 8),
 ('OCT-2027-09','Placeholder Glen','Lowland',    2007, 19.0,'PX octave',                  51.6, 50.0, 6200,'available', null, 'PLACEHOLDER tasting note.','#B5762F', 9),
 ('OCT-2027-10','Placeholder Burn','Highland',   2006, 20.0,'First-fill bourbon octave',  51.0, 50.0, 6400,'available', null, 'PLACEHOLDER tasting note.','#8A4A22',10),
 -- Held back. Reasons are real or they do not go on the board.
 ('OCT-2027-11','Glen Placeholder','Speyside',   2005, 21.0,'First-fill Oloroso octave',  53.8, 50.0, 7200,'reserved','Held for Rampant Club member ballot','PLACEHOLDER tasting note.','#63301A',11),
 ('OCT-2027-12','Placeholder Isle','Islay',      2004, 22.0,'Refill sherry butt, octave finish',52.9,50.0,7600,'reserved','Held for Rampant Club member ballot','PLACEHOLDER tasting note.','#4E2A18',12),
 ('OCT-2027-13','Placeholder Glen','Highland',   2003, 23.0,'PX octave',                  51.4, 50.0, 8100,'reserved','Held for first anchor client','PLACEHOLDER tasting note.','#5A2F1C',13),
 ('OCT-2027-14','Placeholder Burn','Speyside',   2002, 24.0,'First-fill Oloroso octave',  50.8, 50.0, 8800,'reserved','Held for first anchor client','PLACEHOLDER tasting note.','#432314',14)
) as v(ref, dist, region, vintage, age, wood, abv, bulk, exw, status, held, note, hex, ord)
where c.slug = 'octave'
on conflict (cask_ref) do nothing;


-- ---------------------------------------------------------------------
-- 7. MANUAL MILESTONES
-- ---------------------------------------------------------------------
insert into public.tet_milestones
  (slug, kind, applies_to, name_en, name_vn, note_en, note_vn, due_at, is_hard, display_order)
values
  ('huntly-confirm', 'bottling', 'cask',
   'Huntly bottling slot confirmed', 'Xác nhận lịch đóng chai tại Huntly',
   'The 31 October cask cut-off assumes a three-week bottling slot. Until Huntly '
   || 'confirm it, that date is an assumption, not a deadline. Single malt must be '
   || 'bottled in Scotland — there is no local workaround.',
   'Hạn chốt thùng 31/10 dựa trên giả định lịch đóng chai ba tuần. Chưa có xác nhận '
   || 'từ Huntly thì đó chỉ là giả định. Rượu single malt bắt buộc đóng chai tại Scotland.',
   timestamptz '2026-10-10 17:00+07', true, 1),
  ('sleeve-local-decision', 'artwork_cutoff', 'blend',
   'Decide where sleeves are printed', 'Quyết định nơi in hộp',
   'If sleeves are printed and applied in Ho Chi Minh City rather than at Huntly, '
   || 'artwork leaves the critical path entirely: bottles ship plain and artwork can '
   || 'be agreed in December instead of 10 October. Cheaper, and it lets a customer '
   || 'order first and decide the design after.',
   'Nếu hộp được in và lồng tại TP.HCM thay vì tại Huntly, phần thiết kế không còn '
   || 'nằm trên đường găng: rượu nhập về không hộp, thiết kế có thể chốt vào tháng 12 '
   || 'thay vì 10/10. Chi phí thấp hơn và khách có thể đặt trước, chọn thiết kế sau.',
   timestamptz '2026-10-03 17:00+07', true, 2),
  ('tet-blank-sailing', 'shipping', null,
   'Pre-Tết shipping congestion', 'Cao điểm vận chuyển trước Tết',
   'Carriers blank sailings in the weeks before Tết. Do not plan to use the final two weeks of transit float.',
   'Các hãng tàu thường hủy chuyến trước Tết. Không nên dựa vào hai tuần dự phòng cuối.',
   timestamptz '2026-12-15 00:00+07', false, 3)
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------
-- 8. PLACEHOLDER AUDIT  — what still has to be replaced
-- ---------------------------------------------------------------------
create or replace function public.tet_placeholder_audit()
returns table (area text, item text, detail text)
language sql stable as $fn$
  select 'pricing'::text, 'FX rate',
         'VND per GBP is ' || fx_vnd_per_gbp::text || ' — set from treasury, not spot'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'Import duty',
         'UKVFTA rate is ' || (import_duty_pct*100)::text || '% — take the 2026 rate from the tariff-phasing model'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'Freight',
         'GBP ' || freight_per_bottle_gbp::text || ' per bottle — forwarder quote outstanding'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'VAT rate',
         (vat_pct*100)::text || '% — confirm the rate applying in Q1 2027'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'Sleeve and setup',
         'Setup fee VND ' || artwork_setup_fee_vnd::text || ' — printer quote outstanding'
    from public.tet_pricing_inputs where is_active
  union all
  select 'pricing', 'Cask bottling', 'GBP ' || cask_bottling_cost_gbp::text
         || ' per bottle — Huntly quote outstanding'
    from public.tet_pricing_inputs where is_active
  union all
  select 'calendar', 'Cask bottling lead time',
         bottling_lead_weeks_cask::text || ' weeks — this single number sets the cask cut-off'
    from public.tet_programme where is_active
  union all
  select 'calendar', 'Transit time',
         transit_weeks::text || ' weeks assumed (sea). Air freight would return roughly five weeks.'
    from public.tet_programme where is_active
  union all
  select 'blends', 'UK list price', sku || ' at GBP ' || uk_list_price_gbp::text
    from public.tet_products where is_placeholder and is_active
  union all
  select 'casks', 'Cask specification',
         cask_ref || ' — ' || distillery || ', ' || age_years::text || 'yo, '
         || abv_pct::text || '%, ' || bulk_litres::text || 'L, GBP ' || ex_works_gbp::text
    from public.tet_casks where is_placeholder and is_active
  order by 1, 2;
$fn$;

grant execute on function public.tet_placeholder_audit() to authenticated;

commit;

-- Sanity check after running:
--   select * from public.tet_cask_board order by display_order;
--   select public.tet_quote_blends_public('[{"sku":"DT-12YO","qty":50}]'::jsonb, true);
--   select public.tet_countdown();
--   select * from public.tet_placeholder_audit();
