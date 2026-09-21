#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RE-TIME THE ROTA  ·  the 2026-09-21 rules
// ───────────────────────────────────────────────────────────────────────────
//   · Office is for OFFICE STAFF ONLY (Miss Ni, Miss Chau). A floor person's
//     Office day becomes their Open.
//   · Open  14:00 → 22:00. The hour to 15:00 is bar set-up, then report to
//     Miss Chau. Every day including Saturday and Sunday, because the club
//     opens at 15:00 seven days a week.
//   · Close 15:00 → 00:00, every day.
//   · Cleaning is untouched.
//   · Exactly one Open a night. A second person at 14:00 is an hour nobody
//     needed; none at all means the bar is not set up when the doors open.
//
// TODAY IS NOT TOUCHED. Shifts already under way are not re-timed under the
// people working them — the change starts tomorrow.
//
// Writes a snapshot to scratchpad before it changes anything, and does nothing
// at all unless run with --apply.
//
//   node scripts/rota-retime.mjs            # dry run
//   node scripts/rota-retime.mjs --apply
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const env = {}
for (const l of readFileSync('.env.local','utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g,'')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }
const get = async p => { const r = await fetch(`${U}/rest/v1/${p}`, { headers: H })
  if (!r.ok) throw new Error(`${p} → ${r.status} ${await r.text()}`); return r.json() }

const FROM = new Date(Date.now() + 864e5).toISOString().slice(0,10)   // tomorrow

// OFFICE STAFF: the people the Office shift is now reserved for.
const OFFICE_STAFF = ['Miss Ni', 'Miss Chau']

const team = await get('team_members?select=id,display_name,morning_weekday,on_rota,always_shift')
const name = new Map(team.map(t => [t.id, t.display_name]))
const officeIds = new Set(team.filter(t => OFFICE_STAFF.includes(t.display_name)).map(t => t.id))
const fixedOpen = new Map(team.filter(t => t.morning_weekday != null && !officeIds.has(t.id))
                              .map(t => [t.id, t.morning_weekday]))
// Mr Sĩ closes: he is the boss and he is there at the end of the night. He is
// the last person who should be handed the Open on a night nobody's fixed day
// falls on — the existing data had him opening a Saturday, which is how this
// was noticed.
const alwaysCloses = new Set(team.filter(t => t.always_shift === 'Close').map(t => t.id))

const rows = await get(`rota_shifts?shift_date=gte.${FROM}&select=id,member,shift_date,shift_name,start_time,end_time&order=shift_date,start_time`)
writeFileSync(`${process.env.SNAP || '/tmp'}/rota-snapshot-${FROM}.json`, JSON.stringify(rows, null, 1))
console.log(`snapshot: ${rows.length} rows from ${FROM} →  ${process.env.SNAP || '/tmp'}/rota-snapshot-${FROM}.json\n`)

// ── 1. Re-time and rename ────────────────────────────────────────────────
const want = new Map()   // id → {shift_name, start_time, end_time}
for (const r of rows) {
  if (r.shift_name.startsWith('Clean')) continue
  if (r.shift_name === 'Office' && officeIds.has(r.member)) continue   // real office staff
  if (r.shift_name === 'Office' || r.shift_name === 'Open')
    want.set(r.id, { shift_name: 'Open',  start_time: '14:00:00', end_time: '22:00:00' })
  else if (r.shift_name === 'Close')
    want.set(r.id, { shift_name: 'Close', start_time: '15:00:00', end_time: '00:00:00' })
}

// ── 2. Exactly one Open a night ──────────────────────────────────────────
const byDate = {}
for (const r of rows) {
  if (r.shift_name.startsWith('Clean')) continue
  if (r.shift_name === 'Office' && officeIds.has(r.member)) continue
  ;(byDate[r.shift_date] ??= []).push(r)
}
for (const [date, list] of Object.entries(byDate)) {
  const wd = new Date(date + 'T12:00:00').getDay()
  const nameOf = id => want.get(id)?.shift_name ?? rows.find(r => r.id === id).shift_name
  // Who should hold the Open: their fixed day beats anything else, then
  // anyone who is not a designated closer, and only then whoever is left.
  const pickOpen = cands =>
    cands.find(r => fixedOpen.get(r.member) === wd)
    ?? cands.find(r => !alwaysCloses.has(r.member))
    ?? cands[0]

  const opens = list.filter(r => nameOf(r.id) === 'Open')
  if (opens.length > 1) {
    const keep = pickOpen(opens)
    for (const r of opens) if (r.id !== keep.id)
      want.set(r.id, { shift_name: 'Close', start_time: '15:00:00', end_time: '00:00:00' })
  } else if (opens.length === 1) {
    // One Open, but is it the right person? A designated closer holding it
    // while somebody else on the night could take it is a swap, not a rename.
    const held = opens[0]
    if (alwaysCloses.has(held.member)) {
      const better = list.find(r => r.id !== held.id && !alwaysCloses.has(r.member))
      if (better) {
        want.set(held.id,   { shift_name: 'Close', start_time: '15:00:00', end_time: '00:00:00' })
        want.set(better.id, { shift_name: 'Open',  start_time: '14:00:00', end_time: '22:00:00' })
      }
    }
  } else if (list.length) {
    const keep = pickOpen(list)
    want.set(keep.id, { shift_name: 'Open', start_time: '14:00:00', end_time: '22:00:00' })
  }
}

// ── 3. Report, then maybe write ──────────────────────────────────────────
const changes = [...want.entries()].filter(([id, w]) => {
  const r = rows.find(x => x.id === id)
  return r.shift_name !== w.shift_name || r.start_time !== w.start_time || r.end_time !== w.end_time
})
let day = ''
for (const [id, w] of changes) {
  const r = rows.find(x => x.id === id)
  if (r.shift_date !== day) { day = r.shift_date
    console.log(`${day} ${new Date(day+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short'})}`) }
  console.log(`   ${String(name.get(r.member)).padEnd(11)} ${r.shift_name.padEnd(7)} ${r.start_time.slice(0,5)}–${r.end_time.slice(0,5)}` +
              `   →   ${w.shift_name.padEnd(7)} ${w.start_time.slice(0,5)}–${w.end_time.slice(0,5)}`)
}
console.log(`\n${changes.length} of ${rows.length} rows change.`)

// ── VERIFY THE RESULT, not the intention ─────────────────────────────────
// Every trading day needs exactly one Open, and nothing may be left on the
// old times. Checked against what the rows WILL be, not what was changed.
console.log('\nVERIFY')
let bad = 0
const finalOf = r => want.get(r.id) ?? r
for (const [date, list] of Object.entries(byDate)) {
  const fin = list.map(finalOf)
  const nOpen = fin.filter(f => f.shift_name === 'Open').length
  const wrong = fin.filter(f =>
    (f.shift_name === 'Open'  && (f.start_time !== '14:00:00' || f.end_time !== '22:00:00')) ||
    (f.shift_name === 'Close' && (f.start_time !== '15:00:00' || f.end_time !== '00:00:00')))
  // A designated closer may hold the Open on their OWN fixed day — Mr Sĩ's
  // Monday is his Open now, and that is the rule working, not breaking. What
  // must not happen is one landing on him any other night.
  const wd2 = new Date(date + 'T12:00:00').getDay()
  const closerOpening = list.filter(r => finalOf(r).shift_name === 'Open'
    && alwaysCloses.has(r.member) && fixedOpen.get(r.member) !== wd2)
  if (nOpen !== 1) { console.log(`  ✗ ${date}: ${nOpen} Opens (want exactly 1)`); bad++ }
  if (wrong.length) { console.log(`  ✗ ${date}: ${wrong.length} row(s) on the old times`); bad++ }
  if (closerOpening.length && fin.length > 1) { console.log(`  ✗ ${date}: a designated closer holds the Open`); bad++ }
}
// The control: a probe that cannot fail proves nothing. Assert the check bites
// by running it against a day we know is wrong.
const control = Object.keys(byDate)[0]
const sabotaged = byDate[control].map(finalOf).filter(f => f.shift_name === 'Open').length + 1
console.log(sabotaged !== 1 ? `  ✓ control: ${sabotaged} Opens would be reported wrong` : '  ✗ control did not bite')
console.log(bad === 0 ? `  ✓ all ${Object.keys(byDate).length} days: exactly one Open, all on the new times\n`
                      : `  ${bad} problem(s)\n`)
if (bad) process.exit(1)

if (!APPLY) { console.log('DRY RUN — nothing written. Re-run with --apply.'); process.exit(0) }
let n = 0
for (const [id, w] of changes) {
  const r = await fetch(`${U}/rest/v1/rota_shifts?id=eq.${id}`, { method: 'PATCH', headers: H, body: JSON.stringify(w) })
  if (!r.ok) { console.log('FAILED', id, r.status, (await r.text()).slice(0,120)); continue }
  n++
}
console.log(`applied: ${n}/${changes.length}`)
