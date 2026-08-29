-- ══════════════════════════════════════════════════════════════════════════
-- COMPASS MIGRATION · PART B · BLOCK 3 — tier-2 descriptor lexicon for the 16
-- Seeds flavour_descriptors for the new families (slug = <name>__<family>, the
-- existing disambiguation convention). Additive alongside the old descriptors;
-- old rows are removed in the Part E cutover. Plain sensory vocabulary only.
-- ══════════════════════════════════════════════════════════════════════════

insert into flavour_descriptors (slug, category_slug, name, sort_order) values
  -- FIELD
  ('malt_loaf__cereal_biscuit','cereal_biscuit','Malt loaf',1),('biscuit__cereal_biscuit','cereal_biscuit','Biscuit',2),
  ('porridge__cereal_biscuit','cereal_biscuit','Porridge',3),('rye_bread__cereal_biscuit','cereal_biscuit','Rye bread',4),
  ('corn__cereal_biscuit','cereal_biscuit','Corn',5),
  ('cut_grass__green_grassy','green_grassy','Cut grass',1),('hay__green_grassy','green_grassy','Hay',2),
  ('green_apple_skin__green_grassy','green_grassy','Green apple skin',3),('leafy__green_grassy','green_grassy','Leafy',4),
  -- STILL
  ('apple__orchard_fruit','orchard_fruit','Apple',1),('pear__orchard_fruit','orchard_fruit','Pear',2),
  ('plum__orchard_fruit','orchard_fruit','Plum',3),('apricot__orchard_fruit','orchard_fruit','Apricot',4),
  ('banana__tropical_citrus','tropical_citrus','Banana',1),('pineapple__tropical_citrus','tropical_citrus','Pineapple',2),
  ('mango__tropical_citrus','tropical_citrus','Mango',3),('lemon_zest__tropical_citrus','tropical_citrus','Lemon zest',4),
  ('heather_honey__floral_honeyed','floral_honeyed','Heather honey',1),('rose__floral_honeyed','floral_honeyed','Rose',2),
  ('elderflower__floral_honeyed','floral_honeyed','Elderflower',3),('beeswax__floral_honeyed','floral_honeyed','Beeswax',4),
  ('butter__buttery_creamy','buttery_creamy','Butter',1),('cream__buttery_creamy','buttery_creamy','Cream',2),
  ('custard__buttery_creamy','buttery_creamy','Custard',3),('fudge__buttery_creamy','buttery_creamy','Fudge',4),
  ('struck_match__meaty_sulphury','meaty_sulphury','Struck match',1),('broth__meaty_sulphury','meaty_sulphury','Broth',2),
  ('cooked_meat__meaty_sulphury','meaty_sulphury','Cooked meat',3),('gunpowder__meaty_sulphury','meaty_sulphury','Gunpowder',4),
  -- CASK
  ('vanilla__vanilla_coconut','vanilla_coconut','Vanilla',1),('coconut__vanilla_coconut','vanilla_coconut','Coconut',2),
  ('toasted_oak_sweetness__vanilla_coconut','vanilla_coconut','Toasted-oak sweetness',3),
  ('cinnamon__baking_spice','baking_spice','Cinnamon',1),('clove__baking_spice','baking_spice','Clove',2),
  ('nutmeg__baking_spice','baking_spice','Nutmeg',3),('ginger__baking_spice','baking_spice','Ginger',4),
  ('black_pepper__pepper_tannin','pepper_tannin','Black pepper',1),('oak_tannin__pepper_tannin','pepper_tannin','Oak tannin',2),
  ('black_tea__pepper_tannin','pepper_tannin','Black tea',3),('rye_pepper__pepper_tannin','pepper_tannin','Rye pepper',4),
  ('raisin__dried_fruit_walnut','dried_fruit_walnut','Raisin',1),('fig__dried_fruit_walnut','dried_fruit_walnut','Fig',2),
  ('date__dried_fruit_walnut','dried_fruit_walnut','Date',3),('walnut__dried_fruit_walnut','dried_fruit_walnut','Walnut',4),
  ('toffee__treacle_roast','treacle_roast','Toffee',1),('treacle__treacle_roast','treacle_roast','Treacle',2),
  ('coffee__treacle_roast','treacle_roast','Coffee',3),('dark_chocolate__treacle_roast','treacle_roast','Dark chocolate',4),
  ('char__treacle_roast','treacle_roast','Char',5),
  ('old_leather__leather_polished_oak','leather_polished_oak','Old leather',1),('tobacco__leather_polished_oak','leather_polished_oak','Tobacco',2),
  ('waxed_wood__leather_polished_oak','leather_polished_oak','Waxed wood',3),('dried_herbs__leather_polished_oak','leather_polished_oak','Dried herbs',4),
  -- SHORE
  ('bonfire__woodsmoke','woodsmoke','Bonfire',1),('ash__woodsmoke','woodsmoke','Ash',2),
  ('smoked_meat__woodsmoke','woodsmoke','Smoked meat',3),('embers__woodsmoke','woodsmoke','Embers',4),
  ('tar__tar_iodine','tar_iodine','Tar',1),('iodine__tar_iodine','tar_iodine','Iodine',2),
  ('antiseptic__tar_iodine','tar_iodine','Antiseptic',3),('creosote__tar_iodine','tar_iodine','Creosote',4),
  ('kippers__tar_iodine','tar_iodine','Kippers',5),
  ('sea_salt__brine_shoreline','brine_shoreline','Sea salt',1),('seaweed__brine_shoreline','brine_shoreline','Seaweed',2),
  ('oyster_shell__brine_shoreline','brine_shoreline','Oyster shell',3),('wet_stone__brine_shoreline','brine_shoreline','Wet stone',4)
on conflict (slug) do update set category_slug=excluded.category_slug, name=excluded.name, sort_order=excluded.sort_order;

-- ── VERIFICATION ──────────────────────────────────────────────────────────
-- EXPECTED: 70 new descriptors, all FK-valid to the 16 new families.
select count(*) as new_descriptors from flavour_descriptors
  where category_slug in ('cereal_biscuit','green_grassy','orchard_fruit','tropical_citrus',
    'floral_honeyed','buttery_creamy','meaty_sulphury','vanilla_coconut','baking_spice',
    'pepper_tannin','dried_fruit_walnut','treacle_roast','leather_polished_oak',
    'woodsmoke','tar_iodine','brine_shoreline');
-- EXPECTED: 70
