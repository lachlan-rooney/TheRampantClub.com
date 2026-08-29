-- ══════════════════════════════════════════════════════════════════════════
-- COMPASS MIGRATION · PART E · CUTOVER — delete the legacy 13-family taxonomy
-- ══════════════════════════════════════════════════════════════════════════
-- RUN LAST, and only once everything is verified:
--   • the whisky map / finder renders the 16 Compass families only (live);
--   • sanity trio holds (a peaty Islay carries tar_iodine, a first-fill sherry
--     carries dried_fruit_walnut, a grain carries cereal_biscuit);
--   • member taste pages render on the 16 (M001/2/3 re-derived);
--   • regression: the three fixed shapes return identical top-3 (confirmed);
--   • `grep -ri smws` in src is empty (confirmed).
--
-- This is the point of no return: it removes the old rows the app already stops
-- rendering (every display filters quadrant IS NOT NULL). The routing is
-- preserved in flavour_family_migration, and the old seed lives in git history,
-- so it is recoverable if ever needed. Delete order respects the FKs
-- (tags → intensities → descriptors → categories). Each step verifies its count.

-- The legacy 13 (identified explicitly; they are exactly the quadrant IS NULL rows).
-- old = ('young_spritely','sweet_fruity_mellow','spicy_sweet','spicy_dry',
--        'rich_dried_fruits','old_dignified','light_delicate','juicy_oak_vanilla',
--        'oily_coastal','lightly_peated','peated','heavily_peated','grain_rye')

-- Pre-flight: confirm what will be removed. EXPECTED — cats 13 · descriptors 77 ·
-- intensities 1525 · tags 1052.
select
  (select count(*) from flavour_categories        where quadrant is null) as old_categories,
  (select count(*) from flavour_descriptors       where category_slug in (select slug from flavour_categories where quadrant is null)) as old_descriptors,
  (select count(*) from whisky_flavour_intensities where category_slug in (select slug from flavour_categories where quadrant is null)) as old_intensities,
  (select count(*) from whisky_flavour_tags        where category_slug in (select slug from flavour_categories where quadrant is null)) as old_tags;

begin;

-- 1. descriptor tags on old families
delete from whisky_flavour_tags
  where category_slug in (select slug from flavour_categories where quadrant is null);

-- 2. radar-spoke intensities on old families
delete from whisky_flavour_intensities
  where category_slug in (select slug from flavour_categories where quadrant is null);

-- 3. tier-2 descriptors under old families
delete from flavour_descriptors
  where category_slug in (select slug from flavour_categories where quadrant is null);

-- 4. the old families themselves
delete from flavour_categories where quadrant is null;

commit;

-- ── VERIFICATION (post-cutover) ────────────────────────────────────────────
-- EXPECTED: categories 16 · descriptors 70 · intensities 1604 · tags 880,
-- and ZERO rows on any legacy slug.
select
  (select count(*) from flavour_categories)                                                     as categories,       -- 16
  (select count(*) from flavour_descriptors)                                                    as descriptors,      -- 70
  (select count(*) from whisky_flavour_intensities)                                             as intensities,      -- 1604
  (select count(*) from whisky_flavour_tags)                                                     as tags,            -- 880
  (select count(*) from flavour_categories where quadrant is null)                              as leftover_old_cats; -- 0

-- Every category now belongs to a quadrant:
select quadrant, count(*) from flavour_categories group by quadrant order by quadrant;
-- EXPECTED: cask 6 · field 2 · shore 3 · still 5
