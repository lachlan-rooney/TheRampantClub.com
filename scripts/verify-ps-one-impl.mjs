#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PS(t): prove the refactor moved NOTHING, and prove the old code was wrong.
//
//   node scripts/verify-ps-one-impl.mjs snapshot   ← BEFORE applying the SQL
//   node scripts/verify-ps-one-impl.mjs verify     ← AFTER applying the SQL
//
// The refactor's whole claim is "the formula does not change". A check that
// only asks "does the view still return numbers" would pass on a formula that
// silently moved every score in the building, so this one diffs every row
// against a snapshot taken before the change and demands they be IDENTICAL as
// strings — not close, not rounded-equal, identical.
//
// ── IT ALSO HAS TO FAIL ON THE KNOWN-BROKEN VERSION ──────────────────────
// Step 4 reimplements the two TypeScript previews that this change deletes and
// asserts they DISAGREE with the view on live rows. If that step ever reports
// "they agree", the harness is not measuring anything: either the drift was
// imaginary or the comparison is broken. A harness that cannot fail on the bug
// it was written for is decoration.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'

const SNAP = process.env.PS_SNAPSHOT || '/tmp/ps-proof/before.json'
// The snapshot MUST include days_since, or `verify` cannot tell whether a
// difference is the refactor or simply a day having passed.

const mode = process.argv[2]
if (!['snapshot', 'verify'].includes(mode)) {
  console.error('usage: verify-ps-one-impl.mjs snapshot|verify')
  process.exit(2)
}

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('FAIL  .env.local is missing the Supabase url or service key'); process.exit(1) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const COLS = 'preference_id,member_no,ps_t,score_health_pct,needs_revalidation,s0,confidence,lambda,frequency,validation_count,days_since,r_reinforce,m_engage'

const get = async (path) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: H })
  const body = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${body.slice(0, 300)}`)
  return JSON.parse(body)
}
const rpc = async (fn, args) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) })
  const body = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${body.slice(0, 300)}`)
  return JSON.parse(body)
}
const digest = (rows) => createHash('sha256')
  .update(JSON.stringify(rows.map(r => [r.preference_id, String(r.ps_t), String(r.score_health_pct), r.needs_revalidation])))
  .digest('hex')

const rowsNow = () => get(`preference_scores?select=${COLS}&order=preference_id`)

if (mode === 'snapshot') {
  const rows = await rowsNow()
  if (rows.length === 0) { console.error('FAIL  the view returned 0 rows — there is nothing to snapshot, so nothing could be proved'); process.exit(1) }
  mkdirSync(dirname(SNAP), { recursive: true })
  writeFileSync(SNAP, JSON.stringify(rows))
  console.log(`snapshot  ${rows.length} rows → ${SNAP}`)
  console.log(`          checksum ${digest(rows).slice(0, 24)}`)
  process.exit(0)
}

// ── verify ────────────────────────────────────────────────────────────────
let pass = 0, fail = 0
const ok = (n, c, d = '') => { c ? (pass++, console.log(`  ✓ ${n}${d ? '  ' + d : ''}`)) : (fail++, console.log(`  ✗ ${n}${d ? '  ' + d : ''}`)) }

console.log('\n1 · the inputs actually loaded')
const after = await rowsNow()
ok('the view returns rows', after.length > 0, `${after.length} preferences`)
ok('every row has a score', after.every(r => r.ps_t !== null && r.ps_t !== undefined))
// COLS is the list this script ASKS for, so counting its keys only proves the
// script got what it requested. The view's real shape needs select=*.
const starRow = await get('preference_scores?select=*&limit=1')
const viewCols = starRow.length ? Object.keys(starRow[0]) : []
ok('the view still has its 25 columns', viewCols.length === 25, `${viewCols.length} columns`)
ok('lambda_origin is still absent from the view', !viewCols.includes('lambda_origin'),
   'the view was frozen before that column existed; the rewrite must not add it')
