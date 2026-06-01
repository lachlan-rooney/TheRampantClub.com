#!/usr/bin/env node
// MIS Pass 1 — one-shot import script.
//
// Reads scripts/data/directory.csv (members) and scripts/data/preferences.csv
// (preferences) — both straight CSV exports of the corresponding tabs in the
// Master Intelligence Sheet — and inserts into the public.members /
// public.preferences tables created by db/mis_pass1.sql.
//
// Run:
//   node scripts/mis_import.mjs
//   node scripts/mis_import.mjs --dry-run     # parse + validate, no DB write
//
// Loads SUPABASE_SERVICE_ROLE_KEY from .env.local (no extra deps).
// Idempotent re-runs are NOT safe — the preferences table has no natural unique
// constraint, so re-running would duplicate. Use --dry-run for validation.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot  = resolve(__dirname, '..')
const dataDir   = resolve(__dirname, 'data')
const dryRun    = process.argv.includes('--dry-run')

// ───── env loader (no dotenv dep) ─────
function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(resolve(repoRoot, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  } catch {
    // No .env.local — rely on process.env.
  }
  return { ...env, ...process.env }
}

// ───── CSV parser — handles quoted fields with embedded commas ─────
function parseCsv(src) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(cell => cell.trim() !== ''))
}

