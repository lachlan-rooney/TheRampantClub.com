// WHILE published = false, WHAT CAN A GUEST SEE?
//
//   node silent-while-unpublished.mjs
//   BASE=https://therampantclub.com node silent-while-unpublished.mjs
//
// The database is shared between local and production, so the publication
// state and the figures are the same wherever this points; what differs is the
// CODE, which is why it is worth running against both.
//
// ══ WHAT THIS ASKS, AND WHAT IT DELIBERATELY DOES NOT ═════════════════════
// A first draft of this grepped every script the page loads for the string
// "575" and "1425" and reported the page as NOT SILENT. Both hits were real
// and both were nonsense: #757575 is a colour in Next's dev-tools bundle, and
// 8.71425 is a number inside an SVG path in the same file. A bare three- or
// four-digit integer cannot be searched for in minified JavaScript — it will
// always be in there somewhere, and a test that cries wolf is a test people
// learn to ignore.
//
// So the question is asked the way it actually matters:
//   · the RENDERED TEXT, which is what a guest reads, carries no auction;
//   · no figure appears FORMATTED AS MONEY anywhere, which is the only form
//     a price can take on the page;
//   · the private column names and bidder fields appear nowhere;
//   · the public function returns nothing to the anon key.
//
// ⚠ The UI LABELS ("Silent auction", "Place a bid") ARE in the app bundle, by
// design: the component ships with the page and renders nothing while there
// are no published lots. A label is not a secret. A reserve is, and no reserve
// is in the bundle because no reserve is in the function's return type.
import { readFileSync } from 'node:fs'
const env = {}
for (const l of readFileSync('/Users/lachlanrooney/Downloads/rampant-club/.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const BASE = process.env.BASE || 'http://localhost:3001'
const SLUG = process.env.SLUG || 'rizal-fathoni'
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY, A = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }
console.log(`against ${BASE}\n`)

const { createClient } = await import('/Users/lachlanrooney/Downloads/rampant-club/node_modules/@supabase/supabase-js/dist/index.cjs')
const a = createClient(U, K, { auth: { persistSession: false } })

// ── 1 · THE STATE, as the owner sees it ──────────────────────────────────
const { data: auction } = await a.from('studio_auctions').select('published')
// ⚠ TWO MODES, BECAUSE THE RIGHT ANSWER CHANGES WHEN THE OWNER PRESSES
// PUBLISH. Before publication the whole point is that the guide says nothing.
// After it, the guide SHOULD show the auction — and this file reporting
// "NOT SILENT" in red for a correct, deliberate state is how a harness
// teaches people to ignore it. What does not change either way is that a
// reserve, a buyer and a sale price must never appear, so those run in both
// modes and the mode is announced.
const PUBLISHED = auction?.[0]?.published === true
console.log(PUBLISHED
  ? '⚠ THE AUCTION IS PUBLISHED. The silence assertions do not apply; the private-data\n  assertions below do, and still must pass.\n'
  : 'the auction is not published — running the full silence check.\n')
t(typeof auction?.[0]?.published === 'boolean', 'the auction row was read', `published = ${auction?.[0]?.published}`)
// ⚠ SCOPED TO THIS EXHIBITION'S AUCTION. Unscoped, this read EVERY row in
// studio_lots — including the throwaway lots of a verification run happening
// at the same moment. It reported two failures against production that were
// nothing but another script's fixtures, which is the worst kind of red: one
// that is real, reproducible for ten minutes, and about nothing.
const { data: thisAuction } = await a.from('studio_auctions')
  .select('id').eq('collaboration_id',
    (await a.from('collaborations').select('id').eq('slug', SLUG).single()).data.id).single()
const { data: lots } = await a.from('studio_lots')
  .select('kind,status,price_usd,reserve_usd,sold_price_usd,sold_to,starting_bid_usd,collaboration_pieces(title_en)')
  .eq('auction_id', thisAuction.id)
t(lots.length === 8, 'eight lots exist in this exhibition', `${lots.length}`)

// ── 2 · THE PUBLIC DOOR, through the anon key ────────────────────────────
const r = await fetch(`${U}/rest/v1/rpc/studio_auction_public`, {
  method: 'POST', headers: { apikey: A, Authorization: 'Bearer ' + A, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_slug: SLUG }),
})
const rows = await r.json()
t(Array.isArray(rows) && (PUBLISHED ? rows.length === lots.length : rows.length === 0),
  PUBLISHED ? 'the public function returns every published lot to anon'
            : 'the public function returns NOTHING to anon',
  `${rows.length} row(s)`)

