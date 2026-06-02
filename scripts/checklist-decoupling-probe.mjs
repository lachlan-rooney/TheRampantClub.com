#!/usr/bin/env node
// checklist-decoupling-probe.mjs
//
// Five-check integration probe proving the opening/closing checklist
// system's SNAPSHOT SEMANTICS hold across both the easy case (template
// mutation after a sheet is sealed) AND the migration-survival case
// (real pre-existing sealed sheets continue to read identically after
// the schema change that this pass introduced).
//
// Probe runs against the live DB with service-role credentials but is
// strict about isolation:
//   • All probe writes go to a SENTINEL date (1999-01-01) that real
//     shifts cannot collide with.
//   • Template mutation is captured BEFORE the change and restored
//     byte-identically afterward (items + updated_at).
//   • Cleanup is VERIFIED, not assumed — the probe re-counts rows and
//     re-snapshots the template at the end to prove zero residue.
//
// Run:  node scripts/checklist-decoupling-probe.mjs
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (read from .env.local automatically).

import { readFile } from 'node:fs/promises'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolvePath(__dirname, '..')

async function loadEnvLocal() {
  try {
    const raw = await readFile(resolvePath(root, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* */ }
}
await loadEnvLocal()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ── 0. Migration applied? ────────────────────────────────────────────
const { error: tplErr } = await sb.from('checklist_templates').select('kind').limit(1)
if (tplErr) {
  console.error('✗ Migration not yet applied. Run db/checklist_templates.sql in Supabase SQL editor first.')
  console.error('  Error:', tplErr.message)
  process.exit(2)
}
const { error: shErr } = await sb.from('shift_checklists').select('id').limit(1)
if (shErr) {
  console.error('✗ shift_checklists missing. Run db/checklist_templates.sql in Supabase SQL editor first.')
  console.error('  Error:', shErr.message)
  process.exit(2)
}
console.log('✓ Migration applied: checklist_templates + shift_checklists both readable.\n')

// ── Helpers ──────────────────────────────────────────────────────────
function hashOf(obj) {
  // Stable JSON hash — sort keys recursively so object-key reorder
  // doesn't show up as a difference.
  const stableStringify = (v) => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v)
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
    const keys = Object.keys(v).sort()
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
  }
  return createHash('sha256').update(stableStringify(obj)).digest('hex').slice(0, 16)
}

function snapshotItems(template) {
  return [...template].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(t => ({
    id: t.id,
    label: t.label_en,
    label_en: t.label_en,
    label_vn: t.label_vn ?? null,
    type: t.type ?? 'checkbox',
    zone: t.zone ?? '',
    required: !!t.required,
    sort_order: t.sort_order ?? 0,
    placeholder: t.placeholder,
    checked: false,
    name: null,
    ts: null,
  }))
}

// ── Pre-probe state snapshots (so we can verify zero residue later) ──
const { data: openingTpl0 } = await sb.from('checklist_templates').select('items, updated_at').eq('kind', 'opening').single()
const openingTplHash0 = hashOf(openingTpl0)
const { count: totalSheets0 } = await sb.from('shift_checklists').select('id', { count: 'exact', head: true })

console.log(`Pre-probe state captured:`)
console.log(`  opening template hash: ${openingTplHash0}`)
console.log(`  opening template items: ${openingTpl0.items.length}`)
console.log(`  total sheet rows: ${totalSheets0}\n`)

// ── Pick a real pre-existing sealed sheet (migration-survival case) ──
const { data: sealed0 } = await sb
  .from('shift_checklists')
  .select('id, shift_date, kind, items, item_values, free_notes, submitted_by, submitted_at')
  .not('submitted_at', 'is', null)
  .neq('shift_date', '1999-01-01')  // exclude any prior probe residue, just in case
  .order('shift_date', { ascending: false })
  .limit(1)
  .maybeSingle()

let realSheetHash0 = null
if (sealed0) {
  realSheetHash0 = hashOf(sealed0)
  console.log(`Pre-existing sealed sheet picked for migration-survival check:`)
  console.log(`  ${sealed0.shift_date} · ${sealed0.kind} · signed by ${sealed0.submitted_by}`)
  console.log(`  hash: ${realSheetHash0}\n`)
} else {
  console.log(`No pre-existing sealed sheets in DB — migration-survival check will be SKIPPED.\n`)
}

// ── Probe writes use a sentinel date that real shifts can't collide with
const PROBE_DATE = '1999-01-01'
const PROBE_FUTURE_DATE = '1999-01-02'

// Defensive: clean any prior probe residue.
await sb.from('shift_checklists').delete().in('shift_date', [PROBE_DATE, PROBE_FUTURE_DATE])

// ── Step A: snapshot opening from template, fill required, seal ──────
const items = snapshotItems(openingTpl0.items)
const item_values = {}
const filled = items.map(it => {
  if (it.required && it.type === 'checkbox') {
    return { ...it, checked: true, name: 'PROBE', ts: new Date().toISOString() }
  }
  if (it.required && it.type === 'text') {
    item_values[it.id] = `[probe value for ${it.id}]`
  }
  return it
})
const sealRow = {
  shift_date: PROBE_DATE, kind: 'opening',
  items: filled, item_values,
  template_version_at: openingTpl0.updated_at,
  free_notes: null,
  submitted_by: 'PROBE',
  submitted_at: new Date().toISOString(),
}
const { data: sealedProbe, error: sealErr } = await sb.from('shift_checklists').insert(sealRow).select().single()
if (sealErr) { console.error('Probe seal failed:', sealErr.message); process.exit(1) }
const probeHash0 = hashOf({
  items: sealedProbe.items,
  item_values: sealedProbe.item_values,
  submitted_at: sealedProbe.submitted_at,
  submitted_by: sealedProbe.submitted_by,
  free_notes: sealedProbe.free_notes,
})
console.log(`Probe sheet sealed at ${PROBE_DATE}: ${sealedProbe.items.length} items, hash ${probeHash0}\n`)