// ───── date helpers (DD/MM/YYYY → YYYY-MM-DD) ─────
function parseDate(s) {
  if (!s || s.trim() === '') return null
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) throw new Error(`Unrecognised date format: "${s}" (expected DD/MM/YYYY)`)
  const [_, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// ───── value parsers with spec-aware enum validation ─────
const allowedConfidence = [1.00, 0.75, 0.50, 0.25]
const allowedLambda     = [0.000, 0.002, 0.005, 0.010, 0.020]
const allowedFrequency  = [0.8, 1.0, 1.2, 1.5]

function snapToAllowed(v, allowed, label) {
  const n = Number(v)
  if (Number.isNaN(n)) throw new Error(`${label} not a number: "${v}"`)
  const match = allowed.find(a => Math.abs(a - n) < 1e-6)
  if (match == null) throw new Error(`${label}=${n} not in allowed set ${JSON.stringify(allowed)}`)
  return match
}

function parseBool(s) {
  if (s == null) return false
  const v = s.trim().toUpperCase()
  return v === 'TRUE' || v === 'YES' || v === '1'
}

// ───── load + parse ─────
console.log('▸ Loading CSVs…')
const directoryRows   = parseCsv(readFileSync(resolve(dataDir, 'directory.csv'),   'utf8'))
const preferencesRows = parseCsv(readFileSync(resolve(dataDir, 'preferences.csv'), 'utf8'))

// Skip top 3 rows (title, subtitle, section labels). Row 4 is the real header.
// Members: header at index 2, data starts at index 3.
// Preferences: header at index 3, data starts at index 4.
const directoryDataRows = directoryRows.slice(3)
const preferenceDataRows = preferencesRows.slice(4)

console.log(`  ${directoryDataRows.length} member rows`)
console.log(`  ${preferenceDataRows.length} preference rows`)

// ───── build members ─────
const members = []
const memberByName = new Map()
for (const r of directoryDataRows) {
  if (!r[0] || !r[0].startsWith('TRC-M')) continue
  const m = {
    member_no:   r[0].trim(),
    full_name:   r[1].trim(),
    nickname:    r[2]?.trim() || null,
    tier:        r[3].trim(),
    status:      r[4].trim() || 'Active',
    join_date:   parseDate(r[5]),
    birthday:    parseDate(r[6]),
    email:       r[7]?.trim() || null,
    phone:       r[8]?.trim() || null,
    referred_by: r[13]?.trim() || null,
  }
  members.push(m)
  memberByName.set(m.full_name.toLowerCase(), m.member_no)
}

// ───── build preferences (resolve member_no by CSV col + name fallback) ─────
const preferences = []
const unmatched = []
for (let i = 0; i < preferenceDataRows.length; i++) {
  const r = preferenceDataRows[i]
  if (!r[0] || !r[0].trim()) continue
  const rowNum = i + 5  // 1-based + 4 header rows

  // Prefer CSV column B (Member No.). Fall back to name lookup, which is what
  // the spec asks for — resolve by name once at import time so the FK is the
  // canonical join key going forward.
  let member_no = r[1]?.trim()
  if (!member_no || !member_no.startsWith('TRC-M')) {
    member_no = memberByName.get(r[0].trim().toLowerCase())
  }
  if (!member_no) {
    unmatched.push({ row: rowNum, name: r[0], reason: 'No member_no on row and name not in members' })
    continue
  }
  if (!members.find(m => m.member_no === member_no)) {
    unmatched.push({ row: rowNum, name: r[0], reason: `member_no ${member_no} not in directory` })
    continue
  }

  try {
    preferences.push({
      member_no,
      category:        r[3].trim(),
      subcategory:     r[4]?.trim() || null,
      preference_name: r[5].trim(),
      detail:          r[6]?.trim() || null,
      verbatim_quote:  r[7]?.trim() || null,
      s0:              Number(r[8]),
      confidence:      snapToAllowed(r[9],  allowedConfidence, `[row ${rowNum}] confidence`),
      lambda:          snapToAllowed(r[10], allowedLambda,     `[row ${rowNum}] lambda`),
      frequency:       snapToAllowed(r[11], allowedFrequency,  `[row ${rowNum}] frequency`),
      last_validated:  parseDate(r[12]),
      validation_count: Number(r[13]) || 1,
      source:          r[18]?.trim() || 'Interview',
      contradiction:   parseBool(r[19]),
      logged_by:       r[20]?.trim() || null,
      created_date:    parseDate(r[21]),
    })
  } catch (e) {
    unmatched.push({ row: rowNum, name: r[0], reason: e.message })
  }
}

if (unmatched.length > 0) {
  console.error(`\n✗ ${unmatched.length} row(s) failed validation:`)
  for (const u of unmatched) console.error(`  row ${u.row} (${u.name}): ${u.reason}`)
  process.exit(1)
}

console.log(`\n▸ Parsed:`)
console.log(`  ${members.length} members`)
console.log(`  ${preferences.length} preferences`)

const perMember = {}
for (const p of preferences) perMember[p.member_no] = (perMember[p.member_no] || 0) + 1
console.log('\n▸ Preferences per member:')
for (const m of members) console.log(`  ${m.member_no} ${m.full_name.padEnd(20)} ${perMember[m.member_no] || 0}`)

if (dryRun) {
  console.log('\n— DRY RUN — no DB writes.\n')
  process.exit(0)
}

// ───── write to Supabase ─────
const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log('\n▸ Inserting members…')
const { error: memErr } = await sb.from('members').insert(members)
if (memErr) {
  console.error('  insert failed:', memErr.message)
  process.exit(1)
}
console.log(`  ${members.length} inserted`)

console.log('\n▸ Inserting preferences…')
// Chunk inserts in case the dataset grows; 100 is well under PostgREST limits.
let inserted = 0
for (let i = 0; i < preferences.length; i += 100) {
  const chunk = preferences.slice(i, i + 100)
  const { error } = await sb.from('preferences').insert(chunk)
  if (error) {
    console.error(`  chunk starting at index ${i} failed:`, error.message)
    process.exit(1)
  }
  inserted += chunk.length
}
console.log(`  ${inserted} inserted`)

// ───── verification: pull from preference_scores view, print sample PS(t) ─────
console.log('\n▸ Verifying via preference_scores view…')
const { data: sample, error: vErr } = await sb
  .from('preference_scores')
  .select('member_no, preference_name, s0, confidence, lambda, frequency, validation_count, days_since, ps_t, score_health_pct, needs_revalidation')
  .order('ps_t', { ascending: false })
  .limit(10)
if (vErr) {
  console.error('  view query failed:', vErr.message)
  process.exit(1)
}

console.log('\n  Top 10 PS(t) values:')
console.log('  member_no | preference                                 | S₀ | C    | λ     | F   | vc | days | PS(t) | %   | flag')
for (const s of sample) {
  console.log(
    `  ${s.member_no} | ${(s.preference_name || '').padEnd(42).slice(0,42)} | ${s.s0}  | ${s.confidence} | ${String(s.lambda).padEnd(5)} | ${s.frequency} | ${s.validation_count}  | ${s.days_since}   | ${s.ps_t.toFixed(2).padStart(5)} | ${s.score_health_pct}% | ${s.needs_revalidation}`
  )
}

// Per-member summary
const { data: counts, error: cErr } = await sb
  .from('preference_scores')
  .select('member_no')
if (!cErr) {
  const tally = {}
  for (const c of counts) tally[c.member_no] = (tally[c.member_no] || 0) + 1
  console.log('\n  preference_scores rows per member (active only):')
  for (const m of members) console.log(`    ${m.member_no} ${m.full_name.padEnd(20)} ${tally[m.member_no] || 0}`)
}

console.log('\n✓ Done.\n')
