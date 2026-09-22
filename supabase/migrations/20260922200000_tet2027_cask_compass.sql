-- ═══════════════════════════════════════════════════════════════════════════
--  Migration: 20260922200000_tet2027_cask_compass.sql
--  A Tết cask can point at a whisky in the Flavour Compass, and the /tet page
--  can show that whisky's CONFIRMED Compass profile on the cask.
-- ───────────────────────────────────────────────────────────────────────────
--  Owner, 2026-09-22: "Flavour Compass on each cask" (idea 5 of 7).
--
--  WHY A LINK AND NOT NEW TAGS. The Compass already has a whole pipeline —
--  16 families, intensities, confidence, a review queue, a `confirmed` flag.
--  A cask that is tagged as a whisky gets all of it; a second tagging scheme
--  for casks would drift from the first the day it was written.
--
--  WHY A FUNCTION AND NOT A GRANT. /tet reads with the ANON key on purpose
--  (app/tet/page.tsx), and anon cannot read flavour_categories or
--  whisky_flavour_intensities — nor should it be able to read every whisky's
--  tags. This SECURITY DEFINER function returns exactly one thing: the
--  confirmed Compass values of whiskies that a Tết cask points at. Nothing
--  else leaves.
--
--  ONLY CONFIRMED TAGS. A buyer's page is not the place for a model's first
--  guess. Until a human confirms them in the review queue, a linked cask shows
--  no radar at all.
--
--  TO LINK A CASK (once the real casks and their Compass tags exist):
--    update public.tet_casks set whisky_id = '<whiskies.id>' where cask_ref = 'OCT-2027-01';
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.tet_casks
  add column if not exists whisky_id uuid references public.whiskies(id) on delete set null;

comment on column public.tet_casks.whisky_id is
  'The Flavour Compass whisky this cask is tagged as. /tet shows its confirmed Compass profile.';

create or replace function public.tet_cask_compass()
returns table (cask_ref text, category_slug text, category_name text, sort_order int, intensity numeric, confidence numeric)
language sql
stable
security definer
set search_path = public
as $$
  select c.cask_ref::text, fc.slug::text, fc.name::text, fc.sort_order::int,
         i.intensity::numeric, i.confidence::numeric
  from public.tet_casks c
  join public.whisky_flavour_intensities i on i.whisky_id = c.whisky_id and i.confirmed
  join public.flavour_categories fc on fc.slug = i.category_slug and fc.quadrant is not null
  where c.whisky_id is not null and c.is_active
$$;

revoke all on function public.tet_cask_compass() from public;
grant execute on function public.tet_cask_compass() to anon, authenticated;

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- drop function if exists public.tet_cask_compass();
-- alter table public.tet_casks drop column if exists whisky_id;
