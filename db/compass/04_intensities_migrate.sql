-- ══════════════════════════════════════════════════════════════════════════
-- COMPASS MIGRATION · PART B · BLOCK 4 — migrate whisky_flavour_intensities
-- Builds new-slug intensity rows from the old rows per the routing table.
-- COLLISION-SAFE: several old families collapse onto one new family
-- (green_grassy ← young_spritely + light_delicate; woodsmoke ← lightly_peated
-- + peated + heavily_peated; pepper_tannin ← spicy_dry + grain_rye). Rows are
-- MERGED per (whisky, new family): intensity = max, and a merged row is
-- confirmed ONLY if EVERY contributor was a deterministic route — any split or
-- additive contribution re-queues it (ratification doesn't survive a re-read).
-- NO old rows are touched here; cutover deletion is Part E.
-- ══════════════════════════════════════════════════════════════════════════

-- Idempotent: clear any prior run of NEW-slug rows only (never the old 13).
delete from whisky_flavour_intensities where category_slug in
  ('cereal_biscuit','green_grassy','orchard_fruit','tropical_citrus','floral_honeyed',
   'buttery_creamy','meaty_sulphury','vanilla_coconut','baking_spice','pepper_tannin',
   'dried_fruit_walnut','treacle_roast','leather_polished_oak','woodsmoke','tar_iodine','brine_shoreline');

with src as (
  select whisky_id, category_slug, intensity, confidence, source, model,
         evidence, confirmed, lower(coalesce(evidence,'')) as ev,
         (coalesce(trim(evidence),'') <> '') as has_ev
  from whisky_flavour_intensities
  where category_slug in ('young_spritely','sweet_fruity_mellow','spicy_sweet','spicy_dry',
    'old_dignified','juicy_oak_vanilla','oily_coastal','lightly_peated','rich_dried_fruits',
    'grain_rye','peated','heavily_peated','light_delicate')
),
routed as (
  -- deterministic primaries — carry intensity/confidence/source/model/evidence; is_det = confirmed
  select whisky_id,
    case category_slug
      when 'young_spritely' then 'green_grassy'      when 'sweet_fruity_mellow' then 'orchard_fruit'
      when 'spicy_sweet' then 'baking_spice'          when 'spicy_dry' then 'pepper_tannin'
      when 'old_dignified' then 'leather_polished_oak' when 'juicy_oak_vanilla' then 'vanilla_coconut'
      when 'oily_coastal' then 'brine_shoreline'      when 'lightly_peated' then 'woodsmoke'
      when 'rich_dried_fruits' then 'dried_fruit_walnut' when 'grain_rye' then 'cereal_biscuit'
    end as new_slug,
    intensity, confidence, source, model, evidence, confirmed as is_det
  from src where category_slug in ('young_spritely','sweet_fruity_mellow','spicy_sweet','spicy_dry',
    'old_dignified','juicy_oak_vanilla','oily_coastal','lightly_peated','rich_dried_fruits','grain_rye')

  union all  -- peated split (drop empty-evidence → unrouted, re-tag in Part D)
  select whisky_id, case when ev ~ 'iodine|tcp|medicin|tar|creosote|antiseptic' then 'tar_iodine' else 'woodsmoke' end,
    intensity, confidence, source, model, evidence, false from src where category_slug='peated' and has_ev

  union all  -- heavily_peated split
  select whisky_id, case when ev ~ 'bonfire|ash|soot|ember|campfire' and ev !~ 'iodine|tcp|medicin|tar|creosote|antiseptic'
      then 'woodsmoke' else 'tar_iodine' end,
    intensity, confidence, source, model, evidence, false from src where category_slug='heavily_peated' and has_ev

  union all  -- light_delicate split
  select whisky_id, case when ev ~ 'citrus|lemon|orange|zest' then 'tropical_citrus'
      when ev ~ 'grass|hay|leaf' then 'green_grassy' else 'floral_honeyed' end,
    intensity, confidence, source, model, evidence, false from src where category_slug='light_delicate' and has_ev

  union all  -- ADDITIVE: grain_rye → pepper_tannin @ min(intensity,2)
  select whisky_id, 'pepper_tannin', least(intensity,2), confidence, source, model, evidence, false
    from src where category_slug='grain_rye' and ev ~ 'rye|pepper'

  union all  -- ADDITIVE: rich_dried_fruits → treacle_roast @ min(intensity,2)
  select whisky_id, 'treacle_roast', least(intensity,2), confidence, source, model, evidence, false
    from src where category_slug='rich_dried_fruits' and ev ~ 'chocolate|treacle|coffee|toffee|mocha'
)
insert into whisky_flavour_intensities (whisky_id, category_slug, intensity, confidence, source, model, evidence, confirmed)
select whisky_id, new_slug,
       max(intensity)::smallint,
       max(confidence),
       'llm',
       max(model),
       nullif(string_agg(distinct evidence, ' | '), ''),
       bool_and(is_det)
from routed
where new_slug is not null
group by whisky_id, new_slug;

-- ── VERIFICATION ──────────────────────────────────────────────────────────
-- (1) Unrouted split rows (empty evidence) — EXPECTED: 0.
select count(*) as unrouted_empty_evidence from whisky_flavour_intensities
  where category_slug in ('peated','heavily_peated','light_delicate') and coalesce(trim(evidence),'')='';

-- (2) Totals. EXPECTED: new_total=1604, confirmed=1397, unconfirmed=207.
select count(*) filter (where true) as new_total,
       count(*) filter (where confirmed) as confirmed_true,
       count(*) filter (where not confirmed) as confirmed_false
from whisky_flavour_intensities where category_slug in
  ('cereal_biscuit','green_grassy','orchard_fruit','tropical_citrus','floral_honeyed',
   'buttery_creamy','meaty_sulphury','vanilla_coconut','baking_spice','pepper_tannin',
   'dried_fruit_walnut','treacle_roast','leather_polished_oak','woodsmoke','tar_iodine','brine_shoreline');

-- (3) Per-family breakdown. EXPECTED (total / confirmed / unconfirmed):
--   orchard_fruit 281/281/0 · baking_spice 221/221/0 · vanilla_coconut 206/206/0
--   dried_fruit_walnut 188/188/0 · pepper_tannin 176/172/4 · brine_shoreline 121/121/0
--   green_grassy 96/92/4 · treacle_roast 87/0/87 · woodsmoke 71/41/30 · floral_honeyed 45/0/45
--   leather_polished_oak 45/45/0 · cereal_biscuit 30/30/0 · tropical_citrus 26/0/26 · tar_iodine 11/0/11
--   (buttery_creamy 0, meaty_sulphury 0 — sparse by design)
select category_slug, count(*) total,
       count(*) filter (where confirmed) confirmed, count(*) filter (where not confirmed) queued
from whisky_flavour_intensities where category_slug in
  ('cereal_biscuit','green_grassy','orchard_fruit','tropical_citrus','floral_honeyed',
   'buttery_creamy','meaty_sulphury','vanilla_coconut','baking_spice','pepper_tannin',
   'dried_fruit_walnut','treacle_roast','leather_polished_oak','woodsmoke','tar_iodine','brine_shoreline')
group by category_slug order by total desc;

-- Arithmetic: 1525 originals + 91 additive = 1616 contributions − 12 collision-merges = 1604.
-- Review queue (confirmed=false) = 207. Old-13 rows remain until Part E.