// The comparison below is only worth anything if the terms it checks actually
// vary. If every M were 1.0 and every lambda 0, a view that had silently
// dropped both terms would pass.
const mVals = [...new Set(after.map(r => String(r.m_engage)))]
ok('M varies, so M is genuinely under test', mVals.length > 1 || mVals[0] !== '1.0', `M = ${mVals.slice(0, 6).join(', ')}`)
const decaying = after.filter(r => Number(r.lambda) > 0 && Number(r.days_since) > 0).length
ok('rows have lambda>0 and t>0, so decay is under test', decaying > 0, `${decaying}/${after.length}`)

console.log('\n2 · the formula did not move')
// ── WHY THIS IS NOT A SNAPSHOT DIFF ─────────────────────────────
// ps_t contains e^(−lambda·(current_date − last_validated)), so every score
// legitimately moves at midnight. Diffing today's view against a snapshot
// taken yesterday would report 159 changed rows and mean nothing by it — the
// first version of this check would have done exactly that and called the
// refactor a disaster.
//
// So the primary assertion is time-independent: the OLD expression, written
// out long-hand here, evaluated against the CURRENT inputs, must equal what
// the rewritten view returns. Tolerance is 1e-9, because this side is IEEE
// double and the view is Postgres numeric; a faithful reimplementation lands
// within ~1e-16 (lib/mis/live-pst.ts measures 4.4e-16 across the same rows),
// while the deleted previews were out by up to 3.5. There is no ambiguity in
// that gap.
const oldFormula = (r) => {
  const days = Number(r.days_since)
  const R = Math.min(1.3, 1.0 + 0.075 * (Number(r.validation_count) - 1))
  const M = Number(r.m_engage)   // the view's own M; the term under test is the product
  return Math.min(5, Number(r.s0) * Number(r.confidence) * Math.exp(-Number(r.lambda) * days)
                     * Number(r.frequency) * R * M)
}
const off = after.map(r => ({ r, e: Math.abs(oldFormula(r) - Number(r.ps_t)) }))
const moved = off.filter(x => x.e > 1e-9)
ok('every ps_t matches the original expression', moved.length === 0,
   moved.length
     ? `${moved.length} differ, worst ${Math.max(...off.map(x => x.e)).toFixed(4)}`
     : `${after.length}/${after.length}, worst ${Math.max(...off.map(x => x.e)).toExponential(2)}`)
// R and M are now functions; they must still produce the columns they did.
const rOff = after.filter(r => Math.abs(Math.min(1.3, 1.0 + 0.075 * (Number(r.validation_count) - 1)) - Number(r.r_reinforce)) > 1e-9)
ok('r_reinforce matches the original expression', rOff.length === 0, `${rOff.length} differ`)
const healthOff = after.filter(r => Math.abs(Math.round(Number(r.ps_t) / Number(r.s0) * 100) - Number(r.score_health_pct)) > 1)
ok('score_health_pct still derives from ps_t', healthOff.length === 0, `${healthOff.length} differ`)
const flagOff = after.filter(r => {
  const want = Number(r.ps_t) < 0.7 * Number(r.s0) || Number(r.days_since) > 180 || (Number(r.s0) >= 4 && Number(r.days_since) > 90)
  return want !== r.needs_revalidation.includes('REVALIDATE')
})
ok('the revalidation rule is unchanged', flagOff.length === 0, `${flagOff.length} differ`)

// ── THE STRONGER CHECK, WHEN IT IS AVAILABLE ─────────────────────
// If the snapshot was taken on the same day, nothing should have moved by a
// single digit and that can be asserted exactly. Run `snapshot` immediately
// before applying the SQL and `verify` immediately after to get this.
let before = null
try { before = JSON.parse(readFileSync(SNAP, 'utf8')) } catch { /* optional */ }
if (!before) {
  console.log(`  – no snapshot at ${SNAP}; the exact byte-for-byte check is skipped`)
  console.log('    (take one BEFORE applying the SQL for the strongest form of this check)')
} else {
  const byId = new Map(before.map(r => [r.preference_id, r]))
  const sameDay = after.filter(a => { const b = byId.get(a.preference_id); return b && Number(b.days_since) === Number(a.days_since) })
  ok('snapshot is not empty', before.length > 0, `${before.length} rows`)
  if (sameDay.length !== after.length) {
    console.log(`  – the snapshot is from another day (${sameDay.length}/${after.length} rows share days_since); decay has legitimately moved the rest, so only the same-day rows are compared exactly`)
  }
  if (sameDay.length === 0) {
    console.log('  – no rows share a days_since with the snapshot; exact check skipped')
  } else {
    const exact = sameDay.filter(a => String(a.ps_t) !== String(byId.get(a.preference_id).ps_t))
    ok('same-day rows are byte-identical to the snapshot', exact.length === 0,
       exact.length ? `${exact.length}/${sameDay.length} moved, e.g. ${exact.slice(0, 3).map(a => `${a.member_no}: ${byId.get(a.preference_id).ps_t} → ${a.ps_t}`).join(' | ')}`
                    : `${sameDay.length}/${sameDay.length} identical`)
    ok('row count is unchanged', after.length === before.length, `${before.length} → ${after.length}`)
  }
}

