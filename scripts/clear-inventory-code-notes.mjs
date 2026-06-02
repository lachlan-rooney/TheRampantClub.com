// clear-inventory-code-notes.mjs
// Some rows have inventory-tracking codes in the tasting_notes field
// ("Lô mẫu 1 | Sample | Còn 1/4", "Lô mẫu 2 | RUOU05" etc) instead of
// actual tasting prose. Those entries are not notes — they're stock
// references that landed in the wrong column. This script:
//
//   1. Identifies rows whose notes match the inventory-code pattern,
//      EXCLUDING anything that looks like real tasting prose
//      (Nose: / Palate: / Finish:).
//   2. Saves the original notes to a CSV at scripts/data/cleared-
//      inventory-codes-<date>.csv so nothing is destroyed without an
//      audit trail (the codes themselves are real data — they should
//      live in a future stock-tracking field).
//   3. Clears tasting_notes + tasting_notes_source on those rows so
//      the backfill script will pick them up next run.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

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

const dryRun = process.argv.includes('--dry-run')

// Pull every row with notes and filter client-side; the patterns we want
// to catch are easier expressed in regex than in PostgREST .ilike chains.
const { data: rows, error } = await sb
  .from('whiskies')
  .select('id, name, tasting_notes, tasting_notes_source')
  .not('tasting_notes', 'is', null)
  .not('tasting_notes', 'eq', '')
if (error) { console.error('Load failed:', error.message); process.exit(1) }

const INVENTORY_PATTERN = /(Lô\s*\d|Lô mẫu|RUOU\s*\d|Slot\s*RUOU|\| Sample\b|\bSample\b\s*\||Còn\s*\d|Slot\s*\d{2,})/i
const TASTING_PROSE_PATTERN = /(\bnose\s*:|\bpalate\s*:|\bfinish\s*:|\bmouthfeel\s*:|\baroma\s*:)/i

const targets = rows.filter(r =>
  INVENTORY_PATTERN.test(r.tasting_notes) &&
  !TASTING_PROSE_PATTERN.test(r.tasting_notes)
)

console.log(`Scanned ${rows.length} rows with notes; ${targets.length} match the inventory-code pattern.`)

if (targets.length === 0) { console.log('Nothing to clear.'); process.exit(0) }

// Sample preview so the user can see what's being cleared.
console.log('\nFirst 5 matches:')
for (const r of targets.slice(0, 5)) {
  console.log(`  • ${r.name}`)
  console.log(`    notes: ${r.tasting_notes}`)
}

// Backup CSV.
const stamp = new Date().toISOString().slice(0, 10)
await mkdir(resolvePath(root, 'scripts/data'), { recursive: true })
const backupPath = resolvePath(root, `scripts/data/cleared-inventory-codes-${stamp}.csv`)
const esc = v => {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
const lines = ['id,name,tasting_notes_source,original_notes']
for (const r of targets) lines.push(`${esc(r.id)},${esc(r.name)},${esc(r.tasting_notes_source)},${esc(r.tasting_notes)}`)
await writeFile(backupPath, lines.join('\n'))
console.log(`\nBackup written to: ${backupPath}`)

if (dryRun) {
  console.log('\n--dry-run: not clearing. Re-run without the flag to apply.')
  process.exit(0)
}

// Clear in batches of 100 to stay well under any PostgREST limits.
let cleared = 0
for (let i = 0; i < targets.length; i += 100) {
  const chunk = targets.slice(i, i + 100)
  const ids = chunk.map(r => r.id)
  const { error: updErr } = await sb
    .from('whiskies')
    .update({
      tasting_notes:              null,
      tasting_notes_source:       null,
      tasting_notes_confidence:   null,
      tasting_notes_generated_at: null,
    })
    .in('id', ids)
  if (updErr) { console.error(`Batch ${i} failed:`, updErr.message); process.exit(1) }
  cleared += chunk.length
  console.log(`  cleared ${cleared}/${targets.length}…`)
}

console.log(`\n✓ Cleared ${cleared} rows. The next run of backfill-tasting-notes.mjs will queue them automatically.`)
