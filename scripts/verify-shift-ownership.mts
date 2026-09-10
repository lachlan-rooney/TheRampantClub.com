#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════════
// SHIFT TASKS — THE NEGATIVE TEST.  "Nobody ticks anyone else's box."
// ───────────────────────────────────────────────────────────────────────────
// A rule is only real if breaking it is REFUSED. Every assertion below tries to
// break one and expects to be stopped; the two positive controls exist so that a
// silently broken probe (which passes everything by doing nothing) is caught.
//
// Three layers, because the rule can fail at any of them:
//   IDENTITY — can a caller claim to be someone else?      (signed cookie)
//   OWNERSHIP — can a caller act on someone else's row?    (shift_task_update)
//   PIN — is a revert actually bound to a proven person?   (kiosk_verify_pin)
// Plus GRANTS: is the function reachable by anyone but the server?
//
// Touches NO real staff, NO real shift, NO member_no key. Everything it makes is
// prefixed "ZZ " and removed in the finally block.
//
//   npx tsx scripts/verify-shift-ownership.mts
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env: Record<string, string> = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
process.env.SUPABASE_JWT_SECRET = env.SUPABASE_JWT_SECRET
const { signActor, verifyActor } = await import('../lib/acting-identity.ts')

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL!, SVC = env.SUPABASE_SERVICE_ROLE_KEY!
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, SECRET = env.SUPABASE_JWT_SECRET
const ADMIN_UID = '3e1583db-b881-42ec-aadb-6f69a22fad80'   // the owner's admin uid

if (!SECRET) { console.log('\n⚠  BLOCKED — SUPABASE_JWT_SECRET absent; nothing proven.\n'); process.exit(2) }

