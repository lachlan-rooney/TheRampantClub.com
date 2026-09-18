-- ═══════════════════════════════════════════════════════════════════════════
-- THE HOUSE MENUS
-- ───────────────────────────────────────────────────────────────────────────
-- Two services, deliberately kept apart, because the club sells them apart:
--
--   PLATES  — small dishes to share, ordered by our team from the restaurants
--             upstairs, plated here and carried to wherever the member is
--             sitting. Three or four per restaurant. No large meals.
--
--   DINING  — set menus from the same restaurants, cooked in our dining room,
--             sat down, downstairs only. Priced per head, with a minimum
--             number of covers and notice.
--
-- A member who reads the Plates menu in the Library must not be able to order
-- a five-course meal to a wing chair, and a member booking the dining room
-- should not be reading bar snacks. Two tables, not one table with a flag,
-- because a set menu genuinely has different parts (courses, covers, notice)
-- from a dish.
--
-- ── THE ONE RULE THAT MATTERS ──────────────────────────────────────────────
-- What the restaurant charges US never reaches a browser. It lives in
-- `cost_vnd` / `cost_per_head_vnd` on the base tables; the base tables are
-- readable ONLY by the service role; every member- and kiosk-facing read goes
-- through the views below, which do not select those columns at all. This is
-- the same discipline as the Tết cost model, for the same reason: a partner
-- restaurant finding out our margin from view-source would end the
-- partnership, and there is no way to un-leak a number.
--
-- Partner contact details sit on the base table too, for the same reason — a
-- supplier's mobile number is not menu content.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Vocabulary ─────────────────────────────────────────────────────────────
-- Kept as CHECK constraints rather than enums: the kitchen will invent a new
-- allergen or a new dietary flag long before anyone wants to write a
-- migration, and a CHECK is one ALTER away. Enums are not.

