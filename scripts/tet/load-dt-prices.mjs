// ═══════════════════════════════════════════════════════════════════════════
// DUNCAN TAYLOR VIETNAM'S PRICING SHEET → the cask records.
//   node scripts/tet/load-dt-prices.mjs [--dry]
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-24: the club buys from DT Vietnam (their landed cost plus
// their 10%), and the Tết page quotes their LIST PRICE. So three numbers per
// cask come off the sheet and are stored rather than calculated:
//
//   cost_per_bottle_vnd     what the club pays, ex VAT   — SENSITIVE, never
//                           in the board view a browser reads
//   list_price_vnd          DT VN list, ex VAT
//   list_price_inc_vat_vnd  DT VN list, inc VAT — what the page prints
//
// Their inc-VAT column is NOT simply ex × 1.1 (it runs at about 1.0986), so
// both are taken from the sheet rather than one being derived from the other.
// Guessing at their arithmetic would put a number on the page that Duncan
// Taylor never quoted.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry')
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type': 'application/json', Prefer: 'return=representation',
}

// cask, our cost ex-VAT, list ex-VAT, list inc-VAT — DT VN sheet, 2026-09-24.
const SHEET = [
  ['Q5364', 4514942, 13043165, 14329709],
  ['Q5172', 2868820,  8287703,  9105746],
  ['Q5176', 2836275,  8193682,  9001551],
  ['Q5177', 2880271,  8320784,  9139780],
  ['Q5169', 2861297,  8265969,  9080166],
  ['Q5086', 8593982, 24827058, 27297231],
  ['Q5088', 8610513, 24874814, 27349168],
  ['Q5113', 3995026, 11541186, 12679186],
  ['Q5074', 2937976,  8487485,  9322993],
  ['Q5062', 3385047,  9779024, 10745547],
  ['Q5423', 2055344,  5937661,  6519264],
  ['Q5439', 4372316, 12631134, 13882662],
  ['Q5429', 4607449, 13310408, 14623961],
  ['Q5435', 3882121, 11215016, 12324673],
  ['Q5430', 4160023, 12017844, 13201907],
  ['Q5358', 2227442,  6434831,  7065609],
  ['Q5148', 2578886,  7450116,  8182875],
  ['Q5133', 2188668,  6322819,  6943339],
  ['Q5134', 2192237,  6333128,  6954551],
  ['Q5057', 3207991,  9267530, 10182392],
]
const SOURCE = 'DT VN pricing sheet, 2026-09-24'

const vnd = n => new Intl.NumberFormat('vi-VN').format(n)
let done = 0, missing = []

for (const [ref, cost, listEx, listInc] of SHEET) {
  const check = await fetch(`${U}/rest/v1/tet_casks?cask_ref=eq.${ref}&select=cask_ref,outturn_override`, { headers: H })
  const found = await check.json()
  if (!found.length) { missing.push(ref); continue }
  const bottles = found[0].outturn_override
  const margin = ((listEx - cost) / listEx) * 100
  console.log(
    `${ref}  cost ${vnd(cost).padStart(10)}  →  list ${vnd(listInc).padStart(11)} inc VAT` +
    `   (${margin.toFixed(1)}% of list is ours, ${vnd((listEx - cost) * bottles).padStart(12)} the cask)`)
  if (DRY) continue
  const r = await fetch(`${U}/rest/v1/tet_casks?cask_ref=eq.${ref}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({
      cost_per_bottle_vnd: cost,
      list_price_vnd: listEx,
      list_price_inc_vat_vnd: listInc,
      price_source: SOURCE,
    }),
  })
  if (!r.ok) { console.log('  ✗', r.status, (await r.text()).slice(0, 120)); continue }
  done++
}

console.log('')
console.log(DRY ? 'dry run — nothing written' : `${done} casks priced`)
if (missing.length) console.log('not in the database:', missing.join(', '))