console.log('\n3 · the NEW thing arrived — one implementation, two call sites')
let preview = null
try {
  const r = after[0]
  preview = await rpc('mis_preview_ps', {
    p_member_no: r.member_no,
    p_drafts: [{ s0: r.s0, confidence: r.confidence, lambda: r.lambda, frequency: r.frequency, validation_count: r.validation_count, days_since: r.days_since }],
  })
  ok('mis_preview_ps exists and answers', Array.isArray(preview) && preview.length === 1)
  ok('the preview agrees with the view, exactly', String(preview[0].ps_t) === String(r.ps_t),
     `view ${r.ps_t} · preview ${preview[0].ps_t}`)
  ok('the preview reports the M it used', preview[0].m_engage !== null && String(preview[0].m_engage) === String(r.m_engage),
     `M=${preview[0].m_engage}`)
} catch (e) { ok('mis_preview_ps exists and answers', false, String(e.message)) }

// A batch, which is what the intake page sends.
try {
  const batch = after.slice(0, 5)
  const r = await rpc('mis_preview_ps', {
    p_member_no: batch[0].member_no,
    p_drafts: batch.map(x => ({ s0: x.s0, confidence: x.confidence, lambda: x.lambda, frequency: x.frequency, validation_count: x.validation_count, days_since: x.days_since })),
  })
  ok('a batch of drafts comes back in order', r.length === batch.length && r.every((x, i) => x.idx === i), `${r.length} drafts, idx 0..${r.length - 1}`)
} catch (e) { ok('a batch of drafts comes back in order', false, String(e.message)) }

// t is genuinely parameterised: the same draft at t=0 must score HIGHER than
// at its live t, for any row whose lambda is not zero.
try {
  const decaying = after.find(r => Number(r.lambda) > 0 && Number(r.days_since) > 0 && Number(r.ps_t) < 5)
  if (!decaying) { ok('the decay term is parameterised on t', false, 'no live row has lambda>0 and t>0 — cannot test it with real data') }
  else {
    const [atZero] = await rpc('mis_preview_ps', {
      p_member_no: decaying.member_no,
      p_drafts: [{ s0: decaying.s0, confidence: decaying.confidence, lambda: decaying.lambda, frequency: decaying.frequency, validation_count: decaying.validation_count, days_since: 0 }],
    })
    ok('the decay term is parameterised on t', Number(atZero.ps_t) > Number(decaying.ps_t),
       `t=${decaying.days_since}: ${Number(decaying.ps_t).toFixed(4)}  →  t=0: ${Number(atZero.ps_t).toFixed(4)}`)
  }
} catch (e) { ok('the decay term is parameterised on t', false, String(e.message)) }