create table if not exists public.menu_venues (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,

  -- The brand name is NOT translated. "El Gaucho" is "El Gaucho" in both
  -- languages; a restaurant's name belongs to the restaurant.
  name            text not null,
  kind            text not null default 'partner'
                  check (kind in ('partner', 'house')),

  tagline_en      text,
  tagline_vn      text,

  -- Storage path inside the `menu-media` bucket, or a /images/... path for
  -- anything committed to the repo. Nullable: a partner may not have given us
  -- a usable logo yet, and the menu must still render without one.
  logo_path       text,
  accent_hex      text check (accent_hex is null or accent_hex ~ '^#[0-9A-Fa-f]{6}$'),

  -- ADMIN ONLY. Never selected by any view below.
  contact_name    text,
  contact_phone   text,
  contact_email   text,
  contact_note    text,

  display_order   integer not null default 0,
  is_active       boolean not null default true,

  -- True while the row is still a stand-in for something we have not been
  -- given yet. `menu_placeholder_audit()` lists them; nothing placeholder
  -- should be in front of a member with a real price on it.
  is_placeholder  boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.menu_venues is
  'Restaurants we plate from, plus The Rampant Club itself for house dishes. Contact columns are admin-only and are excluded from every public view.';


-- ── PLATES: the small dishes, served anywhere in the venue ─────────────────

create table if not exists public.menu_items (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid not null references public.menu_venues(id) on delete cascade,
  slug                text not null,

  name_en             text not null,
  name_vn             text,
  description_en      text,
  description_vn      text,

  -- Written by the kitchen, shown to the member, and the reason we ask every
  -- partner for it in writing: WE plate and serve this, so the duty of care is
  -- ours whoever cooked it.
  allergens           text[] not null default '{}',
  dietary             text[] not null default '{}',

  -- An empty allergen list is ambiguous in the worst possible direction: it
  -- reads as "this dish contains no allergens" when it usually means "nobody
  -- has told us yet". This flag separates the two, and the menu says "ask your
  -- server" until the kitchen has actually confirmed the dish. Defaults to
  -- false, so a dish added in a hurry fails safe.
  allergens_confirmed boolean not null default false,

  photo_path          text,

  -- What the member pays, in đồng, tax inclusive. Nullable while a dish is
  -- still being agreed — the menu renders "price on request" rather than
  -- inventing a number.
  price_vnd           integer check (price_vnd is null or price_vnd >= 0),

  -- ⚠ ADMIN ONLY — what the restaurant charges us. Excluded from all views.
  cost_vnd            integer check (cost_vnd is null or cost_vnd >= 0),

  -- Order to plated, in minutes. Drives whether a dish can be offered away
  -- from the dining room at all.
  lead_time_minutes   integer check (lead_time_minutes is null or lead_time_minutes between 0 and 240),

  availability_en     text,
  availability_vn     text,

  display_order       integer not null default 0,
  is_active           boolean not null default true,
  is_placeholder      boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (venue_id, slug),

  -- A closed vocabulary, checked in the database rather than hoped for in the
  -- UI: an allergen typed three different ways is an allergen that does not
  -- filter, and this is the one field on the menu where that is dangerous.
  constraint menu_items_allergens_known check (
    allergens <@ array[
      'gluten','crustaceans','eggs','fish','peanuts','soy','dairy','nuts',
      'celery','mustard','sesame','sulphites','lupin','molluscs'
    ]::text[]
  ),
  constraint menu_items_dietary_known check (
    dietary <@ array['vegetarian','vegan','pork','alcohol','raw','spicy']::text[]
  )
);

comment on column public.menu_items.cost_vnd is
  'ADMIN ONLY — what the partner charges the club. Must never appear in a view, an API response, or a browser.';


-- ── DINING: set menus, cooked downstairs, sat down ─────────────────────────

create table if not exists public.menu_set_menus (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid not null references public.menu_venues(id) on delete cascade,
  slug                text not null,

  name_en             text not null,
  name_vn             text,
  standfirst_en       text,
  standfirst_vn       text,

  price_per_head_vnd  integer check (price_per_head_vnd is null or price_per_head_vnd >= 0),

  -- ⚠ ADMIN ONLY.
  cost_per_head_vnd   integer check (cost_per_head_vnd is null or cost_per_head_vnd >= 0),

  -- The two numbers that stop a booking going wrong: we cannot cook for four
  -- when the menu needs eight, and we cannot cook tonight what needs three
  -- days' notice.
  min_covers          integer check (min_covers is null or min_covers between 1 and 60),
  notice_hours        integer check (notice_hours is null or notice_hours between 0 and 720),

  display_order       integer not null default 0,
  is_active           boolean not null default true,
  is_placeholder      boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (venue_id, slug)
);

create table if not exists public.menu_set_courses (
  id              uuid primary key default gen_random_uuid(),
  set_menu_id     uuid not null references public.menu_set_menus(id) on delete cascade,

  -- "To start" / "Khai vị" — the course, not the dish.
  course_en       text,
  course_vn       text,
  dish_en         text not null,
  dish_vn         text,
  note_en         text,
  note_vn         text,

  allergens           text[] not null default '{}',
  dietary             text[] not null default '{}',
  allergens_confirmed boolean not null default false,

  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),

  constraint menu_set_courses_allergens_known check (
    allergens <@ array[
      'gluten','crustaceans','eggs','fish','peanuts','soy','dairy','nuts',
      'celery','mustard','sesame','sulphites','lupin','molluscs'
    ]::text[]
  ),
  constraint menu_set_courses_dietary_known check (
    dietary <@ array['vegetarian','vegan','pork','alcohol','raw','spicy']::text[]
  )
);


-- ── Housekeeping ───────────────────────────────────────────────────────────

create index if not exists menu_items_venue_idx      on public.menu_items (venue_id, display_order);
create index if not exists menu_set_menus_venue_idx  on public.menu_set_menus (venue_id, display_order);
create index if not exists menu_set_courses_menu_idx on public.menu_set_courses (set_menu_id, display_order);

create or replace function public.menu_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists menu_venues_touch on public.menu_venues;
create trigger menu_venues_touch before update on public.menu_venues
  for each row execute function public.menu_touch_updated_at();

drop trigger if exists menu_items_touch on public.menu_items;
create trigger menu_items_touch before update on public.menu_items
  for each row execute function public.menu_touch_updated_at();

drop trigger if exists menu_set_menus_touch on public.menu_set_menus;
create trigger menu_set_menus_touch before update on public.menu_set_menus
  for each row execute function public.menu_touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- LOCKING THE BASE TABLES
-- ───────────────────────────────────────────────────────────────────────────
-- RLS on with NO policies means: anon and authenticated get nothing, ever,
-- from the base tables. The service role bypasses RLS, so admin routes and the
-- server-side menu reads still work. Everything a browser is allowed to see
-- comes from the views below.
--
-- The REVOKE is belt and braces on top of RLS: if someone later adds a policy
-- by accident, the grant still is not there.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.menu_venues     enable row level security;
alter table public.menu_items      enable row level security;
alter table public.menu_set_menus  enable row level security;
alter table public.menu_set_courses enable row level security;

