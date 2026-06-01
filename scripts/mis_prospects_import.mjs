#!/usr/bin/env node
// MIS Prospects — one-shot import script.
//
// Reads scripts/data/prospects.csv (the SALES PIPELINE tab exported from the
// Master Intelligence Sheet) and inserts into public.prospects + reconciles
// converted_member_no by matching full_name against existing members.
//
// Run:
//   node scripts/mis_prospects_import.mjs              # full import
//   node scripts/mis_prospects_import.mjs --dry-run    # parse + validate only
//
// Idempotent re-runs are NOT safe — re-importing duplicates. Use --dry-run
// while iterating, then run for real once.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot  = resolve(__dirname, '..')
const dataPath  = resolve(__dirname, 'data', 'prospects.csv')
const dryRun    = process.argv.includes('--dry-run')

// ───── env loader ─────
function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(resolve(repoRoot, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  } catch {}
  return { ...env, ...process.env }
}

// ───── CSV parser ─────
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
  return rows
}

// ───── helpers ─────
const STAGE_MAP = {
  'lead': 'Lead',
  'initial contact': 'Initial Contact',
  'interview scheduled': 'Interview Scheduled',
  'interview complete': 'Interview Complete',
  'application received': 'Application Received',
  'onboarded': 'Onboarded',
  'declined': 'Declined',
  'withdrawn': 'Withdrawn',
  'on hold': 'On Hold',
}

function normaliseStage(raw) {
  if (!raw) return 'Lead'
  // Strip mojibake separators and trailing "Now Member" tail.
  const cleaned = raw.toLowerCase()
    .replace(/[â–—]/g, ' ')
    .replace(/\s+now\s+member.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return STAGE_MAP[cleaned] || (raw.trim() ? raw.trim() : 'Lead')
}

function normaliseSource(raw) {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  if (v === 'referral') return 'Referral'
  if (v === 'event') return 'Event'
  if (v === 'direct approach') return 'Direct Approach'
  return raw.trim() || null
}

function parseDate(s) {
  if (!s) return null
  const t = s.trim()
  if (!t || t === '-' || t === '—' || t === '–') return null
  // Accept both DD/MM/YYYY and YYYY-MM-DD
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return t
  return null
}

function parseScore(s) {
  if (s == null) return null
  const t = String(s).trim()
  if (!t) return null
  const n = parseInt(t, 10)
  if (Number.isNaN(n) || n < 1 || n > 5) return null
  return n
}

function parseInt0(s) {
  if (s == null) return 0
  const n = parseInt(String(s).trim(), 10)
  return Number.isNaN(n) ? 0 : n
}

function clean(s) {
  if (s == null) return null
  const t = String(s).trim()
  return t || null
}

function parseLetterSent(notes) {
  // Legacy data used bold formatting for "letter sent" — not captured in CSV.
  // We leave it false on import; the admin marks it manually in the UI.
  return false
}

// ───── main ─────
console.log('▸ Loading prospects CSV…')
let raw
try {
  raw = readFileSync(dataPath, 'utf8')
} catch (e) {
  console.error(`✗ Could not read ${dataPath}`)
  console.error('  Save the SALES PIPELINE tab from Google Sheets as CSV to that path first.')
  process.exit(1)
}

const allRows = parseCsv(raw)

// Find the real header row — the one with "Prospect ID" or "Full Name" near the start.
let headerIdx = -1
for (let i = 0; i < Math.min(allRows.length, 10); i++) {
  const r = allRows[i].slice(0, 6).map(x => x.toLowerCase())
  if (r.includes('prospect id') && r.includes('full name')) { headerIdx = i; break }
}
if (headerIdx === -1) {
  console.error('✗ Could not locate header row (looking for "Prospect ID" + "Full Name" in first 10 rows).')
  process.exit(1)
}

const dataRows = allRows.slice(headerIdx + 1)
console.log(`  ${dataRows.length} candidate rows (header at index ${headerIdx})`)

// Column index map — matches the spec's 35-column layout. Some legacy exports
// duplicate "Prospect ID" so col 1 is actually the stage.
const COL = {
  prospect_id: 0,
  stage:       1,
  days:        2,   // ignored on import; recomputed by view
  full_name:   3,
  nickname:    4,
  referred_by: 5,
  referred_by_member_no: 6,
  referral_relationship: 7,
  contact_info: 8,  // legacy "First Contact Date" in some exports — see below
  source:      9,
  last_contact: 10,
  contact_count: 11,
  next_action: 12,
  next_action_date: 13,
  assigned_to: 14,
  notes:       15,
  interview_date: 16,
  interviewer: 17,
  interview_location: 18,
  interview_duration: 19,
  interview_notes: 20,
  red_flags: 21,
  profession: 22,
  cultural_fit: 23,
  social_compatibility: 24,
  commercial_potential: 25,
  whisky_interest: 26,
  brand_alignment: 27,
  community_value: 28,
  diversity_contribution: 29,
  overall: 30,
  committee_notes: 31,
  decision: 32,
  decision_date: 33,
  converted_member_no: 34,
}

// The legacy CSV has TWO swap-y columns — "First Contact Date" actually sits
// where we'd expect contact_info OR vice versa depending on export. We detect:
//   - If col 8 looks like a date (DD/MM/YYYY), it's first_contact_date and col 9 is the source.
//   - If col 8 has anything else (address etc.), col 9 is still the source; first_contact_date may be missing.

const prospects = []
const errors = []
for (let i = 0; i < dataRows.length; i++) {
  const r = dataRows[i]
  const rowNum = headerIdx + 2 + i

  const prospect_id = clean(r[COL.prospect_id])
  const full_name = clean(r[COL.full_name])
  if (!full_name) continue                     // blank row
  if (!prospect_id) continue                   // no ID = un-importable

  // Disambiguate col 8 — date vs address.
  const col8 = clean(r[COL.contact_info])
  const dateGuess = parseDate(col8)
  const first_contact_date = dateGuess
  const contact_info = dateGuess ? null : col8

  try {
    prospects.push({
      prospect_id,
      stage: normaliseStage(r[COL.stage]),
      full_name,
      nickname:              clean(r[COL.nickname]),
      referred_by_name:      clean(r[COL.referred_by]),
      referred_by_member_no: clean(r[COL.referred_by_member_no]),
      referral_relationship: clean(r[COL.referral_relationship]),
      source_channel:        normaliseSource(r[COL.source]),
      contact_info,
      first_contact_date,
      last_contact_date:     parseDate(r[COL.last_contact]),
      contact_count:         parseInt0(r[COL.contact_count]),
      next_action:           clean(r[COL.next_action]),
      next_action_date:      parseDate(r[COL.next_action_date]),
      assigned_to:           clean(r[COL.assigned_to]),
      notes:                 clean(r[COL.notes]),
      interview_date:        parseDate(r[COL.interview_date]),
      interviewer:           clean(r[COL.interviewer]),
      interview_location:    clean(r[COL.interview_location]),
      interview_duration:    clean(r[COL.interview_duration]),
      interview_notes:       clean(r[COL.interview_notes]),
      red_flags:             clean(r[COL.red_flags]),
      profession:            clean(r[COL.profession]),
      cultural_fit:          parseScore(r[COL.cultural_fit]),
      social_compatibility:  parseScore(r[COL.social_compatibility]),
      commercial_potential:  parseScore(r[COL.commercial_potential]),
      whisky_interest:       parseScore(r[COL.whisky_interest]),
      brand_alignment:       parseScore(r[COL.brand_alignment]),
      community_value:       parseScore(r[COL.community_value]),
      diversity_contribution: clean(r[COL.diversity_contribution]),
      committee_notes:       clean(r[COL.committee_notes]),
      decision:              clean(r[COL.decision]),
      decision_date:         parseDate(r[COL.decision_date]),
      converted_member_no:   clean(r[COL.converted_member_no]),
      letter_sent:           parseLetterSent(r[COL.notes]),
    })
  } catch (e) {
    errors.push({ row: rowNum, prospect_id, reason: e.message })
  }
}

// ───── stage tally ─────
const byStage = {}
for (const p of prospects) byStage[p.stage] = (byStage[p.stage] || 0) + 1

console.log(`\n▸ Parsed ${prospects.length} prospects`)
console.log('\n▸ By stage:')
for (const [stage, count] of Object.entries(byStage).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${stage.padEnd(28)} ${count}`)
}

// Show a sample of imported rows
console.log('\n▸ Sample (first 5):')
for (const p of prospects.slice(0, 5)) {
  console.log(`  ${p.prospect_id.padEnd(8)} ${p.stage.padEnd(22)} ${p.full_name}`)
}

// Show prospects with scores
const scored = prospects.filter(p => p.cultural_fit != null || p.social_compatibility != null || p.commercial_potential != null || p.whisky_interest != null || p.brand_alignment != null || p.community_value != null)
console.log(`\n▸ ${scored.length} prospects have at least one score recorded`)

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} parse errors:`)
  for (const e of errors) console.error(`  row ${e.row} (${e.prospect_id}): ${e.reason}`)
}

