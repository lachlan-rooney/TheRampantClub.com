// ═══════════════════════════════════════════════════════════════════════════
// THE FIVE FLOOR TOOLS, AGAINST THE REAL ROUTES.
//   node scripts/verify-kiosk-floor-tools.mjs        (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Tonight's bookings with named guests · the shift list · the floor note ·
// the back bar · what's on. Every one of them is behind two gates (an enrolled
// device AND a PIN-signed staff cookie), and two of them write.
//
// PROVE THE HARNESS. Three checks are built to fail on a broken build:
//   · 1–2  assert the INPUTS loaded (a device, a PIN, a real signed session).
//          A zero-row harness once passed everything.
//   · 5    sends the staff cookie with no device cookie. Delete the deviceOk()
//          call from a route and this passes, which is the point of it.
//   · 11   marks a task done with NO EVIDENCE. Remove the check constraint or
//          the route's pass-through and it is accepted — the one rule the
//          whole shift-task system rests on.
//
// Every row it creates is removed at the end, and the member it writes notes
// about is a throwaway: a floor note onto a real member_no would sit in the
// desk's review queue forever.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const BASE = 'http://localhost:3001'
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const NAME = 'ZZ Floor Test', PIN = '517390', MEMBER = 'ZZ-FLOOR', LABEL = 'ZZ-FLOOR'

const wipe = async () => {
  await rest(`preference_candidates?member_no=eq.${MEMBER}`, { method: 'DELETE' })
  await rest(`booking_guests?guest_name=like.ZZ%20Guest*`, { method: 'DELETE' })
  await rest(`bookings?member_no=eq.${MEMBER}`, { method: 'DELETE' })
  await rest(`members?member_no=eq.${MEMBER}`, { method: 'DELETE' })
  const tms = await (await rest(`team_members?display_name=eq.${encodeURIComponent(NAME)}&select=id`)).json()
  for (const x of tms || []) {
    // ORDER MATTERS, and so does created_by. shift_add_one_off stamps the
    // actor onto the instance as well as the event, so deleting only by
    // assignee leaves a row holding a foreign key and the team member cannot
    // be removed — which is how a first run of this left two rows behind.
    await rest(`shift_task_events?actor_team_member_id=eq.${x.id}`, { method: 'DELETE' })
    await rest(`shift_task_instances?created_by=eq.${x.id}`, { method: 'DELETE' })
    await rest(`shift_task_instances?assignee_team_member_id=eq.${x.id}`, { method: 'DELETE' })
    await rest(`shift_task_instances?title_en=eq.ZZ%20Floor%20Test%20task`, { method: 'DELETE' })
    await rest(`kiosk_pin_attempts?team_member_id=eq.${x.id}`, { method: 'DELETE' })
    await rest(`team_members?id=eq.${x.id}`, { method: 'DELETE' })
  }
  await rest(`kiosk_devices?label=eq.${LABEL}`, { method: 'DELETE' })
}
await wipe()

// An owner cookie, only to create the throwaway device and set the PIN.
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const OWNER = '3e1583db-b881-42ec-aadb-6f69a22fad80'
const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: OWNER, email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'lachlanrooney55@gmail.com', app_metadata: {}, user_metadata: {} } }
const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
const admin = v.length > 3180
  ? (() => { const ps = []; for (let i = 0, n = 0; i < v.length; i += 3180, n++) ps.push(`sb-${ref}-auth-token.${n}=${v.slice(i, i + 3180)}`); return ps.join('; ') })()
  : `sb-${ref}-auth-token=${v}`

const vnToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const mondayOf = d => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10) }

