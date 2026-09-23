-- ═══════════════════════════════════════════════════════════════════════════
--  Migration: 20260923160000_menu_venue_hours.sql
--  When each kitchen takes orders, and how long it says the food will be.
-- ───────────────────────────────────────────────────────────────────────────
--  Owner, 2026-09-23: "code in the opening times for each restaurant to the
--  kiosk. So that restaurants that stop taking orders at a specific time must
--  show as closed when the time hits that. Also, put an estimated wait time
--  beside each restaurant."
--
--  A TABLE, NOT A COLUMN OF TEXT. One row per serving window per weekday, so a
--  kitchen that closes between lunch and dinner is two rows and a kitchen that
--  runs to half past midnight is one row that crosses midnight. Free text
--  ("6pm till late") cannot be compared against a clock, which is the whole
--  point of the request.
--
--  LAST ORDERS, NOT CLOSING. last_order_at is the moment the tablet stops
--  taking that kitchen's food — the useful time, and usually earlier than the
--  door closing. opens_at is when it starts.
--
--  PAST MIDNIGHT: last_order_at EARLIER than opens_at means the window runs
--  into the next day (17:00 → 00:30). The evaluation in lib/menus/hours.ts
--  handles it, and there are tests for exactly that case.
--
--  NO ROWS = NO RESTRICTION. A venue with no hours behaves as it does today:
--  always orderable. Nothing goes dark because somebody has not filled a form
--  in yet — the restriction arrives with the data, restaurant by restaurant.
--
--  THE WAIT IS AN ESTIMATE AND SAYS SO. wait_minutes is what the kitchen tells
--  us, kept beside the restaurant; menu_items.lead_time_minutes stays as the
--  per-dish figure. Where neither exists, nothing is shown — a made-up wait is
--  worse than none.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.menu_venues
  add column if not exists wait_minutes integer
    check (wait_minutes is null or (wait_minutes >= 0 and wait_minutes <= 240));

comment on column public.menu_venues.wait_minutes is
  'The kitchen''s own estimate, in minutes, shown beside the restaurant. Null = say nothing.';

create table if not exists public.menu_venue_hours (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.menu_venues(id) on delete cascade,

  -- 0 = Sunday … 6 = Saturday, matching JavaScript's getDay() so the tablet
  -- and the database never disagree about which day "3" is.
  weekday       smallint not null check (weekday between 0 and 6),

  opens_at      time not null,
  last_order_at time not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint menu_venue_hours_one_per_start unique (venue_id, weekday, opens_at)
);

create index if not exists menu_venue_hours_venue_idx
  on public.menu_venue_hours (venue_id, weekday);

-- Locked like the rest of the menu tables: no anon or member path. The kiosk
-- reads through /api/kiosk/menus (device token, service role); the members'
-- portal reads the public view below.
alter table public.menu_venue_hours enable row level security;
revoke all on public.menu_venue_hours from anon, authenticated;

-- ── The venues view, with the hours hung off each venue ────────────────────
-- Contact columns and every cost stay out, exactly as before.
drop view if exists public.menu_venues_public;
create view public.menu_venues_public as
  select
    v.slug, v.name, v.kind,
    v.tagline_en, v.tagline_vn,
    v.logo_path, v.accent_hex,
    v.arriving_on,
    v.display_order,
    v.is_placeholder,
    v.wait_minutes,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'weekday', h.weekday,
               'opens_at', to_char(h.opens_at, 'HH24:MI'),
               'last_order_at', to_char(h.last_order_at, 'HH24:MI'))
             order by h.weekday, h.opens_at)
        from public.menu_venue_hours h
       where h.venue_id = v.id
    ), '[]'::jsonb) as hours
  from public.menu_venues v
  where v.is_active;

revoke all on public.menu_venues_public from anon;
grant select on public.menu_venues_public to authenticated;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- drop view if exists public.menu_venues_public;
-- create view public.menu_venues_public as
--   select v.slug, v.name, v.kind, v.tagline_en, v.tagline_vn, v.logo_path,
--          v.accent_hex, v.arriving_on, v.display_order, v.is_placeholder
--     from public.menu_venues v where v.is_active;
-- revoke all on public.menu_venues_public from anon;
-- grant select on public.menu_venues_public to authenticated;
-- drop table if exists public.menu_venue_hours;
-- alter table public.menu_venues drop column if exists wait_minutes;
