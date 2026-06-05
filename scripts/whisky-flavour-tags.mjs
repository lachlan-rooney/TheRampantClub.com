// Whisky flavour-tagging foundation — Phase 0 (taxonomy + calibration batch).
//
// SINGLE SOURCE OF TRUTH for the SMWS-style flavour taxonomy. This one file:
//   • holds the canonical 12 broad categories + their finer descriptors,
//   • `emit-sql`  → writes db/whisky_flavour_tags.sql (schema + RLS + taxonomy seed),
//   • `tag`       → tags a CALIBRATION SPREAD (rich + thin + empty notes) via the
//                   same model the MIS uses (claude-opus-4-7), reading ONLY the
//                   tasting_notes prose, and writes:
//                     - data/whisky_flavour_calibration.json   (raw results)
//                     - db/whisky_flavour_calibration_tags.sql (INSERTs, confirmed=false)
//                     - docs/whisky_flavour_calibration_report.md (human review report)
//
// TWO SIGNALS, distinct:
//   • CONFIDENCE (0..1) — how sure we are a flavour is PRESENT.
//   • INTENSITY  (1..4) — how STRONG/dominant it is (per broad category). These are
//     the radar/spider-chart spoke lengths. A whisky can be present-but-faint
//     (high confidence, intensity 1) or present-and-intense (high both).
//
// HARD RULE enforced in the prompt: tag ONLY from the prose. No inference from
// name / region / distillery / age. Empty or flavour-less notes → ZERO tags and
// ZERO intensities (an honest sparse radar, never an invented full one).
//
// Usage (env from .env.local):
//   node scripts/whisky-flavour-tags.mjs emit-sql
//   node scripts/whisky-flavour-tags.mjs tag

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'

const MODEL = 'claude-opus-4-7'  // matches the MIS extraction model

// ─── THE TAXONOMY — SMWS-style flavour wheel, two-tier ──────────────────────
export const TAXONOMY = [
  { slug: 'young_spritely', name: 'Young & Spritely', order: 1,
    desc: 'Fresh, vibrant, cereal-led; little cask influence.',
    descriptors: ['cereal', 'grassy', 'green_apple', 'citrus_zest', 'floral', 'fresh_malt'] },
  { slug: 'sweet_fruity_mellow', name: 'Sweet, Fruity & Mellow', order: 2,
    desc: 'Soft orchard/stone fruit, honey and vanilla; rounded and easy.',
    descriptors: ['vanilla', 'honey', 'orchard_fruit', 'caramel', 'stone_fruit', 'toffee'] },
  { slug: 'spicy_sweet', name: 'Spicy & Sweet', order: 3,
    desc: 'Warming baking spice over a sweet base.',
    descriptors: ['cinnamon', 'ginger', 'nutmeg', 'baking_spice', 'clove', 'honeyed_spice'] },
  { slug: 'spicy_dry', name: 'Spicy & Dry', order: 4,
    desc: 'Drying oak spice, pepper, tannin, tobacco/leather.',
    descriptors: ['black_pepper', 'oak_tannin', 'dry_spice', 'tobacco', 'leather', 'char', 'clove'] },
  { slug: 'rich_dried_fruits', name: 'Deep, Rich & Dried Fruits', order: 5,
    desc: 'Classic sherry cask: raisin, fig, dark chocolate, christmas cake.',
    descriptors: ['raisin', 'fig', 'date', 'dark_chocolate', 'christmas_cake', 'walnut', 'dried_fruit'] },
  { slug: 'old_dignified', name: 'Old & Dignified', order: 6,
    desc: 'Mature, polished oak; beeswax, old leather, dried herbs.',
    descriptors: ['polished_oak', 'beeswax', 'old_leather', 'dried_herbs', 'sandalwood', 'antique_wood'] },
  { slug: 'light_delicate', name: 'Light & Delicate', order: 7,
    desc: 'Gentle, floral, light honey and lemon; subtle malt.',
    descriptors: ['floral', 'light_honey', 'lemon', 'hay', 'delicate_malt', 'meadow'] },
  { slug: 'juicy_oak_vanilla', name: 'Juicy, Oak & Vanilla', order: 8,
    desc: 'Bourbon-cask sweetness: vanilla, coconut, toasted oak, custard.',
    descriptors: ['vanilla', 'coconut', 'toasted_oak', 'butterscotch', 'custard', 'banana'] },
  { slug: 'oily_coastal', name: 'Oily & Coastal', order: 9,
    desc: 'Maritime: brine, sea salt, seaweed, oily texture, minerality.',
    descriptors: ['brine', 'sea_salt', 'seaweed', 'oily_texture', 'mineral', 'smoked_fish'] },
  { slug: 'lightly_peated', name: 'Lightly Peated', order: 10,
    desc: 'A gentle wisp of smoke over a non-peaty base.',
    descriptors: ['gentle_smoke', 'soft_peat', 'ember', 'light_bonfire'] },
  { slug: 'peated', name: 'Peated', order: 11,
    desc: 'Clear peat smoke: bonfire, soot, tar, smoked meat, ash.',
    descriptors: ['bonfire_smoke', 'soot', 'tar', 'smoked_meat', 'ash', 'campfire'] },
  { slug: 'heavily_peated', name: 'Heavily Peated', order: 12,
    desc: 'Intense, medicinal peat: iodine, TCP, creosote, kippers.',
    descriptors: ['medicinal', 'iodine', 'tcp', 'creosote', 'intense_smoke', 'kippers'] },
  { slug: 'grain_rye', name: 'Grain & Rye', order: 13,
    desc: 'Grain-whisky and rye character: rye spice, corn, cereal sweetness, raw wood.',
    descriptors: ['rye_spice', 'corn', 'grain', 'sawdust', 'cereal_sweetness'] },
]

