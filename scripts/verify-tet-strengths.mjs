#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TẾT — THE 45% AND 40% PROBE  ·  run after 20260921150000_tet2027_45_and_40
// ───────────────────────────────────────────────────────────────────────────
// Read as ANON, because that is who reads /tet. Four claims:
//
//   1. The new columns exist and carry a figure for EVERY active cask.
//   2. Reducing a cask never loses bottles, and the counts rise as the
//      strength falls — which is the entire argument the page makes.
//   3. A cask too weak to be reduced is quoted at its own strength rather
//      than nulled: same count as cask strength, gain of zero.
//   4. Cost never appears. The board is a public view; ex-works, freight,
//      discount and margin must not be in it under any name.
//
// Plus the controls, because a probe that cannot fail proves nothing:
//   · the board must actually have rows (a zero-row probe passes everything)
//   · a strength the board does NOT carry must be reported missing, proving
//     the column check bites rather than waving through absence
//
// READ-ONLY.   node scripts/verify-tet-strengths.mjs
// Exit 0 = every claim holds · 1 = something is wrong · 2 = could not run
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!URL_ || !ANON) { console.log('\n⚠  BLOCKED — .env.local is missing a key.\n'); process.exit(2) }

let bad = 0
const ok   = m => console.log(`  ✓ ${m}`)
const fail = m => { console.log(`  ✗ ${m}`); bad++ }

const r = await fetch(`${URL_}/rest/v1/tet_cask_board?select=*&order=display_order`,
  { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
if (!r.ok) { console.log(`\n⚠  BLOCKED — anon could not read the board (${r.status}).\n`); process.exit(2) }
const rows = await r.json()

// ── CONTROL: inputs loaded ────────────────────────────────────────────────
console.log('\nCONTROL — the probe has something to probe')
if (rows.length === 0) { fail('the board is EMPTY — every claim below would pass vacuously'); process.exit(1) }
ok(`${rows.length} active cask${rows.length === 1 ? '' : 's'} on the board`)

const cols = Object.keys(rows[0])

// ── 1. THE COLUMNS ARRIVED ────────────────────────────────────────────────
console.log('\n1 — the migration landed')
const LADDER = [
  { pc: null, b: 'bottles_cask_strength', u: 'unit_vnd_cask_strength', g: null },
  { pc: 55,   b: 'bottles_55',            u: 'unit_vnd_55',            g: 'extra_bottles_55' },
  { pc: 50,   b: 'bottles_reduced',       u: 'unit_vnd_reduced',       g: 'extra_bottles' },
  { pc: 45,   b: 'bottles_45',            u: 'unit_vnd_45',            g: 'extra_bottles_45' },
  { pc: 40,   b: 'bottles_40',            u: 'unit_vnd_40',            g: 'extra_bottles_40' },
]
for (const s of LADDER) {
  const name = s.pc ? `${s.pc}%` : 'cask strength'
  const missing = [s.b, s.u, s.g].filter(Boolean).filter(c => !cols.includes(c))
  if (missing.length) { fail(`${name}: column(s) absent — ${missing.join(', ')}`); continue }
  const nulls = rows.filter(row => row[s.b] == null)
  if (nulls.length) fail(`${name}: ${nulls.length} cask(s) with no bottle count — ${nulls.map(n => n.cask_ref).join(', ')}`)
  else ok(`${name}: a figure for all ${rows.length}`)
}

// ── CONTROL: a strength the board does NOT carry must be reported missing ─
console.log('\nCONTROL — the column check can fail')
if (cols.includes('bottles_35')) fail('bottles_35 exists — below the legal minimum, it must not')
else ok('bottles_35 correctly absent (the same test that passed above, failing here)')

// ── 2. THE ARGUMENT HOLDS ─────────────────────────────────────────────────
console.log('\n2 — reducing never loses bottles, and the ladder rises')
for (const row of rows) {
  const abv = Number(row.cask_abv_pct)
  const steps = LADDER.filter(s => s.pc === null || abv > s.pc)
  let last = null, broke = false
  for (const s of steps) {
    const n = Number(row[s.b])
    if (last !== null && n < last) {
      fail(`${row.cask_ref} (${abv}%): ${s.pc}% yields ${n} bottles, fewer than the step above (${last})`)
      broke = true; break
    }
    last = n
  }
  if (!broke) {
    const cs = Number(row.bottles_cask_strength)
    const floor = steps[steps.length - 1]
    ok(`${row.cask_ref} · ${abv}% · ${cs} bottles → ${last} at ${floor.pc ? floor.pc + '%' : 'cask strength'} (+${last - cs})`)
  }
}

// ── 3. A CASK TOO WEAK IS QUOTED AT ITS OWN STRENGTH, NOT NULLED ──────────
console.log('\n3 — a strength a cask cannot reach is honest, not null')
let tested = 0
for (const row of rows) {
  const abv = Number(row.cask_abv_pct)
  for (const s of LADDER.filter(x => x.pc !== null && abv <= x.pc)) {
    tested++
    const same = Number(row[s.b]) === Number(row.bottles_cask_strength)
    const zero = Number(row[s.g]) === 0
    if (same && zero) ok(`${row.cask_ref} (${abv}%) cannot be raised to ${s.pc}% — quoted at its own strength, gain 0`)
    else fail(`${row.cask_ref} (${abv}%) at ${s.pc}%: expected its cask-strength count with gain 0, got ${row[s.b]} / +${row[s.g]}`)
  }
}
if (tested === 0) ok('no cask on the board is weaker than a listed strength — nothing to test')

// ── 4. COST IS NOT IN A PUBLIC VIEW ───────────────────────────────────────
console.log('\n4 — no cost reaches anon')
const leaked = cols.filter(c => /cost|ex_works|exworks|freight|margin|discount|landed|buy_/i.test(c))
if (leaked.length) fail(`the board carries ${leaked.join(', ')} — anon can read this view`)
else ok(`none of ${cols.length} columns names a cost`)

console.log(bad === 0
  ? '\n✅  45% and 40% are live, the ladder is honest, and no cost leaks.\n'
  : `\n❌  ${bad} problem(s) above.\n`)
process.exit(bad === 0 ? 0 : 1)
