-- ══════════════════════════════════════════════════════════════════════════
-- COMPASS MIGRATION · ROUTING RECORD (archival snapshot)
-- ══════════════════════════════════════════════════════════════════════════
-- A dated, version-controlled export of the flavour_family_migration audit
-- table: the exact old-13 → Compass-16 routing applied during the migration.
-- Kept alongside db/compass/01-06 as the documented re-derivation-from-source
-- record (independent-creation evidence). Re-runnable to restore the table.
-- Rows: 19. Migration recorded: 2026-08-28. Snapshot committed with the repo.

create table if not exists flavour_family_migration (
  id         bigint generated always as identity primary key,
  old_slug   text not null, new_slug text not null, rule text not null,
  note       text, created_at timestamptz not null default now()
);

-- Idempotent: clear before re-inserting so re-running this snapshot restores
-- exactly these 19 rows rather than appending duplicates.
truncate flavour_family_migration restart identity;

insert into flavour_family_migration (old_slug, new_slug, rule, note) values
  ('young_spritely', 'green_grassy', 'deterministic', null),
  ('sweet_fruity_mellow', 'orchard_fruit', 'deterministic', null),
  ('spicy_sweet', 'baking_spice', 'deterministic', null),
  ('spicy_dry', 'pepper_tannin', 'deterministic', null),
  ('old_dignified', 'leather_polished_oak', 'deterministic', null),
  ('juicy_oak_vanilla', 'vanilla_coconut', 'deterministic', null),
  ('oily_coastal', 'brine_shoreline', 'deterministic', null),
  ('lightly_peated', 'woodsmoke', 'deterministic', null),
  ('rich_dried_fruits', 'dried_fruit_walnut', 'deterministic', null),
  ('grain_rye', 'cereal_biscuit', 'deterministic', null),
  ('peated', 'tar_iodine', 'split_evidence', 'if evidence ~ iodine|tcp|medicin|tar|creosote|antiseptic'),
  ('peated', 'woodsmoke', 'split_evidence', 'else'),
  ('heavily_peated', 'woodsmoke', 'split_evidence', 'only if evidence ~ bonfire|ash|soot|ember|campfire AND NOT medicinal'),
  ('heavily_peated', 'tar_iodine', 'split_evidence', 'else'),
  ('light_delicate', 'tropical_citrus', 'split_evidence', 'if evidence ~ citrus|lemon|orange|zest'),
  ('light_delicate', 'green_grassy', 'split_evidence', 'elif evidence ~ grass|hay|leaf'),
  ('light_delicate', 'floral_honeyed', 'split_evidence', 'else'),
  ('grain_rye', 'pepper_tannin', 'additive_evidence', 'where evidence ~ rye|pepper; intensity = least(orig,2)'),
  ('rich_dried_fruits', 'treacle_roast', 'additive_evidence', 'where evidence ~ chocolate|treacle|coffee|toffee|mocha; intensity = least(orig,2)');
