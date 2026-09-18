-- ═══════════════════════════════════════════════════════════════════════════
-- RESTAURANTS THAT HAVE NOT ARRIVED YET
-- ───────────────────────────────────────────────────────────────────────────
-- The owner is announcing a line-up: Le Corto, El Gaucho, Hoa Tuc, Rico Taco,
-- Fujiyama Sushi and Iberico all land on 23 September, and members should see
-- them coming rather than see nothing.
--
-- TWO THINGS HAD TO CHANGE FOR THAT TO BE POSSIBLE.
--
-- 1. A DATE. `arriving_on` on menu_venues. A date, not a line of text, so it
--    reads "Arriving 23 September" in English and "Sẽ phục vụ từ 23 tháng 9"
--    in Vietnamese without anybody typing it twice, and so it can be compared
--    against today rather than being a sentence nobody remembers to delete.
--
-- 2. A VENUES VIEW. menu_plates_public is driven by menu_items: it joins from
--    the dishes out to the venue, so a restaurant with no dishes produced no
--    rows at all and could not be rendered however much we wanted it. That is
--    also why Le Corto silently vanished earlier today. menu_venues_public
--    fixes it properly — the surfaces now read the venues FIRST and hang
--    dishes off them, instead of inferring the restaurants from the food.
--
-- A venue with a date shows its logo and the arriving line and NOT its dishes,
-- even where placeholders exist. El Gaucho's and Le Corto's stand-in dishes
-- stay in the database, hidden, ready for the day they open — better than
-- deleting work that will be wanted again in five days.
--
-- IBERICO IS NOT ONE OF THEM. Re-reading the owner's message: the arriving
-- five are Le Corto, Hoa Tuc, Rico Taco, FUJIYAMA Sushi and El Gaucho. Iberico
-- was a separate sentence — "add in Iberico Restaurant, logo to follow, menu
-- items:" — an addition, not an announcement. I had given it the date too,
-- which would have hidden the menu that arrived minutes later behind a
-- "coming soon" line. Its dishes go in the next migration.
--
-- ⚠ NAMES are exactly as the owner typed them, including "FUJIYAMA Sushi" in
--   capitals. "Hoa Tuc" was corrected to "Hoa Túc" in 20260918330000 once
--   their logo settled the spelling. A restaurant's name is its
--   own; correcting one is not a tidy-up, it is a mistake with a straight face.
--   Worth confirming with each of them.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.menu_venues
  add column if not exists arriving_on date;

comment on column public.menu_venues.arriving_on is
  'Set while a restaurant is announced but not yet serving. The menu shows "Arriving <date>" and lists no dishes. Clear it on the day they open.';

-- ── The venues view the surfaces were missing ──────────────────────────────
-- Contact columns and every cost stay out, as everywhere else.
drop view if exists public.menu_venues_public;
create view public.menu_venues_public as
  select
    v.slug, v.name, v.kind,
    v.tagline_en, v.tagline_vn,
    v.logo_path, v.accent_hex,
    v.arriving_on,
    v.display_order,
    v.is_placeholder
  from public.menu_venues v
  where v.is_active;

revoke all on public.menu_venues_public from anon;
grant select on public.menu_venues_public to authenticated;

-- ── The new restaurants ────────────────────────────────────────────────────
insert into public.menu_venues (slug, name, kind, logo_path, display_order, is_placeholder, arriving_on)
values
  ('hoa-tuc',         'Hoa Túc',            'partner', null, 40, true, date '2026-09-23'),
  ('rico-taco',       'Rico Taco',          'partner', null, 50, true, date '2026-09-23'),
  ('fujiyama-sushi',  'FUJIYAMA Sushi',     'partner', null, 60, true, date '2026-09-23'),
  -- Serving, not arriving: no date.
  ('iberico',         'Iberico Restaurant', 'partner',
   '/images/partners/iberico-600.webp',                      70, false, null)
on conflict (slug) do update
  set name          = excluded.name,
      kind          = excluded.kind,
      display_order = excluded.display_order,
      arriving_on   = excluded.arriving_on;

-- Kept out of the insert so a re-run cannot blank a logo uploaded since.
update public.menu_venues set logo_path = '/images/partners/iberico-600.webp'
 where slug = 'iberico' and logo_path is null;

-- ── The two that were listed early, now given their date ───────────────────
update public.menu_venues
   set arriving_on = date '2026-09-23'
 where slug in ('le-corto', 'el-gaucho');

-- Serving TODAY, and must not be caught by any of the above.
update public.menu_venues
   set arriving_on = null
 where slug in ('cure-and-pickle', 'livannah', 'iberico');

-- ── Read it back ───────────────────────────────────────────────────────────
select slug, name,
       coalesce(arriving_on::text, 'serving now') as status,
       case when logo_path is null then '⚠ no logo' else 'logo ✓' end as logo
  from public.menu_venues
 order by display_order;