revoke all on public.menu_venues,
              public.menu_items,
              public.menu_set_menus,
              public.menu_set_courses
  from anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- THE VIEWS A BROWSER MAY READ
-- ───────────────────────────────────────────────────────────────────────────
-- Plain views, owned by the migration role, so they read the base tables with
-- the owner's rights rather than the caller's. Column lists are written out in
-- full and deliberately: `select *` here would leak `cost_vnd` the first time
-- somebody adds a column, and the failure would be silent.
-- ═══════════════════════════════════════════════════════════════════════════

drop view if exists public.menu_plates_public;
create view public.menu_plates_public as
  select
    v.slug          as venue_slug,
    v.name          as venue_name,
    v.kind          as venue_kind,
    v.tagline_en    as venue_tagline_en,
    v.tagline_vn    as venue_tagline_vn,
    v.logo_path     as venue_logo_path,
    v.accent_hex    as venue_accent_hex,
    v.display_order as venue_order,
    i.id,
    i.slug,
    i.name_en, i.name_vn,
    i.description_en, i.description_vn,
    i.allergens, i.dietary, i.allergens_confirmed,
    i.photo_path,
    i.price_vnd,
    i.lead_time_minutes,
    i.availability_en, i.availability_vn,
    i.display_order,
    i.is_placeholder
  from public.menu_items i
  join public.menu_venues v on v.id = i.venue_id
  where i.is_active and v.is_active;

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
    ) as courses
  from public.menu_set_menus m
  join public.menu_venues v on v.id = m.venue_id
  where m.is_active and v.is_active;

-- `authenticated` only, NOT anon. The dishes are not a secret, but what the
-- club charges its members is nobody else's business, and the price columns
-- live in these views. The kiosk has no user session — it reads through
-- /api/kiosk/menus with the service role once its device token has been
-- checked, which is how every other kiosk read already works.
grant select on public.menu_plates_public, public.menu_dining_public
  to authenticated;


-- ── What still needs a human ───────────────────────────────────────────────
-- Same idea as tet_placeholder_audit(): one call says what is still made up.
-- A dish with a real price and is_placeholder still true is the dangerous
-- case, so it is listed first.

create or replace function public.menu_placeholder_audit()
returns table (kind text, venue text, label text, detail text)
language sql stable security definer set search_path = public as $$
  select 'plate', v.name, i.name_en,
         case when i.price_vnd is not null
              then 'PRICED but still marked placeholder'
              else 'no price agreed yet' end
    from public.menu_items i join public.menu_venues v on v.id = i.venue_id
   where i.is_placeholder
  union all
  select 'set menu', v.name, m.name_en,
         case when m.price_per_head_vnd is not null
              then 'PRICED but still marked placeholder'
              else 'no price agreed yet' end
    from public.menu_set_menus m join public.menu_venues v on v.id = m.venue_id
   where m.is_placeholder
  union all
  select 'venue', v.name, coalesce(v.tagline_en, '—'),
         case when v.logo_path is null then 'no logo yet' else 'awaiting confirmation' end
    from public.menu_venues v
   where v.is_placeholder
  union all
  -- The one that is actually dangerous: live in front of members, priced, and
  -- nobody has confirmed what is in it.
  select 'ALLERGENS', v.name, i.name_en, 'LIVE and unconfirmed — ask the kitchen'
    from public.menu_items i join public.menu_venues v on v.id = i.venue_id
   where i.is_active and v.is_active and not i.allergens_confirmed
  order by 1, 4 desc, 2;
$$;

revoke all on function public.menu_placeholder_audit() from anon, authenticated;


-- ── The media bucket ───────────────────────────────────────────────────────
-- Public, like `event-media`: a logo and a photograph of a plate are not
-- secrets, and signed URLs on a menu that a tablet re-renders every few
-- minutes would expire mid-service. Writes are service-role only — uploads go
-- through /api/admin/menus/media, which sniffs the bytes and strips EXIF.

insert into storage.buckets (id, name, public)
values ('menu-media', 'menu-media', true)
on conflict (id) do nothing;

drop policy if exists "menu media readable" on storage.objects;
create policy "menu media readable" on storage.objects
  for select using (bucket_id = 'menu-media');