// ── 3 · THE RENDERED PAGE ────────────────────────────────────────────────
const page = await fetch(`${BASE}/studio/${SLUG}/guide`)
t(page.status === 200, 'the guide loads', `HTTP ${page.status}`)
const html = await page.text()
// Rendered text: tags stripped, and <style>/<script> contents removed, because
// textContent includes a <style> block and that has bitten this codebase.
const text = html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ')

t(/Rizal Fathoni/i.test(text), 'CONTROL: the rendered text DOES contain the artist — the search can see it')
// ⚠ THIS USED TO BE A CONTROL ASSERTING THE OPPOSITE. A Series Of Body was
// kept in the guide while the owner decided; on 11 Nov 2026 he confirmed it is
// not in the exhibition and its row was deleted. A control that asserts the
// presence of something since removed does not fail loudly — it just quietly
// stops being a control, so it is inverted rather than deleted.
t(!/A Series Of Body/i.test(text), 'A Series Of Body is gone — it is not in the exhibition')
t(/8 pieces/i.test(text), 'CONTROL: the walking order reads EIGHT pieces, counted from the data')

// ⚠ EXACT LABELS AND MARKUP, NOT ENGLISH WORDS. A first pass looked for
// "reserve" and "sold" and found both: "All rights reserved" in the footer,
// and the artist's own sentence about the rainforest being "owned, sold, and
// consumed". Neither has anything to do with an auction. The words a guest
// would see IF the auction were published are specific strings and specific
// class names, so those are what is checked.
const silenceOnly = PUBLISHED ? () => {} : t
if (PUBLISHED) console.log('– SKIPPED: the "nothing is drawn" assertions — the auction is published on purpose.')
for (const w of ['Silent auction', 'Place a bid', 'Enquire', 'Current highest bid',
                 'Reserve met', 'Reserve not yet met', 'Starting bid', 'Bidding has closed',
                 'have sold', 'has sold', 'Sold as a pair']) {
  silenceOnly(!new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text),
    `the rendered page never says "${w}"`)
}
// The component's own markup. If any of this is in the HTML, something drew.
for (const cls of ['sga-banner', 'sga-lot', 'sga-sale', 'sga-cta', 'sga-form', 'sga-sold']) {
  silenceOnly(!html.includes(`class="${cls}`) && !html.includes(`${cls} `) || !html.includes('sga-'),
    `no ${cls} element was rendered`)
}
silenceOnly(!/\bsga-/.test(html), 'not one element of the auction component is in the HTML')
// ⚠ ANY money at all. Not "not these figures" — no figure, in either currency
// form the page can produce.
const money = text.match(/US\$\s?[\d,]+/g) || []
silenceOnly(money.length === 0, 'no money of any kind is printed on the page', money.join(', ') || 'none')

// ── 4 · THE PAGE'S JAVASCRIPT, for the things that ARE secret ────────────
const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1])
const bodies = [html]
for (const src of srcs) {
  const u = src.startsWith('http') ? src : new URL(src, BASE).href
  try { bodies.push(await (await fetch(u)).text()) } catch { /* unreadable chunk is not evidence */ }
}
t(srcs.length > 0, 'CONTROL: the page loads JavaScript that can be searched', `${srcs.length} script(s)`)
t(bodies.some(b => b.includes('Rizal Fathoni')), 'CONTROL: and the artist is findable in it')

// These are long enough and distinctive enough to mean something.
const buyers = lots.map(l => l.sold_to).filter(Boolean)
for (const name of buyers) t(!bodies.some(b => b.includes(name)), `the buyer "${name}" appears in no response`)
for (const col of ['reserve_usd', 'sold_to', 'sold_price_usd', 'bidder_email', 'bidder_name']) {
  t(!bodies.some(b => b.includes(col)), `the private column name ${col} appears in no response`)
}
// Money formatted the way the page would write it, across everything.
const formatted = [...new Set(lots.flatMap(l => [l.reserve_usd, l.sold_price_usd, l.price_usd, l.starting_bid_usd]).filter(Boolean))]
// Once published, starting bids and current highests are MEANT to be on the
// page; only the private figures must still be absent.
const privateOnly = [...new Set(lots.flatMap(l => [l.reserve_usd, l.sold_price_usd]).filter(Boolean))]
for (const v of (PUBLISHED ? privateOnly : formatted)) {
  const forms = [`US$${v}`, `US$${Number(v).toLocaleString('en-US')}`]
  const found = forms.find(f => bodies.some(b => b.includes(f)))
  t(!found, `no figure written as ${forms[1]} appears anywhere`, found || '')
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed — ${
  fail ? 'FAILED' : PUBLISHED ? 'published, and nothing private is on the page' : 'silent while unpublished'}`)
process.exit(fail ? 1 : 0)
