-- ═══════════════════════════════════════════════════════════════════════════
--  Migration: 20260923190000_menu_set_price_ladder.sql
--  A set menu priced per head, by the size of the party.
-- ───────────────────────────────────────────────────────────────────────────
--  Owner, 2026-09-23: "On 'The Dining Room' tab, we will add set menu prices
--  for external catering for specific numbers. Hoa Tuc, and Lune for now" —
--  priced PER HEAD by group size, and "min number is 5, max is 12".
--
--  WHY A LADDER AND NOT ONE PRICE. menu_set_menus already has
--  price_per_head_vnd, which says one number for any party. Catering does not
--  work that way: five guests and twelve guests are different jobs and
--  different prices per head. Each rung is a party size with its own price.
--
--  price_per_head_vnd STAYS as the fallback — a set menu with no ladder keeps
--  behaving exactly as it does today, so nothing that exists now changes.
--
--  5 TO 12 is the club's rule, stored per set menu (min_covers / max_covers)
--  rather than hard-coded, because the next caterer will have their own.
--  A rung outside its menu's own range is refused by a trigger: a price for
--  fifteen guests on a menu that stops at twelve is a price nobody can buy.
--
--  NET OF SERVICE AND VAT, like every other price in the menus: the surfaces
--  add 10% service and 10% VAT (lib/menus/orders.ts) and say so.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A CATERER IS NOT A KITCHEN ON THE FLOOR ───────────────────────────────
-- Owner, same day: "Lune is only for The Dining Room". Some partners cook
-- plates sent up to the rooms; a caterer only does the sat-down job. Without
-- this, a caterer appears on the Plates tab as a kitchen with nothing on it —
-- wrong, and an invitation to tap.
alter table public.menu_venues
  add column if not exists dining_only boolean not null default false;

comment on column public.menu_venues.dining_only is
  'External caterer: shown on The Dining Room tab only, never under Plates or the Bar.';

alter table public.menu_set_menus
  add column if not exists max_covers integer check (max_covers is null or max_covers > 0);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_set_menus_covers_order') then
    alter table public.menu_set_menus
      add constraint menu_set_menus_covers_order
      check (min_covers is null or max_covers is null or max_covers >= min_covers);
  end if;
end $$;

comment on column public.menu_set_menus.max_covers is
  'The largest party this menu is offered to. Null = no stated ceiling.';

create table if not exists public.menu_set_prices (
  id                 uuid primary key default gen_random_uuid(),
  set_menu_id        uuid not null references public.menu_set_menus(id) on delete cascade,

  -- The size of the party this rung is for.
  covers             integer not null check (covers > 0 and covers <= 200),
  -- What each guest pays at that size, before service and VAT.
  price_per_head_vnd integer not null check (price_per_head_vnd >= 0),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint menu_set_prices_one_per_size unique (set_menu_id, covers)
);

create index if not exists menu_set_prices_menu_idx
  on public.menu_set_prices (set_menu_id, covers);

-- A rung must be a party the menu actually serves.
create or replace function public.menu_set_prices_in_range()
returns trigger language plpgsql as $$
declare v_min integer; v_max integer;
begin
  select min_covers, max_covers into v_min, v_max
    from public.menu_set_menus where id = new.set_menu_id;
  if v_min is not null and new.covers < v_min then
    raise exception 'This menu starts at % guests; % is below it.', v_min, new.covers;
  end if;
  if v_max is not null and new.covers > v_max then
    raise exception 'This menu stops at % guests; % is above it.', v_max, new.covers;
  end if;
  return new;
end $$;

drop trigger if exists menu_set_prices_range on public.menu_set_prices;
create trigger menu_set_prices_range
  before insert or update on public.menu_set_prices
  for each row execute function public.menu_set_prices_in_range();

-- Locked like the rest of the menu tables: no anon or member path to the base
-- table. What a member sees comes through the view below.
alter table public.menu_set_prices enable row level security;
revoke all on public.menu_set_prices from anon, authenticated;

-- ── The venues view, carrying the new flag ────────────────────────────────
-- Recreated here (it was last written by 20260923160000) so the flag and the
-- ladder arrive in one run rather than leaving the surfaces half-informed.
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
    v.dining_only,
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

-- ── The dining view, with the ladder and the ceiling ───────────────────────
drop view if exists public.menu_dining_public;
create view public.menu_dining_public as
  select
    v.slug          as venue_slug,
    v.name          as venue_name,
    v.kind          as venue_kind,
    v.tagline_en    as venue_tagline_en,
    v.tagline_vn    as venue_tagline_vn,
    v.logo_path     as venue_logo_path,
    v.accent_hex    as venue_accent_hex,
    v.display_order as venue_order,
    m.id,
    m.slug,
    m.name_en, m.name_vn,
    m.standfirst_en, m.standfirst_vn,
    m.price_per_head_vnd,
    m.min_covers,
    m.max_covers,
    m.notice_hours,
    m.display_order,
    m.is_placeholder,
    coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'id', c.id,
                  'course_en', c.course_en, 'course_vn', c.course_vn,
                  'dish_en', c.dish_en,     'dish_vn', c.dish_vn,
                  'note_en', c.note_en,     'note_vn', c.note_vn,
                  'allergens', c.allergens, 'dietary', c.dietary,
                  'allergens_confirmed', c.allergens_confirmed
                ) order by c.display_order, c.dish_en)
       from public.menu_set_courses c
       where c.set_menu_id = m.id),
      '[]'::jsonb
    ) as courses,
    coalesce(
      (select jsonb_agg(
                jsonb_build_object('covers', p.covers, 'price_per_head_vnd', p.price_per_head_vnd)
                order by p.covers)
       from public.menu_set_prices p
       where p.set_menu_id = m.id),
      '[]'::jsonb
    ) as prices
  from public.menu_set_menus m
  join public.menu_venues v on v.id = m.venue_id
  where m.is_active and v.is_active;

grant select on public.menu_dining_public to authenticated;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- drop view if exists public.menu_dining_public;   -- then recreate from
--   20260918210000_menus.sql (without max_covers and prices)
-- drop trigger if exists menu_set_prices_range on public.menu_set_prices;
-- drop function if exists public.menu_set_prices_in_range();
-- drop table if exists public.menu_set_prices;
-- alter table public.menu_set_menus drop constraint if exists menu_set_menus_covers_order;
-- alter table public.menu_set_menus drop column if exists max_covers;
-- alter table public.menu_venues drop column if exists dining_only;  -- and
--   recreate menu_venues_public from 20260923160000
