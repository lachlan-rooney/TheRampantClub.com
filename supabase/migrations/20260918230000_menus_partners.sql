-- ═══════════════════════════════════════════════════════════════════════════
-- MENUS — CURE & PICKLE IS A BRAND, AND TWO LOGOS ARRIVE
-- ───────────────────────────────────────────────────────────────────────────
-- I misread the owner. "We already have a cure and pickle platter to add to
-- it" was a SUPPLIER, not a description — I read it as "cured and pickled" and
-- put the Charcuterie Platter under The Rampant Club's own kitchen. It is made
-- by Cure & Pickle and belongs to them.
--
-- That is not cosmetic. The house/partner distinction decides whose name sits
-- above the dish on a menu a member reads, and crediting someone else's
-- charcuterie to our own kitchen is the kind of error a supplier notices.
--
-- Also lands the two logos the owner sent, rendered from the 7437px originals
-- into public/images/partners/. Both had real transparency; Le Corto's cat and
-- "WINE DINING" are WHITE, so that logo only resolves on a dark ground — which
-- is what the menus are. Committed to the repo rather than the storage bucket
-- because they are brand assets, not content staff will swap during service.
-- The admin upload still overrides them: mediaUrl() passes any path starting
-- with "/" straight through, so repo art and uploaded art live side by side.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Cure & Pickle ──────────────────────────────────────────────────────────
-- No tagline: I am not putting words in their mouth. The owner can add one in
-- /admin/menus, or ask them what they call themselves.
insert into public.menu_venues (slug, name, kind, logo_path, display_order, is_placeholder)
values ('cure-and-pickle', 'Cure & Pickle', 'partner',
        '/images/partners/cure-and-pickle-600.webp', 15, false)
on conflict (slug) do update
  set name      = excluded.name,
      kind      = excluded.kind,
      logo_path = excluded.logo_path;

-- ── The platter goes home ──────────────────────────────────────────────────
update public.menu_items i
   set venue_id = (select id from public.menu_venues where slug = 'cure-and-pickle')
 where i.slug = 'charcuterie-platter'
   and i.venue_id = (select id from public.menu_venues where slug = 'the-rampant-club');

-- ── Le Corto ───────────────────────────────────────────────────────────────
-- The tagline is CLEARED, not corrected. I had invented "French bistronomy";
-- the obvious repair was to use their own strapline off the logo — but the
-- logo they sent already reads "WINE DINING" underneath the wordmark, so a
-- tagline beneath it printed the same words twice. The artwork says it; the
-- page should not say it again.
-- Still a draft: no dishes or prices agreed yet.
update public.menu_venues
   set logo_path  = '/images/partners/le-corto-600.webp',
       tagline_en = null,
       tagline_vn = null
 where slug = 'le-corto';

-- ── What is still missing ──────────────────────────────────────────────────
select * from public.menu_placeholder_audit();
