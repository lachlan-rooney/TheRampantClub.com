// ═══════════════════════════════════════════════════════════════════════════
// IS A MEMBER MADE TO SET A PIN, AND CAN ANYONE GET STUCK?
//   node scripts/verify-pin-gate.mjs                         (dev, :3001)
//   BASE=http://localhost:3099 node scripts/verify-pin-gate.mjs   (a BUILD)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-10-02: "They should have to set their pin on first log in/sign
// up." Setting one was a field on a profile page nobody had to visit, so a
// member's first tap on a club tablet was the moment they found out they had
// none — at the bar, with staff watching.
//
// THE TWO WAYS THIS GOES BADLY WRONG, both checked here:
//
//   · THE DEADLOCK (4). Written as two independent middleware blocks, a member
//     owing documents AND a PIN is sent /members → /members/agree → /members/pin
//     → /members/agree, forever. The two steps are decided together for exactly
//     this reason, and this check walks a member who owes both.
//
//   · THE TRAP (7). my_kiosk_pin_state() returns NO ROWS for a profile with no
//     member_no — every staff and admin account — and set_my_kiosk_pin refuses
//     them outright. Gating on "no row" instead of has_pin === false would lock
//     every admin out of /members with no way to comply.
//
// Throwaway member and auth user, removed at the end.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const BASE = process.env.BASE || 'http://localhost:3001'
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })
const admin = (p, i) => fetch(`${U}/auth/v1/admin/${p}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const M = 'ZZ-PINGATE', TAG = 'ZZ PinGate'
let member, staff
const cookieFor = (sub, email) => {
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

const wipe = async () => {
  await rest(`member_kiosk_pins?member_no=eq.${M}`, { method: 'DELETE' })
  await rest(`member_terms_consents?member_no=eq.${M}`, { method: 'DELETE' })
  for (const id of [member, staff].filter(Boolean)) {
    await rest(`activity_events?actor=eq.${id}`, { method: 'DELETE' })
    await rest(`profiles?id=eq.${id}`, { method: 'DELETE' })
    await admin(`users/${id}`, { method: 'DELETE' })
  }
  await rest(`members?member_no=eq.${M}`, { method: 'DELETE' })
}
await wipe()

let browser
try {
  // A member who owes BOTH: no consent on anything, no PIN.
  await rest('members', { method: 'POST', body: JSON.stringify({ member_no: M, full_name: `${TAG} Member`, tier: 'Pioneer', status: 'Active' }) })
  const mEmail = `zz-pingate-${randomUUID().slice(0, 8)}@example.invalid`
  member = (await (await admin('users', { method: 'POST', body: JSON.stringify({ email: mEmail, password: `zz-${randomUUID()}`, email_confirm: true }) })).json()).id
  await rest('profiles', { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: member, display_name: `${TAG} Member`, member_no: M, is_admin: false }) })

  // And a login with NO membership, which is every staff account.
  const sEmail = `zz-pingate-staff-${randomUUID().slice(0, 8)}@example.invalid`
  staff = (await (await admin('users', { method: 'POST', body: JSON.stringify({ email: sEmail, password: `zz-${randomUUID()}`, email_confirm: true }) })).json()).id
  await rest('profiles', { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: staff, display_name: `${TAG} Staff`, member_no: null, is_admin: false }) })

  t(!!member && !!staff, '1 · HARNESS: a member owing both, and a login with no membership')

  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addCookies(cookieFor(member, mEmail))
  const p = await ctx.newPage()

  // ── DOCUMENTS FIRST ────────────────────────────────────────────────────
  await p.goto(`${BASE}/members/calendar`, { waitUntil: 'networkidle' })
  t(p.url().endsWith('/members/agree'), '2 · a legal obligation outranks the PIN', p.url().replace(BASE, ''))

  // ── PROVE THE HARNESS: NO DEADLOCK ─────────────────────────────────────
  // Two independent gates would bounce /members/agree → /members/pin →
  // /members/agree. The member must be allowed to STAND on the step they owe.
  await p.goto(`${BASE}/members/agree`, { waitUntil: 'networkidle' })
  t(p.url().endsWith('/members/agree'), '3 · and they can stand on it — no bounce', p.url().replace(BASE, ''))

  // MAIN-FRAME DOCUMENT REDIRECTS ONLY. Counting every 3xx on the page gave 32
  // — Next's RSC prefetches for each nav link each answer with one, so the
  // number said "loop" when there was none. A loop is a chain the MAIN FRAME
  // cannot get out of; that is the only thing worth counting.
  const chain = []
  const onNav = r => {
    const req = r.request()
    if (req.resourceType() !== 'document' || req.frame() !== p.mainFrame()) return
    if (r.status() >= 300 && r.status() < 400) chain.push(new URL(req.url()).pathname)
  }
  p.on('response', onNav)
  await p.goto(`${BASE}/members`, { waitUntil: 'networkidle' })
  p.off('response', onNav)
  t(chain.length <= 2 && p.url().endsWith('/members/agree'),
    '4 · PROVE THE HARNESS: no redirect loop between the two steps',
    `${chain.length} hop(s): ${chain.join(' → ') || 'none'} → ${p.url().replace(BASE, '')}`)

  // Consent to everything, through the app's own route.
  const cookie = cookieFor(member, mEmail).map(c => `${c.name}=${c.value}`).join('; ')
  const st = await (await fetch(`${BASE}/api/members/documents`, { headers: { cookie } })).json()
  for (const d of (st.documents || []).filter(x => x.needs_action)) {
    const r = await fetch(`${BASE}/api/members/documents/agree`, { method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_key: d.doc_key, granted: true, language: 'en', scrolled_to_end: true }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { t(false, `(setup) could not consent to ${d.doc_key}`, JSON.stringify(j)); break }
    // THE PRIVACY NOTICE MUST NOT BE EMAILED (owner, 2026-10-02).
    if (d.doc_key === 'privacy') t(j.emailed === false, '5 · the privacy notice is NOT emailed', `emailed=${j.emailed}`)
  }

  // ── NOW THE PIN ────────────────────────────────────────────────────────
  await p.goto(`${BASE}/members/calendar`, { waitUntil: 'networkidle' })
  t(p.url().endsWith('/members/pin'), '6 · with the documents done, the PIN is the step', p.url().replace(BASE, ''))
  const body = (await p.innerText('body')).replace(/\s+/g, ' ').toLowerCase()
  t(body.includes('one thing before you go on'), '6b · and the page says why they were sent')

  // ── PROVE THE HARNESS: STAFF ARE NEVER TRAPPED ─────────────────────────
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await sctx.addCookies(cookieFor(staff, sEmail))
  const sp = await sctx.newPage()
  await sp.goto(`${BASE}/members`, { waitUntil: 'networkidle' })
  t(!sp.url().includes('/members/pin'), '7 · PROVE THE HARNESS: a login with no membership is never sent to set one',
    sp.url().replace(BASE, ''))
  await sctx.close()

  // Set it, through the real route, and the gate must open.
  const setR = await fetch(`${BASE}/api/members/kiosk-pin`, { method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '836491' }) })
  t(setR.ok, '8 · a PIN can be set', `status ${setR.status}`)

  await p.goto(`${BASE}/members/calendar`, { waitUntil: 'networkidle' })
  t(p.url().endsWith('/members/calendar'), '9 · and the portal opens', p.url().replace(BASE, ''))

  // And /members/pin stays visitable afterwards, to change it.
  await p.goto(`${BASE}/members/pin`, { waitUntil: 'networkidle' })
  t(p.url().endsWith('/members/pin'), '10 · the PIN page is still reachable to change it later')
} catch (e) {
  console.log('✗ THREW:', e?.message || e); fail++
} finally {
  if (browser) await browser.close()
  await wipe()
  const left = await (await rest(`members?member_no=eq.${M}&select=member_no`)).json()
  t(Array.isArray(left) && left.length === 0, 'it cleaned up after itself', left.length ? 'LEFT ROWS' : 'nothing left')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
