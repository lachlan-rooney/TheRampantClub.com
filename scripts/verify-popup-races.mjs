#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE TWO RACES, RUN UNTIL THEY MEAN SOMETHING.
//
//   node scripts/verify-popup-races.mjs            100 rounds of each
//   ROUNDS=250 node scripts/verify-popup-races.mjs
//
// ── WHY THIS EXISTS SEPARATELY FROM verify-popup.mjs ─────────────────────
// A race that passes once has not been tested; it has been sampled. The full
// suite builds and tears down an event every run, which is too slow to say
// anything about a one-in-fifty failure. This builds ONE event and hammers the
// two moments that decide tomorrow evening:
//
//   · three tablets reaching for the LAST PLACE in the same instant
//   · four door phones scanning the SAME TICKET in the same instant
//
// ── AND WHY THE LOGGING IS THE WAY IT IS ─────────────────────────────────
// ⚠ ON 12 NOV 2026 A RUN FAILED ONCE AND THE REASON WAS LOST, because the
// shell wrapper around it kept only the tally line and discarded the ✗ text.
// An unexplained intermittent failure in the thing running tomorrow night is
// not something to shrug at, and it could not be chased because the evidence
// had been thrown away by the thing reporting it.
//
// So: every round's RAW RESULTS are held, and the moment one fails, the whole
// round is printed — every RPC answer, the database state afterwards, and the
// round number — and the file is written to disk. Nothing is summarised until
// after it has been kept.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const ROUNDS = Number(process.env.ROUNDS || 100)
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = await import(`${process.cwd()}/node_modules/@supabase/supabase-js/dist/index.cjs`)
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const rpc = async (fn, args) => {
  const { data, error } = await a.rpc(fn, args)
  if (error) return { __error: error.message, __fn: fn }
  return Array.isArray(data) ? data[0] : data
}

const failures = []
const slug = 'race-' + randomUUID().slice(0, 8)
let eventId = null
let bookOk = 0, doorOk = 0

const dump = (round, kind, detail) => {
  const rec = { round, kind, at: new Date().toISOString(), ...detail }
  failures.push(rec)
  console.log(`\n✗ ROUND ${round} — ${kind} FAILED`)
  console.log(JSON.stringify(rec, null, 2))
}

