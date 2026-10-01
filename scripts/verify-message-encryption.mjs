// ═══════════════════════════════════════════════════════════════════════════
// ARE THE MESSAGES ACTUALLY ENCRYPTED?
//   node scripts/verify-message-encryption.mjs        (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// The members' page says "All messages are encrypted" and "staff never read
// your messages". This is the check that those sentences are true, run against
// the real write path and the real database rather than against the library.
//
// PROVE THE HARNESS: step 2 reads the raw row with the SERVICE ROLE — the most
// privileged credential there is — and fails if the plaintext appears in it.
// Before sealing was added, that step fails, which is how it is known to be
// looking in the right place.
//
// Every row it creates is removed at the end.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, init = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...init })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const cookieFor = (sub, email) => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
  const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
  const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: sub, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {} } }
  const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
  if (v.length <= 3180) return `sb-${ref}-auth-token=${v}`
  const ps = []; for (let i = 0, n = 0; i < v.length; i += 3180, n++) ps.push(`sb-${ref}-auth-token.${n}=${v.slice(i, i + 3180)}`)
  return ps.join('; ')
}

// Two real members, and the secret one of them is about to type.
const members = await (await rest('profiles?is_admin=eq.false&member_no=not.is.null&select=id,display_name&limit=2')).json()
if (members.length < 2) { console.log('need two non-admin members with a member_no'); process.exit(1) }
const [A, B] = members
const SECRET = `zz-sealed-secret-${randomUUID()}`

// A direct thread between them, as an accepted introduction would make.
const [thread] = await (await rest('threads', { method: 'POST', body: JSON.stringify({ kind: 'direct', created_by: A.id }) })).json()
await rest('thread_participants', { method: 'POST', body: JSON.stringify([
  { thread_id: thread.id, participant: A.id, role: 'member' },
  { thread_id: thread.id, participant: B.id, role: 'member' },
]) })

const cleanup = async () => {
  await rest(`messages?thread_id=eq.${thread.id}`, { method: 'DELETE' })
  await rest(`thread_participants?thread_id=eq.${thread.id}`, { method: 'DELETE' })
  await rest(`threads?id=eq.${thread.id}`, { method: 'DELETE' })
}

try {
  // 1 — sent through the REAL route, as the member, not written by this script
  const send = await fetch('http://localhost:3001/api/social/messages', {
    method: 'POST', headers: { cookie: cookieFor(A.id, 'a@example.invalid'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id: thread.id, body: SECRET }),
  })
  t(send.ok, 'a member sends a direct message through the real send route', `${send.status}`)

  // 2 — THE WHOLE POINT. The most privileged credential reads the raw row.
  const rows = await (await rest(`messages?thread_id=eq.${thread.id}&select=*`)).json()
  const raw = JSON.stringify(rows)
  t(rows.length === 1, 'exactly one row was stored')
  t(!raw.includes(SECRET), 'the plaintext is NOWHERE in the row, read with the service role')
  t(/^v1\.direct\./.test(rows[0]?.body || ''), 'the stored body is a sealed envelope', (rows[0]?.body || '').slice(0, 28) + '…')

  // 3 — the member whose thread it is gets their words back
  const readA = await (await fetch(`http://localhost:3001/api/social/dm/${thread.id}`, { headers: { cookie: cookieFor(A.id, 'a@example.invalid') } })).json()
  t(JSON.stringify(readA).includes(SECRET), 'the member reads it back as words')
  const readB = await (await fetch(`http://localhost:3001/api/social/dm/${thread.id}`, { headers: { cookie: cookieFor(B.id, 'b@example.invalid') } })).json()
  t(JSON.stringify(readB).includes(SECRET), 'and so does the other party')

  // 4 — STAFF. The concierge is the staff route that reads message bodies.
  const owner = '3e1583db-b881-42ec-aadb-6f69a22fad80'
  const staffThread = await fetch(`http://localhost:3001/api/admin/concierge/${thread.id}`, { headers: { cookie: cookieFor(owner, 'lachlanrooney55@gmail.com') } })
  const staffTxt = await staffThread.text()
  t(!staffTxt.includes(SECRET), 'the staff Concierge cannot read a direct thread', `${staffThread.status}`)
  const staffList = await (await fetch('http://localhost:3001/api/admin/concierge', { headers: { cookie: cookieFor(owner, 'lachlanrooney55@gmail.com') } })).text()
  t(!staffList.includes(SECRET), 'and it is not in the staff Concierge list either')

  // 5 — the library's own refusals, against the stored envelope
  const { openBody } = await import('../lib/crypto/messages.ts').catch(() => ({ openBody: null }))
  if (openBody) {
    let refused = false
    try { openBody(rows[0].body, 'concierge', thread.id) } catch { refused = true }
    t(refused, 'opening a direct body in the concierge scope is refused')
    let tampered = false
    const bits = rows[0].body.split('.')
    bits[4] = bits[4].slice(0, -2) + (bits[4].endsWith('A') ? 'B' : 'A')
    try { openBody(bits.join('.'), 'direct', thread.id) } catch { tampered = true }
    t(tampered, 'a tampered body is refused rather than half-read')
    let moved = false
    try { openBody(rows[0].body, 'direct', randomUUID()) } catch { moved = true }
    t(moved, 'a body moved to another thread is refused')
  } else {
    console.log('  (library-level checks skipped — run with a TS loader to include them)')
  }
} finally {
  await cleanup()
  const left = await (await rest(`messages?thread_id=eq.${thread.id}&select=id`)).json()
  t(Array.isArray(left) && left.length === 0, 'every test row removed')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
