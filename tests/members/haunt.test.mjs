// ═══════════════════════════════════════════════════════════════════════════
// THE HALLOWEEN HAUNTING — what a sign-up looks like on the 31st of October.
//   node tests/members/haunt.test.mjs              (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-24: "when people click Sign up for the Halloween party I want
// the colour to flash invert black and red instead of the usual colours of the
// page, then slowly melt away."
//
// ⚠ IT SIGNS NOBODY UP. fixture_signup is intercepted at the network and
// answered with the success the database would have given, so the page takes
// the same branch without a row being written against a real member on a real
// fixture. Everything read afterwards is read-only.
//
// PROVEN AGAINST THE BROKEN VERSION: with `isHaunted` forced to true, the
// check that an ordinary fixture stays calm fails; with the guard on
// `!reason` removed, the refusal check fails.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const ORIGIN = 'http://localhost:3001'
const MEMBER = '3e1583db-b881-42ec-aadb-6f69a22fad80'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const payload = { sub: MEMBER, email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} }
const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`
const jwt = `${unsigned}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(unsigned).digest('base64url')}`
const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: MEMBER, aud: 'authenticated', role: 'authenticated', email: payload.email, app_metadata: {}, user_metadata: {} } }
const ref = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\./)[1]
const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const cookies = []
if (value.length > 3180) for (let i = 0, n = 0; i < value.length; i += 3180, n++) cookies.push({ name: `sb-${ref}-auth-token.${n}`, value: value.slice(i, i + 3180), domain: 'localhost', path: '/' })
else cookies.push({ name: `sb-${ref}-auth-token`, value, domain: 'localhost', path: '/' })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }

const b = await chromium.launch()
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  await ctx.addCookies(cookies)
  // The sign-up itself never reaches the database; the page sees success.
  let refused = false
  // Matched on the WHOLE path: '**/rpc/fixture_signup*' also catches
  // fixture_signup_counts, and answering that one with a string crashed the
  // page's refresh — which this suite reported as a page error, correctly.
  await ctx.route(
    url => new URL(url).pathname.endsWith('/rpc/fixture_signup'),
    r => r.fulfill({ status: 200, contentType: 'application/json', body: refused ? '"full"' : 'null' }))

  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message))
  await p.goto(`${ORIGIN}/members/events`, { waitUntil: 'networkidle', timeout: 120000 })
  await p.waitForTimeout(2200)

  const row = n => p.locator('.wo-row', { hasText: n }).first()
  const signUp = async n => {
    const r = row(n); await r.scrollIntoViewIfNeeded()
    await r.locator('.wo-btn').click()
  }

  const halloween = row('Halloween')
  t(await halloween.count() === 1, 'the Halloween party is on the page')

  // ── IT HAPPENS ──────────────────────────────────────────────────────────
  await signUp('Halloween')
  await p.waitForSelector('.hw', { timeout: 4000 })
  t(true, 'signing up for it haunts the page')

  const sheet = await p.$$eval('.hw-sheet', els => els.map(e => ({
    cols: e.children.length,
    filter: getComputedStyle(e.firstElementChild).backdropFilter,
    bg: getComputedStyle(e.firstElementChild).backgroundColor,
  })))
  t(sheet.length === 1, 'one sheet over the page', JSON.stringify(sheet))
  t(sheet[0].cols > 8, 'in columns, so it can melt', String(sheet[0].cols))
  t(/grayscale|invert|sepia/.test(sheet[0].filter),
    'which filters the page BEHIND it rather than painting over it', sheet[0].filter)

  const hw = await p.$eval('.hw', e => ({
    hidden: e.getAttribute('aria-hidden'),
    events: getComputedStyle(e).pointerEvents,
    fixed: getComputedStyle(e).position,
    parent: e.parentElement.tagName,
  }))
  t(hw.hidden === 'true' && hw.events === 'none', 'it is weather, not furniture — aria-hidden, no pointer events', JSON.stringify(hw))
  t(hw.parent === 'BODY', 'portalled to the body, clear of MemberPage’s transform', hw.parent)

  // ── IT FLASHES BETWEEN TWO STATES, NEITHER OF THEM THE CLUB'S ──────────
  const seen = new Set()
  for (let i = 0; i < 16; i++) {
    const f = await p.$eval('.hw-sheet span', e => {
      const s = getComputedStyle(e)
      return s.backdropFilter + ' | ' + s.backgroundColor
    }).catch(() => null)
    if (f) seen.add(f)
    await p.waitForTimeout(45)
  }
  const states = [...seen]
  t(states.length >= 2, 'the page flashes between two states', String(states.length))
  t(states.some(f => /invert\(1\)/.test(f)), 'one of them is the invert', states.find(f => /invert/.test(f))?.slice(0, 60))
  t(states.some(f => /rgba?\(1[0-9]{2}, *\d+, *\d+/.test(f)), 'and it is washed red, not the club’s green',
    states.find(f => /rgba?\(1/.test(f))?.slice(-30))
  t(states.some(f => /sepia|hue-rotate/.test(f) && /transparent|rgba\(0, 0, 0, 0\)/.test(f)),
    'the other is black with red on it', states.find(f => /sepia/.test(f))?.slice(0, 60))

  await p.waitForTimeout(900)
  const fallen = await p.$$eval('.hw-sheet span', els => els.map(e => {
    const m = new DOMMatrixReadOnly(getComputedStyle(e).transform)
    return Math.round(m.f)
  })).catch(() => [])
  await p.waitForTimeout(700)
  const later = await p.$$eval('.hw-sheet span', els => els.map(e => {
    const m = new DOMMatrixReadOnly(getComputedStyle(e).transform)
    return Math.round(m.f)
  })).catch(() => [])
  t(fallen.some(v => v > 0), 'the columns run down the screen', JSON.stringify(fallen.slice(0, 6)))
  t(later.length === 0 || later.some((v, i) => v > (fallen[i] ?? 0)), 'and keep going', JSON.stringify(later.slice(0, 6)))
  t(new Set(fallen).size > 1, 'each on its own beat, so it drips rather than wipes', `${new Set(fallen).size} distinct offsets`)

  // ── IT IS BLOOD, NOT A CURTAIN ──────────────────────────────────────────
  // Owner, 2026-09-24: "can the blood dripping be more blood/teardroppy?"
  // Two things carry that: the run still CLINGING to each column, and the
  // drops that have LET GO and are running on down the page by themselves.
  const strand = await p.$eval('.hw-sheet span', e => {
    const s = getComputedStyle(e, '::before')
    return { h: parseFloat(s.height), mask: s.maskImage || s.webkitMaskImage, radius: s.borderTopLeftRadius }
  }).catch(() => null)
  t(!!strand && strand.h > 10, 'a run still clings to the edge of each column', JSON.stringify(strand?.h))
  t(/gradient/.test(strand?.mask || ''), 'and fades out at its head, like a smear', (strand?.mask || '').slice(0, 40))

  const drips = await p.$$eval('.hw-drips i', els => els.map(e => {
    const s = getComputedStyle(e)
    return { y: Math.round(new DOMMatrixReadOnly(s.transform).f), mask: (s.maskImage || s.webkitMaskImage || '').slice(0, 20), filter: s.backdropFilter.slice(0, 20), h: parseFloat(s.height) }
  })).catch(() => [])
  t(drips.length > 8, 'loose drops as well as the sheet', String(drips.length))
  t(drips.every(d => /gradient/.test(d.mask)), 'each one trailing its own smear')
  t(drips.every(d => /grayscale|sepia/.test(d.filter)), 'and filtering the page behind it, so it is the same blood')
  t(drips.some(d => d.h > 30), 'they are runs, not beads', `tallest ${Math.max(...drips.map(d => d.h))}px`)
  await p.waitForTimeout(500)
  const later2 = await p.$$eval('.hw-drips i', els => els.map(e => Math.round(new DOMMatrixReadOnly(getComputedStyle(e).transform).f))).catch(() => [])
  t(later2.some((v, i) => v > (drips[i]?.y ?? 0)), 'still running after the sheet has gone past',
    `${drips[0]?.y} → ${later2[0]}`)

  // ── AND THEN IT IS GONE ─────────────────────────────────────────────────
  await p.waitForSelector('.hw', { state: 'detached', timeout: 6000 })
  t(await p.locator('.hw').count() === 0, 'it takes itself off the page when it is done')

  // ── EVERY OTHER FIXTURE IS ORDINARY ─────────────────────────────────────
  const plain = (await p.$$eval('.wo-row .wo-title', els => els.map(e => e.textContent)))
    .find(x => !/hallowe/i.test(x) && x !== 'Halloween Haunting!')
  await signUp(plain)
  await p.waitForTimeout(1200)
  t(await p.locator('.hw').count() === 0, `signing up for "${plain?.slice(0, 28)}" does not haunt anything`)

  // ── A REFUSAL IS NOT A CELEBRATION ──────────────────────────────────────
  refused = true
  await signUp('Halloween')
  await p.waitForTimeout(1200)
  t(await p.locator('.hw').count() === 0, 'and a full party refuses without the light show')

  t(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '))
} finally {
  await b.close()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