const CAT_BY_SLUG = Object.fromEntries(TAXONOMY.map(c => [c.slug, c]))

// ─── SQL emit ───────────────────────────────────────────────────────────────
function sqlStr(s) { return s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'` }

function emitSchemaAndSeed() {
  const L = []
  L.push(`-- ─────────────────────────────────────────────────────────────────────────
-- Whisky flavour tags — FOUNDATION for the (later) recommendation engine + radar.
-- GENERATED by scripts/whisky-flavour-tags.mjs (emit-sql) — taxonomy is the
-- single source of truth in that file; regenerate, don't hand-edit the seed.
--
-- Three tables:
--   flavour_categories      — tier 1, the 12 broad families.
--   flavour_descriptors     — tier 2, finer notes under each family.
--   whisky_flavour_intensities — per-(bottle, broad-category) INTENSITY 1-4 +
--       confidence. These are the radar/spider spoke lengths (absent = spoke 0).
--   whisky_flavour_tags     — per-(bottle, descriptor) fine tags + confidence +
--       evidence. Both tag tables carry a confirmed flag (machine proposes,
--       human ratifies — like the MIS preference-candidate queue).
-- Tags AUGMENT whiskies; existing fields untouched.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists flavour_categories (
  slug        text primary key,
  name        text not null,
  description text,
  sort_order  int  not null default 0
);

create table if not exists flavour_descriptors (
  slug          text primary key,
  category_slug text not null references flavour_categories(slug) on delete cascade,
  name          text not null,
  sort_order    int  not null default 0
);

-- The radar spokes: one row per broad category the PROSE supports, with how
-- strong it is (intensity 1-4) and how sure we are it's present (confidence).
create table if not exists whisky_flavour_intensities (
  id            uuid primary key default gen_random_uuid(),
  whisky_id     uuid not null references whiskies(id) on delete cascade,
  category_slug text not null references flavour_categories(slug),
  intensity     smallint not null check (intensity between 1 and 4),
  confidence    numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  source        text not null default 'llm',
  model         text,
  evidence      text,
  confirmed     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (whisky_id, category_slug)             -- one spoke per category per bottle
);
create index if not exists idx_wfi_whisky    on whisky_flavour_intensities(whisky_id);
create index if not exists idx_wfi_confirmed on whisky_flavour_intensities(confirmed);

-- The fine descriptor tags (tier 2).
create table if not exists whisky_flavour_tags (
  id              uuid primary key default gen_random_uuid(),
  whisky_id       uuid not null references whiskies(id) on delete cascade,
  category_slug   text not null references flavour_categories(slug),
  descriptor_slug text not null references flavour_descriptors(slug),
  confidence      numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  source          text not null default 'llm',
  model           text,
  evidence        text,
  confirmed       boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (whisky_id, category_slug, descriptor_slug)
);
create index if not exists idx_wft_whisky    on whisky_flavour_tags(whisky_id);
create index if not exists idx_wft_confirmed on whisky_flavour_tags(confirmed);
create index if not exists idx_wft_category  on whisky_flavour_tags(category_slug);

-- RLS — mirror whiskies: members read, admins write.
alter table flavour_categories          enable row level security;
alter table flavour_descriptors         enable row level security;
alter table whisky_flavour_intensities  enable row level security;
alter table whisky_flavour_tags         enable row level security;
`)
  for (const t of ['flavour_categories', 'flavour_descriptors', 'whisky_flavour_intensities', 'whisky_flavour_tags']) {
    L.push(`drop policy if exists "read ${t}" on ${t};`)
    L.push(`create policy "read ${t}" on ${t} for select using (auth.uid() is not null);`)
    L.push(`drop policy if exists "admins write ${t}" on ${t};`)
    L.push(`create policy "admins write ${t}" on ${t} for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));`)
  }

  L.push(`\n-- ── Taxonomy seed (generated from TAXONOMY) ──`)
  for (const c of TAXONOMY) {
    L.push(`insert into flavour_categories (slug, name, description, sort_order) values (${sqlStr(c.slug)}, ${sqlStr(c.name)}, ${sqlStr(c.desc)}, ${c.order})\n  on conflict (slug) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;`)
  }
  L.push('')
  for (const c of TAXONOMY) {
    c.descriptors.forEach((d, i) => {
      const name = d.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
      // descriptor slugs are namespaced <descriptor>__<category> — the same word
      // (vanilla, floral) legitimately appears under more than one category.
      L.push(`insert into flavour_descriptors (slug, category_slug, name, sort_order) values (${sqlStr(d + '__' + c.slug)}, ${sqlStr(c.slug)}, ${sqlStr(name)}, ${i})\n  on conflict (slug) do update set category_slug = excluded.category_slug, name = excluded.name, sort_order = excluded.sort_order;`)
    })
  }
  writeFileSync('db/whisky_flavour_tags.sql', L.join('\n') + '\n')
  console.log('wrote db/whisky_flavour_tags.sql')
}

// ─── Calibration tagging ─────────────────────────────────────────────────────
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  })
  if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`)
  return r.json()
}

function vocabForPrompt() {
  return TAXONOMY.map(c =>
    `- ${c.slug} — "${c.name}": ${c.desc}\n    descriptors: ${c.descriptors.join(', ')}`
  ).join('\n')
}

const TOOL = {
  name: 'emit_flavour_profile',
  description: 'Emit the flavour categories (with intensity), descriptors, supported by the tasting notes.',
  input_schema: {
    type: 'object',
    properties: {
      notes_quality: { type: 'string', enum: ['rich', 'thin', 'none'],
        description: 'rich = real flavour prose; thin = a little but sparse; none = no flavour info (empty, or just a region/operational note).' },
      categories: {
        type: 'array',
        description: 'One entry per BROAD category the prose supports — these are the radar spokes. Omit categories the prose does not support.',
        items: {
          type: 'object',
          properties: {
            category_slug: { type: 'string', description: 'One of the taxonomy category slugs.' },
            intensity:     { type: 'integer', description: 'How STRONG/dominant this family is in the prose: 1=faint/a whisper ("a touch of smoke"), 2=clearly present ("smoky"), 3=prominent/a major theme, 4=dominant/intense/defining ("bracing, intensely peaty"). Distinct from confidence.' },
            confidence:    { type: 'number', description: '0..1 — how sure you are this family is PRESENT at all.' },
            evidence:      { type: 'string', description: 'The exact phrase from the notes supporting this family + its intensity.' },
          },
          required: ['category_slug', 'intensity', 'confidence', 'evidence'],
        },
      },
      descriptors: {
        type: 'array',
        description: 'Finer descriptor tags. Each must sit under a category you listed above.',
        items: {
          type: 'object',
          properties: {
            category_slug:   { type: 'string' },
            descriptor_slug: { type: 'string', description: 'A descriptor under that category (bare word, e.g. "vanilla").' },
            confidence:      { type: 'number', description: '0..1 — how explicitly the prose supports this descriptor.' },
            evidence:        { type: 'string', description: 'The exact phrase from the notes.' },
          },
          required: ['category_slug', 'descriptor_slug', 'confidence', 'evidence'],
        },
      },
      comment: { type: 'string', description: 'One short line: how confident/shaky, or any taxonomy gap hit.' },
    },
    required: ['notes_quality', 'categories', 'descriptors', 'comment'],
  },
}

function systemPrompt() {
  return `You build whisky flavour profiles for The Rampant Club, against a FIXED two-tier taxonomy.

