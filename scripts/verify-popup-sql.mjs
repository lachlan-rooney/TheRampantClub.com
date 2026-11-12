// WHICH SQL FILES ARE ACTUALLY LIVE IN THE DATABASE — asked of the database,
// not of the repository. Each probe is something only that file creates.
import { readFileSync } from 'node:fs'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = await import(`${process.cwd()}/node_modules/@supabase/supabase-js/dist/index.cjs`)
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const NIL = '00000000-0000-0000-0000-000000000000'
const gone = e => e && /could not find|does not exist|schema cache/i.test(e.message)

const checks = [
  ['db/popup_timed_entry.sql', 'the five tables and the session grid', async () => {
    const { error } = await a.from('popup_sessions').select('id').limit(1); return !error }],
  ['db/popup_door_concurrency.sql', 'the atomic admit and the door list', async () => {
    const { error } = await a.rpc('popup_doorlist', { p_event_id: NIL }); return !gone(error) }],
  ['db/popup_staff_phones.sql', "purpose = 'popup' on a device", async () => {
    const { error } = await a.from('kiosk_devices').insert({ label: 'PROBE', token_hash: 'p'.repeat(64), purpose: 'popup' })
    if (!error) await a.from('kiosk_devices').delete().eq('token_hash', 'p'.repeat(64))
    return !error || !/purpose/.test(error.message) }],
  ['db/popup_tonight.sql · columns', 'taken_by · admitted_party · reconciled_at', async () => {
    const { error } = await a.from('popup_bookings').select('taken_by, admitted_party, reconciled_at').limit(1)
    return !error }],
  ['db/popup_tonight.sql · popup_walkup', 'a walk-up on a running session', async () => {
    const { error } = await a.rpc('popup_walkup', { p_event_id: NIL, p_session_id: NIL, p_name: 'x', p_party: 1, p_by: 'x' })
    return !gone(error) }],
  ['db/popup_tonight.sql · the scan FIX', 'an unknown code answers instead of erroring', async () => {
    // ⚠ THE ONE THAT WAS BROKEN. Eleven columns against a twelve-column
    // signature raised at RUN time, and only on this branch.
    const { data, error } = await a.rpc('popup_scan', { p_event_id: NIL, p_code: 'DEADBEEF', p_admit: false, p_by: 'probe' })
    if (error) return false
    const r = Array.isArray(data) ? data[0] : data
    return r?.state === 'unknown' }],
  ['db/popup_tonight.sql · popup_shift', 'moving the evening', async () => {
    const { error } = await a.rpc('popup_shift', { p_event_id: NIL, p_minutes: 10 }); return !gone(error) }],
  ['db/popup_tonight.sql · popup_reconcile', 'the morning after', async () => {
    const { error } = await a.rpc('popup_reconcile', { p_booking_id: NIL, p_arrived: false, p_party: null, p_by: 'x', p_note: null }); return !gone(error) }],
  ['db/popup_tonight.sql · reminders', 'who is due a ten-minute email', async () => {
    const { error } = await a.rpc('popup_due_reminders', { p_event_id: NIL }); return !gone(error) }],
  ['db/popup_tonight.sql · follow-up', 'who is due the morning-after email', async () => {
    const { error } = await a.rpc('popup_followup_due', { p_event_id: NIL }); return !gone(error) }],
  ['db/popup_tonight.sql · set_party', 'correcting how many came in', async () => {
    const { error } = await a.rpc('popup_set_party', { p_booking_id: NIL, p_party: 1, p_by: 'x' }); return !gone(error) }],
]

let missing = 0
for (const [file, what, run] of checks) {
  const ok = await run()
  console.log(`${ok ? '✓ LIVE   ' : '✗ MISSING'} ${file.padEnd(38)} ${what}`)
  if (!ok) missing++
}
// and nothing is callable by the public
const { data: grants } = await a.rpc('popup_doorlist', { p_event_id: NIL })
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { error: anonErr } = await anon.rpc('popup_doorlist', { p_event_id: NIL })
console.log(anonErr ? '\n✓ the door list is NOT callable with the public key' : '\n✗ ANON CAN READ THE DOOR LIST')
if (!anonErr) missing++
const { error: bookErr } = await anon.rpc('popup_book', { p_event_id: NIL, p_session_id: NIL, p_name: 'x', p_email: null, p_party: 1, p_lang: 'en', p_consent: false, p_terms: 'x', p_source: 'kiosk', p_attempt: null })
console.log(bookErr ? '✓ and neither is popup_book' : '✗ ANON CAN BOOK')
if (!bookErr) missing++

console.log(missing ? `\n✗ ${missing} thing(s) are not live` : '\n✓ EVERY SQL FILE IS LIVE — nothing left to run')
process.exit(missing ? 1 : 0)
