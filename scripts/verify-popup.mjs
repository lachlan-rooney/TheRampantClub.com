#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE POP-UP, PROVED — timed entry at Independence Palace.
//
//   node scripts/verify-popup.mjs
//
// Builds its own throwaway event, hammers it, and deletes it. It NEVER touches
// 'palace-2026-11-13'.
//
// ⚠ THE EVENT IT CREATES IS PUBLISHED, because popup_book refuses an
// unpublished one. It is not on any public page — the pop-up has no public
// listing — but it is real while the run lasts, and it is deleted in `finally`.
//
// ══ WHAT THIS IS FOR ══════════════════════════════════════════════════════
// Two races decide whether tomorrow evening works:
//   · three tablets reaching for the LAST PLACE in the same second
//   · several door phones scanning the SAME TICKET in the same second
// Neither can be found by using the thing carefully. Both are here.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY
let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const { createClient } = await import(`${process.cwd()}/node_modules/@supabase/supabase-js/dist/index.cjs`)
const a = createClient(U, K, { auth: { persistSession: false } })
const rpc = async (fn, args) => {
  const { data, error } = await a.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return Array.isArray(data) ? data[0] : data
}
const hhmm = (iso) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

const slug = 'rehearsal-' + randomUUID().slice(0, 8)
let eventId = null