CONTROLLED VOCABULARY (tag ONLY against these — never invent a category or descriptor):
${vocabForPrompt()}

You emit two things, from the PROSE ONLY:
  • categories: each broad family the prose supports, with an INTENSITY (1-4) and a CONFIDENCE (0..1).
  • descriptors: finer notes, each under one of those categories, with a confidence.

INTENSITY vs CONFIDENCE — keep them distinct:
  • CONFIDENCE = how SURE you are the flavour is present. ("definitely there")
  • INTENSITY  = how STRONG/dominant it is. 1 = faint/a whisper ("a touch of smoke", "light peat");
    2 = clearly present ("smoky"); 3 = prominent, a major theme; 4 = dominant/intense/defining
    ("bracing, intensely peaty", "massive sherry bomb"). A flavour can be high-confidence but low-
    intensity (clearly there, but faint). Read the intensity from the prose's own strength words.

ABSOLUTE RULES:
1. Tag ONLY flavours explicitly present in the TASTING NOTES prose. Every category and descriptor needs an "evidence" phrase taken from those notes.
2. NEVER infer flavour, or intensity, from the whisky's name, distillery, region, or age. "It's an Islay so probably peaty" is FORBIDDEN — fabricated data. The name is given only so you know what you're reading; it is NOT a source of tags or intensity.
3. If the notes are empty, or carry no flavour information (e.g. just "Ireland", or an operational note like "broken while sorting"), return notes_quality "none" with EMPTY categories AND empty descriptors. A sparse/empty radar is the honest answer — never pad it.
4. A bottle may carry several categories (several spokes) and several descriptors. Every descriptor's category_slug must also appear in your categories list (so the radar has that spoke).
5. descriptor_slug must belong to the category_slug you pair it with. Use the bare descriptor word.
6. Be honest with both numbers — low confidence and low intensity are useful signals, not failures.`
}

async function tagOne(anthropic, w) {
  const userText = `WHISKY NAME (reference only — do NOT tag from this): ${w.name}\n\nTASTING NOTES (tag ONLY from this prose):\n"""\n${(w.tasting_notes || '').trim() || '(no notes)'}\n"""`
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt(),
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'emit_flavour_profile' },
    messages: [{ role: 'user', content: userText }],
  })
  const tool = msg.content.find(c => c.type === 'tool_use')
  if (!tool) throw new Error('no tool_use in response')
  return tool.input
}

function pickCalibration(all) {
  const len = w => (w.tasting_notes || '').trim().length
  const byName = (a, b) => a.name.localeCompare(b.name)
  const rich = all.filter(w => len(w) >= 180).sort(byName)
  const thin = all.filter(w => len(w) > 0 && len(w) < 180).sort(byName)
  const empty = all.filter(w => len(w) === 0).sort(byName)

  const want = 24
  const stride = Math.max(1, Math.floor(rich.length / want))
  const richPick = []
  for (let i = 0; i < rich.length && richPick.length < want; i += stride) richPick.push(rich[i])
  const peatRe = /(peat|smoke|smoky|iodine|medicinal|brine|seaweed|maritime|coastal|tar|bonfire)/i
  for (const w of rich) {
    if (richPick.length >= want + 4) break
    if (peatRe.test(w.tasting_notes) && !richPick.includes(w)) richPick.push(w)
  }
  const thinPick  = thin.slice(0, 8)
  const emptyPick = empty.filter((_, i) => i % Math.max(1, Math.floor(empty.length / 8)) === 0).slice(0, 8)
  return { richPick, thinPick, emptyPick }
}

async function runTagging() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
  if (!SB_URL || !SB_KEY) throw new Error('Supabase env not set')
  const anthropic = new Anthropic({ apiKey })

  const all = await sb('whiskies?select=id,name,region,age,tasting_notes&order=name')
  const { richPick, thinPick, emptyPick } = pickCalibration(all)
  const batch = [
    ...richPick.map(w => ({ ...w, bucket: 'rich' })),
    ...thinPick.map(w => ({ ...w, bucket: 'thin' })),
    ...emptyPick.map(w => ({ ...w, bucket: 'empty' })),
  ]
  console.log(`calibration batch: ${batch.length} (rich ${richPick.length}, thin ${thinPick.length}, empty ${emptyPick.length})`)

  const results = []
  for (const w of batch) {
    let out, err = null
    for (let attempt = 0; attempt < 2 && !out; attempt++) {
      try { out = await tagOne(anthropic, w) }
      catch (e) { err = e.message; await new Promise(r => setTimeout(r, 800)) }
    }
    if (!out) { console.log(`  ✗ ${w.name.slice(0,40)} — ${err}`); results.push({ id: w.id, name: w.name, region: w.region, age: w.age, bucket: w.bucket, tasting_notes: w.tasting_notes || '', error: err, categories: [], descriptors: [] }); continue }

    const v = validate(out, w)
    for (const d of v.descriptors) d.disposition = disposition(d.confidence)
    results.push({ id: w.id, name: w.name, region: w.region, age: w.age, bucket: w.bucket,
                   tasting_notes: w.tasting_notes || '', notes_quality: out.notes_quality,
                   comment: out.comment, ...v })
    console.log(`  ✓ ${w.bucket.padEnd(5)} ${w.name.slice(0,40).padEnd(40)} → ${v.categories.length} cats / ${v.descriptors.length} desc (${out.notes_quality})`)
  }

  writeFileSync('data/whisky_flavour_calibration.json', JSON.stringify(results, null, 2) + '\n')
  writeTagsSql(results, 'db/whisky_flavour_calibration_tags.sql', false)
  writeReport(results)
  console.log('\nwrote data/whisky_flavour_calibration.json, db/whisky_flavour_calibration_tags.sql, docs/whisky_flavour_calibration_report.md')
}

const clamp01 = n => Math.round(Math.max(0, Math.min(1, Number(n) || 0)) * 100) / 100
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Validate a model response against the controlled vocabulary.
function validate(out, w) {
  const cats = [], descs = [], rejected = []
  for (const c of (out.categories || [])) {
    if (!CAT_BY_SLUG[c.category_slug]) { rejected.push({ kind: 'category', ...c, why: 'unknown category' }); continue }
    cats.push({ category_slug: c.category_slug, intensity: Math.max(1, Math.min(4, Math.round(c.intensity))),
                confidence: clamp01(c.confidence), evidence: c.evidence })
  }
  for (const d of (out.descriptors || [])) {
    const cat = CAT_BY_SLUG[d.category_slug]
    if (!cat) { rejected.push({ kind: 'descriptor', ...d, why: 'unknown category' }); continue }
    if (!cat.descriptors.includes(d.descriptor_slug)) { rejected.push({ kind: 'descriptor', ...d, why: 'descriptor not in category' }); continue }
    descs.push({ category_slug: d.category_slug, descriptor_slug: d.descriptor_slug, confidence: clamp01(d.confidence), evidence: d.evidence })
  }
  return { categories: cats, descriptors: descs, rejected }
}

// Phase-1 density/trust rule (DESCRIPTORS only):
//   ≥0.70 → trusted (confirmed=true)   0.60-0.70 → review queue (confirmed=false)   <0.60 → dropped
function disposition(conf) { return conf >= 0.7 ? 'trusted' : conf >= 0.6 ? 'review' : 'dropped' }

// Generic SQL writer. density=false (calibration) → everything confirmed=false,
// nothing dropped. density=true (full run) → intensities confirmed=true; dropped
// descriptors skipped; trusted descriptors confirmed=true; review left false.
function writeTagsSql(results, path, density) {
  const L = []
  let ni = 0, nt = 0
  for (const r of results) {
    const keep = (r.descriptors || []).filter(d => !density || disposition(d.confidence) !== 'dropped')
    if (!r.categories?.length && !keep.length) continue
    L.push(`-- ${r.name.replace(/\n/g, ' ')}  [${r.bucket}]`)
    for (const c of (r.categories || [])) {
      const confirmed = density ? 'true' : 'false'
      L.push(`insert into whisky_flavour_intensities (whisky_id, category_slug, intensity, confidence, source, model, evidence, confirmed) values (${sqlStr(r.id)}, ${sqlStr(c.category_slug)}, ${c.intensity}, ${c.confidence}, 'llm', ${sqlStr(MODEL)}, ${sqlStr((c.evidence||'').slice(0,300))}, ${confirmed})\n  on conflict (whisky_id, category_slug) do update set intensity = excluded.intensity, confidence = excluded.confidence, evidence = excluded.evidence, confirmed = excluded.confirmed;`)
      ni++
    }
    for (const d of keep) {
      const confirmed = density ? (disposition(d.confidence) === 'trusted' ? 'true' : 'false') : 'false'
      L.push(`insert into whisky_flavour_tags (whisky_id, category_slug, descriptor_slug, confidence, source, model, evidence, confirmed) values (${sqlStr(r.id)}, ${sqlStr(d.category_slug)}, ${sqlStr(d.descriptor_slug + '__' + d.category_slug)}, ${d.confidence}, 'llm', ${sqlStr(MODEL)}, ${sqlStr((d.evidence||'').slice(0,300))}, ${confirmed})\n  on conflict (whisky_id, category_slug, descriptor_slug) do update set confidence = excluded.confidence, evidence = excluded.evidence, confirmed = excluded.confirmed;`)
      nt++
    }
  }
  const tag = density ? 'FULL run (Phase 1)' : 'Calibration (Phase 0)'
  L.unshift(`-- ${ni} intensity spokes + ${nt} descriptor tags across ${results.filter(r=>r.categories?.length||r.descriptors?.length).length} bottles.`)
  L.unshift(`-- ${tag} flavour data. ${density ? 'Density rule applied: <0.6 dropped; ≥0.7 confirmed=true (trusted); 0.6-0.7 confirmed=false (review queue). Intensity spokes confirmed=true.' : 'Nothing auto-trusted (confirmed=false).'}
