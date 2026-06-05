// Whisky name cleanup — collapse self-concatenated (doubled) display names.
//
// The `whiskies.name` column has 122/337 rows where a leading or internal phrase
// is stored twice (bad import): "GlenAllachie GlenAllachie 15yo…",
// "Arran Signature Series Signature Series Edition 1…". Every UI shows raw
// `name`, so fixing the column fixes every surface at once.
//
// FIX = collapse any IMMEDIATELY-repeated phrase (1-4 words), anywhere, repeatedly.
// This is safe for independent-bottler names ("Frank McHardy Teaninich…",
// "Duncan Taylor Aultmore…") — it only removes a true repeat, never strips a
// distillery/bottler prefix.
//
// Reversible: apply snapshots the original into `name_original` before changing
// `name` (reversal = `update whiskies set name = name_original where name_original is not null`).
// Idempotent: re-running collapse on a cleaned name is a no-op.
//
//   node scripts/whisky-name-cleanup.mjs report   # before→after list + JSON, NO writes
//   node scripts/whisky-name-cleanup.mjs apply     # snapshot + apply (needs name_original column)

import { writeFileSync } from 'node:fs'

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

// Collapse consecutive duplicate phrases (case-insensitive match, keep first casing).
export function collapseName(name) {
  let w = (name || '').trim().split(/\s+/)
  let changed = true
  while (changed) {
    changed = false
    outer:
    for (let k = 1; k <= 4; k++) {
      for (let i = 0; i + 2 * k <= w.length; i++) {
        const a = w.slice(i, i + k).map(s => s.toLowerCase()).join(' ')
        const b = w.slice(i + k, i + 2 * k).map(s => s.toLowerCase()).join(' ')
        if (a === b) { w.splice(i + k, k); changed = true; break outer }
      }
    }
  }
  return w.join(' ')
}

async function fetchWhiskies() {
  const r = await fetch(`${BASE}/rest/v1/whiskies?select=id,name,distillery`, { headers: H })
  if (!r.ok) throw new Error(`fetch ${r.status}: ${await r.text()}`)
  return r.json()
}

function buildChanges(ws) {
  return ws
    .map(w => ({ id: w.id, before: w.name, after: collapseName(w.name), distillery: w.distillery }))
    .filter(x => x.after !== x.before)
}

async function report() {
  const ws = await fetchWhiskies()
  const changes = buildChanges(ws)
  writeFileSync('data/whisky_name_cleanup.json', JSON.stringify(changes, null, 2) + '\n')

  const startsWithDist = changes.filter(c => c.distillery && c.after.toLowerCase().startsWith(c.distillery.toLowerCase()))
  const bottlerPrefixed = changes.filter(c => !(c.distillery && c.after.toLowerCase().startsWith(c.distillery.toLowerCase())))

  const L = [`# Whisky name cleanup — ${changes.length} of ${ws.length} rows to fix (review before apply)\n`]
  L.push(`Fix: collapse consecutive duplicate phrases. Reversible via name_original. Nothing applied yet.\n`)
  L.push(`- ${startsWithDist.length} cleaned names start with their distillery (the normal form).`)
  L.push(`- ${bottlerPrefixed.length} do NOT — independent-bottler names (bottler prefix, distillery mid-name). SCAN THESE.\n`)
  L.push(`## Independent-bottler / non-distillery-leading rows (${bottlerPrefixed.length}) — verify these are right`)
  for (const c of bottlerPrefixed) L.push(`- «${c.before}»\n    → «${c.after}»`)
  L.push(`\n## All other changes (${startsWithDist.length})`)
  for (const c of startsWithDist) L.push(`- «${c.before}»\n    → «${c.after}»`)
  writeFileSync('docs/whisky_name_cleanup_report.md', L.join('\n') + '\n')

  console.log(`changed: ${changes.length}/${ws.length}`)
  console.log(`  start-with-distillery: ${startsWithDist.length} | bottler-prefixed (scan): ${bottlerPrefixed.length}`)
  console.log('wrote data/whisky_name_cleanup.json + docs/whisky_name_cleanup_report.md')
}

async function apply() {
  const ws = await fetchWhiskies()
  const changes = buildChanges(ws)
  // Guard: name_original column must exist.
  const probe = await fetch(`${BASE}/rest/v1/whiskies?select=name_original&limit=1`, { headers: H })
  if (!probe.ok) throw new Error('name_original column missing — run: alter table whiskies add column if not exists name_original text;')
  console.log(`applying ${changes.length} cleanups (snapshot → name_original, then set name)…`)
  let n = 0
  for (const c of changes) {
    const r = await fetch(`${BASE}/rest/v1/whiskies?id=eq.${c.id}`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ name_original: c.before, name: c.after }),
    })
    if (!r.ok) { console.error(`  ✗ ${c.before.slice(0,40)} — ${r.status} ${await r.text()}`); continue }
    n++
  }
  console.log(`done: ${n}/${changes.length} rows updated. Reverse with: update whiskies set name = name_original where name_original is not null;`)
}

const cmd = process.argv[2]
if (cmd === 'report') report().catch(e => { console.error(e); process.exit(1) })
else if (cmd === 'apply') apply().catch(e => { console.error(e); process.exit(1) })
else { console.error('usage: node scripts/whisky-name-cleanup.mjs [report|apply]'); process.exit(1) }