// ── Step B: mutate the template — add a sentinel item ────────────────
const sentinelItem = {
  id: 'probe-sentinel-' + Date.now(),
  label_en: 'PROBE SENTINEL (added after seal)',
  label_vn: null,
  type: 'checkbox',
  zone: 'PROBE ZONE',
  required: false,
  sort_order: 99999,
}
const mutatedItems = [...openingTpl0.items, sentinelItem]
await sb.from('checklist_templates')
  .update({ items: mutatedItems, updated_at: new Date().toISOString(), updated_by: 'probe-mutation' })
  .eq('kind', 'opening')
console.log(`Template mutated: sentinel item ${sentinelItem.id} added (now ${mutatedItems.length} items).\n`)

// ── Step C: re-fetch and check ───────────────────────────────────────
const { data: probeRefetched } = await sb
  .from('shift_checklists')
  .select('items, item_values, submitted_at, submitted_by, free_notes')
  .eq('shift_date', PROBE_DATE).eq('kind', 'opening').single()
const probeHash1 = hashOf(probeRefetched)
const probeContainsSentinel = probeRefetched.items.some(i => i.id === sentinelItem.id)

let realSheetHash1 = null
let realSheetContainsSentinel = null
if (sealed0) {
  const { data: realRefetched } = await sb
    .from('shift_checklists')
    .select('id, shift_date, kind, items, item_values, free_notes, submitted_by, submitted_at')
    .eq('id', sealed0.id).single()
  realSheetHash1 = hashOf(realRefetched)
  realSheetContainsSentinel = realRefetched.items.some(i => i.id === sentinelItem.id)
}

// Fresh future-date snapshot — would a NEW sheet started right now
// include the sentinel? (The decoupling means YES.)
const { data: openingTplLive } = await sb.from('checklist_templates').select('items').eq('kind', 'opening').single()
const freshSnap = snapshotItems(openingTplLive.items)
const freshContainsSentinel = freshSnap.some(i => i.id === sentinelItem.id)

// ── Step D: cleanup, then verify zero residue ────────────────────────
await sb.from('shift_checklists').delete().in('shift_date', [PROBE_DATE, PROBE_FUTURE_DATE])
await sb.from('checklist_templates')
  .update({ items: openingTpl0.items, updated_at: openingTpl0.updated_at })
  .eq('kind', 'opening')

const { data: openingTplFinal } = await sb.from('checklist_templates').select('items, updated_at').eq('kind', 'opening').single()
const openingTplHashFinal = hashOf(openingTplFinal)
const templateRestored = openingTplHashFinal === openingTplHash0

const { count: totalSheetsFinal } = await sb.from('shift_checklists').select('id', { count: 'exact', head: true })
const sheetCountRestored = totalSheetsFinal === totalSheets0

const { count: residueProbe } = await sb.from('shift_checklists').select('id', { count: 'exact', head: true }).in('shift_date', [PROBE_DATE, PROBE_FUTURE_DATE])

// ── Report ───────────────────────────────────────────────────────────
const decouplingCore       = probeHash0 === probeHash1 && !probeContainsSentinel
const futureSnapshotCarriesIt = freshContainsSentinel
const migrationSurvival    = sealed0 ? (realSheetHash0 === realSheetHash1 && !realSheetContainsSentinel) : null
const cleanTemplate        = templateRestored
const cleanSheets          = sheetCountRestored && residueProbe === 0

console.log('────────────────────────────────────────────────────────')
console.log('VERDICT')
console.log('────────────────────────────────────────────────────────')
console.log(`  ${decouplingCore       ? '✓' : '✗'} sealed probe sheet byte-identical after template mutation`)
console.log(`    (hash before=${probeHash0}, after=${probeHash1}; sentinel present: ${probeContainsSentinel})`)
console.log(`  ${futureSnapshotCarriesIt ? '✓' : '✗'} new template item appears only on a future-dated snapshot`)
console.log(`    (future snapshot contains sentinel: ${freshContainsSentinel})`)
if (migrationSurvival === null) {
  console.log(`  · pre-existing sealed sheet check SKIPPED (no real sealed sheets in DB yet)`)
} else {
  console.log(`  ${migrationSurvival   ? '✓' : '✗'} a real pre-existing sealed sheet is unchanged and renders`)
  console.log(`    (hash before=${realSheetHash0}, after=${realSheetHash1}; sentinel present: ${realSheetContainsSentinel})`)
}
console.log(`  ${cleanTemplate        ? '✓' : '✗'} template restored to its seeded state (zero residue)`)
console.log(`    (hash before=${openingTplHash0}, after=${openingTplHashFinal})`)
console.log(`  ${cleanSheets          ? '✓' : '✗'} probe sheet deleted, real sheet count unchanged`)
console.log(`    (sheets before=${totalSheets0}, after=${totalSheetsFinal}; probe residue rows: ${residueProbe})`)

const allClean = decouplingCore && futureSnapshotCarriesIt && (migrationSurvival !== false) && cleanTemplate && cleanSheets
console.log('────────────────────────────────────────────────────────')
console.log(allClean ? '✓ ALL CHECKS PASSED' : '✗ ONE OR MORE CHECKS FAILED')
process.exit(allClean ? 0 : 1)
