#!/usr/bin/env node
// KIOSK PHASE 3 verification. Run against a PRODUCTION build (`next start -p 3001`):
// the service worker only registers when NODE_ENV is production, and check 1 is
// meaningless without it.
import { createHmac } from 'node:crypto'
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
const rpc = async (fn, b = {}, h = svcH) => {
  const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(b) })
  let j; try { j = await r.json() } catch { j = null }; return j
}
const b64u = x => Buffer.from(x).toString('base64url')
const mint = sub => { const n = Math.floor(Date.now()/1e3)
  const h = b64u(JSON.stringify({ alg:'HS256', typ:'JWT' }))
  const p = b64u(JSON.stringify({ sub, aud:'authenticated', role:'authenticated', iat:n, exp:n+900 }))
  return `${h}.${p}.${b64u(createHmac('sha256', SEC).update(`${h}.${p}`).digest())}` }

let fails = 0
const head = t => console.log(`\n── ${t} ` + '─'.repeat(Math.max(0, 58 - t.length)))
const ok = (c, l, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) fails++ }

const made = { member: 'ZZ-P3-A', user: null, device: null, entries: [], fixture: null }
const SECRET_DESC = 'ZZINTERNALNOTE-do-not-show'
const SECRET_ATT  = 'ZZATTENDEE-Mr-Somebody'

