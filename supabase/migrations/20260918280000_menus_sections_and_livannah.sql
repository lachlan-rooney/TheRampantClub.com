-- ═══════════════════════════════════════════════════════════════════════════
-- SECTIONS WITHIN A RESTAURANT, AND LIVANNAH
-- ───────────────────────────────────────────────────────────────────────────
-- Livannah is offering two distinct menus — skewers and nori tacos — and the
-- schema could not say so: a dish belonged to a venue and nothing else, so the
-- seventeen would have run together as one undifferentiated list under one
-- logo. A member reading it would have no idea the tacos were a thing.
--
-- So `section_en` / `section_vn` on menu_items. Nullable, because most
-- restaurants offer one list and a heading over a single group is clutter;
-- MenuBoard only draws a section heading where there is more than one.
--
-- The views are DROPPED and recreated rather than CREATE OR REPLACE: replace
-- can only append columns to the end, and the section belongs next to the
-- name, not bolted on after is_placeholder. Dropping loses the grants, so they
-- are re-applied below — including the REVOKE from anon, which is the one that
-- was missed the first time and left the club's prices readable by anyone with
-- the publishable key.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.menu_items
  add column if not exists section_en text,
  add column if not exists section_vn text;

comment on column public.menu_items.section_en is
  'Optional named group within a venue (e.g. "Nori Tacos"). Null where a restaurant offers one list.';

-- ── The views, rebuilt ─────────────────────────────────────────────────────

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
    i.section_en, i.section_vn,
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

-- Same discipline as 20260918220000: Supabase's default privileges hand every
-- new view in `public` to anon, so granting to authenticated is not enough.
revoke all on public.menu_plates_public from anon;
grant select on public.menu_plates_public to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- LIVANNAH
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠ THREE THINGS FOR THE OWNER. These are REAL prices off Livannah's own
--   menu, not placeholders, so they are worth checking rather than trusting:
--
--   1. THE PRICE-TO-DISH MAPPING ON THE SKEWERS IS INFERRED. The paste arrived
--      with the first two prices AFTER their dish and the next five BEFORE
--      theirs — a two-column PDF unwrapping badly. Eight dishes and eight
--      prices did line up exactly once read that way, which is the only reason
--      I trust it at all. The list is printed in the reply for checking.
--
--   2. THE ENGLISH NAMES ARE MY TRANSLATIONS. The Vietnamese is Livannah's own
--      wording, untouched. A dish name belongs to the restaurant, so these
--      want their eye, and Miss Châu's, before anyone calls them final.
--
--   3. NO LEAD TIMES. I have invented enough of those today; seventeen more
--      would be fiction at a scale that starts to look like fact. Livannah
--      have not been asked. They are the one thing missing from these rows.
--
--   "_99" is read as 99,000₫ — consistent with the rest of their list and with
--   what the club charges elsewhere.
--
--   4. THE 20% UPLIFT APPLIES HERE TOO. Livannah's numbers are what THEY
--      charge, so they are cost_vnd, and the member price is cost x 1.2 —
--      the same arrangement as Iberico. Without this the club would have
--      served all seventeen dishes at cost and made nothing on any of them.
--
--      Rounded UP to the next whole thousand, not to the nearest. Five of the
--      seventeen do not land on a round figure (99,000 x 1.2 = 118,800), and a
--      price like that is two problems: no menu in Saigon prints it, and the
--      club's own price() helper renders it as "119K" while the database holds
--      118,800 — the screen and the till disagreeing by 200 dong. Rounding up
--      keeps the uplift at or above 20% in every case; the exact figures are
--      printed at the bottom of this file.
--
--   Raw is marked ONLY on the tartare, which is raw by definition. Whether
--   their salmon, tuna, scallop and roe are served raw is a question for the
--   kitchen, not a guess for me. Allergens are unconfirmed throughout, so
--   every one of these says "ask your server".
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.menu_venues (slug, name, kind, logo_path, display_order, is_placeholder)
values ('livannah', 'Livannah', 'partner', '/images/partners/livannah-600.webp', 25, false)
on conflict (slug) do update
  set name = excluded.name, kind = excluded.kind, logo_path = excluded.logo_path;

with l as (select id from public.menu_venues where slug = 'livannah')
insert into public.menu_items (
  venue_id, slug, section_en, section_vn, name_en, name_vn,
  description_en, description_vn, dietary, allergens, allergens_confirmed,
  cost_vnd, price_vnd, display_order, is_active, is_placeholder
)
select l.id, v.slug, v.sec_en, v.sec_vn, v.name_en, v.name_vn,
       v.desc_en, v.desc_vn, v.dietary, '{}'::text[], false,
       v.cost,
       (ceil(v.cost * 1.2 / 1000) * 1000)::int,
       v.ord, true, false
