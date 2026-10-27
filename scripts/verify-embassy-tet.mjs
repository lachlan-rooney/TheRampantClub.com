// ═══════════════════════════════════════════════════════════════════════════
// THE EMBASSY TẾT PAGE — the club's page, in the Embassy's colours.
//   node scripts/verify-embassy-tet.mjs            (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-10-27: "an exact copy of the TRC one in the following club
// colours: #151d2a, #d2b37f" with the Embassy logo, and ten of the twenty
// casks. Built for an event the same evening.
//
// So the test is not "does a page render". It is:
//   · is it the SAME page — same sections, in the same order, as /tet
//   · in the RIGHT two colours, with the Embassy lockup and no club mark
//   · with exactly the owner's ten casks and none of the other ten
//   · and is the club's own /tet still untouched
//
// That last one matters most: the Embassy page is a FORK, and a fork is only
// safe if the original is provably unharmed.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const BASE = process.env.BASE || 'http://localhost:3001'
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const WANT = ['Q5364','Q5088','Q5134','Q5423','Q5177','Q5430','Q5057','Q5113','Q5439','Q5358']
const EXCLUDED = ['Q5172','Q5176','Q5169','Q5086','Q5074','Q5062','Q5429','Q5435','Q5148','Q5133']
const NAVY = 'rgb(21, 29, 42)'   // #151d2a
const GOLD = 'd2b37f'

