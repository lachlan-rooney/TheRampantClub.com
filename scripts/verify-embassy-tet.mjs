// ═══════════════════════════════════════════════════════════════════════════
// THE SPIRITS EMBASSY TẾT PAGE — ten casks, the gate, and a tablet.
//   node scripts/verify-embassy-tet.mjs            (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Built and checked on 2026-10-27 for an event the same evening, which is
// exactly when a page gets shown to a buyer without anybody having opened it
// at the size it will actually be used.
//
// What it proves:
//   · without a pass the board is NOT served (the gate renders instead)
//   · exactly the owner's TEN casks appear, and the other ten do not
//   · no cost figure reaches the browser
//   · it works at the two tablet sizes with no sideways scroll and the last
//     card reachable
//   · the strength pills actually change the figures
//   · EN/VN both render
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

// The same pass lib/tet/gate mints: `<expires>.<hmac>`, signed with the JWT secret.
const tetPass = (() => {
  const exp = String(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return `${exp}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')}`
})()

// ── 0 · the ten must be on the live board, or the page is right and the data is wrong
const board = await (await fetch(`${U}/rest/v1/tet_cask_board?select=cask_ref,status&limit=100`, { headers: svc })).json()
const refs = new Set((Array.isArray(board) ? board : []).map(c => c.cask_ref))
t(Array.isArray(board) && board.length > 0, '0 · the live cask board loaded', `${board.length} casks`)
const missing = WANT.filter(r => !refs.has(r))
t(missing.length === 0, '0b · all ten Embassy refs exist on the board',
  missing.length ? `MISSING: ${missing.join(', ')}` : '10/10')
const unavailable = (Array.isArray(board) ? board : []).filter(c => WANT.includes(c.cask_ref) && c.status !== 'available')
t(unavailable.length === 0, '0c · and all ten are still available',
  unavailable.length ? unavailable.map(c => `${c.cask_ref}=${c.status}`).join(', ') : 'all available')

const browser = await chromium.launch()
try {
  // ── 1 · THE GATE
  const bare = await browser.newContext()
  const bp = await bare.newPage()
  await bp.goto(`${BASE}/embassy/tet`, { waitUntil: 'domcontentloaded' })
  await bp.waitForTimeout(800)
  const gateText = (await bp.innerText('body')).toLowerCase()
  t(!gateText.includes('auchentoshan') && !gateText.includes('craigellachie'),
    '1 · without a pass, no cask is served at all')
  t(/password|mật khẩu|18/.test(gateText), '1b · the door is shown instead')
  await bare.close()

  // ── 2 · THE TEN
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true })
  await ctx.addCookies([{ name: 'trc_tet', value: tetPass, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage()
  const resp = await p.goto(`${BASE}/embassy/tet`, { waitUntil: 'domcontentloaded' })
  t(resp?.status() === 200, '2 · with a pass the page loads', `${resp?.status()}`)
  await p.waitForSelector('article', { timeout: 20000 })
  const cards = await p.locator('article').count()
  t(cards === 10, '2b · exactly ten cask cards', `${cards}`)

  const body = (await p.innerText('body')).replace(/\s+/g, ' ')
  for (const r of WANT) {
    if (!body.includes(r)) { t(false, `2c · ${r} is on the page`); break }
  }
  t(WANT.every(r => body.includes(r)), '2c · every one of the owner\'s ten refs is on the page')
  // And the other ten are NOT. Absence is the half that gets forgotten.
  const EXCLUDED = ['Q5172','Q5176','Q5169','Q5086','Q5074','Q5062','Q5429','Q5435','Q5148','Q5133']
  const leaked = EXCLUDED.filter(r => body.includes(r))
  t(leaked.length === 0, '2d · and none of the other ten appear', leaked.length ? `LEAKED: ${leaked.join(', ')}` : 'none')

  // ── 3 · NO COST IN THE BROWSER
  const html = await p.content()
  const costish = ['cost_vnd', 'landed_cost', 'gross_margin', 'gross_profit', 'cost_per_head']
  const found = costish.filter(k => html.includes(k))
  t(found.length === 0, '3 · no cost or margin field reaches the browser', found.length ? `FOUND: ${found.join(', ')}` : 'clean')

  // ── 4 · THE STRENGTH PILLS DO SOMETHING
  const firstFig = () => p.locator('.eb-figval').first().innerText()
  const csVal = await firstFig()
  await p.locator('.eb-pill', { hasText: '40%' }).first().click()
  await p.waitForTimeout(350)
  const reducedVal = await firstFig()
  t(csVal !== reducedVal, '4 · switching strength changes the figures', `${csVal} → ${reducedVal}`)
  const bottlesNow = await p.locator('.eb-figval').nth(1).innerText()
  t(bottlesNow.includes('+') || bottlesNow !== '—', '4b · and reducing shows the extra bottles', bottlesNow.trim())
  await p.locator('.eb-pill', { hasText: /Cask strength|Nguyên/ }).first().click()
  await p.waitForTimeout(300)

  // ── 5 · A TABLET, BOTH WAYS UP
  for (const [w, h] of [[1280, 800], [1024, 768], [820, 1180]]) {
    await p.setViewportSize({ width: w, height: h })
    await p.waitForTimeout(400)
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    t(over <= 1, `5 · ${w}x${h}: no sideways scroll`, `overflow ${over}px`)
    // The last card must be reachable and not sitting under anything. The
    // strength bar is STICKY, not fixed, precisely so it cannot cover it.
    const last = p.locator('article').last()
    await last.scrollIntoViewIfNeeded()
    await p.waitForTimeout(250)
    const box = await last.boundingBox()
    const covered = box ? await p.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return !!(el && !el.closest('article'))
    }, { x: box.x + box.width / 2, y: box.y + 12 }) : true
    t(!covered, `5b · ${w}x${h}: the last card is not covered`)
  }
  await p.setViewportSize({ width: 1280, height: 800 })

  // ── 6 · BOTH LANGUAGES
  const en = (await p.innerText('body')).toLowerCase()
  t(en.includes('per bottle') && en.includes('bottled at'), '6 · English renders')
  const vn = p.locator('button', { hasText: /^VN$/ })
  t(await vn.count() > 0, '6b · the page carries an EN/VN switch')
  if (await vn.count() > 0) {
    await vn.first().click()
    await p.waitForTimeout(900)
    const low = (await p.innerText('body')).toLowerCase()
    t(low.includes('mỗi chai') && low.includes('đóng chai'), '6c · and it truly turns over to Vietnamese',
      low.includes('mỗi chai') ? 'translated' : 'STILL ENGLISH')
    t(!low.includes('per bottle'), '6d · with no English left in the figures')
  }

  // ── 7 · THE BRANDING IS THE EMBASSY'S, NOT THE CLUB'S
  const ground = await p.evaluate(() => getComputedStyle(document.querySelector('main')).backgroundColor)
  t(ground === 'rgb(11, 34, 57)', '7 · the ground is Embassy navy', ground)
  const txt = (await p.innerText('body'))
  t(/SPIRITS\s*EMBASSY/i.test(txt), '7b · the Spirits Embassy wordmark is on it')
  // The club must not be named anywhere a guest can read: not in the body,
  // and not in the footer the root layout adds to every page. 'Rampant Sans'
  // is a FONT and is excluded on purpose — the typeface is shared, the brand
  // is not.
  const clubHits = (txt.match(/rampant/gi) || []).length
  const fontOnly = (txt.match(/rampant sans/gi) || []).length
  t(clubHits - fontOnly === 0, '7c · and The Rampant Club is named nowhere a guest can read',
    clubHits - fontOnly === 0 ? 'clean' : `${clubHits - fontOnly} mention(s): ${(txt.match(/.{0,30}rampant.{0,30}/gi) || []).filter(h => !/rampant sans/i.test(h)).slice(0, 2).join(' | ')}`)
  t(!/TheRampantClub\.com/i.test(txt), '7d · and the club\'s email is not on an Embassy page')
} finally { await browser.close() }

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
