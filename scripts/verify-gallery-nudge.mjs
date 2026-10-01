// ═══════════════════════════════════════════════════════════════════════════
// DOES THE GALLERY ACTUALLY ASK?
//   node scripts/verify-gallery-nudge.mjs            (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// The Event Gallery held 14 contributions and gallery_prompts had never held a
// row, because nothing ever asked. These are the checks that it asks, asks the
// right person, asks once, and cannot be used to dismiss or open an evening
// somebody was not at.
//
// ── IT RUNS AS A REAL MEMBER, NOT AS THE OWNER ────────────────────────────
// A minted non-admin member JWT, HS256 over SUPABASE_JWT_SECRET. The owner is an
// admin and would pass checks a member would fail — the lesson from the signing
// RLS audit.
//
// PROVE THE HARNESS:
//   · 1   asserts the fixtures and the sign-up actually exist. A zero-row
//         harness once passed everything.
//   · 7   asks about a fixture the member was NOT signed up to. Delete the
//         sign-up check in the route and it passes, which is the point of it.
//   · 10  asks twice. Drop idx_gallery_prompt_fixture and the second ask comes
//         back, which is the whole promise of "asked once".
//
// Every row it creates is removed at the end, against a THROWAWAY member — a
// prompt row written onto a real member_no would silence a real question.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const BASE = 'http://localhost:3001'
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const MEMBER = 'ZZ-NUDGE'
const TAG = 'ZZ Nudge'

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

const ymd = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)

// A THROWAWAY AUTH USER, not just a profiles row. profiles.id is a foreign key
// to auth.users, so a random uuid is refused (23503) — the harness has to make
// a real sign-in and take it away again.
const admin = (path, init) => fetch(`${U}/auth/v1/admin/${path}`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
  ...init,
})
const makeUser = async email => {
  const r = await admin('users', { method: 'POST', body: JSON.stringify({ email, password: `zz-${randomUUID()}`, email_confirm: true }) })
  const j = await r.json().catch(() => ({}))
  return r.ok ? j.id : null
}

let profile, staffOnly, fixA, fixB, fixOld
const wipe = async () => {
  if (profile) await rest(`gallery_prompts?member=eq.${profile}`, { method: 'DELETE' })
  for (const f of [fixA, fixB, fixOld].filter(Boolean)) {
    const evs = await (await rest(`events?fixture_id=eq.${f}&select=id`)).json()
    for (const e of evs || []) await rest(`event_media?event_id=eq.${e.id}`, { method: 'DELETE' })
    await rest(`events?fixture_id=eq.${f}`, { method: 'DELETE' })
    await rest(`fixture_signups?fixture_id=eq.${f}`, { method: 'DELETE' })
    await rest(`fixtures?id=eq.${f}`, { method: 'DELETE' })
  }
  await rest(`fixtures?title=like.${encodeURIComponent(TAG)}*`, { method: 'DELETE' })
  // ── THE ORDER HERE IS THE WHOLE JOB ─────────────────────────────────────
  // Creating an album and contributing to it calls socialEmit, which writes to
  // activity_events — the Ops Hub's append-only spine, whose actor is a FK to
  // profiles. So the profile cannot be deleted, so the auth user cannot be
  // deleted (its cascade hits the same constraint, as a 500), so the member
  // cannot be deleted either. Five runs of this left five throwaway members in
  // the real roster and five rows in the real activity log before I looked.
  //
  // Named by actor, one at a time, and nothing else: a filter that reached any
  // further would be deleting somebody's real history.
  for (const id of [profile, staffOnly].filter(Boolean)) {
    await rest(`activity_events?actor=eq.${id}`, { method: 'DELETE' })
    await rest(`profiles?id=eq.${id}`, { method: 'DELETE' })
    await admin(`users/${id}`, { method: 'DELETE' })
  }
  // Last: profiles.member_no points at it.
  await rest(`members?member_no=eq.${MEMBER}`, { method: 'DELETE' })
}