-- GENERATED by scripts/whisky-flavour-tags.mjs. Run db/whisky_flavour_tags.sql FIRST.`)
  writeFileSync(path, L.join('\n') + '\n')
}

// Bounded-concurrency map.
async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx) } }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return out
}

// FULL RUN — tag every bottle, apply the density/trust rule on write.
async function runAll() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
  if (!SB_URL || !SB_KEY) throw new Error('Supabase env not set')
  const anthropic = new Anthropic({ apiKey })
  const all = await sb('whiskies?select=id,name,region,age,tasting_notes&order=name')
  const len = w => (w.tasting_notes || '').trim().length
  const bucketOf = w => len(w) >= 180 ? 'rich' : len(w) > 0 ? 'thin' : 'empty'

  // RESUME: reuse any prior successful (error-free) tag so a re-run after a
  // quota reset only spends API on the bottles still missing.
  const prior = existsSync('data/whisky_flavour_full.json')
    ? JSON.parse(readFileSync('data/whisky_flavour_full.json', 'utf8')) : []
  const doneById = new Map(prior.filter(r => !r.error).map(r => [r.id, r]))
  const todo = all.filter(w => !doneById.has(w.id))
  console.log(`full run: ${all.length} bottles — ${doneById.size} already done, ${todo.length} to tag (concurrency 6)`)

  let done = 0
  const fresh = await pool(todo, 6, async (w) => {
    let out, err = null
    for (let a = 0; a < 3 && !out; a++) {
      try { out = await tagOne(anthropic, w) }
      catch (e) { err = e.message; if (/usage limit/i.test(err)) return { id: w.id, name: w.name, region: w.region, age: w.age, bucket: bucketOf(w), tasting_notes: w.tasting_notes || '', error: err, categories: [], descriptors: [] }; await sleep(1200) }
    }
    const bucket = bucketOf(w)
    done++; if (done % 25 === 0) console.log(`  …${done}/${todo.length}`)
    if (!out) return { id: w.id, name: w.name, region: w.region, age: w.age, bucket, tasting_notes: w.tasting_notes || '', error: err, categories: [], descriptors: [] }
    const v = validate(out, w)
    for (const d of v.descriptors) d.disposition = disposition(d.confidence)
    return { id: w.id, name: w.name, region: w.region, age: w.age, bucket, tasting_notes: w.tasting_notes || '', notes_quality: out.notes_quality, comment: out.comment, ...v }
  })
  // merge prior-done + fresh, in catalogue order
  const merged = new Map([...doneById, ...fresh.map(r => [r.id, r])])
  const results = all.map(w => merged.get(w.id)).filter(Boolean)
  writeFileSync('data/whisky_flavour_full.json', JSON.stringify(results, null, 2) + '\n')
  writeTagsSql(results, 'db/whisky_flavour_full_tags.sql', true)
  printVerify(results)
}

// LOAD — push the verified full-run tags into the DB via PostgREST (upsert),
// applying the density rule. Reads data/whisky_flavour_full.json.
async function sbWrite(table, conflict, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const r = await fetch(`${SB_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json',
                 Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    })
    if (!r.ok) throw new Error(`${table} ${r.status}: ${await r.text()}`)
  }
}

