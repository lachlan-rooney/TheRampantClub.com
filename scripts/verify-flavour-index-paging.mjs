#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// NOBODY READS THE FLAVOUR INDEX WITH A PLAIN SELECT.
//
// On 12 Nov 2026 three places did, PostgREST capped each at 1000 rows of 1,582,
// and every finder in the club was quietly working from two thirds of the
// library. This fails the moment a fourth appears.
//
// It greps the SOURCE, deliberately: a runtime check would only catch the path
// that happens to run, and the one that bit us was the one nobody ran.
// ═══════════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TABLE = 'whisky_flavour_intensities'
const ALLOWED = [
  'lib/whisky/flavour-index.ts',                 // the one paged reader
  'app/api/admin/popup/finder/route.ts',         // pages itself; admin only
  'app/kiosk/popup/finder/page.tsx',             // .in() on ~40 ids
  'app/admin/whisky/flavour-review/page.tsx',    // .eq(confirmed,false) — see note
  'scripts/verify-flavour-index-paging.mjs',
  'scripts/derive-taste-profiles.mjs',           // pages inside its own get()
]

// ⚠ KNOWN, RECORDED, AND NOT FIXED — these three are one-off maintenance
// scripts run by hand, never by a request, and never during service. They
// still read a capped 1000 rows, so a run of any of them today would work
// from two thirds of the library. Fix before using them, or page them first.
// They are listed rather than silently allowed so this is a decision on the
// record instead of an omission.
const KNOWN_CAPPED_SCRIPTS = [
  'scripts/tag-untagged-from-notes.mjs',
  'scripts/whisky-dedup-rows.mjs',
  'scripts/whisky-flavour-tags.mjs',
]

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === '.git') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(e)) out.push(p)
  }
  return out
}

const offenders = []
for (const file of walk('.')) {
  const rel = file.replace(/^\.\//, '')
  if (ALLOWED.includes(rel) || KNOWN_CAPPED_SCRIPTS.includes(rel)) continue
  const src = readFileSync(file, 'utf8')
  if (!src.includes(TABLE)) continue
  // A read is safe if it pages (.range), or is bounded (.in / .eq / .limit).
  const idx = src.indexOf(TABLE)
  const around = src.slice(Math.max(0, idx - 300), idx + 600)
  const bounded = /\.range\(|\.in\(|\.eq\(|\.limit\(|readAllIntensities/.test(around)
  if (!bounded) offenders.push(rel)
}

if (offenders.length) {
  console.log(`✗ ${offenders.length} unbounded read(s) of ${TABLE}:`)
  for (const o of offenders) console.log('   ·', o)
  console.log('\n  Use readAllIntensities() from lib/whisky/flavour-index.')
  process.exit(1)
}
console.log(`✓ every read of ${TABLE} is paged or bounded`)
console.log(`  the one paged reader: lib/whisky/flavour-index.ts`)
console.log(`  callers: flavour-match · recommend · derive-taste`)
console.log(`\n⚠ ${KNOWN_CAPPED_SCRIPTS.length} hand-run maintenance scripts still read a capped 1000 rows:`)
for (const k of KNOWN_CAPPED_SCRIPTS) console.log('   ·', k)
console.log('  None of them runs during service. Page them before the next use.')
