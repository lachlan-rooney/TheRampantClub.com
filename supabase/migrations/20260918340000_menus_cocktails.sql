-- ═══════════════════════════════════════════════════════════════════════════
-- THE BAR — A THIRD SERVICE, AND THE CLUB'S OWN
-- ───────────────────────────────────────────────────────────────────────────
-- menu_items could say which RESTAURANT a dish came from and which named list
-- inside that restaurant it sat on, but not which of the club's services it
-- belonged to: everything was a plate. Cocktails are neither a small plate nor
-- private catering, so `service` now says which tab a row appears under.
--
-- THESE ARE THE CLUB'S OWN, NOT A PARTNER'S. Ten drinks at exactly the prices
-- on the printed Library Bar card — Manhattan 350, Old Fashioned 350, Mojito
-- 300, Negroni 350, the soft drinks 90 and the two made or imported ones 120.
-- They go under The Rampant Club, the house venue that has sat empty since the
-- menu was built, and NO 20% is applied: there is no supplier to take a margin
-- from, because the club is the supplier.
--
-- Split into Cocktails and Non-Alcoholic, which is how the printed card reads
-- and how anybody scans a drinks list — the section machinery built for
-- Livannah's two menus does it without a line of new code.
--
-- ⚠ "COMPLIMENTARY THIS EVENING" is set as the house venue's tagline, which
--   renders as one line under the heading and above the four drinks. It was
--   the last thing in the owner's message, after the four prices, so it reads
--   as a note about tonight rather than as a fifth item.
--
--   The prices still show. That is deliberate — a member should see what the
--   drink normally costs and that tonight it is on the club — but if the
--   intention is to show no prices at all this evening, say so and it is one
--   update. TO END IT:
--
--     update public.menu_venues set tagline_en = null, tagline_vn = null
--      where slug = 'the-rampant-club';
--
-- Alcohol is marked on the four cocktails and not on the soft drinks, which
-- needs no confirming from anybody. Allergens are
-- unconfirmed as everywhere else — vermouth and bitters carry sulphites and
-- nobody has said so in writing. No lead times: the bar has not been asked.
--
-- The Vietnamese is mine and unreviewed.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.menu_items
  add column if not exists service text not null default 'plate';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_items_service_known') then
    alter table public.menu_items
      add constraint menu_items_service_known check (service in ('plate', 'cocktail'));
  end if;
end $$;

comment on column public.menu_items.service is
  'Which tab the row appears under: plate (small plates, anywhere in the club) or cocktail (the bar). Set menus are a separate table.';

create index if not exists menu_items_service_idx on public.menu_items (service, venue_id, display_order);

-- ── The view, rebuilt to carry it ──────────────────────────────────────────
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
    i.display_order,
    i.is_placeholder
  from public.menu_items i
  join public.menu_venues v on v.id = i.venue_id
  where i.is_active and v.is_active;

-- Supabase's default privileges hand every new view to anon. Granting to
-- authenticated is not enough; the revoke is the part that matters.
revoke all on public.menu_plates_public from anon;
grant select on public.menu_plates_public to authenticated;

-- ── The house bar ──────────────────────────────────────────────────────────
update public.menu_venues
   set tagline_en = 'Complimentary this evening',
       tagline_vn = 'Miễn phí tối nay',
       is_placeholder = false
 where slug = 'the-rampant-club';

with c as (select id from public.menu_venues where slug = 'the-rampant-club')
insert into public.menu_items (
  venue_id, slug, service, section_en, section_vn,
  name_en, name_vn, description_en, description_vn,
  allergens, dietary, allergens_confirmed,
  price_vnd, display_order, is_active, is_placeholder
)
select c.id, v.slug, 'cocktail', v.sec_en, v.sec_vn,
       v.name_en, v.name_vn, v.desc_en, v.desc_vn,
       '{}'::text[], v.dietary, false,
       v.price, v.ord, true, false
from c, (values
  ('manhattan', 'Cocktails', 'Cocktail', 'Manhattan', 'Manhattan',
   'Rye or bourbon whisky, sweet vermouth, Angostura bitters. Stirred, straight up, with a cherry and a discarded orange.',
   'Whisky lúa mạch đen hoặc bourbon, vermouth ngọt, bitters Angostura. Khuấy, dùng không đá, kèm quả anh đào.',
   array['alcohol']::text[], 350000, 10),

  ('old-fashioned', 'Cocktails', 'Cocktail', 'Old Fashioned', 'Old Fashioned',
   'Black Bull 12 Scotch whisky, sugar, Angostura bitters. Stirred down, on the rocks.',
   'Black Bull 12 Scotch whisky, đường, bitters Angostura. Khuấy, dùng với đá.',
   array['alcohol']::text[], 350000, 20),

  ('mojito', 'Cocktails', 'Cocktail', 'Mojito', 'Mojito',
   'White rum, lime juice, sugar syrup, soda water, mint. Built, served tall.',
   'Rum trắng, nước cốt chanh, siro đường, soda, bạc hà. Pha trực tiếp, ly cao.',
   array['alcohol']::text[], 300000, 30),

  ('negroni', 'Cocktails', 'Cocktail', 'Negroni', 'Negroni',
   'Gin, Campari, sweet vermouth. Stirred down, on the rocks, with a twist.',
   'Gin, Campari, vermouth ngọt. Khuấy, dùng với đá, kèm vỏ cam.',
   array['alcohol']::text[], 350000, 40),

  -- ── Non-alcoholic. Brand names are left exactly as they are: Sprite is
  --    Sprite in both languages, and translating one would be odd. ──────────
  ('spiced-cola', 'Non-Alcoholic', 'Không cồn', 'Home-Made Spiced Cola', 'Cola gia vị tự làm',
   null, null, '{}'::text[], 120000, 110),
  ('sprite', 'Non-Alcoholic', 'Không cồn', 'Sprite', 'Sprite',
   null, null, '{}'::text[], 90000, 120),
  ('soda-water', 'Non-Alcoholic', 'Không cồn', 'Soda Water', 'Nước soda',
   null, null, '{}'::text[], 90000, 130),
  ('coca-cola', 'Non-Alcoholic', 'Không cồn', 'Coca Cola', 'Coca Cola',
   null, null, '{}'::text[], 90000, 140),
  ('tonic-water', 'Non-Alcoholic', 'Không cồn', 'Tonic Water', 'Nước tonic',
   null, null, '{}'::text[], 90000, 150),
  ('aranciata', 'Non-Alcoholic', 'Không cồn', 'San Pellegrino Aranciata', 'San Pellegrino Aranciata',
   null, null, '{}'::text[], 120000, 160)
) as v(slug, sec_en, sec_vn, name_en, name_vn, desc_en, desc_vn, dietary, price, ord)
on conflict (venue_id, slug) do update
  set service        = excluded.service,
      section_en     = excluded.section_en,
      section_vn     = excluded.section_vn,
      name_en        = excluded.name_en,
      name_vn        = excluded.name_vn,
      description_en = excluded.description_en,
      description_vn = excluded.description_vn,
      dietary        = excluded.dietary,
      price_vnd      = excluded.price_vnd,
      display_order  = excluded.display_order;

-- ── Read it back ───────────────────────────────────────────────────────────
select i.section_en as section, i.name_en,
       to_char(i.price_vnd, 'FM999,999,999') || '₫' as member_pays
  from public.menu_items i
 where i.service = 'cocktail'
 order by i.display_order;

select service, count(*) as live_rows
  from public.menu_items where is_active group by service order by service;