async function runLoad() {
  if (!SB_URL || !SB_KEY) throw new Error('Supabase env not set')
  const results = JSON.parse(readFileSync('data/whisky_flavour_full.json', 'utf8'))
  const intensities = [], tags = []
  for (const r of results) {
    if (r.error) continue
    for (const c of (r.categories || [])) {
      intensities.push({ whisky_id: r.id, category_slug: c.category_slug, intensity: c.intensity,
        confidence: c.confidence, source: 'llm', model: MODEL, evidence: (c.evidence||'').slice(0,300), confirmed: true })
    }
    for (const d of (r.descriptors || [])) {
      if (disposition(d.confidence) === 'dropped') continue
      tags.push({ whisky_id: r.id, category_slug: d.category_slug, descriptor_slug: d.descriptor_slug + '__' + d.category_slug,
        confidence: d.confidence, source: 'llm', model: MODEL, evidence: (d.evidence||'').slice(0,300),
        confirmed: disposition(d.confidence) === 'trusted' })
    }
  }
  // Dedupe by the conflict key (model can emit a descriptor twice with two
  // evidence phrases) — keep the highest-confidence instance.
  const dedupe = (rows, keyFn) => {
    const m = new Map()
    for (const r of rows) { const k = keyFn(r); const p = m.get(k); if (!p || r.confidence > p.confidence) m.set(k, r) }
    return [...m.values()]
  }
  const ints = dedupe(intensities, r => `${r.whisky_id}|${r.category_slug}`)
  const tgs  = dedupe(tags, r => `${r.whisky_id}|${r.category_slug}|${r.descriptor_slug}`)
  console.log(`loading ${ints.length} intensity spokes + ${tgs.length} descriptor tags (deduped from ${intensities.length}/${tags.length})…`)
  await sbWrite('whisky_flavour_intensities', 'whisky_id,category_slug', ints)
  await sbWrite('whisky_flavour_tags', 'whisky_id,category_slug,descriptor_slug', tgs)
  console.log('done.')
}

