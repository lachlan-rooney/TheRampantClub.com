// ═══════════════════════════════════════════════════════════════════════════
// A DUNCAN TAYLOR CASK SUMMARY → the cask record.
//   node scripts/tet/apply-cask-summary.mjs < summary.txt      [--dry]
// ───────────────────────────────────────────────────────────────────────────
// The summaries arrive one cask at a time, as pasted text. This reads that
// text and writes only what the sheet actually says:
//
//   ABV                     → abv_pct
//   RLA ÷ ABV               → bulk_litres      (litres of alcohol ÷ strength)
//   Cask No / Passport No   → cask_number
//   Seasoning + tag + months in octave → wood
//   AYS                     → vintage_year
//   Age at Ready Date       → age_years        (the page floors it: 14.9 → 14)
//   Current Colour          → colour_srm       (the beer scale, in words)
//   Post Tasting Notes      → tasting_note_en  (unless NA)
//
// WHAT IT WILL NOT DO. It never invents a value: a field the summary does not
// carry is left exactly as it was. It refuses to write a cask it cannot find,
// and it prints what it read before it writes, so a bad paste is visible
// rather than silent. Prices come from the pricing sheet, not from here —
// this script does not touch them.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry')
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }

const text = readFileSync(0, 'utf8')

/** The value that follows a label, on its own line or the next non-empty one. */
const after = (label) => {
  const re = new RegExp(`^\\s*${label}\\s*$`, 'im')
  const m = re.exec(text)
  if (!m) return null
  const rest = text.slice(m.index + m[0].length).split('\n').map(s => s.trim()).filter(Boolean)
  return rest[0] ?? null
}
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null }

// Colours are written as words on the assessment: "Current Color FIFTEEN".
const WORDS = ['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN',
  'ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN','TWENTY',
  'TWENTY-ONE','TWENTY-TWO','TWENTY-THREE','TWENTY-FOUR','TWENTY-FIVE','TWENTY-SIX','TWENTY-SEVEN',
  'TWENTY-EIGHT','TWENTY-NINE','THIRTY']
const colourNumber = (w) => {
  if (!w) return null
  const i = WORDS.indexOf(w.trim().toUpperCase().replace(/\s+/g, '-'))
  return i > 0 ? i : num(w)
}
const title = (s) => (s ?? '').toLowerCase().replace(/\b[a-zà-ỹ]/g, c => c.toUpperCase())
  .replace(/\bPx\b/i, 'PX')

const caskNo = (after('Cask No / Passport No') || '').split('/')[0].trim() || after('Cask No')
const passport = (after('Cask No / Passport No') || '').split('/')[1]?.trim() || after('Passport No')
const abv = num(after('ABV'))
const rla = num(after('RLA'))
const seasoning = after('Seasoning Type')
const caskType = after('Cask Type')
const tags = after('Cask Tags')
const months = num(after('Months In Octave'))
const ays = after('AYS')
const age = num(after('Age at Ready Date'))
const current = after('Current Color') || after('Current Colour')
const entry = after('Entry Colour') || after('Entry Color')
const post = after('Post Tasting Notes')
const assessed = after('Assessment Date')

if (!caskNo) { console.error('No cask number in that text.'); process.exit(1) }

// wood: the seasoning, the physical cask where the tag names one, and the
// time it spent in octave — each only if the summary gave it.
const size = /\((\d+L)\)/i.exec(tags || '')?.[1]
const woodBits = [title(seasoning)]
if (size && /BLOOD TUB/i.test(tags)) woodBits.push(`blood tub ${size}`)
else if (size) woodBits.push(size)
if (months) woodBits.push(`${months} months`)

const patch = {}
if (abv) patch.abv_pct = abv
if (abv && rla) patch.bulk_litres = Math.round((rla / (abv / 100)) * 100) / 100
if (caskNo && passport) patch.cask_number = `${caskNo} / ${passport}`
if (seasoning) patch.wood = woodBits.filter(Boolean).join(' · ')
if (ays) patch.vintage_year = Number(String(ays).slice(-4))
if (age) patch.age_years = Math.round(age * 10) / 10
if (caskType) patch.cask_type = title(caskType)
const srm = colourNumber(current)
if (srm) {
  patch.colour_srm = srm
  patch.colour_source = `Duncan Taylor assessment${assessed ? ' ' + assessed.split(' ')[0] : ''}`
    + ` · current colour ${String(current).toUpperCase()}${entry ? ` (entry ${String(entry).toUpperCase()})` : ''}`
}
if (post && !/^NA$/i.test(post)) patch.tasting_note_en = post.endsWith('.') ? post : post + '.'

console.log(`${caskNo} — ${after('Distillery')}`)
for (const [k, v] of Object.entries(patch)) console.log(`   ${k.padEnd(16)} ${v}`)
const untouched = [['tasting notes', !patch.tasting_note_en], ['colour', !patch.colour_srm]]
  .filter(([, missing]) => missing).map(([what]) => what)
if (untouched.length) console.log(`   (not in this summary, left as they were: ${untouched.join(', ')})`)

if (DRY) { console.log('\ndry run — nothing written'); process.exit(0) }

const found = await (await fetch(`${U}/rest/v1/tet_casks?cask_ref=eq.${caskNo}&select=cask_ref`, { headers: H })).json()
if (!found.length) { console.error(`\n${caskNo} is not in the database — load it from the pricing sheet first.`); process.exit(1) }
const r = await fetch(`${U}/rest/v1/tet_casks?cask_ref=eq.${caskNo}`, { method: 'PATCH', headers: H, body: JSON.stringify(patch) })
if (!r.ok) { console.error('\n✗', r.status, (await r.text()).slice(0, 200)); process.exit(1) }
const c = (await r.json())[0]
console.log(`\n✓ ${c.cask_ref} · ${c.distillery} · ${c.abv_pct}% · ${c.bulk_litres}L · ${c.outturn_override} bottles · colour ${c.colour_srm ?? '—'} SRM`)
