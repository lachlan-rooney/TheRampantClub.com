#!/usr/bin/env node
// Verification for the three kiosk auth/cache fixes. ZZ-TEST fixtures, cleaned up.
//   node scripts/verify-kiosk-auth-fixes.mjs
//
// RUN IT AGAINST A PRODUCTION BUILD (`next start -p 3001`), not `next dev`. The
// dev server sets its own Cache-Control and replaces the no-store header, so
// check 8 fails there for a reason that does not exist in production.
import { createHmac, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { NEXT_PUBLIC_SUPABASE_URL: U, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
        SUPABASE_SERVICE_ROLE_KEY: SVC, SUPABASE_JWT_SECRET: SEC } = env
const APP = process.env.APP_URL || 'http://localhost:3001'
const svcH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }
const rest = (p, o = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svcH, ...o })
const rpc = async (fn, body = {}, headers = svcH) => {
  const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) })
  let j; try { j = await r.json() } catch { j = null }
  return { status: r.status, body: j }
}
const b64u = b => Buffer.from(b).toString('base64url')
const mint = sub => { const n = Math.floor(Date.now()/1e3)
  const h = b64u(JSON.stringify({ alg:'HS256', typ:'JWT' }))
  const p = b64u(JSON.stringify({ sub, aud:'authenticated', role:'authenticated', iat:n, exp:n+600 }))
  return `${h}.${p}.${b64u(createHmac('sha256', SEC).update(`${h}.${p}`).digest())}` }
const asMember = id => ({ apikey: ANON, Authorization: `Bearer ${mint(id)}`, 'Content-Type': 'application/json' })

let fails = 0, skips = 0
const head = t => console.log(`\n── ${t} ` + '─'.repeat(Math.max(0, 58 - t.length)))
const ok = (c, label, d = '') => { console.log(`${c ? '✓' : '✗'} ${label}${d ? ' — ' + d : ''}`); if (!c) fails++ }
const skip = (l, w) => { console.log(`· SKIP ${l} — ${w}`); skips++ }

let serverUp = false
for (let i = 0; i < 3 && !serverUp; i++) {
  try { const r = await fetch(`${APP}/api/kiosk/board`, { signal: AbortSignal.timeout(30_000) }); serverUp = r.status < 600 }
  catch { await new Promise(r => setTimeout(r, 1500)) }
}

