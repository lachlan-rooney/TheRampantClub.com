// ═══════════════════════════════════════════════════════════════════════════
// MARKED FULL, AND THE COUNT SAYS SO — What's On, as a member sees it.
//   node tests/members/fixture-full.test.mjs        (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: "If I click full mark full on the events admin page, It
// should show on the public page that the full number of attendees are
// attending."
//
// `is_full` is the switch staff throw when the places are gone but the names
// are not in the system — taken on Zalo, or by the hotline. It drove the FULL
// pill and the sign-up button, and not the number beside them, so an event
// staff had closed read "0/50 in" with an empty bar next to the word Full.
//
// ⚠ IT CREATES A THROWAWAY FIXTURE and deletes it at the end whether the test
// passes or fails: titled as a test, dated years out so it cannot be mistaken
// for something the club is running, and with no signups on it. It touches no
// real fixture — the real ones are the club's events, and a stray is_full on
// one of those is a door closed on members who could have come.
//
// PROVEN AGAINST THE BROKEN VERSION: with `count` back to the raw signup
// count, the "8/8" check reads 0/8 and fails.
//
// ⚠ MATCH THE RENDERED CASE. The page uppercases the pill and the button in
// CSS and innerText returns what is on screen, so /Full/ does not match FULL.
// Every text check here is case-insensitive for that reason.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const ORIGIN = 'http://localhost:3001'
const MEMBER = '3e1583db-b881-42ec-aadb-6f69a22fad80'
const TITLE = 'AUTOMATED TEST — ignore (full switch)'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const payload = { sub: MEMBER, email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} }
const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`
const jwt = `${unsigned}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(unsigned).digest('base64url')}`
const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: MEMBER, aud: 'authenticated', role: 'authenticated', email: payload.email, app_metadata: {}, user_metadata: {} } }
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const cookies = []
if (value.length > 3180) for (let i = 0, n = 0; i < value.length; i += 3180, n++) cookies.push({ name: `sb-${ref}-auth-token.${n}`, value: value.slice(i, i + 3180), domain: 'localhost', path: '/' })
else cookies.push({ name: `sb-${ref}-auth-token`, value, domain: 'localhost', path: '/' })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }

let fixtureId = null
const b = await chromium.launch()
try {
  const made = await (await rest('fixtures', {
    method: 'POST',
    body: JSON.stringify({
      sport: 'other', type: 'social', title: TITLE,
      description: 'A throwaway fixture written by a test.',
      date: '2029-12-31T12:00:00+00:00', location: 'Nowhere',
      max_signups: 8, is_full: false,
    }),
  })).json()
  fixtureId = made?.[0]?.id
  t(!!fixtureId, 'a throwaway fixture to switch, capacity 8, nobody signed up', JSON.stringify(made).slice(0, 120))

  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addCookies(cookies)
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message))
  const row = () => p.locator('.wo-row', { hasText: 'AUTOMATED TEST' }).first()
  const read = async () => {
    await p.goto(`${ORIGIN}/members/events`, { waitUntil: 'networkidle', timeout: 120000 })
    await p.waitForTimeout(2200)
    await row().scrollIntoViewIfNeeded()
    return {
      text: (await row().innerText()).replace(/\s+/g, ' '),
      fill: await row().locator('.wo-bar span').evaluate(e => e.style.width).catch(() => null),
    }
  }

  // ── BEFORE: empty, and it says so ───────────────────────────────────────
  const before = await read()
  t(/0\/8 in|0\/8 tham gia/.test(before.text), 'before the switch it reads 0/8', before.text.slice(0, 80))
  t(before.fill === '0%', 'and the bar is empty', String(before.fill))
  t(/sign me up|đăng ký/i.test(before.text), 'and a member can put their name down', before.text.slice(-60))

  // ── THE SWITCH ──────────────────────────────────────────────────────────
  await rest(`fixtures?id=eq.${fixtureId}`, { method: 'PATCH', body: JSON.stringify({ is_full: true }) })

  const after = await read()
  t(/8\/8 in|8\/8 tham gia/.test(after.text), 'marked full, every place reads as taken: 8/8', after.text.slice(0, 80))
  t(after.fill === '100%', 'and the bar is full', String(after.fill))
  t(/\bfull\b|hết chỗ/i.test(after.text), 'the pill still says Full', after.text.slice(-60))
  t(!/sign me up/i.test(after.text), 'and nobody else can put their name down', after.text.slice(-60))

  // ── AND BACK ────────────────────────────────────────────────────────────
  await rest(`fixtures?id=eq.${fixtureId}`, { method: 'PATCH', body: JSON.stringify({ is_full: false }) })
  const reopened = await read()
  t(/0\/8 in|0\/8 tham gia/.test(reopened.text), 'reopening it tells the truth again: 0/8', reopened.text.slice(0, 80))
  t(reopened.fill === '0%', 'and the bar empties', String(reopened.fill))

  t(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '))
} finally {
  // THE DELETE GETS FIVE GOES. The first run of this test lost its network on
  // the way out and left the throwaway fixture on file, marked full, where
  // members would have seen it. Cleaning up is the one step that must not
  // depend on a good connection.
  let left = []
  for (let i = 0; i < 5; i++) {
    try {
      if (fixtureId) await rest(`fixtures?id=eq.${fixtureId}`, { method: 'DELETE' })
      left = await (await rest('fixtures?select=id,title&title=like.*AUTOMATED TEST*')).json()
      if (Array.isArray(left) && left.length === 0) break
      for (const f of left) await rest(`fixtures?id=eq.${f.id}`, { method: 'DELETE' })
    } catch {
      await new Promise(r => setTimeout(r, 2500))
    }
  }
  t(Array.isArray(left) && left.length === 0, 'the throwaway fixture is gone', JSON.stringify(left))
  await b.close()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
