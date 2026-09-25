-- ═══════════════════════════════════════════════════════════════════════════
--  THE KITCHENS' HOURS, AS PUBLISHED — applied 2026-09-25 via REST.
--  This file is the repo's record of what went in and where each line came
--  from. It is written so it can be run again from scratch.
-- ───────────────────────────────────────────────────────────────────────────
--  Owner, 2026-09-25: "I need the opening hours added in properly then for
--  each restaurant. Google them and figure it out by day."
--
--  ⚠ WHAT THESE ARE, AND WHAT THEY ARE NOT. Every line below is the
--  restaurant's OWN PUBLIC TRADING HOURS, taken from its own website or its
--  MICHELIN listing on 2026-09-25 — not the hours it has agreed to cook for
--  the club. Those are a matter between the club and the partner, and no
--  search can answer them. Where the two differ the club's agreement wins and
--  this file should be corrected, because the tablet greys a kitchen out on
--  these numbers: hours that are too narrow stop a member ordering food that
--  was actually available.
--
--  ⚠ LAST ORDERS vs CLOSING. last_order_at is when the tablet stops taking
--  that kitchen's food. Only Ibérico publishes a separate kitchen close, so
--  only Ibérico's is a true last-orders time; for the rest the published
--  CLOSING time is used, which is generous — a kitchen usually stops taking
--  orders before its doors shut. Ask each partner for the real one.
--
--  weekday: 0 = Sunday … 6 = Saturday (JavaScript's getDay()).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Cure & Pickle · every day, all day ────────────────────────────────────
-- Owner, 2026-09-25: "Cure and pickle is available at all times. It's one we
-- do in house." Not a restaurant with doors, so it carries no published hours
-- and needs none: it is on the shelf whenever the club is open.
insert into public.menu_venue_hours (venue_id, weekday, opens_at, last_order_at)
select v.id, d.weekday, time '00:00', time '23:59'
  from public.menu_venues v, generate_series(0, 6) as d(weekday)
 where v.slug = 'cure-and-pickle'
on conflict (venue_id, weekday, opens_at) do nothing;

-- ── Hoa Túc · daily 11:00 – 22:00 ─────────────────────────────────────────
-- Source: MICHELIN Guide, Hoa Túc (District 1), 74/7 Hai Bà Trưng.
insert into public.menu_venue_hours (venue_id, weekday, opens_at, last_order_at)
select v.id, d.weekday, time '11:00', time '22:00'
  from public.menu_venues v, generate_series(0, 6) as d(weekday)
 where v.slug = 'hoa-tuc'
on conflict (venue_id, weekday, opens_at) do nothing;

-- ── Rico Taco · daily 10:00 – 22:00 ───────────────────────────────────────
-- Source: ricotacosaigon.com/contact-us — "10AM TO 10PM / MON-SUN", 74/7 Hai
-- Bà Trưng (the same courtyard as Hoa Túc). TripAdvisor carries a different
-- listing (Tue–Sun 11:00–23:00, closed Monday); the restaurant's own site is
-- taken over a directory, and this is the line to check with them first.
insert into public.menu_venue_hours (venue_id, weekday, opens_at, last_order_at)
select v.id, d.weekday, time '10:00', time '22:00'
  from public.menu_venues v, generate_series(0, 6) as d(weekday)
 where v.slug = 'rico-taco'
on conflict (venue_id, weekday, opens_at) do nothing;

-- ── Tuk Tuk Thai Bistro · daily 10:00 – 22:00 ─────────────────────────────
-- Source: tuktukthaibistro.com — "HOURS: 10AM TO 10PM", given for all
-- branches at once, so it is applied to all seven days.
insert into public.menu_venue_hours (venue_id, weekday, opens_at, last_order_at)
select v.id, d.weekday, time '10:00', time '22:00'
  from public.menu_venues v, generate_series(0, 6) as d(weekday)
 where v.slug = 'tuk-tuk-thai'
on conflict (venue_id, weekday, opens_at) do nothing;

-- ── Ibérico · daily 16:00 – 22:30 (kitchen) ───────────────────────────────
-- Source: weareiberico.com — "16:00 – 23:30 daily · Kitchen closes 22:30".
-- ⚠ Those are the THẢO ĐIỀN hours, the only branch that publishes any. The
-- club's plates are more likely to come from Thị Sách in District 1, whose
-- hours are not published. Confirm which kitchen serves the club.
insert into public.menu_venue_hours (venue_id, weekday, opens_at, last_order_at)
select v.id, d.weekday, time '16:00', time '22:30'
  from public.menu_venues v, generate_series(0, 6) as d(weekday)
 where v.slug = 'iberico'
on conflict (venue_id, weekday, opens_at) do nothing;

-- ── Lüne · Monday to Saturday 11:30 – 22:30, closed Sunday ────────────────
-- Source: MICHELIN Guide listing and directory listings for Lüne Restaurant &
-- Bar, 17/14 Lê Thánh Tôn. Lüne is the club's caterer for The Dining Room
-- rather than a plates kitchen, so these hours say when they can be reached
-- about a sitting, not when a member may order a dish.
insert into public.menu_venue_hours (venue_id, weekday, opens_at, last_order_at)
select v.id, d.weekday, time '11:30', time '22:30'
  from public.menu_venues v, generate_series(1, 6) as d(weekday)
 where v.slug = 'lune'
on conflict (venue_id, weekday, opens_at) do nothing;

-- ── STILL WITHOUT HOURS, DELIBERATELY ─────────────────────────────────────
--   · Livannah        — neither livannah.com nor any listing publishes hours.
--   · FUJIYAMA Sushi  — no listing found that matches the club's partner.
--   · The Rampant Club — the club's own kitchen and bar. Nobody can google
--     this one: it is the owner's to state, and the rota's 00:30 close is a
--     staffing fact, not a last-orders time.
-- A venue with NO rows is 'unknown' in lib/menus/hours.ts, not 'closed', so
-- these three keep behaving exactly as they did. That is the right failure:
-- inventing hours would shut a kitchen that was open.

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- delete from public.menu_venue_hours
--  where venue_id in (select id from public.menu_venues
--                      where slug in ('cure-and-pickle','hoa-tuc','rico-taco',
--                                     'tuk-tuk-thai','iberico','lune'));
