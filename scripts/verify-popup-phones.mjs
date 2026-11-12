#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THREE STAFF PHONES, ONE PLACE — THROUGH THE ROUTE, NOT THE FUNCTION.
//
//   node race-phones.mjs           100 rounds
//   ROUNDS=20 node race-phones.mjs
//
// ── WHY THIS EXISTS BESIDE verify-popup-races.mjs ────────────────────────
// That one calls popup_book() directly and has run 100/100 clean. It proves
// POSTGRES. It does not touch the device cookie, the staff cookie, the route's
// own validation, the attempt id, or the JSON a phone actually receives — all
// of which sit between a thumb and that function, and all of which changed
// today when sign-up moved from tablets onto phones.
//
// So this races THREE SEPARATELY PAIRED DEVICES against the live
// /api/kiosk/popup/book, each with its own device cookie and its own attempt
// id, exactly as three phones in three hands would.
//
// ── WHAT IT DOES TO THE REAL EVENT, AND WHAT IT PUTS BACK ────────────────
// It books on the real event, because POPUP_SLUG is read by the server and a
// second event would need a second server. It therefore:
//   · refuses to start if that event already has ANY booking;
//   · caps ONE session at 1 and restores the override afterwards;
//   · books with NO EMAIL, so not one message is sent and the race stays
//     about the lock;
//   · deletes every row it made and PROVES the count is back to zero.
//
// ⚠ FAILURES ARE KEPT WHOLE. Same rule as the other races: the full round —
// every status code, every body, every row — is printed and written to disk
// before anything is counted.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID, createHash, createHmac } from 'node:crypto'

const ROUNDS = Number(process.env.ROUNDS || 100)
const BASE = process.env.BASE || 'http://localhost:3001'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = await import(`${process.cwd()}/node_modules/@supabase/supabase-js/dist/index.cjs`)
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'

const failures = []
const phones = []
let ok = 0, sessionId = null, hadOverride = null, wasPublished = null, eventId = null

const dump = (round, detail) => {
  const rec = { round, at: new Date().toISOString(), ...detail }
  failures.push(rec)
  console.log(`\n✗ ROUND ${round} FAILED`)
  console.log(JSON.stringify(rec, null, 2))
}