const sb = createClient(URL_, SVC, { auth: { persistSession: false } })
let pass = 0, fail = 0
const ok  = (l: string, d = '') => { pass++; console.log(`✓ ${l}${d ? ' — ' + d : ''}`) }
const bad = (l: string, d = '') => { fail++; console.log(`✗ ${l}${d ? ' — ' + d : ''}`) }
const check = (cond: boolean, l: string, d = '') => cond ? ok(l, d) : bad(l, d)

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')
function mint(sub: string, ttl = 120) {
  const now = Math.floor(Date.now() / 1000)
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64u(JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + ttl }))
  return `${h}.${p}.${b64u(createHmac('sha256', SECRET!).update(`${h}.${p}`).digest())}`
}
const asUser = (sub: string) => createClient(URL_, ANON, {
  auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${mint(sub)}` } },
})

const made: { staff: string[]; tpl?: string; task?: string; inst?: string; oneOff?: string } = { staff: [] }

// ── setup ──────────────────────────────────────────────────────────────────
async function staff(name: string, supervisor: boolean) {
  const { data, error } = await sb.from('team_members')
    .insert({ display_name: name, role_title: 'Probe', active: true, is_shift_supervisor: supervisor })
    .select('id').single()
  if (error) throw new Error(`could not create ${name}: ${error.message}`)   // never pass by doing nothing
  made.staff.push(data.id); return data.id as string
}

try {
  console.log('\n── setup ──')
  const OWNER = await staff('ZZ Shift Owner', false)
  const OTHER = await staff('ZZ Shift Other', false)
  const SUPER = await staff('ZZ Shift Super', true)

  // PINs go through the real admin function, so the probe exercises the real hash.
  const admin = asUser(ADMIN_UID)
  for (const [id, pin] of [[OWNER, '4417'], [OTHER, '9931'], [SUPER, '2286']] as const) {
    const { error } = await admin.rpc('set_team_member_pin', { p_team_member: id, p_pin: pin })
    if (error) throw new Error(`set_team_member_pin failed: ${error.message}`)
  }
  console.log('  three throwaway staff, PINs set through set_team_member_pin')

  // active:false — the probe template must never appear on the live shift screen.
  const { data: tpl, error: te } = await sb.from('shift_templates').insert({
    slug: `zz-probe-${Date.now()}`, day_of_week: 1, title_en: 'ZZ Probe Shift',
    assignee_team_member_id: OWNER, active: false,
  }).select('id').single()
  if (te) throw new Error(`template: ${te.message}`)
  made.tpl = tpl.id
  const { data: task, error: ke } = await sb.from('shift_template_tasks')
    .insert({ template_id: tpl.id, sort: 1, title_en: 'ZZ Probe Task' }).select('id').single()
  if (ke) throw new Error(`task: ${ke.message}`)
  made.task = task.id
  const { data: inst, error: ie } = await sb.from('shift_task_instances').insert({
    template_task_id: task.id, template_id: tpl.id,
    week_start: '2020-01-06', shift_date: '2020-01-06', assignee_team_member_id: OWNER,
  }).select('id').single()
  if (ie) throw new Error(`instance: ${ie.message}`)
  made.inst = inst.id
  console.log('  probe shift + task + instance (inactive template, week 2020-01-06)')

  const upd = async (actor: string, args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc('shift_task_update', {
      p_instance: made.inst, p_actor: actor, p_status: null, p_evidence: null,
      p_blocked_reason: null, p_blocked_unblocker: null, p_note: null,
      p_revert_note: null, p_prospect: null, ...args,
    })
    return { refusal: data as string | null, error }
  }
  const statusNow = async () => (await sb.from('shift_task_instances')
    .select('status, evidence').eq('id', made.inst).single()).data

  // ── IDENTITY — the forgery that used to work ────────────────────────────
  console.log('\n── identity: is the acting cookie forgeable? ──')
  check(verifyActor(OWNER) === null, 'bare team_member id in the cookie is REFUSED',
        'this exact value was accepted before it was signed')
  check(verifyActor(signActor(OWNER)) === OWNER, 'a properly signed cookie is accepted', 'positive control')
  const stolen = signActor(OWNER).split('.')[1]
  check(verifyActor(`${SUPER}.${stolen}`) === null, "another person's id with a stolen tag is REFUSED")
  check(verifyActor(`${OWNER}.`) === null && verifyActor('') === null && verifyActor(undefined) === null,
        'empty and malformed values are REFUSED')

  // ── COVER ───────────────────────────────────────────────────────────────
  // The roster is the EXPECTATION, not the permission. This block asserted the
  // opposite until 2026-09-10 — a rule invented here, never asked for, which
  // stopped anyone covering a colleague's day from ticking anything at all.
  console.log('\n── cover: the roster is the expectation, not the permission ──')
  let r = await upd(OTHER, { p_status: 'done', p_evidence: 'Covered Tuesday for the owner' })
  check(r.refusal === null && !r.error, "a colleague CAN complete a task they are covering",
        `refusal=${r.refusal ?? 'none'}`)
  const covered = await sb.from('shift_task_instances').select('status, completed_by').eq('id', made.inst).single()
  check(covered.data?.status === 'done', '…the row moved to done')
  check(covered.data?.completed_by === OTHER,
        'completed_by records WHO DID IT, not who was rostered',
        covered.data?.completed_by === OTHER ? 'the coverer' : 'WRONG PERSON')

  // Put it back for the rest of the run — and prove a revert costs a note.
  r = await upd(OTHER, { p_status: 'not_started' })
  check(r.refusal === 'revert_needs_note', 'turning back a done costs a note, from anyone',
        `refusal=${r.refusal ?? 'NONE'}`)
  await upd(OTHER, { p_status: 'not_started', p_revert_note: 'resetting the probe' })

  r = await upd(OWNER, { p_status: 'done', p_evidence: '   ' })
  check(!!r.error || r.refusal !== null, 'done with blank evidence is REFUSED',
        r.error ? 'constraint' : `refusal=${r.refusal}`)

  r = await upd(OWNER, { p_status: 'done', p_evidence: 'Stock counted, 3 bottles short — logged' })
  check(r.refusal === null && !r.error, 'the owner CAN complete their own task', 'positive control')
  check((await statusNow())?.status === 'done', '…and the row moved to done')

  // ANY move off done is a revert — including a quiet nudge to in_progress.
  r = await upd(SUPER, { p_status: 'in_progress' })
  check(r.refusal === 'revert_needs_note', 'every move off done is a revert, note required',
        `refusal=${r.refusal ?? 'NONE'}`)

  r = await upd(SUPER, { p_status: 'not_started' })
  check(r.refusal === 'revert_needs_note', 'a revert without a note is REFUSED',
        `refusal=${r.refusal ?? 'NONE'}`)

  r = await upd(SUPER, { p_status: 'not_started', p_revert_note: 'Count was of the wrong shelf — redo Friday' })
  check(r.refusal === null && !r.error, 'a supervisor revert WITH a note is allowed', 'positive control')
  const { data: evs } = await sb.from('shift_task_events').select('*').eq('instance_id', made.inst)
  const revert = (evs || []).find(e => JSON.stringify(e).includes('wrong shelf'))
  check(!!revert, 'the revert is written to shift_task_events', 'the trail is the point')

  // ── NOT REQUIRED — a third state, with provenance ───────────────────────
  console.log('\n── not required: a third state, not a shade of done ──')
  r = await upd(OWNER, { p_status: 'not_required', p_note: 'No deliveries this week' })
  check(r.refusal === null && !r.error, 'a task can be marked not required', `refusal=${r.refusal ?? 'none'}`)
  const nr = await sb.from('shift_task_instances').select('status, evidence, completed_by').eq('id', made.inst).single()
  check(nr.data?.status === 'not_required', '…and it is NOT done', `status=${nr.data?.status}`)
  check(!nr.data?.completed_by, 'not required does not record a completer — nobody completed it')
  const { data: nrEvents } = await sb.from('shift_task_events').select('*')
    .eq('instance_id', made.inst).eq('kind', 'not_required')
  check((nrEvents || []).length === 1, 'it writes a not_required event', 'provenance, not a bare flag')
  check(!!nrEvents?.[0]?.actor_name && !!nrEvents?.[0]?.created_at, '…carrying who and when',
        `${nrEvents?.[0]?.actor_name}`)

  r = await upd(OWNER, { p_status: 'not_started' })
  check(r.refusal === 'revert_needs_note', 'un-marking it costs a note too')
  r = await upd(OWNER, { p_status: 'not_started', p_revert_note: 'Deliveries are back on' })
  check(r.refusal === null && (await statusNow())?.status === 'not_started',
        'reverting restores the task and leaves a trail', 'positive control')

  // ── ONE-OFF — added for a day, and it must NOT come back ────────────────
  console.log('\n── one-off: added today, gone next week ──')
  const { data: oneOff, error: ooErr } = await sb.rpc('shift_add_one_off', {
    p_template: made.tpl, p_week: '2020-01-06', p_actor: OWNER, p_title: 'ZZ One-off — polish the brass',
  })
  check(!ooErr && !!oneOff, 'a one-off can be added to a day', ooErr?.message || '')
  if (oneOff) {
    made.oneOff = oneOff as string
    const { data: row } = await sb.from('shift_task_instances')
      .select('template_task_id, title_en, is_one_off').eq('id', oneOff).single()
    check(row?.template_task_id === null, 'it has NO template task — which is what stops it recurring')
    check(row?.is_one_off === true && !!row?.title_en, 'it carries its own title', row?.title_en || '')
    // Materialise next week and prove it did not follow.
    await sb.rpc('shift_materialise_week', { p_week_start: '2020-01-13' })
    const { count: next } = await sb.from('shift_task_instances').select('*', { count: 'exact', head: true })
      .eq('week_start', '2020-01-13').eq('title_en', 'ZZ One-off — polish the brass')
    check(next === 0, 'and it does NOT appear the following week', 'structural, not a rule to remember')
  }

  // ── SNAPSHOT — a past week must not change when the template does ───────
  console.log('\n── history: a past week is self-contained ──')
  await sb.from('shift_template_tasks').update({ title_en: 'ZZ Probe Task — REWORDED TODAY' }).eq('id', made.task)
  const { data: hist } = await sb.from('shift_task_instances').select('title_en').eq('id', made.inst).single()
  check(hist?.title_en === 'ZZ Probe Task',
        'rewording the template does NOT change what last week says', `week still reads: ${hist?.title_en}`)

  // ── PIN — the binding on a revert ───────────────────────────────────────
  console.log('\n── pin: is a revert bound to a proven person? ──')
  const pin = async (id: string, p: string) => (await sb.rpc('kiosk_verify_pin', { p_team_member: id, p_pin: p })).data
  check(await pin(SUPER, '0000') === null, 'a wrong PIN is REFUSED')
  check(await pin(SUPER, '2286') === SUPER, 'the right PIN verifies', 'positive control')
  check(await pin(SUPER, '4417') === null, "another person's PIN does not verify for you")
  for (let i = 0; i < 5; i++) await pin(OTHER, '0000')
  check(await pin(OTHER, '9931') === null, 'five wrong tries locks the person out', 'rate limit holds')

  // ── GRANTS — is the function reachable by anyone but the server? ────────
  console.log('\n── grants: can a signed-in user call the function directly? ──')
  const direct = await asUser(ADMIN_UID).rpc('shift_task_update', {
    p_instance: made.inst, p_actor: OWNER, p_status: 'done',
    p_evidence: 'FORGED via direct rpc', p_blocked_reason: null, p_blocked_unblocker: null,
    p_note: null, p_revert_note: null, p_prospect: null,
  })
  if (direct.error) {
    ok('shift_task_update is NOT callable by authenticated', 'db/shift_tasks_lock_actor.sql has been run')
  } else {
    bad('shift_task_update IS callable by authenticated — impersonation is LIVE',
        'RUN db/shift_tasks_lock_actor.sql')
    await sb.from('shift_task_instances').update({ status: 'not_started', evidence: null }).eq('id', made.inst)
  }
} catch (e) {
  bad('threw', (e as Error).message)
} finally {
  console.log('\n── teardown ──')
  if (made.oneOff) await sb.from('shift_task_events').delete().eq('instance_id', made.oneOff)
  if (made.oneOff) await sb.from('shift_task_instances').delete().eq('id', made.oneOff)
  if (made.task) await sb.from('shift_task_instances').delete().eq('template_task_id', made.task)
  if (made.inst) await sb.from('shift_task_events').delete().eq('instance_id', made.inst)
  if (made.inst) await sb.from('shift_task_instances').delete().eq('id', made.inst)
  if (made.task) await sb.from('shift_template_tasks').delete().eq('id', made.task)
  if (made.tpl)  await sb.from('shift_templates').delete().eq('id', made.tpl)
  for (const id of made.staff) {
    await sb.from('kiosk_pin_attempts').delete().eq('team_member_id', id)
    await sb.from('team_members').delete().eq('id', id)
  }
  const { data: left } = await sb.from('team_members').select('id, display_name').ilike('display_name', 'ZZ Shift%')
  if (left?.length) bad('throwaway staff survived teardown', left.map(l => l.display_name).join(', '))
  else console.log('  probe staff, shift, task, instance and PIN attempts all removed')
  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed\n`)
  process.exit(fail === 0 ? 0 : 1)
}
