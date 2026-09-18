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
