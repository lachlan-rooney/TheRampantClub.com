-- ══════════════════════════════════════════════════════════════════════════
-- COMPASS MIGRATION · PART B · BLOCK 5 — remap whisky_flavour_tags (tier-2)
-- Each old descriptor is mapped to its new lexicon home BY MEANING (not just
-- by its family's route — e.g. spicy_dry/tobacco → leather_polished_oak). A
-- descriptor with no clean home is DROPPED and counted. Collision-safe (two old
-- descriptors → one new descriptor on the same bottle merge). confirmed is kept
-- only when the descriptor stays on its old family's DETERMINISTIC target;
-- every cross-family move or split-family origin re-queues (confirmed=false).
-- NO old tag rows are deleted here (Part E). Descriptor tags are display-only —
-- they do NOT feed the match maths (that's whisky_flavour_intensities).
-- ══════════════════════════════════════════════════════════════════════════

-- Idempotent: clear prior NEW-descriptor rows only.
delete from whisky_flavour_tags where category_slug in
  ('cereal_biscuit','green_grassy','orchard_fruit','tropical_citrus','floral_honeyed',
   'buttery_creamy','meaty_sulphury','vanilla_coconut','baking_spice','pepper_tannin',
   'dried_fruit_walnut','treacle_roast','leather_polished_oak','woodsmoke','tar_iodine','brine_shoreline');

with map(old_slug, new_cat, new_desc) as (values
  -- young_spritely
  ('cereal__young_spritely','cereal_biscuit','biscuit__cereal_biscuit'),
  ('grassy__young_spritely','green_grassy','cut_grass__green_grassy'),
  ('green_apple__young_spritely','green_grassy','green_apple_skin__green_grassy'),
  ('citrus_zest__young_spritely','tropical_citrus','lemon_zest__tropical_citrus'),
  ('floral__young_spritely','floral_honeyed','rose__floral_honeyed'),
  ('fresh_malt__young_spritely','cereal_biscuit','malt_loaf__cereal_biscuit'),
  -- sweet_fruity_mellow
  ('vanilla__sweet_fruity_mellow','vanilla_coconut','vanilla__vanilla_coconut'),
  ('honey__sweet_fruity_mellow','floral_honeyed','heather_honey__floral_honeyed'),
  ('orchard_fruit__sweet_fruity_mellow','orchard_fruit','apple__orchard_fruit'),
  ('caramel__sweet_fruity_mellow','treacle_roast','toffee__treacle_roast'),
  ('stone_fruit__sweet_fruity_mellow','orchard_fruit','plum__orchard_fruit'),
  ('toffee__sweet_fruity_mellow','treacle_roast','toffee__treacle_roast'),
  -- spicy_sweet
  ('cinnamon__spicy_sweet','baking_spice','cinnamon__baking_spice'),
  ('ginger__spicy_sweet','baking_spice','ginger__baking_spice'),
  ('nutmeg__spicy_sweet','baking_spice','nutmeg__baking_spice'),
  ('baking_spice__spicy_sweet','baking_spice','cinnamon__baking_spice'),
  ('clove__spicy_sweet','baking_spice','clove__baking_spice'),
  ('honeyed_spice__spicy_sweet','baking_spice','ginger__baking_spice'),
  -- spicy_dry
  ('black_pepper__spicy_dry','pepper_tannin','black_pepper__pepper_tannin'),
  ('oak_tannin__spicy_dry','pepper_tannin','oak_tannin__pepper_tannin'),
  ('dry_spice__spicy_dry','pepper_tannin','black_pepper__pepper_tannin'),
  ('tobacco__spicy_dry','leather_polished_oak','tobacco__leather_polished_oak'),
  ('leather__spicy_dry','leather_polished_oak','old_leather__leather_polished_oak'),
  ('char__spicy_dry','treacle_roast','char__treacle_roast'),
  ('clove__spicy_dry','baking_spice','clove__baking_spice'),
  -- rich_dried_fruits
  ('raisin__rich_dried_fruits','dried_fruit_walnut','raisin__dried_fruit_walnut'),
  ('fig__rich_dried_fruits','dried_fruit_walnut','fig__dried_fruit_walnut'),
  ('date__rich_dried_fruits','dried_fruit_walnut','date__dried_fruit_walnut'),
  ('dark_chocolate__rich_dried_fruits','treacle_roast','dark_chocolate__treacle_roast'),
  ('christmas_cake__rich_dried_fruits','dried_fruit_walnut','fig__dried_fruit_walnut'),
  ('walnut__rich_dried_fruits','dried_fruit_walnut','walnut__dried_fruit_walnut'),
  ('dried_fruit__rich_dried_fruits','dried_fruit_walnut','raisin__dried_fruit_walnut'),
  -- old_dignified
  ('polished_oak__old_dignified','leather_polished_oak','waxed_wood__leather_polished_oak'),
  ('beeswax__old_dignified','floral_honeyed','beeswax__floral_honeyed'),
  ('old_leather__old_dignified','leather_polished_oak','old_leather__leather_polished_oak'),
  ('dried_herbs__old_dignified','leather_polished_oak','dried_herbs__leather_polished_oak'),
  ('sandalwood__old_dignified','leather_polished_oak','waxed_wood__leather_polished_oak'),
  ('antique_wood__old_dignified','leather_polished_oak','waxed_wood__leather_polished_oak'),
  -- light_delicate (split origin → all re-queue)
  ('floral__light_delicate','floral_honeyed','rose__floral_honeyed'),
  ('light_honey__light_delicate','floral_honeyed','heather_honey__floral_honeyed'),
  ('lemon__light_delicate','tropical_citrus','lemon_zest__tropical_citrus'),
  ('hay__light_delicate','green_grassy','hay__green_grassy'),
  ('delicate_malt__light_delicate','cereal_biscuit','malt_loaf__cereal_biscuit'),
  ('meadow__light_delicate','floral_honeyed','elderflower__floral_honeyed'),
  -- juicy_oak_vanilla
  ('vanilla__juicy_oak_vanilla','vanilla_coconut','vanilla__vanilla_coconut'),
  ('coconut__juicy_oak_vanilla','vanilla_coconut','coconut__vanilla_coconut'),
  ('toasted_oak__juicy_oak_vanilla','vanilla_coconut','toasted_oak_sweetness__vanilla_coconut'),
  ('butterscotch__juicy_oak_vanilla','buttery_creamy','fudge__buttery_creamy'),
  ('custard__juicy_oak_vanilla','buttery_creamy','custard__buttery_creamy'),
  ('banana__juicy_oak_vanilla','tropical_citrus','banana__tropical_citrus'),
  -- oily_coastal
  ('brine__oily_coastal','brine_shoreline','sea_salt__brine_shoreline'),
  ('sea_salt__oily_coastal','brine_shoreline','sea_salt__brine_shoreline'),
  ('seaweed__oily_coastal','brine_shoreline','seaweed__brine_shoreline'),
  ('mineral__oily_coastal','brine_shoreline','wet_stone__brine_shoreline'),
  ('smoked_fish__oily_coastal','tar_iodine','kippers__tar_iodine'),
  -- (oily_texture__oily_coastal → NO CLEAN HOME → dropped, see verification)
  -- peated (split origin → re-queue)
  ('bonfire_smoke__peated','woodsmoke','bonfire__woodsmoke'),
  ('soot__peated','woodsmoke','ash__woodsmoke'),
  ('tar__peated','tar_iodine','tar__tar_iodine'),
  ('smoked_meat__peated','woodsmoke','smoked_meat__woodsmoke'),
  ('ash__peated','woodsmoke','ash__woodsmoke'),
  ('campfire__peated','woodsmoke','bonfire__woodsmoke'),
  -- heavily_peated (split origin → re-queue)
  ('medicinal__heavily_peated','tar_iodine','antiseptic__tar_iodine'),
  ('iodine__heavily_peated','tar_iodine','iodine__tar_iodine'),
  ('tcp__heavily_peated','tar_iodine','antiseptic__tar_iodine'),
  ('creosote__heavily_peated','tar_iodine','creosote__tar_iodine'),
  ('intense_smoke__heavily_peated','woodsmoke','bonfire__woodsmoke'),
  ('kippers__heavily_peated','tar_iodine','kippers__tar_iodine'),
  -- lightly_peated (deterministic → woodsmoke; same-target descriptors keep confirmed)
  ('gentle_smoke__lightly_peated','woodsmoke','bonfire__woodsmoke'),
  ('soft_peat__lightly_peated','woodsmoke','embers__woodsmoke'),
  ('ember__lightly_peated','woodsmoke','embers__woodsmoke'),
  ('light_bonfire__lightly_peated','woodsmoke','bonfire__woodsmoke'),
  -- grain_rye
  ('rye_spice__grain_rye','pepper_tannin','rye_pepper__pepper_tannin'),
  ('corn__grain_rye','cereal_biscuit','corn__cereal_biscuit'),
  ('grain__grain_rye','cereal_biscuit','porridge__cereal_biscuit'),
  ('sawdust__grain_rye','cereal_biscuit','rye_bread__cereal_biscuit'),
  ('cereal_sweetness__grain_rye','cereal_biscuit','malt_loaf__cereal_biscuit')
),
-- deterministic primary target per old family (for the confirmed rule)
det(old_fam, target) as (values
  ('young_spritely','green_grassy'),('sweet_fruity_mellow','orchard_fruit'),('spicy_sweet','baking_spice'),
  ('spicy_dry','pepper_tannin'),('old_dignified','leather_polished_oak'),('juicy_oak_vanilla','vanilla_coconut'),
  ('oily_coastal','brine_shoreline'),('lightly_peated','woodsmoke'),('rich_dried_fruits','dried_fruit_walnut'),
  ('grain_rye','cereal_biscuit')
),
remapped as (
  select t.whisky_id, m.new_cat, m.new_desc, t.confidence, t.source, t.model, t.evidence,
    -- keep confirmed only if it stayed on its family's deterministic target
    (t.confirmed and d.target is not distinct from m.new_cat) as keep_conf
  from whisky_flavour_tags t
  join map m on m.old_slug = t.descriptor_slug
  left join det d on d.old_fam = t.category_slug
)
insert into whisky_flavour_tags (whisky_id, category_slug, descriptor_slug, confidence, source, model, evidence, confirmed)
select whisky_id, new_cat, new_desc, max(confidence), 'llm', max(model),
       nullif(string_agg(distinct evidence, ' | '), ''), bool_and(keep_conf)
from remapped
group by whisky_id, new_cat, new_desc;

-- ── VERIFICATION ──────────────────────────────────────────────────────────
-- (1) Dropped: old tag rows whose descriptor has no clean new home.
--     EXPECTED: 18 rows, all oily_texture__oily_coastal (mouthfeel, not a flavour note).
select count(*) as dropped_tags, array_agg(distinct descriptor_slug) as dropped_descriptors
from whisky_flavour_tags t
where t.category_slug in ('young_spritely','sweet_fruity_mellow','spicy_sweet','spicy_dry','rich_dried_fruits',
    'old_dignified','light_delicate','juicy_oak_vanilla','oily_coastal','peated','heavily_peated','lightly_peated','grain_rye')
  and t.descriptor_slug not in (
    'cereal__young_spritely','grassy__young_spritely','green_apple__young_spritely','citrus_zest__young_spritely',
    'floral__young_spritely','fresh_malt__young_spritely','vanilla__sweet_fruity_mellow','honey__sweet_fruity_mellow',
    'orchard_fruit__sweet_fruity_mellow','caramel__sweet_fruity_mellow','stone_fruit__sweet_fruity_mellow','toffee__sweet_fruity_mellow',
    'cinnamon__spicy_sweet','ginger__spicy_sweet','nutmeg__spicy_sweet','baking_spice__spicy_sweet','clove__spicy_sweet','honeyed_spice__spicy_sweet',
    'black_pepper__spicy_dry','oak_tannin__spicy_dry','dry_spice__spicy_dry','tobacco__spicy_dry','leather__spicy_dry','char__spicy_dry','clove__spicy_dry',
    'raisin__rich_dried_fruits','fig__rich_dried_fruits','date__rich_dried_fruits','dark_chocolate__rich_dried_fruits','christmas_cake__rich_dried_fruits','walnut__rich_dried_fruits','dried_fruit__rich_dried_fruits',
    'polished_oak__old_dignified','beeswax__old_dignified','old_leather__old_dignified','dried_herbs__old_dignified','sandalwood__old_dignified','antique_wood__old_dignified',
    'floral__light_delicate','light_honey__light_delicate','lemon__light_delicate','hay__light_delicate','delicate_malt__light_delicate','meadow__light_delicate',
    'vanilla__juicy_oak_vanilla','coconut__juicy_oak_vanilla','toasted_oak__juicy_oak_vanilla','butterscotch__juicy_oak_vanilla','custard__juicy_oak_vanilla','banana__juicy_oak_vanilla',
    'brine__oily_coastal','sea_salt__oily_coastal','seaweed__oily_coastal','mineral__oily_coastal','smoked_fish__oily_coastal',
    'bonfire_smoke__peated','soot__peated','tar__peated','smoked_meat__peated','ash__peated','campfire__peated',
    'medicinal__heavily_peated','iodine__heavily_peated','tcp__heavily_peated','creosote__heavily_peated','intense_smoke__heavily_peated','kippers__heavily_peated',
    'gentle_smoke__lightly_peated','soft_peat__lightly_peated','ember__lightly_peated','light_bonfire__lightly_peated',
    'rye_spice__grain_rye','corn__grain_rye','grain__grain_rye','sawdust__grain_rye','cereal_sweetness__grain_rye');
-- EXPECTED: dropped_tags = 18 · dropped_descriptors = {oily_texture__oily_coastal}

-- (2) New tag rows inserted (collision-merged). RECONCILE: 1052 original − 18 dropped
--     − (tag-level collision merges) = this figure. Block prints the exact number.
select count(*) as new_tag_rows,
       count(*) filter (where confirmed) as confirmed_true,
       count(*) filter (where not confirmed) as confirmed_false
from whisky_flavour_tags where category_slug in
  ('cereal_biscuit','green_grassy','orchard_fruit','tropical_citrus','floral_honeyed',
   'buttery_creamy','meaty_sulphury','vanilla_coconut','baking_spice','pepper_tannin',
   'dried_fruit_walnut','treacle_roast','leather_polished_oak','woodsmoke','tar_iodine','brine_shoreline');
