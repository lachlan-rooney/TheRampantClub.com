// ═══════════════════════════════════════════════════════════════════════════
// CAN A MEMBER GET OFF THE AGREEMENT PAGE?
//   node scripts/verify-agree-gate.mjs                        (dev, :3001)
//   BASE=http://localhost:3099 node scripts/verify-agree-gate.mjs   (a BUILD)
//
// ⚠ RUN IT AGAINST A BUILD. The client Router Cache is all but off in dev, so
// check 8 passes on :3001 even with the bug in place. Only `next start` shows
// it.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-10-02: "it's hard to navigate off it when agreed. You have to
// reload the page." middleware sends anybody behind on a required document to
// /members/agree; the page then did router.push('/members'), and the App
// Router had that redirect cached, so it bounced straight back and the page
// looked stuck. A member who has just agreed to a legal document and appears
// to be trapped on the agreement page is the worst moment for that.
//
// Also checks the gate itself: the control must be DISABLED until the document
// has been scrolled to the end, and the document must be set small enough to
// scroll rather than tour.
//
// PROVE THE HARNESS: check 3 asserts the button starts disabled. Remove the
// `disabled={!reached}` and it passes immediately, which is the point of it.
//
// A THROWAWAY member and auth user, removed afterwards: recording a consent on
// a real member_no would silence a question the club is required to ask.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
// ── RUN IT AGAINST A PRODUCTION BUILD TO SEE THE BUG ──────────────────────
// Next's client Router Cache is all but disabled in development, so the
// bounce-back this file exists to catch DOES NOT REPRODUCE on :3001 — check 8
// passes with the broken router.push() still in place. Build, `next start -p
// 3099`, and run with BASE=http://localhost:3099.
const BASE = process.env.BASE || 'http://localhost:3001'
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })
const admin = (p, i) => fetch(`${U}/auth/v1/admin/${p}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const MEMBER = 'ZZ-AGREE', TAG = 'ZZ Agree'
let uid
const wipe = async () => {
  await rest(`member_terms_consents?member_no=eq.${MEMBER}`, { method: 'DELETE' })
  if (uid) {
    await rest(`activity_events?actor=eq.${uid}`, { method: 'DELETE' })
    await rest(`profiles?id=eq.${uid}`, { method: 'DELETE' })
    await admin(`users/${uid}`, { method: 'DELETE' })
  }
  await rest(`members?member_no=eq.${MEMBER}`, { method: 'DELETE' })
}
await wipe()

const cookies = (sub, email) => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
  const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
  const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: sub, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {} } }
  const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
  const out = []
  if (v.length <= 3180) out.push({ name: `sb-${ref}-auth-token`, value: v, domain: 'localhost', path: '/' })
  else for (let i = 0, n = 0; i < v.length; i += 3180, n++) out.push({ name: `sb-${ref}-auth-token.${n}`, value: v.slice(i, i + 3180), domain: 'localhost', path: '/' })
  return out
}

let browser
try {
  await rest('members', { method: 'POST', body: JSON.stringify({ member_no: MEMBER, full_name: `${TAG} Member`, tier: 'Pioneer', status: 'Active' }) })
  const email = `zz-agree-${randomUUID().slice(0, 8)}@example.invalid`
  const made = await (await admin('users', { method: 'POST', body: JSON.stringify({ email, password: `zz-${randomUUID()}`, email_confirm: true }) })).json()
  uid = made.id
  await rest('profiles', { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: uid, display_name: `${TAG} Member`, member_no: MEMBER, is_admin: false }) })

  // Signed the membership agreement already, so only PRIVACY is outstanding —
  // one document, which is the case the owner hit.
  const mt = await (await rest(`terms_versions?doc_key=eq.membership_terms&select=id,version&order=effective_date.desc,created_at.desc&limit=1`)).json()
  await rest('member_terms_consents', { method: 'POST', body: JSON.stringify({
    member_no: MEMBER, terms_version_id: mt[0].id, doc_key: 'membership_terms', granted: true, method: 'signature' }) })

  t(!!uid, '1 · HARNESS: a throwaway member who owes exactly one document', `privacy outstanding`)

  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addCookies(cookies(uid, email))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e).slice(0, 160)))

  // ── THE GATE CATCHES THEM ──────────────────────────────────────────────
  await p.goto(`${BASE}/members`, { waitUntil: 'networkidle' })
  t(p.url().endsWith('/members/agree'), '2 · the gate sends them to the agreement', p.url().replace(BASE, ''))

  await p.waitForSelector('.ag-sheet', { timeout: 15000 })
  const btn = p.locator('button.ag-agree').first()
  t(await btn.isDisabled(), '3 · PROVE THE HARNESS: "I agree" starts DISABLED until it is read')

  // ── IT IS SET SMALL ENOUGH TO SCROLL ───────────────────────────────────
  const set = await p.evaluate(() => {
    const html = document.querySelector('.ag-html')
    const box = document.querySelector('.ag-sheet')
    const h2 = html?.querySelector('h2')
    const px = el => el ? parseFloat(getComputedStyle(el).fontSize) : null
    return { body: px(html), h2: px(h2), h1Shown: !!html?.querySelector('h1') && getComputedStyle(html.querySelector('h1')).display !== 'none',
             scrollHeight: box?.scrollHeight, clientHeight: box?.clientHeight }
  })
  t(set.body <= 12 && set.h2 <= 18, '4 · the document is set as fine print, not editorially', `body ${set.body}px, h2 ${set.h2}px`)
  t(!set.h1Shown, '5 · and does not re-print its own title as a first screenful')
  t(set.scrollHeight > set.clientHeight, '6 · it genuinely needs scrolling', `${set.scrollHeight}px in a ${set.clientHeight}px box`)

  // ── SCROLL, THEN CLICK ─────────────────────────────────────────────────
  await p.evaluate(() => { const b = document.querySelector('.ag-sheet'); b.scrollTop = b.scrollHeight })
  await p.waitForTimeout(900)
  t(await btn.isEnabled(), '7 · scrolling to the end enables it')

  // ── IT MUST BE OBVIOUS, NOT JUST PRESENT ───────────────────────────────
  // It was the site's standard 13px gold text link with a sliding arrow —
  // right for "Read more" on a public page, wrong for the one action between a
  // member and the portal, on a screen that is otherwise all quiet type.
  const look = await p.evaluate(() => {
    const el = document.querySelector('button.ag-agree')
    if (!el) return null
    const c = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return { bg: c.backgroundColor, area: Math.round(r.width * r.height), h: Math.round(r.height) }
  })
  const filled = look && !/rgba\(0, 0, 0, 0\)|transparent/.test(look.bg)
  t(!!filled && look.h >= 44 && look.area >= 6000,
    '7b · and it is a filled, finger-sized object, not a word',
    look ? `${look.bg}, ${look.h}px tall, ${look.area}px²` : 'no button')

  await btn.click()
  await p.waitForTimeout(2500)

  // ── THERE MUST BE A BUTTON (owner: "I just dont see a button to go past") ─
  // The done state was one sentence and nothing else. Asserted as a real,
  // visible, clickable link BEFORE following it — "the url changed eventually"
  // would pass on a timed jump with no control on screen, which is the state
  // being fixed.
  const enter = p.locator('a.ag-enter').first()
  t(await enter.count() > 0 && await enter.isVisible(), '8 · a way through is ON SCREEN once nothing is outstanding',
    await enter.count() ? (await enter.innerText()).replace(/\s+/g, ' ') : 'NO BUTTON')
  t(await enter.getAttribute('href') === '/members', '8b · and it is a real navigation, not a cached push',
    await enter.getAttribute('href') || 'none')

  await enter.click()
  // THE REAL TEST. router.push kept the cached redirect and bounced back here.
  await p.waitForURL(u => !u.toString().includes('/members/agree'), { timeout: 15000 }).catch(() => {})
  t(!p.url().includes('/agree'), '8c · and it takes them THROUGH, with no reload',
    p.url().replace(BASE, '') || '(still on the agreement)')

  const consents = await (await rest(`member_terms_consents?member_no=eq.${MEMBER}&doc_key=eq.privacy&select=granted,terms_version_id`)).json()
  const current = await (await rest(`rpc/current_terms_version`, { method: 'POST', body: JSON.stringify({ p_doc_key: 'privacy' }) })).json()
  t(consents.length === 1 && consents[0].granted === true && consents[0].terms_version_id === current,
    '9 · against the version the register calls current', `v-id matches: ${consents[0]?.terms_version_id === current}`)

  // And it stays through — a second visit must not bounce them back.
  await p.goto(`${BASE}/members`, { waitUntil: 'networkidle' })
  t(!p.url().includes('/agree'), '10 · and they stay through on the next visit', p.url().replace(BASE, ''))
  // ── ARRIVING ALREADY UP TO DATE ────────────────────────────────────────
  // The stranded case: the page open with nothing outstanding and no agreement
  // just made in this session, so no timed redirect could ever fire. Before
  // today this was a sentence and a full stop.
  await p.goto(`${BASE}/members/agree`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  const again = p.locator('a.ag-enter').first()
  t(await again.count() > 0 && await again.isVisible(),
    '11 · and a member who arrives already up to date is not stranded',
    await again.count() ? 'button present' : 'NO WAY OUT')

  // ── AND THE PREAMBLE IS GONE WITH IT ───────────────────────────────────
  // "Before you go on", "Two documents, read at your own pace" and the
  // prevails line are instructions for a task. With nothing outstanding they
  // described work that did not exist, and they sat ABOVE the way out.
  const left = await p.evaluate(() => ({
    h1: !!document.querySelector('.ag-h1'),
    intro: !!document.querySelector('.ag-intro'),
    prevails: !!document.querySelector('.ag-prevails'),
    tabs: !!document.querySelector('.ag-tabs'),
  }))
  t(!left.h1 && !left.intro && !left.prevails, '12 · the preamble is gone once there is nothing to read',
    JSON.stringify(left))
  t(left.tabs, '12b · but the language toggle stays')

  t(errs.length === 0, '13 · no page errors', errs.slice(0, 2).join(' | '))
} catch (e) {
  console.log('✗ THREW:', e?.message || e); fail++
} finally {
  if (browser) await browser.close()
  await wipe()
  const left = await (await rest(`members?member_no=eq.${MEMBER}&select=member_no`)).json()
  t(Array.isArray(left) && left.length === 0, 'it cleaned up after itself',
    left.length ? 'LEFT A MEMBER ROW BEHIND' : 'nothing left')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