// Part-A honesty gate — stats + no-hallucination spot-check, to stdout.
function printVerify(results) {
  const by = b => results.filter(r => r.bucket === b)
  const errs = results.filter(r => r.error)
  const allCats = results.flatMap(r => r.categories || [])
  const allDesc = results.flatMap(r => r.descriptors || [])
  const disp = { trusted: 0, review: 0, dropped: 0 }
  allDesc.forEach(d => disp[disposition(d.confidence)]++)
  const intHist = [0,0,0,0,0]; allCats.forEach(c => intHist[c.intensity]++)
  // VIOLATIONS: empty/thin bottles that got any spoke
  const halluc = results.filter(r => r.bucket !== 'rich' && (r.categories?.length))
  const grainHits = results.filter(r => (r.categories||[]).some(c => c.category_slug === 'grain_rye'))
  const P = console.log
  P(`\n──────── PART A — full-run verification ────────`)
  P(`bottles: ${results.length}  (rich ${by('rich').length} / thin ${by('thin').length} / empty ${by('empty').length})  errors ${errs.length}`)
  P(`rich tagged: ${by('rich').filter(r=>r.categories?.length).length}/${by('rich').length}`)
  P(`thin tagged: ${by('thin').filter(r=>r.categories?.length).length}/${by('thin').length}   empty tagged: ${by('empty').filter(r=>r.categories?.length).length}/${by('empty').length}  (both should be ~0)`)
  P(`spokes: ${allCats.length}   intensity 1/2/3/4 = ${intHist[1]}/${intHist[2]}/${intHist[3]}/${intHist[4]}`)
  P(`descriptors (pre-trim): ${allDesc.length}  → trusted(≥0.7) ${disp.trusted} / review(0.6-0.7) ${disp.review} / dropped(<0.6) ${disp.dropped}`)
  P(`HALLUCINATION CHECK — empty/thin bottles with spokes: ${halluc.length}${halluc.length?'  ⚠ '+halluc.map(h=>h.name.slice(0,30)).join(', '):'  ✓'}`)
  P(`GRAIN & RYE hits: ${grainHits.length} bottles — ${grainHits.slice(0,12).map(g=>g.name.slice(0,28)).join(' · ')}`)
  if (errs.length) P(`ERRORS: ${errs.map(e=>e.name.slice(0,30)+' ('+e.error+')').join(' | ')}`)
}