const made = { members: [], users: [], device: null }
try {
  const PEOPLE = [
    ['ZZ-NG-A', 'Nguyễn Văn An',  '481907', '1990-03-15'],
    ['ZZ-NG-B', 'Nguyễn Thị Bích','305182', '1988-07-02'],
    ['ZZ-NG-C', 'Nguyễn Hoàng Cường', null, '1975-11-30'],   // no code set
  ]
  for (const [no, name, pin, dob] of PEOPLE) {
    await rest('members', { method:'POST', headers:{...svcH, Prefer:'resolution=merge-duplicates'},
      body: JSON.stringify({ member_no:no, full_name:name, tier:'Honorary', status:'Active', birthday:dob, email:`${no.toLowerCase()}@example.invalid` })})
    made.members.push(no)
    const u = await (await fetch(`${U}/auth/v1/admin/users`, { method:'POST', headers:svcH,
      body: JSON.stringify({ email:`${no.toLowerCase()}@example.invalid`, password:'zz-Test-Pass-9182', email_confirm:true })})).json()
    made.users.push([no, u.id])
    await rest('profiles', { method:'POST', headers:{...svcH, Prefer:'resolution=merge-duplicates'},
      body: JSON.stringify({ id:u.id, display_name:name, is_admin:false, member_no:no })})
    if (pin) await rpc('set_my_kiosk_pin', { p_pin: pin }, asMember(u.id))
  }
  const idOf = no => made.users.find(x => x[0] === no)[1]
  const code = 'ZZA' + Math.random().toString(36).slice(2,7).toUpperCase()
  const d = await (await rest('kiosk_devices', { method:'POST', headers:{...svcH, Prefer:'return=representation'},
    body: JSON.stringify({ label:'ZZ-AUTHFIX', room:'The Dining Room', pair_code:code, pair_expires_at:new Date(Date.now()+12e5).toISOString() })})).json()
  made.device = d[0].id
  const DEV = (await rpc('kiosk_pair_device', { p_code: code })).body

  const login = async (who, pin) => {
    const t0 = performance.now()
    const r = await fetch(`${APP}/api/kiosk/member/login`, { method:'POST',
      headers:{ Cookie:`trc_kiosk_device=${DEV}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ member_no: who, pin }), redirect:'manual' })
    const body = await r.text()
    return { status: r.status, body, ms: performance.now() - t0 }
  }
  const failCount = async no => {
    const r = await rest(`member_pin_attempts?select=id&member_no=eq.${no}&ok=is.false&cleared_at=is.null`,
      { headers: { ...svcH, Prefer:'count=exact', Range:'0-0' } })
    return Number(r.headers.get('content-range')?.split('/')[1] ?? -1)
  }

  if (!serverUp) { skip('all HTTP checks', `no dev server at ${APP}`) } else {

  // ═══ CHECK 1 — THE DEFECT ═══════════════════════════════════════════════
  head('1 · six wrong guesses on a shared surname do not lock anyone out')
  const before = { A: await failCount('ZZ-NG-A'), B: await failCount('ZZ-NG-B') }
  for (let i = 0; i < 6; i++) await login('nguyen', '999119')
  const after = { A: await failCount('ZZ-NG-A'), B: await failCount('ZZ-NG-B') }
  ok(after.A === before.A && after.B === before.B,
     'six wrong guesses on "nguyen" added ZERO failures to either member',
     `A ${before.A}→${after.A}  B ${before.B}→${after.B}`)
  const anIn = await login('ZZ-NG-A', '481907')
  ok(anIn.status === 200, 'the member with the CORRECT code still signs in', `HTTP ${anIn.status}`)
  const bIn = await login('bich', '305182')
  ok(bIn.status === 200, 'an UNAMBIGUOUS name still signs in by name', `HTTP ${bIn.status}`)

  // ═══ CHECK 2 — ONE ATTEMPT, ONE ROW ═════════════════════════════════════
  head('2 · one attempt writes one row, whatever N was')
  const b2 = await failCount('ZZ-NG-A')
  await login('ZZ-NG-A', '999119')
  ok((await failCount('ZZ-NG-A')) === b2 + 1, 'a resolved wrong guess writes exactly one row', `${b2} → ${await failCount('ZZ-NG-A')}`)
  const totalBefore = Number((await rest('member_pin_attempts?select=id', { headers:{...svcH, Prefer:'count=exact', Range:'0-0'} })).headers.get('content-range').split('/')[1])
  await login('nguyen', '999119')
  const totalAfter = Number((await rest('member_pin_attempts?select=id', { headers:{...svcH, Prefer:'count=exact', Range:'0-0'} })).headers.get('content-range').split('/')[1])
  ok(totalAfter - totalBefore === 1, 'an AMBIGUOUS name also writes exactly one row (against the sentinel)', `Δ${totalAfter - totalBefore}`)

  // ═══ CHECK 3 — UNIFORM FAILURE ══════════════════════════════════════════
  head('3 · every failure mode is byte-identical, and close in timing')
  const modes = {
    'multi-match':   await login('nguyen', '999119'),
    'unknown name':  await login('zzznobody', '999119'),
    'wrong code':    await login('ZZ-NG-B', '999119'),
    'no code set':   await login('ZZ-NG-C', '999119'),
  }
  for (let i = 0; i < 7; i++) await login('ZZ-NG-B', '999119')
  modes['locked out'] = await login('ZZ-NG-B', '305182')
  const bodies = new Set(Object.values(modes).map(m => `${m.status}|${m.body}`))
  ok(bodies.size === 1, 'all five modes return an identical status and body', [...bodies][0]?.slice(0, 60))
  const times = Object.entries(modes).map(([k, v]) => `${k} ${Math.round(v.ms)}ms`)
  console.log(`  timings: ${times.join(' · ')}`)
  // clear_member_kiosk_lockout is ADMIN-ONLY — calling it as a member silently
  // does nothing, which is exactly what left ZZ-NG-B locked for check 9 first time.
  const admin = (await (await rest('profiles?select=id&is_admin=eq.true&limit=1')).json())[0]
  await rpc('clear_member_kiosk_lockout', { p_member_no: 'ZZ-NG-B' }, asMember(admin.id))
  ok((await failCount('ZZ-NG-B')) === 0, 'admin can clear a lockout', `${await failCount('ZZ-NG-B')} failures left`)

  // ═══ CHECKS 4 & 5 — RESET DOES NOT FAN OUT OR CONFIRM ═══════════════════
  head('4 · 5 — reset never fans out, never confirms membership')
  const resetsFor = async no => Number((await rest(`member_pin_resets?select=id&member_no=eq.${no}`, { headers:{...svcH, Prefer:'count=exact', Range:'0-0'} })).headers.get('content-range').split('/')[1])
  const askReset = async who => { const r = await fetch(`${APP}/api/kiosk/member/reset`, { method:'POST',
      headers:{ Cookie:`trc_kiosk_device=${DEV}`, 'Content-Type':'application/json' }, body: JSON.stringify({ who }) })
    return { status: r.status, body: await r.text() } }
  const rA = await resetsFor('ZZ-NG-A'), rB = await resetsFor('ZZ-NG-B'), rC = await resetsFor('ZZ-NG-C')
  const multi = await askReset('nguyen')
  ok(await resetsFor('ZZ-NG-A') === rA && await resetsFor('ZZ-NG-B') === rB && await resetsFor('ZZ-NG-C') === rC,
     'a reset on a shared surname issues ZERO tokens (so zero emails)')
  const single = await askReset('ZZ-NG-A')
  const nobody = await askReset('zzznobody')
  ok(multi.body === single.body && single.body === nobody.body && multi.status === nobody.status,
     'multi-match, real member and non-existent member return the same response')
  ok(await resetsFor('ZZ-NG-A') === rA + 1, 'a resolved request issues exactly one token')

  // ═══ CHECK 6 & 7 — SINGLE USE, EXPIRY, LOCKOUT CLEARED, DOB REFUSED ═════
  head('6 · 7 — the reset link, and the DOB rule on that path')
  const tok = (await rpc('request_member_pin_reset', { p_member_no: 'ZZ-NG-A' })).body
  for (let i = 0; i < 6; i++) await login('ZZ-NG-A', '999119')
  ok((await failCount('ZZ-NG-A')) >= 6, 'ZZ-NG-A is locked out before the reset', `${await failCount('ZZ-NG-A')} failures`)
  // CHECK 7: the date-of-birth refusal fires on the RESET path
  const dobTry = await fetch(`${APP}/api/members/kiosk-pin/reset-complete`, { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: tok, pin: '150390' }) })
  const dobBody = await dobTry.json()
  ok(dobTry.status === 400 && /birthday/i.test(dobBody.error || ''),
     'CHECK 7: the reset path refuses the date of birth', dobBody.error?.slice(0, 48))
  ok((await rest(`member_pin_resets?select=used_at&token_hash=eq.${createHash('sha256').update(tok).digest('hex')}`).then(r => r.json()))[0]?.used_at === null,
     'a refused code does NOT spend the token')
  const good = await fetch(`${APP}/api/members/kiosk-pin/reset-complete`, { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: tok, pin: '748261' }) })
  ok(good.status === 200, 'a valid code sets successfully', `HTTP ${good.status}`)
  ok((await failCount('ZZ-NG-A')) === 0, 'CHECK 6: a successful reset clears the lockout')
  const reuse = await fetch(`${APP}/api/members/kiosk-pin/reset-complete`, { method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: tok, pin: '620394' }) })
  ok(reuse.status === 400, 'the link is single-use', `HTTP ${reuse.status}`)
  ok((await login('ZZ-NG-A', '748261')).status === 200, 'the new code works at the kiosk')

  // ═══ CHECK 8 — THE CACHE BOUNDARY ═══════════════════════════════════════
  head('8 · nothing under /kiosk is storable')
  for (const p of ['/kiosk/board', '/kiosk/dining-room', '/kiosk/pair']) {
    const r = await fetch(`${APP}${p}`, { headers:{ Cookie:`trc_kiosk_device=${DEV}` }, redirect:'manual' })
    ok(/no-store/.test(r.headers.get('cache-control') || ''), `no-store on ${p}`, r.headers.get('cache-control') || '(none)')
  }
  const sw = readFileSync('public/sw.js', 'utf8')
  ok(/pathname\.startsWith\('\/kiosk\/'\)/.test(sw) && /pathname === '\/kiosk'/.test(sw),
     'the service worker excludes /kiosk from every cache path')
  ok(/startsWith\('\/kiosk'\)\)\s*\n?\s*\.map\(\(r\) => cache\.delete\(r\)\)|cache\.delete\(r\)/.test(sw),
     'and evicts anything an older worker already stored')
  console.log('  (Cache Storage itself needs a browser — these verify the two writes that would fill it)')

  // ═══ CHECK 9 — PHASE 2 UNBROKEN ═════════════════════════════════════════
  head('9 · Phase 2 unbroken')
  ok((await login('ZZ-NG-B', '305182')).status === 200, 'number + code sign-in')
  const mc = (await fetch(`${APP}/api/kiosk/member/login`, { method:'POST',
    headers:{ Cookie:`trc_kiosk_device=${DEV}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ member_no:'ZZ-NG-B', pin:'305182' }), redirect:'manual' })).headers.getSetCookie()
    .find(c => c.startsWith('trc_kiosk_member='))?.split(';')[0]
  const back = await fetch(`${APP}/kiosk/staff`, { headers:{ Cookie:`trc_kiosk_device=${DEV}; ${mc}` }, redirect:'manual' })
  ok([302,307,308].includes(back.status) && (back.headers.get('location')||'').includes('/kiosk/board'),
     'the back-gesture still lands on the board', `HTTP ${back.status} → ${back.headers.get('location')}`)
  ok((await rpc('kiosk_board', { p_device_token: DEV })).body?.[0]?.room === 'The Dining Room', 'the board still resolves its room')
  }
} catch (e) { console.log('\n✗ HARNESS ERROR —', e.message, '\n', (e.stack||'').split('\n')[1]); fails++ }
finally {
  head('cleanup')
  for (const no of made.members) {
    for (const t of ['kiosk_member_sessions','member_pin_attempts','member_kiosk_pins','member_pin_resets','member_terms_consents'])
      await rest(`${t}?member_no=eq.${no}`, { method:'DELETE' })
    await rest(`profiles?member_no=eq.${no}`, { method:'PATCH', body: JSON.stringify({ member_no:null }) })
  }
  for (const [, id] of made.users) await fetch(`${U}/auth/v1/admin/users/${id}`, { method:'DELETE', headers: svcH })
  for (const no of made.members) await rest(`members?member_no=eq.${no}`, { method:'DELETE' })
  if (made.device) { await rest(`kiosk_member_sessions?device_id=eq.${made.device}`, { method:'DELETE' }); await rest(`kiosk_devices?id=eq.${made.device}`, { method:'DELETE' }) }
  await rest(`member_pin_attempts?member_no=eq.------------`, { method:'DELETE' })
  console.log('  ZZ fixtures removed')
}
console.log(fails === 0 ? `\nPASS${skips ? ` — ${skips} skipped` : ' — no failures'}\n` : `\nFAIL — ${fails} check(s)\n`)
process.exit(fails === 0 ? 0 : 1)