if (dryRun) {
  console.log('\n— DRY RUN — no DB writes.\n')
  process.exit(0)
}

// ───── write ─────
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

// Reconcile converted_member_no by name (legacy data has stale mappings).
console.log('\n▸ Reconciling converted_member_no by full_name…')
const { data: members } = await sb.from('members').select('member_no, full_name')
const byName = new Map()
for (const m of members || []) byName.set(m.full_name.trim().toLowerCase(), m.member_no)
let reconciled = 0
for (const p of prospects) {
  if (p.stage === 'Onboarded' || p.converted_member_no) {
    const match = byName.get(p.full_name.trim().toLowerCase())
    if (match && match !== p.converted_member_no) {
      console.log(`  ${p.prospect_id} ${p.full_name}: ${p.converted_member_no || '∅'} → ${match}`)
      p.converted_member_no = match
      reconciled++
    } else if (match) {
      p.converted_member_no = match
    } else if (p.converted_member_no && !byName.has(p.converted_member_no)) {
      // referenced member_no doesn't exist — null it to avoid FK failure
      console.log(`  ${p.prospect_id} ${p.full_name}: ${p.converted_member_no} (member not found) → null`)
      p.converted_member_no = null
    }
  }
}
console.log(`  reconciled ${reconciled} rows`)

// Also clear referred_by_member_no if it references a non-existent member.
for (const p of prospects) {
  if (p.referred_by_member_no && !byName.has(p.referred_by_member_no.toLowerCase()) &&
      ![...byName.values()].includes(p.referred_by_member_no)) {
    p.referred_by_member_no = null
  }
}

console.log('\n▸ Inserting prospects…')
let inserted = 0
for (let i = 0; i < prospects.length; i += 50) {
  const chunk = prospects.slice(i, i + 50)
  const { error } = await sb.from('prospects').insert(chunk)
  if (error) {
    console.error(`✗ chunk starting at ${i} failed:`, error.message)
    process.exit(1)
  }
  inserted += chunk.length
}
console.log(`  ${inserted} inserted`)

console.log('\n✓ Done.\n')