try {
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
  const { data: ev, error: evErr } = await a.from('popup_events').insert({
    slug, title_en: 'RACE HARNESS — not an event', venue_en: 'Harness',
    event_date: tomorrow, first_start: '18:00', last_finish: '18:20',
    session_minutes: 15, changeover_minutes: 5,
    default_cap: 1, party_max: 2, published: true, public_bookings: false,
    admit_early_minutes: 10, admit_late_minutes: 10,
  }).select().single()
  if (evErr) throw new Error('fixture: ' + evErr.message)
  eventId = ev.id
  await rpc('popup_generate_sessions', { p_event_id: eventId })
  const { data: ss } = await a.from('popup_sessions').select('id').eq('event_id', eventId).order('idx')
  const S = ss[0].id

  const future = () => a.from('popup_sessions').update({
    starts_at: new Date(Date.now() + 3600_000).toISOString(),
    ends_at: new Date(Date.now() + 4500_000).toISOString(),
  }).eq('id', S)
  const live = () => a.from('popup_sessions').update({
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: new Date(Date.now() + 840_000).toISOString(),
  }).eq('id', S)

  console.log(`${ROUNDS} rounds of each race, against ${slug}\n`)

  for (let r = 1; r <= ROUNDS; r++) {
    // ── RESET: one place, nobody in it ──────────────────────────────────
    await a.from('popup_bookings').delete().eq('event_id', eventId)
    await future()

    // ══ RACE 1 · THREE TABLETS, ONE PLACE ═══════════════════════════════
    const t0 = Date.now()
    const three = await Promise.all([1, 2, 3].map(i => rpc('popup_book', {
      p_event_id: eventId, p_session_id: S, p_name: `Tablet ${i}`,
      p_email: `delivered+r${r}t${i}@resend.dev`, p_party: 1, p_lang: 'en',
      p_consent: false, p_terms: 'race', p_source: 'kiosk',
      p_attempt: randomUUID(), p_allow_waiting: false,
    })))
    const won = three.filter(x => x && x.ok)
    const lost = three.filter(x => x && !x.ok)
    const { data: rows } = await a.from('popup_bookings')
      .select('name,status').eq('session_id', S)
    const confirmed = (rows || []).filter(x => x.status === 'confirmed')

    const bookBad =
      won.length !== 1 ? 'more or fewer than one winner' :
      confirmed.length !== 1 ? 'the database does not hold exactly one confirmed booking' :
      !lost.every(x => x.reason === 'full') ? 'a loser was given the wrong reason' :
      won[0].status !== 'confirmed' ? 'the winner is not confirmed' : null

    if (bookBad) {
      dump(r, 'THREE TABLETS, ONE PLACE', {
        why: bookBad, ms: Date.now() - t0,
        rpcAnswers: three, dbRows: rows,
        winners: won.length, losers: lost.length,
      })
    } else bookOk++

    // ══ RACE 2 · FOUR PHONES, ONE TICKET ════════════════════════════════
    if (won.length === 1) {
      await live()
      const code = won[0].ticket_code
      const t1 = Date.now()
      const scans = await Promise.all(['Ni', 'Door 2', 'Door 3', 'Door 4'].map(by =>
        rpc('popup_scan', { p_event_id: eventId, p_code: code, p_admit: true, p_by: by })))
      const valid = scans.filter(s => s && s.state === 'valid')
      const used = scans.filter(s => s && s.state === 'used')
      const admitters = new Set(scans.map(s => s && s.admitted_by).filter(Boolean))
      const { data: after } = await a.from('popup_bookings')
        .select('admitted_at,admitted_by').eq('ticket_code', code).maybeSingle()

      const doorBad =
        scans.some(s => s && s.__error) ? 'an RPC errored' :
        valid.length !== 1 ? `${valid.length} phones were told valid, not 1` :
        used.length !== 3 ? `${used.length} phones were told already-used, not 3` :
        admitters.size !== 1 ? `the record names ${admitters.size} admitters` :
        !after?.admitted_at ? 'the booking was never marked admitted' : null

      if (doorBad) {
        dump(r, 'FOUR PHONES, ONE TICKET', {
          why: doorBad, ms: Date.now() - t1,
          rpcAnswers: scans, dbRow: after, admitters: [...admitters],
        })
      } else doorOk++
    }

    if (r % 10 === 0) process.stdout.write(`  ${r}/${ROUNDS}  bookings ${bookOk} ok · doors ${doorOk} ok\n`)
  }
} catch (e) {
  dump(0, 'THE HARNESS ITSELF', { why: e.message, stack: String(e.stack || '').slice(0, 600) })
} finally {
  if (eventId) {
    await a.from('popup_events').delete().eq('id', eventId)
    const { count } = await a.from('popup_events').select('id', { count: 'exact', head: true }).eq('slug', slug)
    console.log(`\nharness event removed: ${count === 0 ? 'yes' : 'NO — ' + count + ' left'}`)
  }
  const { count: real } = await a.from('popup_bookings').select('id', { count: 'exact', head: true })
  console.log(`real bookings on the live event, untouched: ${real}`)
}

// ⚠ WRITTEN TO DISK BEFORE ANYTHING IS SUMMARISED. The one thing this file
// exists to prevent is a failure that cannot be looked at afterwards.
const path = `/tmp/popup-races-${Date.now()}.json`
if (failures.length) { writeFileSync(path, JSON.stringify(failures, null, 2)); }

console.log(`\nthree tablets, one place : ${bookOk}/${ROUNDS} clean`)
console.log(`four phones, one ticket  : ${doorOk}/${ROUNDS} clean`)
if (failures.length) {
  console.log(`\n✗ ${failures.length} FAILED ROUND(S) — full detail above and in ${path}`)
  process.exit(1)
}
console.log(`\n✓ both races clean across ${ROUNDS} rounds each`)