try {
  const { data: ev } = await a.from('popup_events').select('id, published').eq('slug', SLUG).single()
  eventId = ev.id
  const { count: existing } = await a.from('popup_bookings')
    .select('id', { count: 'exact', head: true }).eq('event_id', eventId)
  if (existing !== 0) throw new Error(`REFUSING TO RUN: ${existing} real booking(s) already on ${SLUG}`)

  wasPublished = ev.published
  if (!wasPublished) await a.from('popup_events').update({ published: true }).eq('id', eventId)

  const { data: ss } = await a.from('popup_sessions')
    .select('id, cap_override').eq('event_id', eventId).order('idx')
  sessionId = ss[0].id
  hadOverride = ss[0].cap_override
  await a.from('popup_sessions').update({ cap_override: 1 }).eq('id', sessionId)

  // ── THREE PHONES, THREE PAIRINGS ────────────────────────────────────────
  // Three staff members, each signed in on their own handset. Different
  // acting staff too, so the winner's attribution can be checked.
  const { data: team } = await a.from('team_members')
    .select('id, display_name').eq('active', true).not('pin_hash', 'is', null).limit(3)
  if ((team || []).length < 3) throw new Error('need three active staff with PINs')

  for (let i = 0; i < 3; i++) {
    const token = randomUUID() + randomUUID()
    const { data: d, error } = await a.from('kiosk_devices').insert({
      label: `RACE PHONE ${i + 1} — throwaway`,
      token_hash: createHash('sha256').update(token).digest('hex'),
      purpose: 'room', enrolled_at: new Date().toISOString(),
    }).select().single()
    if (error) throw new Error('pair: ' + error.message)
    const sig = createHmac('sha256', env.SUPABASE_JWT_SECRET).update(`kiosk:${team[i].id}`).digest('base64url')
    phones.push({ id: d.id, who: team[i].display_name,
      cookie: `trc_kiosk_device=${token}; trc_kiosk_staff=${team[i].id}.${sig}` })
  }
  console.log(`${ROUNDS} rounds · 3 paired phones · ${BASE}/api/kiosk/popup/book`)
  console.log(`held by: ${phones.map(p => p.who).join(' · ')}\n`)

  for (let r = 1; r <= ROUNDS; r++) {
    await a.from('popup_bookings').delete().eq('event_id', eventId)

    const t0 = Date.now()
    const answers = await Promise.all(phones.map(async (ph, i) => {
      const body = {
        session_id: sessionId, name: `Phone ${i + 1} guest`,
        email: '',                       // no email → no message sent
        party_size: 1, lang: 'en', consent: false, terms_text: 'race',
        attempt_id: randomUUID(), allow_waiting: false,
      }
      try {
        const res = await fetch(`${BASE}/api/kiosk/popup/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: ph.cookie },
          body: JSON.stringify(body),
        })
        return { phone: i + 1, who: ph.who, status: res.status, body: await res.json().catch(() => null) }
      } catch (e) { return { phone: i + 1, who: ph.who, status: 0, error: String(e) } }
    }))

    const won = answers.filter(x => x.status === 200 && x.body?.ok)
    const lost = answers.filter(x => !(x.status === 200 && x.body?.ok))
    // ⚠ THE READ-BACK IS CHECKED FOR AN ERROR, NOT JUST FOR ROWS. On the first
    // run this selected a column that does not exist (there is no
    // created_by_staff on popup_bookings), PostgREST returned an error, `data`
    // came back null, and the harness read that as "0 confirmed bookings" and
    // failed five perfectly good rounds. A query that broke and a table that is
    // empty must never arrive here looking the same.
    const { data: rows, error: readErr } = await a.from('popup_bookings')
      .select('name, status, device_hash').eq('session_id', sessionId)
    const confirmed = (rows || []).filter(x => x.status === 'confirmed')

    const why =
      readErr ? 'THE HARNESS COULD NOT READ THE TABLE: ' + readErr.message :
      answers.some(x => x.status === 0) ? 'a phone could not reach the route at all' :
      won.length !== 1 ? `${won.length} phones were told yes, not 1` :
      confirmed.length !== 1 ? `the database holds ${confirmed.length} confirmed bookings, not 1` :
      !lost.every(x => x.status === 409) ? 'a losing phone got something other than 409' :
      !lost.every(x => typeof x.body?.error === 'string' && x.body.error.length > 0)
        ? 'a losing phone got no sentence to show the guest' :
      !won[0].body?.time ? 'the winning phone was not told the time to say out loud' : null

    if (why) dump(r, { why, ms: Date.now() - t0, answers, dbRows: rows, readErr: readErr?.message ?? null })
    else ok++

    if (r % 10 === 0) process.stdout.write(`  ${r}/${ROUNDS}  ${ok} clean\n`)
  }
} catch (e) {
  dump(0, { why: 'THE HARNESS ITSELF: ' + e.message, stack: String(e.stack || '').slice(0, 600) })
} finally {
  if (eventId) await a.from('popup_bookings').delete().eq('event_id', eventId)
  if (sessionId) await a.from('popup_sessions').update({ cap_override: hadOverride }).eq('id', sessionId)
  if (eventId && wasPublished === false) await a.from('popup_events').update({ published: false }).eq('id', eventId)
  for (const p of phones) await a.from('kiosk_devices').delete().eq('id', p.id)
  const { count: left } = await a.from('popup_bookings').select('id', { count: 'exact', head: true }).eq('event_id', eventId)
  const { count: devs } = await a.from('kiosk_devices').select('id', { count: 'exact', head: true }).like('label', 'RACE PHONE%')
  console.log(`\nput back · bookings on ${SLUG}: ${left} · throwaway phones left: ${devs} · published: ${wasPublished}`)
}

if (failures.length) {
  const path = `/tmp/popup-phones-${Date.now()}.json`
  writeFileSync(path, JSON.stringify(failures, null, 2))
  console.log(`\n✗ ${failures.length} FAILED ROUND(S) — full detail above and in ${path}`)
  process.exit(1)
}
console.log(`\n✓ three phones, one place: ${ok}/${ROUNDS} clean — through the real route`)