try {
  // ── IS THE SCHEMA THERE AT ALL? ────────────────────────────────────────
  const probe = await rest('gallery_prompts?select=fixture_id&limit=1')
  if (!probe.ok) {
    console.log('✗ db/gallery_nudge.sql has NOT been run — gallery_prompts has no fixture_id column.')
    console.log('  Run it, then run this again. Nothing else below would mean anything.')
    process.exit(1)
  }

  // ── SETUP: a throwaway member, and three fixtures ──────────────────────
  await wipe()
  await rest('members', { method: 'POST', body: JSON.stringify({ member_no: MEMBER, full_name: `${TAG} Member`, tier: 'Pioneer', status: 'Active' }) })
  const email = `zz-nudge-${randomUUID().slice(0, 8)}@example.invalid`
  profile = await makeUser(email)
  if (!profile) { console.log('could not make a throwaway auth user'); process.exit(1) }
  // The trigger on auth.users may already have made the profile row; either way
  // it must end up non-admin and paired to the throwaway membership.
  const prof = await rest('profiles', { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: profile, display_name: `${TAG} Member`, member_no: MEMBER, is_admin: false }) })
  if (!prof.ok) { console.log('could not make a throwaway profile:', await prof.text()); process.exit(1) }

  const mk = async (title, date) => {
    const [f] = await (await rest('fixtures', { method: 'POST', body: JSON.stringify({ title, sport: 'golf', type: 'golf', date }) })).json()
    return f.id
  }
  fixA = await mk(`${TAG} finished last week`, ymd(-7))       // signed up, finished → the ask
  fixB = await mk(`${TAG} not signed up`, ymd(-5))            // finished, NOT signed up
  fixOld = await mk(`${TAG} months ago`, ymd(-120))           // signed up, outside the window
  await rest('fixture_signups', { method: 'POST', body: JSON.stringify([
    { fixture_id: fixA, user_id: profile, member_no: MEMBER },
    { fixture_id: fixOld, user_id: profile, member_no: MEMBER },
  ]) })

  const cookie = cookieFor(profile, email)
  const get = () => fetch(`${BASE}/api/members/gallery/nudge`, { headers: { cookie }, cache: 'no-store' })
    .then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }))
  const post = body => fetch(`${BASE}/api/members/gallery/nudge`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }))

  const sign = await (await rest(`fixture_signups?fixture_id=eq.${fixA}&select=fixture_id`)).json()
  t(!!fixA && !!fixB && !!fixOld && sign.length === 1,
    '1 · HARNESS: three fixtures and the sign-up exist', `A=${!!fixA} B=${!!fixB} old=${!!fixOld}, ${sign.length} sign-up`)

  // ── IT ASKS ────────────────────────────────────────────────────────────
  const first = await get()
  t(first.s === 200 && first.j.ask?.fixture_id === fixA,
    '2 · it asks about the fixture they were at', first.j.ask ? `"${first.j.ask.title}"` : 'asked nothing')
  t(first.j.ask?.already === 0 && first.j.ask?.event_id === null,
    '3 · with no album yet, it says they would be first', `already=${first.j.ask?.already}, event=${first.j.ask?.event_id}`)

  // ── AND NOT ABOUT THE OTHERS ───────────────────────────────────────────
  // With A dismissed, the only things left to raise are B (finished, but no
  // sign-up) and the one from four months ago (signed up, outside the window).
  // Each exclusion is asserted BY NAME: written as two copies of "ask is null"
  // these two checks both failed for either bug and neither said which.
  // ASSERT THE WRITE, not just that the asking stopped. The first run of this
  // harness passed "it stops asking" while NOTHING was being recorded: the
  // upsert was failing with 42P10 (a conflict target cannot be inferred from a
  // partial unique index), the route was returning 500, and the only check on
  // it was downstream. Absence is not presence.
  const dismissed = await post({ action: 'dismiss', fixture_id: fixA })
  t(dismissed.s === 200 && dismissed.j.ok === true,
    '3b · "not this time" is ACCEPTED, not quietly refused', `status ${dismissed.s} ${JSON.stringify(dismissed.j)}`)
  const after = await get()
  const raised = after.j.ask?.fixture_id ?? null
  t(raised !== fixB, '4 · a fixture they were not down for is never raised',
    raised === fixB ? 'RAISED IT' : 'not raised')
  t(raised !== fixOld, '5 · a fixture from four months ago is outside the window',
    raised === fixOld ? 'RAISED IT' : 'not raised')
  t(raised === null, '5b · so after dismissing the one, there is nothing left to ask',
    raised ? `still raising ${after.j.ask.title}` : 'quiet')

  // ── ASKED ONCE ─────────────────────────────────────────────────────────
  const rows = await (await rest(`gallery_prompts?member=eq.${profile}&select=fixture_id,event_id,outcome`)).json()
  t(rows.length === 1 && rows[0].outcome === 'dismissed' && rows[0].fixture_id === fixA && rows[0].event_id === null,
    '6 · "not this time" is written against the FIXTURE', JSON.stringify(rows[0] || null))

  // ── THE GATE ───────────────────────────────────────────────────────────
  const notMine = await post({ action: 'dismiss', fixture_id: fixB })
  t(notMine.s === 403, '7 · PROVE THE HARNESS: cannot dismiss an evening they were not at', `status ${notMine.s} "${notMine.j.error || ''}"`)
  const openNotMine = await post({ action: 'open', fixture_id: fixB })
  const strayEvents = await (await rest(`events?fixture_id=eq.${fixB}&select=id`)).json()
  t(openNotMine.s === 403 && strayEvents.length === 0,
    '8 · nor open an album for one', `status ${openNotMine.s}, ${strayEvents.length} events created`)

  // ── SAYING YES OPENS THE ALBUM AND RECORDS NOTHING ─────────────────────
  await rest(`gallery_prompts?member=eq.${profile}`, { method: 'DELETE' })
  const opened = await post({ action: 'open', fixture_id: fixA })
  const madeEvents = await (await rest(`events?fixture_id=eq.${fixA}&select=id,title,category,event_date,created_by`)).json()
  const afterOpen = await (await rest(`gallery_prompts?member=eq.${profile}&select=outcome`)).json()
  t(opened.s === 200 && opened.j.created === true && madeEvents.length === 1 && madeEvents[0].created_by === profile,
    '9 · saying yes opens the album, in their name', madeEvents[0] ? `"${madeEvents[0].title}" · ${madeEvents[0].category} · ${madeEvents[0].event_date}` : 'no event')
  t(afterOpen.length === 0,
    '9b · and records NOTHING — a tap is not a photograph', `${afterOpen.length} prompt rows`)

  // Open again → the SAME album, not a second one.
  const again = await post({ action: 'open', fixture_id: fixA })
  const stillOne = await (await rest(`events?fixture_id=eq.${fixA}&select=id`)).json()
  t(again.j.created === false && again.j.event_id === opened.j.event_id && stillOne.length === 1,
    '10 · asking twice does not make a second album', `${stillOne.length} album(s)`)

  // ── A PHOTOGRAPH ANSWERS IT ────────────────────────────────────────────
  const added = await fetch(`${BASE}/api/members/events/${opened.j.event_id}/media`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'link', url: 'https://drive.google.com/drive/folders/zz-nudge-test' }),
  }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }))
  const closed = await (await rest(`gallery_prompts?member=eq.${profile}&select=event_id,fixture_id,outcome`)).json()
  t(added.s === 200 && closed.some(r => r.outcome === 'posted' && r.event_id === opened.j.event_id),
    '11 · a contribution closes the prompt as POSTED', `status ${added.s}, ${closed.length} rows: ${closed.map(r => r.outcome).join(',')}`)
  t(closed.some(r => r.outcome === 'posted' && r.fixture_id === fixA),
    '11b · in BOTH spellings, so a fixture-raised ask is answered too')

  const quiet = await get()
  t(quiet.j.ask === null, '12 · and it stops asking', quiet.j.ask ? 'STILL ASKING' : 'quiet')

  // ── IT ASKS ONCE, EVEN WITH THE LEDGER WIPED OF THAT ONE ───────────────
  // Their own contribution is itself an answer: an evening they have already
  // photographed is never raised, prompt row or not. This is what makes the
  // evenings that predate the nudge safe.
  await rest(`gallery_prompts?member=eq.${profile}`, { method: 'DELETE' })
  const posted = await get()
  t(posted.j.ask === null, '13 · an evening they already photographed is never raised again',
    posted.j.ask ? `raised "${posted.j.ask.title}"` : 'quiet')

  // ── NOT A MEMBER, NOT ASKED ────────────────────────────────────────────
  const staffEmail = `zz-nudge-staff-${randomUUID().slice(0, 8)}@example.invalid`
  staffOnly = await makeUser(staffEmail)
  await rest('profiles', { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: staffOnly, display_name: `${TAG} Staff`, member_no: null, is_admin: false }) })
  const staffAsk = await fetch(`${BASE}/api/members/gallery/nudge`, { headers: { cookie: cookieFor(staffOnly, staffEmail) } })
    .then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }))
  t(staffAsk.s === 200 && staffAsk.j.ask === null, '14 · a login with no membership is never asked', `status ${staffAsk.s}`)

  const anon = await fetch(`${BASE}/api/members/gallery/nudge`)
  t(anon.status === 401, '15 · and nobody signed out is asked anything', `status ${anon.status}`)
} catch (e) {
  console.log('✗ THREW:', e?.message || e); fail++
} finally {
  await wipe()
  // ASSERT THE CLEANUP. A harness that quietly leaves rows in the real roster
  // is worse than one that fails: the mess outlives the run and nobody connects
  // the two. Checked after the wipe, reported with the tally.
  const left = await Promise.all([
    rest(`members?member_no=eq.${MEMBER}&select=member_no`).then(r => r.json()).catch(() => []),
    rest(`profiles?display_name=like.${encodeURIComponent(TAG)}*&select=id`).then(r => r.json()).catch(() => []),
    rest(`fixtures?title=like.${encodeURIComponent(TAG)}*&select=id`).then(r => r.json()).catch(() => []),
  ])
  const n = left.reduce((a, x) => a + (Array.isArray(x) ? x.length : 0), 0)
  t(n === 0, 'it cleaned up after itself',
    n ? `LEFT BEHIND — ${left.map(x => (Array.isArray(x) ? x.length : '?')).join(' member / ')} (member/profile/fixture)` : 'nothing left in the roster')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
