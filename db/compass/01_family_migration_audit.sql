-- ══════════════════════════════════════════════════════════════════════════
-- COMPASS MIGRATION · PART B · BLOCK 1 — audit table + routing table seed
-- Flavour Compass 16 migration. Run in the Supabase SQL editor, in order.
-- This block creates NOTHING destructive — an audit table recording the
-- old-13 → new-16 routing so every later step is traceable line by line.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists flavour_family_migration (
  id         bigint generated always as identity primary key,
  old_slug   text not null,
  new_slug   text not null,
  rule       text not null,            -- deterministic | split_evidence | additive_evidence
  note       text,
  created_at timestamptz not null default now()
);

-- Idempotent: clear any prior seed, re-insert the canonical routing table.
truncate flavour_family_migration restart identity;

insert into flavour_family_migration (old_slug, new_slug, rule, note) values
  -- ── deterministic 1:1 primaries (carry intensity/confidence/source/model/evidence; PRESERVE confirmed)
  ('young_spritely',     'green_grassy',        'deterministic', null),
  ('sweet_fruity_mellow','orchard_fruit',       'deterministic', null),
  ('spicy_sweet',        'baking_spice',        'deterministic', null),
  ('spicy_dry',          'pepper_tannin',       'deterministic', null),
  ('old_dignified',      'leather_polished_oak','deterministic', null),
  ('juicy_oak_vanilla',  'vanilla_coconut',     'deterministic', null),
  ('oily_coastal',       'brine_shoreline',     'deterministic', null),
  ('lightly_peated',     'woodsmoke',           'deterministic', null),
  ('rich_dried_fruits',  'dried_fruit_walnut',  'deterministic', null),
  ('grain_rye',          'cereal_biscuit',      'deterministic', null),
  -- ── evidence-routed SPLITS (route to ONE primary by evidence keyword; confirmed=false, re-queue)
  ('peated',         'tar_iodine',     'split_evidence', 'if evidence ~ iodine|tcp|medicin|tar|creosote|antiseptic'),
  ('peated',         'woodsmoke',      'split_evidence', 'else'),
  ('heavily_peated', 'woodsmoke',      'split_evidence', 'only if evidence ~ bonfire|ash|soot|ember|campfire AND NOT medicinal'),
  ('heavily_peated', 'tar_iodine',     'split_evidence', 'else'),
  ('light_delicate', 'tropical_citrus','split_evidence', 'if evidence ~ citrus|lemon|orange|zest'),
  ('light_delicate', 'green_grassy',   'split_evidence', 'elif evidence ~ grass|hay|leaf'),
  ('light_delicate', 'floral_honeyed', 'split_evidence', 'else'),
  -- ── ADDITIVE secondary rows (extra spoke at min(intensity,2); confirmed=false, re-queue)
  ('grain_rye',        'pepper_tannin','additive_evidence', 'where evidence ~ rye|pepper; intensity = least(orig,2)'),
  ('rich_dried_fruits','treacle_roast','additive_evidence', 'where evidence ~ chocolate|treacle|coffee|toffee|mocha; intensity = least(orig,2)');

-- ── VERIFICATION ──────────────────────────────────────────────────────────
-- EXPECTED: 19 rows total — 10 deterministic, 7 split_evidence, 2 additive_evidence.
select rule, count(*) from flavour_family_migration group by rule order by rule;
-- deterministic=10 · split_evidence=7 · additive_evidence=2  (total 19)
