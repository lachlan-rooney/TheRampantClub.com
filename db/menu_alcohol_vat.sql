-- ═══════════════════════════════════════════════════════════════════════════
-- MENUS · WHICH LINES CARRY ALCOHOL, AND THEREFORE 10% VAT.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-09-25: food at 8%, "Vat on Cocktails standard 10%, beers or less
-- strong items i'm not sure" — then asked for the rule to be looked up.
--
-- VIETNAM'S RULE, as it stands: the standard 10% VAT is reduced to 8% until
-- 31 December 2026, and CATERING IS IN SCOPE — but goods subject to Special
-- Consumption Tax are excluded from the reduction, and that is exactly where
-- alcohol sits. Beer, wine and spirits stay at 10%. So the rate follows the
-- ITEM, not the club:
--
--     a plate of croquetas ............ 8%
--     a Coca Cola ..................... 8%   (no SCT, so the reduction applies)
--     a Negroni ...................... 10%   (spirits — SCT goods)
--     a beer ......................... 10%   (SCT goods, when one is listed)
--
-- ONE FLAG, NOT A RATE PER ITEM. Storing "10" against a Negroni would mean
-- re-typing every drink when the reduction ends on 31 December 2026 and food
-- returns to 10%. Storing "this contains alcohol" is a fact about the drink
-- that never changes; the rates live in lib/menus/orders.ts, in one place,
-- where they can be moved on the day the law does.
--
-- DEFAULT FALSE. Every plate and every soft drink is already correct without
-- being touched, and a new item is food until somebody says otherwise — the
-- safe direction, since the worst case is the club paying 2% it could have
-- charged, not charging a tax it should not have.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'menu_items') then
    raise exception 'PREREQUISITES MISSING — menu_items' using hint = 'Nothing applied.';
  end if;
end $prereq$;

alter table public.menu_items
  add column if not exists contains_alcohol boolean not null default false;

comment on column public.menu_items.contains_alcohol is
  'True where the line is beer, wine or spirits — Special Consumption Tax goods, excluded from Vietnam''s 8% VAT reduction and charged at 10%. The rates themselves live in lib/menus/orders.ts.';

-- ── WHICH ONES ARE ──────────────────────────────────────────────────────
-- The club's bar list already separates them: every drink carries a section,
-- and the sections are "Cocktails" and "Non-Alcoholic". So the flag is set
-- from the club's own grouping rather than from a list of names I typed —
-- four cocktails true, six soft drinks false, and a new cocktail added to
-- that section tomorrow is caught by the same rule when this is re-run.
--
-- ⚠ THE BAR LIST IS TEN LINES LONG. That is everything the system holds: no
-- beer, no wine, no whisky by the glass. If the bar pours more than this, the
-- rest has never been entered — and anything alcoholic that arrives later
-- needs this flag set, or it will be charged at 8% instead of 10%.
update public.menu_items
   set contains_alcohol = true
 where service = 'cocktail'
   and coalesce(section_en, '') not ilike '%non-alcohol%'
   and coalesce(section_en, '') <> '';

-- ── IT HAS TO REACH THE TABLET ────────────────────────────────────────────
-- menu_plates_public is what the room tablet and the portal read (never the
-- base table, which carries cost). Recreated from its definition in
-- 20260918340000_menus_cocktails.sql with the flag appended — nothing else
-- changes, and no cost column appears.
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
    i.service,
    i.section_en, i.section_vn,
    i.name_en, i.name_vn,
    i.description_en, i.description_vn,
    i.allergens, i.dietary, i.allergens_confirmed,
    i.photo_path,
    i.price_vnd,
    i.lead_time_minutes,
    i.availability_en, i.availability_vn,
    i.contains_alcohol,
    i.display_order,
    i.is_placeholder
  from public.menu_items i
  join public.menu_venues v on v.id = i.venue_id
  where i.is_active and v.is_active;

-- The revoke is the part that matters: Supabase hands every new view to anon.
revoke all on public.menu_plates_public from anon;
grant select on public.menu_plates_public to authenticated;

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- select name_en, contains_alcohol from public.menu_items
--  where service = 'cocktail' order by contains_alcohol desc, name_en;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Recreate menu_plates_public from its previous definition, then:
-- alter table public.menu_items drop column if exists contains_alcohol;
