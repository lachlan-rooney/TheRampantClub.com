// All-caps / junk whisky names — GENERATE best-effort proposals, STOP for human
// edits, then APPLY the human-corrected set. NO safe blind casing (McHardy,
// roman numerals, codes, typos, diacritics, structured bottler names), so the
// proposals are a STARTING POINT the human fixes before apply.
//
//   node scripts/whisky-allcaps-names.mjs report  # write proposals, DO NOT apply
//   node scripts/whisky-allcaps-names.mjs apply     # apply the (human-edited) JSON
//
// apply snapshots name_original ONLY where it is null (rows already deduped have
// their pre-dedup original there — never overwrite it). Reversible, idempotent.

import { writeFileSync, readFileSync } from 'node:fs'

const B = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }
const PROPOSAL_FILE = 'data/whisky_allcaps_proposed.json'

const ROMAN = /^(II|III|IV|VI|VII|VIII|IX|XI|XII|XIII)$/
function titleWord(w) {
  if (/\d/.test(w)) return w                                    // codes: SG60, NO231180236, VAT03
  if (ROMAN.test(w.toUpperCase())) return w.toUpperCase()       // roman numerals
  if (/^MC[A-Z]/i.test(w) && w.length > 2) return 'Mc' + w.charAt(2).toUpperCase() + w.slice(3).toLowerCase()
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
}
function propose(name) {
  // drop generic boilerplate segments ("… - SINGLE MALT - SCOTCH WHISKY")
  const segs = name.split(/\s*-\s*/).map(s => s.trim())
    .filter(s => !/^(SINGLE MALT|SCOTCH WHISKY|SINGLE MALT SCOTCH WHISKY|WHISKY)$/i.test(s))
  return segs.join(' - ').split(/\s+/).map(titleWord).join(' ').trim()
}

const isAllCaps = (n) => n && n === n.toUpperCase() && /[A-Z]/.test(n)

async function get(u) { const r = await fetch(`${B}/rest/v1/${u}`, { headers: H }); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json() }

async function report() {
  const ws = await get('whiskies?select=id,name,name_original&order=name')
  const targets = ws.filter(w => isAllCaps(w.name))
  const proposals = targets.map(w => ({ id: w.id, before: w.name, proposed: propose(w.name) }))
  writeFileSync(PROPOSAL_FILE, JSON.stringify(proposals, null, 2) + '\n')

  const L = [`# All-caps name proposals — REVIEW & EDIT before apply (${proposals.length})`, ``,
    `Edit the \`proposed\` values in data/whisky_allcaps_proposed.json (these are best-effort DRAFTS —`,
    `fix McHardy/roman-numeral/code/typo/diacritic/bottler cases the auto-casing got wrong). Then run apply.`, ``,
    `| before | proposed (edit me) |`, `|---|---|`]
  for (const p of proposals) L.push(`| ${p.before} | ${p.proposed} |`)
  writeFileSync('docs/whisky_allcaps_review.md', L.join('\n') + '\n')
  console.log(`wrote ${proposals.length} proposals → ${PROPOSAL_FILE} + docs/whisky_allcaps_review.md`)
  console.log('REVIEW + EDIT the proposed names, then run: node scripts/whisky-allcaps-names.mjs apply')
}

async function apply() {
  const proposals = JSON.parse(readFileSync(PROPOSAL_FILE, 'utf8'))
  const ids = proposals.map(p => p.id)
  const current = await get(`whiskies?select=id,name,name_original&id=in.(${ids.join(',')})`)
  const curById = Object.fromEntries(current.map(w => [w.id, w]))
  let n = 0, skipped = 0
  for (const p of proposals) {
    const cur = curById[p.id]
    if (!cur) { skipped++; continue }
    if (!p.proposed || p.proposed === cur.name) { skipped++; continue }  // unchanged / blank → skip
    const body = { name: p.proposed }
    if (cur.name_original == null) body.name_original = cur.name           // snapshot only if not already set
    const r = await fetch(`${B}/rest/v1/whiskies?id=eq.${p.id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
    if (!r.ok) { console.error(`  ✗ ${p.before}: ${r.status} ${await r.text()}`); continue }
    n++
  }
  console.log(`applied ${n} renames · skipped ${skipped} (unchanged/blank). Reverse: update whiskies set name = name_original where name_original is not null;`)
}

const cmd = process.argv[2]
if (cmd === 'report') report().catch(e => { console.error(e); process.exit(1) })
else if (cmd === 'apply') apply().catch(e => { console.error(e); process.exit(1) })
else { console.error('usage: node scripts/whisky-allcaps-names.mjs [report|apply]'); process.exit(1) }
