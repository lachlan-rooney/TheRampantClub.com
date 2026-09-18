-- ═══════════════════════════════════════════════════════════════════════════
-- THE PLATTER GETS A TIME, AND EL GAUCHO GETS ITS LOGO (AGAIN)
-- ───────────────────────────────────────────────────────────────────────────
-- Two small things in one file so there is one thing to run.
--
-- 1. The charcuterie platter had no lead time. Every other dish on the menu
--    now shows one on its row, so the platter was the only plate looking like
--    one nobody had thought about. Ten minutes, per the owner.
--
-- 2. El Gaucho's logo. 20260918260000_menus_el_gaucho_logo.sql was committed
--    but not run — the database still had logo_path null and my invented
--    "Argentinian steakhouse" tagline, so the menu was falling back to a
--    typeset name. Repeated here verbatim rather than asking for two files to
--    be run in order. Both are idempotent; running either or both is fine.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · the platter's ten minutes ──────────────────────────────────────────
update public.menu_items
   set lead_time_minutes = 10
 where slug = 'charcuterie-platter';

-- ── 2 · El Gaucho's logo, and the tagline their artwork already carries ─────
update public.menu_venues
   set logo_path  = '/images/partners/el-gaucho-600.webp',
       tagline_en = null,
       tagline_vn = null
 where slug = 'el-gaucho';

-- ── Proof, rather than hope ────────────────────────────────────────────────
select v.slug,
       coalesce(v.logo_path, '⚠ NO LOGO') as logo,
       coalesce(v.tagline_en, '—')        as tagline
  from public.menu_venues v
 order by v.display_order;

select v.slug, i.name_en,
       coalesce(i.lead_time_minutes::text, '⚠ none') as lead_minutes
  from public.menu_items i
  join public.menu_venues v on v.id = i.venue_id
 order by v.display_order, i.display_order;