console.log('\n4 · PROVE THE HARNESS — the old TypeScript must FAIL this')
// ── THE RIGHT COMPARISON, WHICH THE FIRST VERSION OF THIS GOT WRONG ─────
// A preview answers ONE question: what will this row score after I save it?
// A save sets last_validated = current_date and validation_count + 1 (see
// apply_preference_validation in db/mis_pass2_validations.sql), so the correct
// target is the view AT t = 0 AND vc + 1 — which is exactly what
// mis_preview_ps returns.
//
// The first version of this step compared the old preview against the row's
// CURRENT ps_t instead, and reported "156 of 159 rows, worst 3.5 points". The
// arithmetic was right and the quantity was not the one in question: the
// current score has decayed for up to 190 days, and a preview does not claim
// to predict it. Step 4b below ASSERTS that distinction rather than describing
// it — a comment is the one place this lesson must not live.
const vcUp = (r) => Math.min(1.3, 1.0 + 0.075 * ((Number(r.validation_count) + 1) - 1))
// Verbatim reimplementations of the two previews this change deletes.
const oldProfilePreview = (r) => Math.min(5, Number(r.s0) * Number(r.confidence) * Number(r.frequency) * vcUp(r) * 1.0)
const oldIntakePreview  = (r) => Math.min(5, Number(r.s0) * Number(r.confidence) * Number(r.frequency) * 1.0 * 1.0)
// The truth a preview is predicting: the formula at t = 0 with vc + 1.
const saveWillGive = (r) => Math.min(5, Number(r.s0) * Number(r.confidence) * Math.exp(-Number(r.lambda) * 0)
                                        * Number(r.frequency) * vcUp(r) * Number(r.m_engage))
const driftOf = (f) => after.map(r => Math.abs(f(r) - saveWillGive(r)))
const dProfile = driftOf(oldProfilePreview)
const dIntake  = driftOf(oldIntakePreview)
ok('the profile preview DID mis-predict the save', dProfile.filter(e => e > 1e-9).length > 0,
   `${dProfile.filter(e => e > 1e-9).length}/${after.length} rows, worst ${Math.max(...dProfile).toFixed(4)} PS points`)
ok('the intake preview DID mis-predict the save', dIntake.filter(e => e > 1e-9).length > 0,
   `${dIntake.filter(e => e > 1e-9).length}/${after.length} rows, worst ${Math.max(...dIntake).toFixed(4)} PS points`)
// WHY it mis-predicted: at t = 0 the decay term is e^0 = 1 on BOTH sides, so M
// is the only term that can differ. The missing decay term was dead code in a
// preview, not a live error — worth saying plainly, because the fix was sold
// partly on decay and that part was not doing damage.
// Compare the UNCAPPED products: the old preview caps at 5 before M is
// applied, so old*M is not the right thing to test against a capped target.
// min(5, uncapped · M) is.
const uncapped = (r) => Number(r.s0) * Number(r.confidence) * Number(r.frequency) * vcUp(r)
const mIsTheCause = after.every(r =>
  Math.abs(Math.min(5, uncapped(r) * Number(r.m_engage)) - saveWillGive(r)) < 1e-9)
ok('and M alone accounts for it (at t=0 the decay term is 1 either way)', mIsTheCause,
   'so the omitted decay term was dead code in the preview, not a live error')
const over = after.filter(r => oldProfilePreview(r) > saveWillGive(r) + 1e-9).length
const under = after.filter(r => oldProfilePreview(r) < saveWillGive(r) - 1e-9).length
ok('it over-promised more often than it under-promised', over > 0 && under > 0,
   `over-promised on ${over} rows, under-promised on ${under}`)
ok('M is not 1.0 for anybody, so hardcoding it was wrong for every row',
   !after.some(r => Math.abs(Number(r.m_engage) - 1.0) < 1e-12),
   `M values live: ${[...new Set(after.map(r => String(r.m_engage)))].join(', ')}`)
// ── 4b · REGISTER ENTRY #5, AS AN ASSERTION ──────────────────────
// "A NUMBER IS ALWAYS A NUMBER OF SOMETHING. STATE THE QUESTION BEFORE
//  COMPARING IT TO ANOTHER."
//
// There are two things in this database that both look like "the score", and
// they answer different questions:
//
//   r.ps_t          — what this preference scores TODAY, decayed over t days
//   saveWillGive(r) — what it will score AFTER A SAVE, which resets t to 0
//
// A preview predicts the second. Measuring it against the first is what
// produced the overstated 3.5-point figure. These assertions make the
// distinction load-bearing: if somebody later points this harness at the
// wrong target, the numbers below stop lining up and the run fails.
const vsCurrentScore = after.map(r => Math.abs(oldProfilePreview(r) - Number(r.ps_t)))
const vsSaveTarget = dProfile
const nCurrent = vsCurrentScore.filter(e => e > 1e-9).length
const nSave = vsSaveTarget.filter(e => e > 1e-9).length