const tetPass = (() => {
  const exp = String(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return `${exp}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')}`
})()

console.log('\n0 · the data the page stands on')
const board = await (await fetch(`${U}/rest/v1/tet_cask_board?select=cask_ref,status&limit=100`, { headers: svc })).json()
t(Array.isArray(board) && board.length > 0, '0 · the live cask board loaded', `${board.length} casks`)
const refs = new Set(board.map(c => c.cask_ref))
const missing = WANT.filter(r => !refs.has(r))
t(missing.length === 0, '0b · all ten Embassy refs exist', missing.length ? `MISSING: ${missing.join(', ')}` : '10/10')
const gone = board.filter(c => WANT.includes(c.cask_ref) && c.status !== 'available')
t(gone.length === 0, '0c · and all ten are available', gone.length ? gone.map(c => `${c.cask_ref}=${c.status}`).join(', ') : 'all available')

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true })
  await ctx.addCookies([{ name: 'trc_tet', value: tetPass, domain: 'localhost', path: '/' }])

  // Load BOTH pages so the comparison is like for like.
  const emb = await ctx.newPage()
  const trc = await ctx.newPage()
  const r1 = await emb.goto(`${BASE}/embassy/tet`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const r2 = await trc.goto(`${BASE}/tet`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  t(r1?.status() === 200, '1 · the Embassy page loads', `${r1?.status()}`)
  t(r2?.status() === 200, '1b · and the club page still loads', `${r2?.status()}`)
  await emb.waitForTimeout(2500); await trc.waitForTimeout(2500)

  console.log('\n2 · is it the SAME page?')
  const heads = (p) => p.evaluate(() => [...document.querySelectorAll('h2, h3')]
    .map(h => (h.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  const [he, ht] = [await heads(emb), await heads(trc)]
  // NOT a threshold: /tet itself renders 3 h2/h3 (its sections use SectionHead,
  // which is not a heading tag), so "more than four" was my guess about the
  // club page rather than a fact about it. Parity below is the real check; this
  // one only asserts the page is not empty.
  t(he.length > 0 && ht.length > 0, '2 · both pages render sections', `embassy ${he.length}, club ${ht.length}`)
  // And the programme's actual sections, by their copy, in both languages'
  // neutral form — lower-cased, because several are uppercased by CSS.
  const lowBody = (await emb.innerText('body')).toLowerCase()
  for (const marker of ['cask', 'sleeve', 'enquir']) {
    t(lowBody.includes(marker), `2a · the "${marker}" section is present`)
  }
  const sameOrder = JSON.stringify(he) === JSON.stringify(ht)
  t(sameOrder, '2b · same headings, same order as /tet',
    sameOrder ? `${he.length} identical` : `embassy ${he.length} vs club ${ht.length}; first difference: ${
      (he.find((h, i) => h !== ht[i]) || '(none)')} vs ${(ht.find((h, i) => h !== he[i]) || '(none)')}`)
  // The interactive pieces must all be there, not just the prose.
  for (const [sel, label] of [['canvas, svg', 'the cask map / radar artwork'], ['input, select, textarea', 'the enquiry and studio fields'], ['button', 'the controls']]) {
    const n = await emb.locator(sel).count()
    t(n > 0, `2c · ${label} rendered`, `${n}`)
  }

  console.log('\n3 · the right two colours, and the right mark')
  const ground = await emb.evaluate(() => getComputedStyle(document.querySelector('main')).backgroundColor)
  t(ground === NAVY, '3 · the ground is #151d2a', ground)
  const clubGround = await trc.evaluate(() => getComputedStyle(document.querySelector('main')).backgroundColor)
  t(clubGround !== NAVY, '3b · and the club page is NOT navy (its own colour is untouched)', clubGround)
  const html = await emb.content()
  t(html.toLowerCase().includes(GOLD), '3c · Embassy gold #d2b37f is in use')
  t(!/#D4B85A/i.test(html), '3d · and the club gold #D4B85A is nowhere on it')
  // NOT a string match. app/layout.tsx styles every checkbox in the estate and
  // its tick is the club's green; the Embassy page OVERRIDES that rule rather
  // than editing a global on event day, so the green is still present in the
  // stylesheet text while nothing renders in it. Asking the browser what colour
  // the tick actually is, is the question that matters — a string check here
  // would fail on a page that is correct.
  const tick = await emb.evaluate(() => {
    const cb = document.querySelector('input[type="checkbox"]')
    if (!cb) return 'no-checkbox'
    cb.checked = true
    return getComputedStyle(cb, '::after').borderColor || getComputedStyle(cb, '::after').borderBottomColor
  })
  t(tick === 'no-checkbox' || /21, 29, 42/.test(tick),
    '3e · the checkbox tick RENDERS in Embassy navy, not club green', tick)
  // And the club green is not painting any surface of the page.
  const grounds = await emb.evaluate(() => {
    const seen = new Set()
    document.querySelectorAll('main, main *').forEach(el => {
      const bg = getComputedStyle(el).backgroundColor
      if (bg && bg !== 'rgba(0, 0, 0, 0)') seen.add(bg)
    })
    return [...seen]
  })
  t(!grounds.includes('rgb(5, 46, 32)'), '3e2 · and no element is painted club green',
    grounds.includes('rgb(5, 46, 32)') ? 'club green still painted' : `${grounds.length} distinct backgrounds, none club green`)
  const logo = await emb.locator('img[src*="tse-gold.svg"]').count()
  t(logo > 0, '3f · the Embassy lockup is on the page', `${logo} instance(s)`)
  t(await emb.locator('img[src*="logo-mark-cream"]').count() === 0, '3g · and the club lion is not')
  const txt = await emb.innerText('body')
  const clubHits = (txt.match(/rampant/gi) || []).length - (txt.match(/rampant sans/gi) || []).length
  t(clubHits === 0, '3h · the club is named nowhere a guest can read',
    clubHits === 0 ? 'clean' : (txt.match(/.{0,30}rampant.{0,30}/gi) || []).filter(h => !/rampant sans/i.test(h))[0])
  t(!/TheRampantClub\.com/i.test(txt), '3i · and its domain is not on it')

  console.log('\n4 · ten casks, not twenty')
  const body = txt.replace(/\s+/g, ' ')
  t(WANT.every(r => body.includes(r)), '4 · every one of the owner\'s ten is on the page',
    `${WANT.filter(r => body.includes(r)).length}/10`)
  const leaked = EXCLUDED.filter(r => body.includes(r))
  t(leaked.length === 0, '4b · and none of the other ten', leaked.length ? `LEAKED: ${leaked.join(', ')}` : 'none')
  const clubBody = (await trc.innerText('body')).replace(/\s+/g, ' ')
  t(EXCLUDED.some(r => clubBody.includes(r)), '4c · the club page still shows the full twenty (the filter is page-local)',
    `${EXCLUDED.filter(r => clubBody.includes(r)).length} of the excluded still on /tet`)

  console.log('\n5 · no cost reaches the browser')
  const costish = ['cost_vnd', 'landed_cost', 'gross_margin', 'gross_profit'].filter(k => html.includes(k))
  t(costish.length === 0, '5 · no cost or margin field in the payload', costish.length ? `FOUND: ${costish.join(', ')}` : 'clean')

  console.log('\n6 · on a tablet')
  for (const [w, h] of [[1280, 800], [1024, 768], [820, 1180]]) {
    await emb.setViewportSize({ width: w, height: h })
    await emb.waitForTimeout(500)
    const over = await emb.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    t(over <= 1, `6 · ${w}x${h}: no sideways scroll`, `overflow ${over}px`)
  }
  await emb.setViewportSize({ width: 1280, height: 900 })

  console.log('\n7 · the door')
  const bare = await browser.newContext()
  const bp = await bare.newPage()
  await bp.goto(`${BASE}/embassy/tet`, { waitUntil: 'domcontentloaded' })
  await bp.waitForTimeout(1000)
  const gate = await bp.innerText('body')
  t(!WANT.some(r => gate.includes(r)), '7 · without a pass no cask is served')
  const gateGround = await bp.evaluate(() => {
    const el = document.querySelector('main') || document.body
    return getComputedStyle(el).backgroundColor
  })
  t(/21, 29, 42/.test(gateGround) || /#151d2a/i.test(await bp.content()),
    '7b · and the door itself wears the Embassy colours', gateGround)
  t(await bp.locator('img[src*="tse-gold.svg"]').count() > 0, '7c · with the Embassy lockup on it')
  await bare.close()
} finally { await browser.close() }

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
