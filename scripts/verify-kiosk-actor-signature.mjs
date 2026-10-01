// ═══════════════════════════════════════════════════════════════════════════
// CAN A TABLET STILL CLAIM TO BE ANYBODY?
//   node scripts/verify-kiosk-actor-signature.mjs      (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// trc_kiosk_staff used to hold a bare team_members id. httpOnly stops a BROWSER
// reading or writing it and stops nothing else: any HTTP client can put what it
// likes in a Cookie header. That is why the cookie was documented as
// "attribution only" and barred from carrying member PII — and why the floor
// staff could not be given the member lookup they need.
//
// It is signed now. These are the checks that say so, against the real routes.
// PROVE THE HARNESS: with the signing removed, check 2 passes (the forgery is
// accepted), which is the whole point of running it.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const NAME = 'ZZ Sig Test', PIN = '802431'
const wipe = async () => {
  const tms = await (await rest(`team_members?display_name=eq.${encodeURIComponent(NAME)}&select=id`)).json()
  for (const x of tms || []) {
    await rest(`kiosk_pin_attempts?team_member_id=eq.${x.id}`, { method: 'DELETE' })
    await rest(`team_members?id=eq.${x.id}`, { method: 'DELETE' })
  }
  await rest('kiosk_devices?label=eq.ZZ-SIG', { method: 'DELETE' })
}
await wipe()

// an owner cookie, to create the throwaway device and set the PIN
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '3e1583db-b881-42ec-aadb-6f69a22fad80', email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: '3e1583db-b881-42ec-aadb-6f69a22fad80', aud: 'authenticated', role: 'authenticated', email: 'lachlanrooney55@gmail.com', app_metadata: {}, user_metadata: {} } }
const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
let admin = ''
if (v.length > 3180) { const ps = []; for (let i = 0, n = 0; i < v.length; i += 3180, n++) ps.push(`sb-${ref}-auth-token.${n}=${v.slice(i, i + 3180)}`); admin = ps.join('; ') }
else admin = `sb-${ref}-auth-token=${v}`

try {
  const [tm] = await (await rest('team_members', { method: 'POST', body: JSON.stringify({ display_name: NAME, active: true, on_rota: false }) })).json()
  await fetch('http://localhost:3001/api/admin/kiosk-devices/pin', { method: 'POST', headers: { cookie: admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: tm.id, pin: PIN }) })
  const made = await (await fetch('http://localhost:3001/api/admin/kiosk-devices', { method: 'POST', headers: { cookie: admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'ZZ-SIG', room: 'The Dining Room' }) })).json()
  const paired = await fetch('http://localhost:3001/api/kiosk/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: made.pair_code }) })
  const dev = ((paired.headers.getSetCookie?.() || []).find(c => c.startsWith('trc_kiosk_device=')) || '').split(';')[0].split('=')[1]

  const me = (cookie) => fetch('http://localhost:3001/api/kiosk/staff/me', { headers: { cookie } }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }))

  // 1 — the real thing
  const pick = await fetch('http://localhost:3001/api/kiosk/staff/pick', {
    method: 'POST', headers: { cookie: `trc_kiosk_device=${dev}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_member_id: tm.id, pin: PIN }),
  })
  const signed = ((pick.headers.getSetCookie?.() || []).find(c => c.startsWith('trc_kiosk_staff=')) || '').split(';')[0].split('=')[1]
  t(pick.ok && !!signed, 'a real PIN sets the acting cookie')
  t(signed !== tm.id && signed.startsWith(tm.id + '.'), 'and the value is SIGNED, not the bare id', signed.slice(0, 44) + '…')
  const real = await me(`trc_kiosk_device=${dev}; trc_kiosk_staff=${signed}`)
  t(real.j?.staff?.display_name === NAME, 'the signed cookie identifies that person')

  // 2 — THE FORGERY. The bare id is exactly what the cookie used to hold.
  const forged = await me(`trc_kiosk_device=${dev}; trc_kiosk_staff=${tm.id}`)
  t(!forged.j?.staff, 'a BARE id is refused — the old format no longer names anybody', `got ${JSON.stringify(forged.j).slice(0, 48)}`)

  // 3 — somebody else's id, signed with a guess
  const bad = `${tm.id}.${Buffer.from('nonsense').toString('base64url')}`
  t(!(await me(`trc_kiosk_device=${dev}; trc_kiosk_staff=${bad}`)).j?.staff, 'a wrong signature is refused')

  // 4 — the ADMIN desk's signature must not work on a tablet
  const adminSigned = `${tm.id}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(`acting:${tm.id}`).digest('base64url')}`
  t(!(await me(`trc_kiosk_device=${dev}; trc_kiosk_staff=${adminSigned}`)).j?.staff, 'a desk cookie does not verify on a tablet')

  // 5 — and the tablet's does not work at the desk
  const deskMe = await fetch('http://localhost:3001/api/admin/acting', { headers: { cookie: `${admin}; trc_admin_staff=${signed}` } })
  t(!(await deskMe.json().catch(() => ({})))?.staff, 'nor a tablet cookie at the desk')
} finally {
  await wipe()
  const left = await (await rest(`team_members?display_name=eq.${encodeURIComponent(NAME)}&select=id`)).json()
  t(Array.isArray(left) && left.length === 0, 'test rows removed')
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
