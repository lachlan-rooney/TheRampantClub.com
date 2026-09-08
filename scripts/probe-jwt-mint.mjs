#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// KIOSK PHASE 2 — THE JWT MINT PROBE  ·  the hard gate before the session layer
// ───────────────────────────────────────────────────────────────────────────
// Proves (or disproves) the one assumption the member session rests on: that a
// token we self-sign with the project's JWT secret is accepted by PostgREST and
// that auth.uid() resolves from it, so member-own RLS applies unchanged.
//
// READ-ONLY. Creates nothing, writes nothing, touches no member_no key.
//
//   node scripts/probe-jwt-mint.mjs
//
// Exit 0 = PASS (build the HS256 mint) · 1 = FAIL (take the GoTrue fallback)
//          2 = BLOCKED (secret absent — nothing was proven either way)
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const SVC  = env.SUPABASE_SERVICE_ROLE_KEY
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SECRET = env.SUPABASE_JWT_SECRET

const say = (ok, label, detail = '') => console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`)

if (!SECRET) {
  console.log('\n⚠  BLOCKED — SUPABASE_JWT_SECRET is not in .env.local.\n')
  console.log('   Supabase dashboard → Project Settings → API → JWT Settings → JWT Secret.')
  console.log('   Add it to .env.local AND Vercel. Server-only — never NEXT_PUBLIC_.')
  console.log('   It mints a token as ANY user, so it belongs in the same tier as the')
  console.log('   service-role key.\n')
  console.log('   Nothing has been proven either way. The session layer stays unbuilt.\n')
  process.exit(2)
}

// ── the mint. This is the ONLY place a token is signed; the algorithm is the
//    single swappable point if the project moves to asymmetric signing keys. ──
const b64u = buf => Buffer.from(buf).toString('base64url')
function mint(profileId, { ttlSeconds = 60, claims = {} } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const header  = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64u(JSON.stringify({
    sub: profileId, aud: 'authenticated', role: 'authenticated',
    iat: now, exp: now + ttlSeconds, ...claims,
  }))
  const body = `${header}.${payload}`
  return `${body}.${b64u(createHmac('sha256', SECRET).update(body).digest())}`
}

const rest = (path, token) =>
  fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })

let failures = 0
const check = (ok, label, detail) => { say(ok, label, detail); if (!ok) failures++ }

console.log('\n── JWT mint probe ────────────────────────────────────────────\n')

// Pick two REAL linked members read-only via the service role. Nothing is written.
const r = await fetch(
  `${URL_}/rest/v1/profiles?select=id,member_no&member_no=not.is.null&limit=2`,
  { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } })
const linked = await r.json()

if (!Array.isArray(linked) || linked.length === 0) {
  console.log('✗ No profile is linked to a member (profiles.member_no is null everywhere).')
  console.log('  The kiosk cannot act as a member without a linked login. Probe cannot run.\n')
  process.exit(1)
}
console.log(`  ${linked.length} linked profile(s) available for the probe\n`)

const A = linked[0]

// 1 — is a self-signed token accepted at all?
const rA = await rest(`profiles?select=id,member_no&id=eq.${A.id}`, mint(A.id))
const bodyA = await rA.json()
check(rA.status === 200, 'PostgREST accepts a self-signed HS256 token',
      `HTTP ${rA.status}${rA.status !== 200 ? ' · ' + JSON.stringify(bodyA).slice(0, 160) : ''}`)

// 2 — does auth.uid() actually resolve? The own-profile policy is
//     (id = auth.uid() or is_admin_uid(auth.uid())) — a row back means it resolved.
check(Array.isArray(bodyA) && bodyA.length === 1 && bodyA[0].id === A.id,
      'auth.uid() resolves to the minted subject', `${(bodyA || []).length} row(s)`)

// 3 — a token signed with the WRONG secret must be refused (proves it is really
//     verifying the signature rather than waving anything through).
const bad = (() => {
  const now = Math.floor(Date.now() / 1000)
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64u(JSON.stringify({ sub: A.id, aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 60 }))
  return `${h}.${p}.${b64u(createHmac('sha256', 'not-the-secret').update(`${h}.${p}`).digest())}`
})()
const rBad = await rest(`profiles?select=id&id=eq.${A.id}`, bad)
check(rBad.status === 401, 'a wrongly-signed token is refused', `HTTP ${rBad.status}`)

// 4 — an EXPIRED token must be refused. NOTE: verification allows ~60s of clock
//     skew leeway, so this must test well beyond it. At -30s the token is still
//     ACCEPTED, which is correct behaviour, not a defect.
const rExp = await rest(`profiles?select=id&id=eq.${A.id}`, mint(A.id, { ttlSeconds: -180 }))
check(rExp.status === 401, 'a token expired beyond the skew window is refused', `HTTP ${rExp.status}`)

const rSkew = await rest(`profiles?select=id&id=eq.${A.id}`, mint(A.id, { ttlSeconds: -30 }))
console.log(`  · leeway: exp 30s in the past → HTTP ${rSkew.status} (~60s skew tolerance; expected 200)`)

// 5 — THE ONE THAT BITES. A token carrying NO exp claim is accepted, and never
//     expires. So the mint must ALWAYS set exp — it can never be optional.
const noExp = (() => {
  const now = Math.floor(Date.now() / 1000)
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64u(JSON.stringify({ sub: A.id, aud: 'authenticated', role: 'authenticated', iat: now }))
  return `${h}.${p}.${b64u(createHmac('sha256', SECRET).update(`${h}.${p}`).digest())}`
})()
const rNoExp = await rest(`profiles?select=id&id=eq.${A.id}`, noExp)
console.log(`  · a token with NO exp claim → HTTP ${rNoExp.status}` +
            (rNoExp.status === 200 ? '  ⚠ never expires — mint() must always set exp' : ''))

// …so assert our own mint always does. exp is not an option on this code path.
const decoded = JSON.parse(Buffer.from(mint(A.id).split('.')[1], 'base64url').toString())
check(typeof decoded.exp === 'number' && decoded.exp > Math.floor(Date.now() / 1000),
      'our mint always sets a future exp', `exp in ${decoded.exp - Math.floor(Date.now() / 1000)}s`)

// 5 — member-own RLS holds under a minted token: A cannot read B's taste profile.
if (linked.length > 1) {
  const B = linked[1]
  const rIso = await rest(`member_taste_profiles?select=member_no&member_no=eq.${B.member_no}`, mint(A.id))
  const iso = await rIso.json()
  check(Array.isArray(iso) && iso.length === 0,
        'member-own RLS holds: A cannot read B under a minted token',
        `${Array.isArray(iso) ? iso.length : '?'} row(s) leaked`)
} else {
  console.log('  (only one linked profile — isolation check deferred to the ZZ-TEST suite)')
}

console.log('')
if (failures === 0) {
  console.log('PASS — the HS256 mint is sound. Build the session layer on it.\n')
  process.exit(0)
}
console.log(`FAIL — ${failures} check(s) failed. Do NOT build the HS256 mint;`)
console.log('take the GoTrue admin-generated-session fallback instead.\n')
process.exit(1)