from l, (values
  -- ── Skewers ──────────────────────────────────────────────────────────────
  ('duck-cakes','Skewers','Xiên nướng','Crispy Duck Cakes','Bánh vịt chiên giòn',
   'Five pieces.','5 miếng.','{}'::text[],99000,10),
  ('wontons','Skewers','Xiên nướng','Hong Kong-style Wontons','Hoành thánh kiểu Hồng Kông',
   'Three pieces.','3 miếng.','{}'::text[],75000,20),
  ('boneless-wings','Skewers','Xiên nướng','Boneless Chicken Wings','Cánh gà không xương',
   null,null,'{}'::text[],85000,30),
  ('cambodian-beef','Skewers','Xiên nướng','Cambodian-style Beef Skewers','Xiên bò vị Campuchia',
   null,null,'{}'::text[],75000,40),
  ('mac-khen','Skewers','Xiên nướng','Mắc Khén & Hạt Dổi','Mắc khén, hạt dổi',
   'Northwest highland spices.','Gia vị Tây Bắc.','{}'::text[],75000,50),
  ('bacon-okra','Skewers','Xiên nướng','Bacon-wrapped Okra','Thịt xông khói cuộn đậu bắp',
   null,null,array['pork']::text[],66000,60),
  ('betel-beef','Skewers','Xiên nướng','Betel Leaf Beef & Pork','Bò lá lốt cuộn thịt heo',
   null,null,array['pork']::text[],85000,70),
  ('baby-broccoli','Skewers','Xiên nướng','Grilled Baby Broccoli','Bông cải xanh baby nướng',
   null,null,'{}'::text[],69000,80),

  -- ── Nori tacos. Every one is the same build; only the protein changes, so
  --    the protein is the name and the build is the description. ────────────
  ('taco-tartare','Nori Tacos','Taco rong biển','Beef Tartare','Bò tartare',
   'Nori, rice, cucumber, carrot, avocado.','Rong biển, cơm, dưa leo, cà rốt, bơ.',
   array['raw']::text[],85000,110),
  ('taco-salmon','Nori Tacos','Taco rong biển','Salmon','Cá hồi',
   'Nori, rice, cucumber, carrot, avocado.','Rong biển, cơm, dưa leo, cà rốt, bơ.',
   '{}'::text[],85000,120),
  ('taco-prawn','Nori Tacos','Taco rong biển','Crispy Tiger Prawn','Tôm sú chiên giòn',
   'Nori, rice, cucumber, carrot, avocado.','Rong biển, cơm, dưa leo, cà rốt, bơ.',
   '{}'::text[],85000,130),
  ('taco-chicken','Nori Tacos','Taco rong biển','Chicken Skewer','Gà xiên',
   'Nori, rice, cucumber, carrot, avocado.','Rong biển, cơm, dưa leo, cà rốt, bơ.',
   '{}'::text[],85000,140),
  ('taco-tuna','Nori Tacos','Taco rong biển','Tuna','Cá ngừ',
   'Nori, rice, cucumber, carrot, avocado.','Rong biển, cơm, dưa leo, cà rốt, bơ.',
   '{}'::text[],119000,150),
  ('taco-unagi','Nori Tacos','Taco rong biển','Japanese Eel (Unagi)','Lươn Nhật (Unagi)',
   'Nori, rice, cucumber, carrot, avocado.','Rong biển, cơm, dưa leo, cà rốt, bơ.',
   '{}'::text[],169000,160),
  ('taco-wagyu','Nori Tacos','Taco rong biển','Wagyu Beef','Bò Wagyu',
   'Nori, rice, cucumber, carrot, avocado.','Rong biển, cơm, dưa leo, cà rốt, bơ.',
   '{}'::text[],145000,170),
  ('taco-scallop','Nori Tacos','Taco rong biển','Scallop','Sò điệp',
   'Nori, rice, cucumber, carrot, avocado.','Rong biển, cơm, dưa leo, cà rốt, bơ.',
   '{}'::text[],85000,180),
  ('taco-ikura','Nori Tacos','Taco rong biển','Salmon Roe','Trứng cá hồi',
   'Nori, rice, cucumber, carrot, avocado.','Rong biển, cơm, dưa leo, cà rốt, bơ.',
   '{}'::text[],85000,190)
) as v(slug, sec_en, sec_vn, name_en, name_vn, desc_en, desc_vn, dietary, cost, ord)
on conflict (venue_id, slug) do update
  set section_en     = excluded.section_en,
      section_vn     = excluded.section_vn,
      name_en        = excluded.name_en,
      name_vn        = excluded.name_vn,
      description_en = excluded.description_en,
      description_vn = excluded.description_vn,
      dietary        = excluded.dietary,
      cost_vnd       = excluded.cost_vnd,
      price_vnd      = excluded.price_vnd,
      display_order  = excluded.display_order;

-- Read it back and check it against the reply before anyone serves from it.
-- The uplift is printed, not asserted: anything under 20.0% is a bug.
select coalesce(i.section_en,'—') as section,
       i.name_en, i.name_vn,
       to_char(i.cost_vnd, 'FM999,999,999') || '₫'  as they_charge_us,
       to_char(i.price_vnd,'FM999,999,999') || '₫'  as member_pays,
       round(((i.price_vnd::numeric / i.cost_vnd) - 1) * 100, 1) || '%' as uplift,
       case when i.price_vnd % 1000 = 0 then 'ok' else '⚠ not a round thousand' end as rounding
  from public.menu_items i
  join public.menu_venues v on v.id = i.venue_id
 where v.slug = 'livannah'
 order by i.display_order;