// Compact radar print: 12 spokes, intensity 0-4 as a bar.
function radarLines(cats) {
  const byCat = Object.fromEntries(cats.map(c => [c.category_slug, c]))
  return TAXONOMY.map(c => {
    const hit = byCat[c.slug]
    const n = hit ? hit.intensity : 0
    const bar = '█'.repeat(n) + '·'.repeat(4 - n)
    return `  ${c.name.padEnd(26)} ${bar} ${n}${hit ? `  (conf ${hit.confidence.toFixed(2)})` : ''}`
  }).join('\n')
}

function writeReport(results) {
  const byBucket = b => results.filter(r => r.bucket === b)
  const richTagged = byBucket('rich').filter(r => r.categories?.length).length
  const thinTagged = byBucket('thin').filter(r => r.categories?.length).length
  const emptyTagged = byBucket('empty').filter(r => r.categories?.length).length
  const allCats = results.flatMap(r => r.categories || [])
  const allDesc = results.flatMap(r => r.descriptors || [])
  const avgConf = allDesc.length ? (allDesc.reduce((s,t)=>s+t.confidence,0)/allDesc.length) : 0
  const rejected = results.flatMap(r => (r.rejected||[]).map(x => ({ name: r.name, ...x })))
  const intHist = [0,0,0,0,0]; allCats.forEach(c => intHist[c.intensity]++)

  const L = []
  L.push(`# Whisky flavour-tagging — Phase 0 calibration report\n`)
  L.push(`Model: \`${MODEL}\` · taxonomy: SMWS-style two-tier (12 categories) · two signals: **confidence** (present?) + **intensity 1-4** (how strong — the radar spokes) · all rows \`confirmed=false\`.\n`)
  L.push(`## Summary`)
  L.push(`- Calibration batch: **${results.length}** bottles — rich ${byBucket('rich').length}, thin ${byBucket('thin').length}, empty ${byBucket('empty').length}.`)
  L.push(`- **Rich** notes that produced a radar: **${richTagged}/${byBucket('rich').length}**.`)
  L.push(`- **Thin** notes that produced a radar: **${thinTagged}/${byBucket('thin').length}** (expect ~0).`)
  L.push(`- **Empty** notes that produced a radar: **${emptyTagged}/${byBucket('empty').length}** (MUST be 0 — any spoke here = hallucination).`)
  L.push(`- **${allCats.length}** category spokes + **${allDesc.length}** descriptor tags. Descriptor avg confidence **${avgConf.toFixed(2)}**.`)
  L.push(`- Intensity spread (spokes at each level): 1=${intHist[1]}, 2=${intHist[2]}, 3=${intHist[3]}, 4=${intHist[4]}.`)
  L.push(`- Off-taxonomy attempts rejected by the validator: **${rejected.length}**.\n`)
  if (rejected.length) { L.push(`### ⚠ Off-taxonomy attempts (rejected, not written):`); for (const x of rejected) L.push(`- ${x.name}: \`${x.category_slug}/${x.descriptor_slug||''}\` — ${x.why}`); L.push('') }

  for (const bucket of ['rich', 'thin', 'empty']) {
    L.push(`\n## ${bucket.toUpperCase()} notes\n`)
    for (const r of byBucket(bucket)) {
      L.push(`### ${r.name}`)
      L.push(`*${r.region || '—'}${r.age ? ' · ' + r.age : ''} · notes "${r.notes_quality || (r.error ? 'ERROR' : '—')}"*`)
      if (r.error) L.push(`> ⚠ error: ${r.error}`)
      L.push(`\n> **Notes:** ${r.tasting_notes ? r.tasting_notes.replace(/\n/g,' ') : '_(none)_'}\n`)
      if (!r.categories?.length) {
        L.push(`**Radar:** _empty_${bucket!=='rich' ? ' ✓ (correctly no hallucination)' : ''}\n`)
      } else {
        L.push('**Radar (intensity 0-4 per family):**\n```')
        L.push(radarLines(r.categories))
        L.push('```')
        if (r.descriptors?.length) {
          L.push(`**Descriptors:**`)
          for (const d of r.descriptors) L.push(`- ${CAT_BY_SLUG[d.category_slug]?.name || d.category_slug} › ${d.descriptor_slug} — \`${d.confidence.toFixed(2)}\` · _“${d.evidence}”_`)
        }
        L.push('')
      }
      if (r.comment) L.push(`_model note: ${r.comment}_\n`)
    }
  }
  writeFileSync('docs/whisky_flavour_calibration_report.md', L.join('\n') + '\n')
}

// ─── main ────────────────────────────────────────────────────────────────────
const cmd = process.argv[2]
if (cmd === 'emit-sql') emitSchemaAndSeed()
else if (cmd === 'tag') runTagging().catch(e => { console.error(e); process.exit(1) })
else if (cmd === 'tag-all') runAll().catch(e => { console.error(e); process.exit(1) })
else if (cmd === 'load') runLoad().catch(e => { console.error(e); process.exit(1) })
else { console.error('usage: node scripts/whisky-flavour-tags.mjs [emit-sql|tag|tag-all|load]'); process.exit(1) }