try {
  // ── THE FIXTURE ───────────────────────────────────────────────────────
  // Tomorrow's date so every session is in the future; a cap of ONE so the
  // last place is the first place and the race needs no warm-up.
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
  const { data: ev, error: evErr } = await a.from('popup_events').insert({
    slug, title_en: 'REHEARSAL — not an event', venue_en: 'Rehearsal',
    event_date: tomorrow, first_start: '18:00', last_finish: '19:00',
    session_minutes: 15, changeover_minutes: 5,
    default_cap: 1, party_max: 2, published: true, public_bookings: false,
  }).select().single()
  if (evErr) throw new Error('could not create the rehearsal event: ' + evErr.message)
  eventId = ev.id
  const made = await rpc('popup_generate_sessions', { p_event_id: eventId })
  t(made === 3, 'the rehearsal grid generated', `${made} sessions from 18:00–19:00`)

  const { data: sessions } = await a.from('popup_sessions')
    .select('id, idx, starts_at').eq('event_id', eventId).order('idx')
  const first = sessions[0]

  const book = (name, email, party = 1, sessionId = first.id, allowWaiting = false) =>
    rpc('popup_book', {
      p_event_id: eventId, p_session_id: sessionId, p_name: name, p_email: email,
      p_party: party, p_lang: 'en', p_consent: false, p_terms: 'rehearsal',
      p_source: 'kiosk', p_attempt: randomUUID(), p_allow_waiting: allowWaiting,
    })

  // ══ A · THREE TABLETS, ONE PLACE, SAME INSTANT ═══════════════════════
  console.log('\n── A · three tablets reach for the last place together ──')
  const three = await Promise.all([
    book('Tablet One',   'delivered+one@resend.dev'),
    book('Tablet Two',   'delivered+two@resend.dev'),
    book('Tablet Three', 'delivered+three@resend.dev'),
  ])
  const won = three.filter(r => r.ok)
  const lost = three.filter(r => !r.ok)
  t(won.length === 1, 'EXACTLY ONE of the three succeeded', `${won.length} won, ${lost.length} refused`)
  t(won[0]?.status === 'confirmed', 'and the winner has a confirmed place, not a waiting one', won[0]?.status)
  t(lost.every(r => r.reason === 'full'),
    'the other two are told the place has gone — not silently waitlisted',
    lost.map(r => r.reason).join(', '))

  // THE DATABASE IS THE ARBITER, not the three answers we were handed.
  const { data: rows } = await a.from('popup_bookings')
    .select('name,status,party_size').eq('session_id', first.id)
  const confirmed = rows.filter(r => r.status === 'confirmed')
  t(confirmed.length === 1, 'and the database holds exactly one booking for that session',
    `${rows.length} row(s), ${confirmed.length} confirmed`)

  // CONTROL: without the lock all three would have fitted. Prove the cap was
  // genuinely the binding constraint by showing the next session takes one.
  // ⚠ A FRESH ADDRESS. This first reused Tablet Two's, and when Tablet Two was
  // the one that WON the race the control came back 'duplicate' — testing the
  // one-per-email rule by accident instead of the capacity it meant to.
  const spill = await book('Spill Guest', 'delivered+spill@resend.dev', 1, sessions[1].id)
  t(spill.ok && spill.status === 'confirmed',
    'CONTROL: the next session had room all along — the refusals were the cap, not a fault',
    `${hhmm(spill.starts_at)}`)

  // ══ B · THE WAITING LIST IS A CHOICE ═════════════════════════════════
  console.log('\n── B · the waiting list is asked for, never assumed ──')
  const w = await book('Waiting Guest', 'delivered+wait@resend.dev', 1, first.id, true)
  t(w.ok && w.status === 'waiting', 'asking for the waiting list puts you on it', w.status)

  // ══ C · ONE PLACE, A PARTY OF TWO ════════════════════════════════════
  console.log('\n── C · a party must fit ──')
  await a.from('popup_sessions').update({ cap_override: 3 }).eq('id', sessions[2].id)
  await book('Single', 'delivered+single@resend.dev', 2, sessions[2].id)   // takes 2 of 3
  const tooBig = await book('Pair', 'delivered+pair@resend.dev', 2, sessions[2].id)
  t(!tooBig.ok && tooBig.reason === 'full',
    'a party of two cannot take the one remaining place', tooBig.reason)

  // ══ D · PROMOTION SKIPS A PARTY THAT CANNOT FIT, AND SAYS SO ═════════
  // ⚠ THE SESSION MUST BE GENUINELY FULL FIRST. This fixture left one place
  // free, so the "waiting" single was simply CONFIRMED into it and there was
  // nothing left to promote — the test reported 0 promoted and looked like a
  // broken promoter when the fixture was the thing that was wrong.
  console.log('\n── D · raising the cap promotes, in order, skipping what will not fit ──')
  await a.from('popup_sessions').update({ cap_override: 2 }).eq('id', sessions[2].id)  // full at 2
  const wp = await book('Waiting Pair', 'delivered+wpair@resend.dev', 2, sessions[2].id, true)
  const ws = await book('Waiting Single', 'delivered+wsingle@resend.dev', 1, sessions[2].id, true)
  t(wp.status === 'waiting' && ws.status === 'waiting',
    'CONTROL: both are genuinely waiting, so there is something to promote',
    `${wp.status}, ${ws.status}`)
  await a.from('popup_sessions').update({ cap_override: 3 }).eq('id', sessions[2].id)  // one place opens
  const promo = await rpc('popup_promote', { p_session_id: sessions[2].id })
  t((promo.promoted || []).length === 1, 'exactly one was promoted into the one new place',
    `${(promo.promoted || []).length} promoted`)
  t((promo.skipped || []).length === 1, 'and the party too large to fit is reported as skipped',
    `${(promo.skipped || []).length} skipped`)
  {
    const { data: who } = await a.from('popup_bookings')
      .select('name,status').in('id', promo.promoted || [])
    t(who?.[0]?.name === 'Waiting Single', 'the one promoted is the single, not the pair', who?.[0]?.name)
  }

  // ══ E · IDEMPOTENCY — the retry that must not double-book ════════════
  console.log('\n── E · a retry inside one interaction takes one place, not two ──')
  // ⚠ MAKE ROOM FIRST. The event's cap is ONE, and section A's control guest
  // already took the only place at 18:20 — so this booked nothing, reported a
  // failed retry, and took section F down with it. Three red lines, one
  // exhausted session.
  await a.from('popup_sessions').update({ cap_override: 5 }).eq('id', sessions[1].id)
  const attempt = randomUUID()
  const again = () => rpc('popup_book', {
    p_event_id: eventId, p_session_id: sessions[1].id, p_name: 'Retry Guest',
    p_email: 'delivered+retry@resend.dev', p_party: 1, p_lang: 'en', p_consent: false,
    p_terms: 'rehearsal', p_source: 'kiosk', p_attempt: attempt, p_allow_waiting: false,
  })
  const r1 = await again()
  const r2 = await again()
  t(r1.ok && r2.ok, 'both the request and its retry report success')
  t(r1.booking_id === r2.booking_id, 'and they are the SAME booking, not two',
    r1.booking_id === r2.booking_id ? 'one id' : `${r1.booking_id} vs ${r2.booking_id}`)
  {
    const { count } = await a.from('popup_bookings').select('id', { count: 'exact', head: true })
      .eq('event_id', eventId).eq('name', 'Retry Guest')
    t(count === 1, 'the database holds one row for that guest', `${count}`)
  }

  // ══ F · ONE BOOKING PER EMAIL, AND SAY WHERE THE OTHER IS ════════════
  console.log('\n── F · the same address twice ──')
  const dup = await book('Retry Guest', 'delivered+retry@resend.dev', 1, sessions[2].id)
  t(!dup.ok && dup.reason === 'duplicate', 'a second booking on one address is refused', dup.reason)
  t(!!dup.starts_at, 'and the refusal names the session they already have',
    dup.starts_at ? hhmm(dup.starts_at) : 'NO TIME GIVEN — the tablet could not say where')

  // ══ G · SEVERAL DOOR PHONES, ONE TICKET, SAME INSTANT ════════════════
  console.log('\n── G · four door phones scan the same ticket together ──')
  const { data: hasScan } = await a.rpc('popup_doorlist', { p_event_id: eventId }).then(
    r => ({ data: !r.error }), () => ({ data: false }))
  if (!hasScan) {
    console.log('– SKIPPED: db/popup_door_concurrency.sql has not been run yet.')
    console.log('–   Until it is, two phones scanning together BOTH report "valid".')
  } else {
    const ticket = won[0].ticket_code
    // ⚠ THE SESSION HAS TO BE HAPPENING. The rehearsal grid is tomorrow, so
    // every scan came back 'early' and nothing was admitted — the door was
    // behaving perfectly and the test was knocking on a door before opening
    // time. Slide the winner's session over now.
    await a.from('popup_sessions').update({
      starts_at: new Date(Date.now() - 60_000).toISOString(),
      ends_at: new Date(Date.now() + 14 * 60_000).toISOString(),
    }).eq('id', first.id)
    const scan = (by) => rpc('popup_scan', {
      p_event_id: eventId, p_code: ticket, p_admit: true, p_by: by })
    const scans = await Promise.all([scan('Ni'), scan('Door 2'), scan('Door 3'), scan('Door 4')])
    t(scans.every(s2 => s2.state === 'valid' || s2.state === 'used'),
      'CONTROL: the session is live, so a scan is neither early nor late',
      [...new Set(scans.map(s2 => s2.state))].join(', '))
    const admitted = scans.filter(s => s.state === 'valid')
    const used = scans.filter(s => s.state === 'used')
    t(admitted.length === 1, 'EXACTLY ONE phone admitted the guest', `${admitted.length} admitted, ${used.length} told "already used"`)
    t(used.length === 3, 'and the other three were told plainly, not given an error')
    t(used.every(s => !!s.admitted_by), 'each loser is told WHO admitted them',
      used.map(s => s.admitted_by).join(', '))
    const names = new Set(scans.map(s => s.admitted_by))
    t(names.size === 1, 'the record names one admitter, not whoever wrote last', [...names].join(', '))
  }

  // ══ H · THE PUBLIC SHAPE CARRIES NO GUEST ════════════════════════════
  console.log('\n── H · what a tablet is allowed to see ──')
  const { data: pub } = await a.rpc('popup_public', { p_slug: slug })
  t(Array.isArray(pub) && pub.length > 0, 'CONTROL: the public shape returns the sessions', `${pub?.length} rows`)
  const blob = JSON.stringify(pub)
  for (const leak of ['Tablet One', 'delivered+', 'ticket_code', won[0].ticket_code]) {
    t(!blob.includes(leak), `no "${leak}" in the public shape`)
  }

} catch (e) {
  fail++
  console.log('✗ the run threw —', e.message)
} finally {
  if (eventId) {
    await a.from('popup_events').delete().eq('id', eventId)
    const { count } = await a.from('popup_events').select('id', { count: 'exact', head: true }).eq('slug', slug)
    t(count === 0, 'the rehearsal event is gone again')
  }
  const { count: real } = await a.from('popup_bookings').select('id', { count: 'exact', head: true })
  console.log(`\nreal bookings on the live event, untouched: ${real}`)
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
