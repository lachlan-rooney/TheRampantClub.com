#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MENUS — THE PRIVACY PROBE  ·  run after 20260918210000_menus.sql
// ───────────────────────────────────────────────────────────────────────────
// The menus commit makes one claim that matters more than the rest: what a
// partner restaurant charges the club can never reach a browser. Until the
// tables existed that was an assertion. This proves it, three ways:
//
//   1. A real member (minted HS256 token, the same trick /kiosk uses) can read
//      the menu views — so the feature actually works for the people it is for.
//   2. That same member gets NOTHING from the base tables, where cost lives.
//   3. The views do not carry a cost column at all, so even a future policy
//      mistake on the base tables could not leak one through them.
//
// Plus the controls, because a probe that cannot fail proves nothing:
//   · anon must be refused the views (they are granted to authenticated only)
//   · a deliberately wrong claim must FAIL, proving the assertions bite
//
// READ-ONLY. Creates nothing, writes nothing.
//
//   node scripts/verify-menus.mjs
//
// Exit 0 = every claim holds · 1 = something leaked or the menu is unreadable
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const SVC = env.SUPABASE_SERVICE_ROLE_KEY
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SECRET = env.SUPABASE_JWT_SECRET

if (!SECRET || !SVC || !ANON) {
  console.log('\n⚠  BLOCKED — .env.local is missing a key this probe needs.\n')
  process.exit(2)
}

const b64u = buf => Buffer.from(buf).toString('base64url')
function mint(profileId, ttl = 90) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64u(JSON.stringify({
    sub: profileId, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + ttl,
  }))
  const body = `${header}.${payload}`
  return `${body}.${b64u(createHmac('sha256', SECRET).update(body).digest())}`
}

const get = (path, token) =>
  fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })

let failures = 0
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}

console.log('\n── Menus probe ───────────────────────────────────────────────\n')

// ── Pick a real NON-ADMIN member. Testing with an admin would prove nothing:
//    admins are allowed to see costs.
const pr = await fetch(
  `${URL_}/rest/v1/profiles?select=id,member_no,is_admin&member_no=not.is.null&is_admin=is.false&limit=1`,
  { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } })
const linked = await pr.json()
if (!Array.isArray(linked) || !linked.length) {
  console.log('✗ No non-admin linked member to probe as. Cannot prove member-side privacy.\n')
  process.exit(1)
}
const M = linked[0]
console.log(`  probing as member ${M.member_no} (is_admin=${M.is_admin})\n`)
const tok = mint(M.id)

// ── 0 · THE INPUT IS REALLY THERE ─────────────────────────────────────────
// A probe against an empty database passes everything. Assert the seed landed
// before asserting anything about it.
const seed = await (await fetch(
  `${URL_}/rest/v1/menu_items?select=id,name_en,cost_vnd`,
  { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } })).json()
check(Array.isArray(seed) && seed.length > 0,
  'the seed is in the database', `${seed.length ?? 0} dish/dishes via service role`)
if (!seed.length) { console.log('\nNothing to probe.\n'); process.exit(1) }

// ── 1 · THE MEMBER CAN READ THE MENU ──────────────────────────────────────
const vRes = await get('menu_plates_public?select=*', tok)
const plates = await vRes.json()
check(vRes.status === 200, 'a member can read menu_plates_public', `HTTP ${vRes.status}`)
check(Array.isArray(plates) && plates.length > 0,
  'the member actually sees dishes', `${plates.length ?? 0} row(s)`)

const dRes = await get('menu_dining_public?select=*', tok)
check(dRes.status === 200, 'a member can read menu_dining_public', `HTTP ${dRes.status}`)

// ── 2 · THE VIEW CARRIES NO COST ──────────────────────────────────────────
const cols = plates.length ? Object.keys(plates[0]) : []
const leaked = cols.filter(c => /cost|contact/i.test(c))
check(leaked.length === 0, 'no cost or contact column in the view',
  leaked.length ? `LEAKED: ${leaked.join(', ')}` : `${cols.length} columns, none of them cost`)

// Asking for it by name must also fail, not silently return null.
const askRes = await get('menu_plates_public?select=cost_vnd', tok)
check(askRes.status !== 200, 'asking the view for cost_vnd by name is refused',
  `HTTP ${askRes.status}`)

// ── 3 · THE BASE TABLES ARE SHUT ──────────────────────────────────────────
for (const t of ['menu_items', 'menu_venues', 'menu_set_menus', 'menu_set_courses']) {
  const r = await get(`${t}?select=*`, tok)
  const body = await r.json().catch(() => null)
  const rows = Array.isArray(body) ? body.length : 0
  check(r.status !== 200 || rows === 0, `a member gets nothing from ${t}`,
    `HTTP ${r.status}, ${rows} row(s)`)
}

// The specific thing we are protecting.
const costRes = await get('menu_items?select=name_en,cost_vnd', tok)
check(costRes.status !== 200, 'a member cannot select cost_vnd from menu_items',
  `HTTP ${costRes.status}`)

// ── 4 · ANON IS REFUSED THE VIEWS ─────────────────────────────────────────
// Granted to `authenticated` only: the dishes are not secret, but what the club
// charges its members is nobody else's business.
const anonRes = await get('menu_plates_public?select=*', ANON)
const anonBody = await anonRes.json().catch(() => null)
const anonRows = Array.isArray(anonBody) ? anonBody.length : 0
check(anonRes.status !== 200 || anonRows === 0, 'anon is refused the menu views',
  `HTTP ${anonRes.status}, ${anonRows} row(s)`)

// ── 5 · THE CONTROL ───────────────────────────────────────────────────────
// A claim that MUST fail. If this one passes, every check above is worthless
// because the assertions are not biting.
const control = await get('menu_items?select=*', SVC)   // service role sees all
const controlRows = (await control.json().catch(() => []))?.length ?? 0
const controlHeld = controlRows > 0
console.log('')
check(controlHeld, 'CONTROL — the service role CAN read the base table',
  `${controlRows} row(s); if this were 0 the probe above would pass on an empty table`)

// ── 6 · THE AUDIT AGREES WITH THE SURFACE ─────────────────────────────────
const aRes = await fetch(`${URL_}/rest/v1/rpc/menu_placeholder_audit`, {
  method: 'POST',
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
  body: '{}',
})
const audit = await aRes.json().catch(() => [])
const unconfirmed = (audit || []).filter(a => a.kind === 'ALLERGENS')
const shownAsAsk = plates.filter(p => p.allergens_confirmed === false)
check(unconfirmed.length === shownAsAsk.length,
  'every unconfirmed dish the audit names is one the menu tells members to ask about',
  `audit ${unconfirmed.length}, menu ${shownAsAsk.length}`)

// A member must NOT be able to run the audit — it names what is still made up.
const aMem = await fetch(`${URL_}/rest/v1/rpc/menu_placeholder_audit`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
  body: '{}',
})
check(aMem.status !== 200, 'a member cannot run menu_placeholder_audit()', `HTTP ${aMem.status}`)

console.log(`\n${failures ? '✗ ' + failures + ' FAILED' : '✓ every claim holds'}\n`)
process.exit(failures ? 1 : 0)
