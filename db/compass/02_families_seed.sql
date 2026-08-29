-- ══════════════════════════════════════════════════════════════════════════
-- COMPASS MIGRATION · PART B · BLOCK 2 — quadrant column + the 16 new families
-- Adds the quadrant metadata column and INSERTs the 16 Compass families
-- ALONGSIDE the old 13 (no deletes — cutover deletion is Part E). sort_order
-- is the production-journey order: field → still → cask → shore.
-- quadrant is metadata only; it is INVISIBLE to the match maths.
-- ══════════════════════════════════════════════════════════════════════════

alter table flavour_categories add column if not exists quadrant text;

-- Idempotent upsert of the 16 (safe to re-run).
insert into flavour_categories (slug, name, description, quadrant, sort_order) values
  -- FIELD
  ('cereal_biscuit',      'Cereal & Biscuit',      'Malt loaf, biscuit, porridge, rye bread, corn.',                 'field',  1),
  ('green_grassy',        'Green & Grassy',        'Cut grass, hay, green apple skin, leafy freshness.',             'field',  2),
  -- STILL
  ('orchard_fruit',       'Orchard Fruit',         'Apple, pear, plum, apricot.',                                    'still',  3),
  ('tropical_citrus',     'Tropical & Citrus',     'Banana, pineapple, mango, lemon zest.',                          'still',  4),
  ('floral_honeyed',      'Floral & Honeyed',      'Heather honey, rose, elderflower, beeswax.',                     'still',  5),
  ('buttery_creamy',      'Buttery & Creamy',      'Butter, cream, custard, fudge.',                                 'still',  6),
  ('meaty_sulphury',      'Meaty & Sulphury',      'Struck match, broth, cooked meat, gunpowder.',                   'still',  7),
  -- CASK
  ('vanilla_coconut',     'Vanilla & Coconut',     'Vanilla, coconut, toasted-oak sweetness.',                       'cask',   8),
  ('baking_spice',        'Baking Spice',          'Cinnamon, clove, nutmeg, ginger.',                               'cask',   9),
  ('pepper_tannin',       'Pepper & Tannin',       'Black pepper, oak tannin, black tea, rye pepper.',               'cask',  10),
  ('dried_fruit_walnut',  'Dried Fruit & Walnut',  'Raisin, fig, date, walnut.',                                     'cask',  11),
  ('treacle_roast',       'Treacle & Roast',       'Toffee, treacle, coffee, dark chocolate, char.',                 'cask',  12),
  ('leather_polished_oak','Leather & Polished Oak','Old leather, tobacco, waxed wood, dried herbs.',                 'cask',  13),
  -- SHORE
  ('woodsmoke',           'Woodsmoke',             'Bonfire, ash, smoked meat, embers.',                             'shore', 14),
  ('tar_iodine',          'Tar & Iodine',          'Tar, iodine, antiseptic, creosote, kippers.',                    'shore', 15),
  ('brine_shoreline',     'Brine & Shoreline',     'Sea salt, seaweed, oyster shell, wet stone.',                    'shore', 16)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description,
      quadrant = excluded.quadrant, sort_order = excluded.sort_order;

-- ── VERIFICATION ──────────────────────────────────────────────────────────
-- EXPECTED: 16 new families present, 4 per quadrant, sort_order 1..16 unique.
select quadrant, count(*) from flavour_categories
  where slug in ('cereal_biscuit','green_grassy','orchard_fruit','tropical_citrus',
    'floral_honeyed','buttery_creamy','meaty_sulphury','vanilla_coconut','baking_spice',
    'pepper_tannin','dried_fruit_walnut','treacle_roast','leather_polished_oak',
    'woodsmoke','tar_iodine','brine_shoreline')
  group by quadrant order by quadrant;
-- EXPECTED: cask=6 · field=2 · shore=3 · still=5   (total 16)
-- (Table now holds 13 old + 16 new = 29 rows until the Part E cutover.)
select count(*) as total_categories from flavour_categories;   -- EXPECTED: 29