let tm, instance
try {
  // ── SETUP ──────────────────────────────────────────────────────────────
  ;[tm] = await (await rest('team_members', { method: 'POST', body: JSON.stringify({ display_name: NAME, active: true, on_rota: false }) })).json()
  await fetch(`${BASE}/api/admin/kiosk-devices/pin`, { method: 'POST', headers: { cookie: admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: tm.id, pin: PIN }) })
  const made = await (await fetch(`${BASE}/api/admin/kiosk-devices`, { method: 'POST', headers: { cookie: admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ label: LABEL, room: 'The Dining Room' }) })).json()
  const paired = await fetch(`${BASE}/api/kiosk/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: made.pair_code }) })
  const device = ((paired.headers.getSetCookie?.() || []).find(c => c.startsWith('trc_kiosk_device=')) || '').split(';')[0].split('=')[1]
  t(!!device, '1 · HARNESS: a throwaway tablet is paired', device ? 'device cookie issued' : 'NO DEVICE — nothing below means anything')
  if (!device) throw new Error('no device')

  const dev = `trc_kiosk_device=${device}`
  const picked = await fetch(`${BASE}/api/kiosk/staff/pick`, { method: 'POST', headers: { cookie: dev, 'Content-Type': 'application/json' }, body: JSON.stringify({ team_member_id: tm.id, pin: PIN }) })
  const staffCookie = ((picked.headers.getSetCookie?.() || []).find(c => c.startsWith('trc_kiosk_staff=')) || '').split(';')[0]
  const both = `${dev}; ${staffCookie}`
  t(picked.status === 200 && staffCookie.includes('.'), '2 · HARNESS: the PIN produced a SIGNED staff cookie',
    staffCookie ? `${staffCookie.split('=')[1].slice(0, 8)}…(${staffCookie.split('.').length - 1} dot)` : 'none')

  const get = (p, cookie) => fetch(`${BASE}${p}`, { headers: cookie ? { cookie } : {} }).then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }))
  const post = (p, body, cookie) => fetch(`${BASE}${p}`, { method: 'POST', headers: { ...(cookie ? { cookie } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => ({ s: r.status, j: await r.json().catch(() => ({})) }))

  // ── TONIGHT, WITH NAMED GUESTS ─────────────────────────────────────────
  // A throwaway member with a booking tonight and two named guests, one of
  // whom has signed in. Then the floor must see both names and the state.
  await rest('members', { method: 'POST', body: JSON.stringify({ member_no: MEMBER, full_name: 'ZZ Floor Member', tier: 'Pioneer', status: 'Active' }) })
  const [bk] = await (await rest('bookings', { method: 'POST', body: JSON.stringify({ member_no: MEMBER, booking_date: vnToday(), start_time: '19:30', party_size: 3, space: 'The Dining Room', status: 'confirmed' }) })).json()
  let guestsReady = true
  if (bk) {
    const g = await rest('booking_guests', { method: 'POST', body: JSON.stringify([
      { booking_id: bk.booking_id, guest_name: 'ZZ Guest Named', added_by_kind: 'member' },
      { booking_id: bk.booking_id, guest_name: 'ZZ Guest Typed', added_by_kind: 'staff' },
    ]) })
    guestsReady = g.ok
  }

  const tn = await get('/api/kiosk/staff/tonight', both)
  const mine = (tn.j.rows || []).find(r => r.id === bk?.booking_id)
  t(tn.s === 200 && Array.isArray(tn.j.rows), '3 · tonight answers the floor', `status ${tn.s}, ${tn.j.rows?.length ?? '?'} rows`)
  t(!!mine && mine.guests?.length === 2 && mine.guests.some(x => x.name === 'ZZ Guest Named'),
    '4 · the guest NAMES reach the floor', guestsReady ? `${mine?.guests?.length ?? 0} named, ${mine?.awaited ?? '?'} still to come` : 'booking_guests not installed — skipped by the route')

  // ── THE TWO GATES ──────────────────────────────────────────────────────
  const noDevice = await get('/api/kiosk/staff/tonight', staffCookie)
  t(noDevice.s === 403, '5 · PROVE THE HARNESS: a signed staff cookie with no paired tablet is refused', `status ${noDevice.s}`)
  const noStaff = await get('/api/kiosk/staff/tonight', dev)
  t(noStaff.s === 401, '6 · a paired tablet with nobody signed in is refused', `status ${noStaff.s}`)
  const forged = await get('/api/kiosk/staff/tonight', `${dev}; trc_kiosk_staff=${tm.id}`)
  t(forged.s === 401, '7 · an UNSIGNED id in the cookie is refused', `status ${forged.s}`)

  // ── THE BACK BAR ───────────────────────────────────────────────────────
  const bar = await get('/api/kiosk/staff/bar', both)
  t(bar.s === 200 && typeof bar.j.totals?.open === 'number' && bar.j.totals.open > 0,
    '8 · the back bar reads the shelf', `${bar.j.totals?.open} open, ${bar.j.totals?.low} low, ${bar.j.totals?.uncounted} never counted`)
  const search = await get('/api/kiosk/staff/bar?q=glen', both)
  t(bar.s === 200 && Array.isArray(search.j.results), '9 · one bottle can be searched for', `${search.j.results?.length ?? 0} hits for "glen"`)

  // ── THE SHIFT LIST ─────────────────────────────────────────────────────
  // One instance, assigned to the throwaway person, borrowing a real template
  // task for its wording (template_task_id is NOT NULL).
  // A ONE-OFF, through the real RPC. A second instance of a template task in
  // the same week is blocked by idx_shift_instance_once, so a direct insert
  // cannot be used — and a one-off is what a harness should create anyway: it
  // cannot follow anybody into next week.
  //
  // The title is on the INSTANCE and is NOT NULL. db/shift_tasks.sql does not
  // show that column; db/day_shifts.sql added it so a past week renders from
  // its own rows. The first run of this harness threw on it, which is how the
  // route came to be reading the wording off the template by mistake.
  const dow = ((new Date(vnToday() + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1
  const [tpl] = await (await rest(`shift_templates?day_of_week=eq.${dow}&select=id&limit=1`)).json()
  if (tpl) {
    const newId = await (await rest('rpc/shift_add_one_off', { method: 'POST', body: JSON.stringify({
      p_template: tpl.id, p_week: mondayOf(vnToday()), p_actor: tm.id, p_title: 'ZZ Floor Test task',
    }) })).json()
    // shift_add_one_off assigns to the TEMPLATE's rostered person. The harness
    // puts it on the throwaway so `mine` can be asserted, and sets the VN title
    // the RPC has no parameter for.
    ;[instance] = await (await rest(`shift_task_instances?id=eq.${newId}`, { method: 'PATCH',
      body: JSON.stringify({ assignee_team_member_id: tm.id, title_vi: 'ZZ việc thử nghiệm' }) })).json()
  }
  const tasks = await get('/api/kiosk/staff/tasks', both)
  const row = (tasks.j.rows || []).find(r => r.id === instance?.id)
  t(tasks.s === 200 && !!row && row.mine === true, '10 · the shift list reaches the tablet', `${tasks.j.rows?.length ?? 0} rows this week, ${tasks.j.waiting} of mine to do`)
  // THE INSTANCE'S OWN WORDING, not the template's. A task reworded for a week
  // must read as reworded on the floor — see the stocktake migration.
  t(row?.title_en === 'ZZ Floor Test task' && row?.title_vn === 'ZZ việc thử nghiệm',
    '10b · the tablet shows the INSTANCE title, in both languages', `"${row?.title_en}" / "${row?.title_vn}"`)

  const noEvidence = await post('/api/kiosk/staff/tasks', { instance_id: instance?.id, status: 'done' }, both)
  t(noEvidence.s === 400 && /evidence/i.test(noEvidence.j.error || ''),
    '11 · PROVE THE HARNESS: done with NO EVIDENCE is refused', `status ${noEvidence.s} — "${noEvidence.j.error || ''}"`)

  const withEvidence = await post('/api/kiosk/staff/tasks', { instance_id: instance?.id, status: 'done', evidence: 'Counted and photographed, left on the bar.' }, both)
  const after = await (await rest(`shift_task_instances?id=eq.${instance?.id}&select=status,evidence,completed_by`)).json()
  t(withEvidence.s === 200 && after[0]?.status === 'done' && after[0]?.completed_by === tm.id,
    '12 · done WITH evidence is accepted and signed', `status "${after[0]?.status}", completed_by ${after[0]?.completed_by === tm.id ? 'the acting person' : after[0]?.completed_by}`)

  // ── TURNING IT BACK ────────────────────────────────────────────────────
  // A note alone is not enough; a note and the PIN is. The desk works exactly
  // this way, and the floor must not be the weaker door.
  const noPin = await post('/api/kiosk/staff/tasks', { instance_id: instance?.id, status: 'not_started', revert_note: 'ticked the wrong line' }, both)
  t(noPin.s === 400 && /pin/i.test(noPin.j.error || ''), '13 · a revert without the PIN is refused', `"${noPin.j.error || ''}"`)

  const wrongPin = await post('/api/kiosk/staff/tasks', { instance_id: instance?.id, status: 'not_started', revert_note: 'ticked the wrong line', pin: '000000' }, both)
  t(wrongPin.s === 401, '14 · a revert with the WRONG PIN is refused', `status ${wrongPin.s}`)

  const reverted = await post('/api/kiosk/staff/tasks', { instance_id: instance?.id, status: 'not_started', revert_note: 'ticked the wrong line', pin: PIN }, both)
  const back = await (await rest(`shift_task_instances?id=eq.${instance?.id}&select=status`)).json()
  const ev = await (await rest(`shift_task_events?instance_id=eq.${instance?.id}&kind=eq.revert&select=note,actor_name`)).json()
  t(reverted.s === 200 && back[0]?.status === 'not_started' && ev.length === 1,
    '15 · a revert with the note AND the PIN is accepted, and leaves a trail', `status "${back[0]?.status}", ${ev.length} revert event by ${ev[0]?.actor_name}`)

  // NOT NEEDED is a third state, not a shade of done: one tap, no evidence.
  const notNeeded = await post('/api/kiosk/staff/tasks', { instance_id: instance?.id, status: 'not_required' }, both)
  const nn = await (await rest(`shift_task_instances?id=eq.${instance?.id}&select=status`)).json()
  t(notNeeded.s === 200 && nn[0]?.status === 'not_required', '16 · "not needed" needs no evidence', `status "${nn[0]?.status}"`)

  const nonsense = await post('/api/kiosk/staff/tasks', { instance_id: instance?.id, status: 'finished-ish' }, both)
  t(nonsense.s === 400, '17 · a state that does not exist is refused', `status ${nonsense.s}`)

  // ── THE FLOOR NOTE ─────────────────────────────────────────────────────
  const note = await post('/api/kiosk/staff/member', { member_no: MEMBER, note: 'Drinks it with a drop of water, never ice.', category: 'Whisky & Beverage' }, both)
  const cands = await (await rest(`preference_candidates?member_no=eq.${MEMBER}&select=*`)).json()
  const c = cands[0]
  t(note.s === 200 && !!c && c.status === 'pending', '18 · a floor note lands in the desk\'s QUEUE, not the record',
    c ? `status "${c.status}", source "${c.source}"` : 'no row')
  t(!!c && c.suggested_confidence === '0.50' || c?.suggested_confidence === 0.5,
    '19 · an ordinary note is tentative', `confidence ${c?.suggested_confidence}, λ ${c?.suggested_lambda}, s0 ${c?.suggested_s0}`)
  // The provenance must name the PERSON. "Floor" alone would tell a reviewer
  // which screen it came from and nothing about who to go and ask.
  t(!!c && String(c.source).startsWith('Floor') && String(c.source).includes(NAME.split(' ').slice(-1)[0]),
    '20 · the note names the PERSON, not just the tablet', `"${c?.source}"`)

  const allergy = await post('/api/kiosk/staff/member', { member_no: MEMBER, note: 'Severely allergic to shellfish — carries an EpiPen.', category: 'Food & Beverage' }, both)
  const all = await (await rest(`preference_candidates?member_no=eq.${MEMBER}&select=*&order=created_at.desc&limit=1`)).json()
  const a = all[0]
  t(allergy.j.medical === true && Number(a?.suggested_lambda) === 0 && Number(a?.suggested_confidence) === 1 && a?.suggested_s0 === 5,
    '21 · an ALLERGY is locked so it can never fade', `medical=${allergy.j.medical}, λ ${a?.suggested_lambda}, confidence ${a?.suggested_confidence}, s0 ${a?.suggested_s0}`)

  const empty = await post('/api/kiosk/staff/member', { member_no: MEMBER, note: 'x' }, both)
  t(empty.s === 400, '22 · an empty note is refused', `status ${empty.s}`)
  const noteNoStaff = await post('/api/kiosk/staff/member', { member_no: MEMBER, note: 'should never be written' }, dev)
  const afterForge = await (await rest(`preference_candidates?member_no=eq.${MEMBER}&select=candidate_id`)).json()
  t(noteNoStaff.s === 401 && afterForge.length === 2, '23 · nobody can write a note without a PIN', `status ${noteNoStaff.s}, ${afterForge.length} rows (2 expected)`)

  // ── THE SCREEN'S OWN STATE ─────────────────────────────────────────────
  // /api/kiosk/staff/floor asked team_members for `is_active`, which does not
  // exist, so PostgREST failed the request and this route returned 403 to
  // everybody — silently, because the page catches the failure. Who-else-is-on,
  // the shift rules and the entire food-order process never drew. Asserted here
  // so it cannot go quiet again.
  const floor = await get('/api/kiosk/staff/floor', both)
  t(floor.s === 200 && !!floor.j.staff?.name && Array.isArray(floor.j.onShift) && (floor.j.process?.steps?.length ?? 0) > 0,
    '25 · the floor state loads at all', `status ${floor.s}, ${floor.j.onShift?.length ?? '?'} on shift, ${floor.j.process?.steps?.length ?? 0} process steps`)

  // ── WHAT'S ON ──────────────────────────────────────────────────────────
  t(Array.isArray(tn.j.whats_on), '26 · what\'s on tonight rides with it', `${tn.j.whats_on?.length ?? 0} on tonight`)
} catch (e) {
  // A thrown error inside the try would otherwise be swallowed by the exit
  // in `finally` — which is exactly how a harness reports nine passes and
  // stops without saying it stopped.
  console.log('✗ THREW:', e?.message || e)
  fail++
} finally {
  await wipe()
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