try {
  // ── fixtures ────────────────────────────────────────────────────────────
  await rest('members', { method:'POST', headers:{...svcH, Prefer:'resolution=merge-duplicates'},
    body: JSON.stringify({ member_no: made.member, full_name:'Zeta Phase Three', tier:'Honorary', status:'Active' })})
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method:'POST', headers:svcH,
    body: JSON.stringify({ email:'zz-p3-a@example.invalid', password:'zz-Test-Pass-9182', email_confirm:true })})).json()
  made.user = u.id
  await rest('profiles', { method:'POST', headers:{...svcH, Prefer:'resolution=merge-duplicates'},
    body: JSON.stringify({ id:u.id, display_name:'Zeta Phase Three', is_admin:false, member_no: made.member })})
  await rest('member_taste_profiles', { method:'POST', headers:{...svcH, Prefer:'resolution=merge-duplicates'},
    body: JSON.stringify({ member_no: made.member, vector: { dried_fruit_walnut: 3, cereal_biscuit: 2, peated_smoky: 1 } })})
  await rpc('set_my_kiosk_pin', { p_pin: '748261' }, { apikey: ANON, Authorization: `Bearer ${mint(u.id)}`, 'Content-Type':'application/json' })

  const code = 'ZZP' + Math.random().toString(36).slice(2,7).toUpperCase()
  const d = await (await rest('kiosk_devices', { method:'POST', headers:{...svcH, Prefer:'return=representation'},
    body: JSON.stringify({ label:'ZZ-P3', room:'The Dining Room', pair_code:code, pair_expires_at:new Date(Date.now()+18e5).toISOString() })})).json()
  made.device = d[0].id
  const DEV = await rpc('kiosk_pair_device', { p_code: code })

  const today = new Date(Date.now() + 7*3.6e6).toISOString().slice(0,10)
  const day3  = new Date(Date.now() + 7*3.6e6 + 2*864e5).toISOString().slice(0,10)
  const day9  = new Date(Date.now() + 7*3.6e6 + 9*864e5).toISOString().slice(0,10)   // OUTSIDE the window
  for (const [dt, title, board, vis] of [
    [today, 'ZZ Member Tasting',  false, 'member'],   // member-visible, NOT on the board
    [day3,  'ZZ Later This Week', false, 'member'],
    [day9,  'ZZ Next Week',       false, 'member'],   // beyond seven days
    [today, 'ZZ Staff Only',      false, 'staff'],    // must never appear
  ]) {
    const r = await (await rest('calendar_entries', { method:'POST', headers:{...svcH, Prefer:'return=representation'},
      body: JSON.stringify({ title, entry_date: dt, space:'The Dining Room', kind:'tasting', visibility: vis,
        show_on_board: board, blocks_space:false, start_time:'19:00', end_time:'22:00',
        description: SECRET_DESC, attendee: SECRET_ATT })})).json()
    if (r[0]?.id) made.entries.push(r[0].id)
  }
  const fx = await (await rest('fixtures', { method:'POST', headers:{...svcH, Prefer:'return=representation'},
    body: JSON.stringify({ sport:'golf', title:'ZZ Golf Day', date: `${day3}T08:00:00+07:00`, location:'Ho Tram',
      description: SECRET_DESC, max_signups: 12 })})).json()
  made.fixture = fx[0]?.id

  const jar = `trc_kiosk_device=${DEV}`
  const login = await fetch(`${APP}/api/kiosk/member/login`, { method:'POST',
    headers:{ Cookie: jar, 'Content-Type':'application/json' },
    body: JSON.stringify({ member_no: made.member, pin:'748261' }), redirect:'manual' })
  const MC = login.headers.getSetCookie().find(c => c.startsWith('trc_kiosk_member='))?.split(';')[0]
  const both = `${jar}; ${MC}`
  ok(login.status === 200 && !!MC, 'signed in for the run', `HTTP ${login.status}`)

  // ═══ CHECK 2 — NOTHING WRONG-FOR-THE-ROOM IN ANY PAYLOAD ════════════════
  head('2 · no wrong-for-the-room field in any response payload')
  const meJson   = await (await fetch(`${APP}/api/kiosk/member/me`,   { headers:{ Cookie: both } })).text()
  const weekJson = await (await fetch(`${APP}/api/kiosk/member/week`, { headers:{ Cookie: both } })).text()
  const both_ = meJson + weekJson
  for (const [label, needle] of [
    ['the internal description', SECRET_DESC],
    ['attendee (who it is with)', SECRET_ATT],
    ['fixtures.description', 'description'],
    ['fixtures.max_signups', 'max_signups'],
    ['signup / RSVP machinery', 'signed_up_at'],
    ['a user_id from signups', 'user_id'],
    ['membership number', made.member],
    ['spend / renewal', 'membership_period'],
  ]) ok(!both_.includes(needle), `absent: ${label}`)
  ok(!both_.includes('ZZ Staff Only'), 'a staff-only entry never reaches a member payload')
  ok(!both_.includes('ZZ Next Week'), 'nothing beyond the seven-day window')
  ok(both_.includes('ZZ Member Tasting') && both_.includes('ZZ Golf Day'),
     'what SHOULD be there is there — house entry and fixture')

  // ═══ CHECK 3 — THE IDENTITY EARNS SOMETHING ═════════════════════════════
  head('3 · a member sees what the public board cannot')
  const board = await rpc('kiosk_board', { p_device_token: DEV })
  const boardTitle = board?.[0]?.title ?? null
  ok(boardTitle !== 'ZZ Member Tasting',
     'the board does NOT show the member-visible entry (never flagged show_on_board)', `board: ${boardTitle ?? 'no_event'}`)
  ok(weekJson.includes('ZZ Member Tasting'), 'the signed-in member DOES see it')
  ok(!weekJson.includes('show_on_board'), 'the week view never consults the board opt-in')

  // ═══ CHECK 4 — BUSY, SPARSE, EMPTY, AND THE BOUNDARY ════════════════════
  head('4 · the week view busy, sparse, empty, and at the boundary')
  // Count only OUR rows: the club's real member-visible entries are in this window
  // too, and asserting on totals would fail for a reason that is not a defect.
  const wk = JSON.parse(weekJson).week
  const mine = wk.entries.filter(e => e.title.startsWith('ZZ '))
  const myFx = wk.fixtures.filter(f => f.title.startsWith('ZZ '))
  ok(mine.length === 2 && myFx.length === 1, 'busy: both in-range entries plus the fixture', `${mine.length}+${myFx.length}`)
  ok(wk.entries.length >= mine.length, 'and the real diary is present alongside them', `${wk.entries.length} entries total`)
  const span = (new Date(`${wk.to}T00:00:00+07:00`) - new Date(`${wk.from}T00:00:00+07:00`)) / 864e5
  ok(span === 6, 'the window is seven INCLUSIVE days — one of each weekday, so no label repeats', `${span + 1} days`)
  for (const id of made.entries) await rest(`calendar_entries?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ visibility:'staff' }) })
  await rest(`fixtures?id=eq.${made.fixture}`, { method:'DELETE' })
  const empty = JSON.parse(await (await fetch(`${APP}/api/kiosk/member/week`, { headers:{ Cookie: both } })).text()).week
  ok(!empty.entries.some(e => e.title.startsWith('ZZ ')) && !empty.fixtures.some(f => f.title.startsWith('ZZ ')),
     'sparse: entries flipped to staff-only drop out cleanly, no error', `${empty.entries.length} left (the real diary)`)

  // ═══ CHECK 6 — REUSED, NOT REIMPLEMENTED ════════════════════════════════
  head('6 · portal components reused')
  const src = readFileSync('app/kiosk/member/page.tsx', 'utf8')
  ok(/from '@\/components\/whisky\/RadarChart'/.test(src), 'RadarChart imported from the portal')
  ok(/from '@\/components\/members\/EmptyState'/.test(src), 'EmptyState imported from the portal')
  ok(/from '@\/components\/members\/Skeleton'/.test(src), 'Skeleton imported from the portal')
  ok(!/function (RadarChart|EmptyState|Skeleton)\b/.test(src), 'and none of them re-declared locally')
  ok(!/position: 'fixed'/.test(src), 'no hand-rolled fixed overlay (the MemberModal trigger)')

  // ═══ CHECK 5 — PHASE 2 BOUNDARY STILL HOLDS ═════════════════════════════
  head('5 · the Phase 2 boundary')
  const back = await fetch(`${APP}/kiosk/staff`, { headers:{ Cookie: both }, redirect:'manual' })
  ok([302,307,308].includes(back.status) && (back.headers.get('location')||'').includes('/kiosk/board'),
     'back-gesture to /kiosk/staff still 307s to the board', `HTTP ${back.status}`)
  ok(/Max-Age=0/i.test(login.headers.getSetCookie().find(c => c.startsWith('trc_kiosk_staff=')) || ''),
     'entering member mode still destroys trc_kiosk_staff')

  // ═══ CHECK 1 — CACHE STORAGE, INSPECTED DIRECTLY ════════════════════════
  head('1 · Cache Storage after a kiosk member session')
  let browser
  try {
    const { chromium } = await import('playwright')
    try { browser = await chromium.launch({ channel: 'chrome' }) } catch { browser = await chromium.launch() }
    const ctx = await browser.newContext()
    await ctx.addCookies([
      { name:'trc_kiosk_device', value: DEV, domain:'localhost', path:'/' },
      { name:'trc_kiosk_member', value: MC.split('=')[1], domain:'localhost', path:'/' },
    ])
    const page = await ctx.newPage()
    await page.goto(`${APP}/members`, { waitUntil:'load' }).catch(() => {})   // let the SW register off-kiosk
    await page.waitForTimeout(2500)
    await page.goto(`${APP}/kiosk/member`, { waitUntil:'networkidle' })
    await page.waitForTimeout(2500)
    const swOn = await page.evaluate(() => navigator.serviceWorker?.controller != null || navigator.serviceWorker?.getRegistrations().then(r => r.length > 0))
    const dump = await page.evaluate(async () => {
      const out = []
      for (const name of await caches.keys()) {
        const c = await caches.open(name)
        for (const req of await c.keys()) {
          const res = await c.match(req)
          out.push({ url: req.url, body: res ? (await res.clone().text()).slice(0, 4000) : '' })
        }
      }
      return out
    })
    console.log(`  service worker present: ${swOn ? 'yes' : 'no'} · cached entries: ${dump.length}`)
    ok(!dump.some(e => new URL(e.url).pathname.startsWith('/kiosk')),
       'NO /kiosk URL is in Cache Storage', dump.filter(e => new URL(e.url).pathname.startsWith('/kiosk')).map(e => e.url).join(', ') || 'none')
    ok(!dump.some(e => /Zeta Phase Three|ZZ-P3-A|Good evening, Zeta/.test(e.body)),
       'NO member content in any cached response body')
    await browser.close()
  } catch (e) {
    ok(false, 'Cache Storage inspection', `browser unavailable: ${e.message.split('\n')[0]}`)
    if (browser) await browser.close().catch(() => {})
  }
} catch (e) { console.log('\n✗ HARNESS ERROR —', e.message, '\n', (e.stack||'').split('\n')[1]); fails++ }
finally {
  head('cleanup')
  for (const id of made.entries) await rest(`calendar_entries?id=eq.${id}`, { method:'DELETE' })
  if (made.fixture) await rest(`fixtures?id=eq.${made.fixture}`, { method:'DELETE' })
  for (const t of ['kiosk_member_sessions','member_pin_attempts','member_kiosk_pins','member_taste_profiles'])
    await rest(`${t}?member_no=eq.${made.member}`, { method:'DELETE' })
  if (made.device) { await rest(`kiosk_member_sessions?device_id=eq.${made.device}`, { method:'DELETE' }); await rest(`kiosk_devices?id=eq.${made.device}`, { method:'DELETE' }) }
  await rest(`profiles?member_no=eq.${made.member}`, { method:'PATCH', body: JSON.stringify({ member_no:null }) })
  if (made.user) await fetch(`${U}/auth/v1/admin/users/${made.user}`, { method:'DELETE', headers: svcH })
  await rest(`members?member_no=eq.${made.member}`, { method:'DELETE' })
  console.log('  ZZ-P3 fixtures removed')
}
console.log(fails === 0 ? '\nPASS — no failures\n' : `\nFAIL — ${fails} check(s)\n`)
process.exit(fails === 0 ? 0 : 1)