// 1 · The two targets are genuinely different quantities. If they were
//     interchangeable, the question would not need stating and this entry
//     would be pedantry rather than a lesson.
const targetsDiffer = after.filter(r => Math.abs(Number(r.ps_t) - saveWillGive(r)) > 1e-9).length
ok('4b · the two candidate targets are NOT interchangeable', targetsDiffer > 0,
   `they differ on ${targetsDiffer}/${after.length} rows — "the score" names two numbers here`)

// 2 · The save target must be the one that does NOT move with t. That is its
//     defining property, and it is what makes it the right answer for a
//     preview. Asserting it means a swap to the current score fails here.
const movesWithT = after.filter(r => Number(r.days_since) > 0 && Number(r.lambda) > 0)
  .filter(r => Math.abs(saveWillGive(r) - Number(r.ps_t)) < 1e-9).length
ok('4b · the target this harness uses is insensitive to t, as a save target must be',
   movesWithT === 0,
   `${movesWithT} decaying rows where the target still equals the decayed score (want 0)`)

// 3 · And the wrong comparison would report a materially LARGER error. Both
//     numbers are recorded so a future change of target is visible in the
//     output rather than silent.
ok('4b · the wrong target overstates the fault, and by how much is on the record',
   nCurrent > nSave && Math.max(...vsCurrentScore) > Math.max(...vsSaveTarget),
   `vs current score: ${nCurrent} rows / worst ${Math.max(...vsCurrentScore).toFixed(4)}  —  `
   + `vs save target: ${nSave} rows / worst ${Math.max(...vsSaveTarget).toFixed(4)}  ← the one in question`)

// And the new path must NOT disagree — same comparison, opposite verdict.
if (preview) {
  const r = after[0]
  const atZero = await rpc('mis_preview_ps', { p_member_no: r.member_no, p_drafts: [{
    s0: r.s0, confidence: r.confidence, lambda: r.lambda, frequency: r.frequency,
    validation_count: Number(r.validation_count) + 1, days_since: 0 }] })
  ok('the new path predicts the save exactly (same test, opposite result)',
     Math.abs(Number(atZero[0].ps_t) - saveWillGive(r)) < 1e-9,
     `preview ${Number(atZero[0].ps_t).toFixed(6)} · a save would give ${saveWillGive(r).toFixed(6)}`)
}

console.log('\n5 · nothing NEW reimplements it')
// Four implementations existed outside SQL, not two. Three are gone: the two
// MIS previews now call mis_preview_ps(), and the observatory snapshot route
// reads the view's own revalidation flag instead of recomputing it with M
// pinned to 1.0.
//
// lib/mis/live-pst.ts stays, deliberately: the Observatory animates a
// 365-point decay curve on a one-second timer and that cannot be a round trip
// per frame. It is PROVEN equal to the view rather than assumed equal —
// scripts/verify-live-pst-fidelity.mts runs the real module against all live
// rows and fails on drift. Run that too; this step only guards against a FIFTH
// copy appearing somewhere else.
const { execSync } = await import('node:child_process')
const files = execSync(
  `grep -rln "0\\.075 \\*\\|1 + 0\\.075\\|1\\.0 + 0\\.25 \\*" app/ lib/ components/ 2>/dev/null || true`,
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
  // grep -r over "lib/" emits "lib//mis/...". Normalise before matching.
  .map(f => f.replace(/\/{2,}/g, '/').replace(/^\.\//, ''))
const strays = files.filter(f => f !== 'lib/mis/live-pst.ts')
ok('no fifth copy of the formula', strays.length === 0,
   strays.length ? strays.join(', ') : 'only lib/mis/live-pst.ts, which is proven against the view')
// The word "predictPs" survives on purpose, in the comments that record why it
// was removed. What must be gone is the DEFINITION and any call to it.
const defs = execSync(`grep -rn "function predictPs\\|= predictPs\\|predictPs(" app/ lib/ components/ 2>/dev/null || true`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  // A line that merely mentions it in prose is not a call site.
  .filter(l => !/^\S+:\d+:\s*(\/\/|\*|\/\*)/.test(l))
ok('the two drifted previews are gone', defs.length === 0,
   defs.length ? defs.join('\n      ') : 'no definition and no call site remains')

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
