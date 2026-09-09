import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { actingStaffId } from '@/lib/admin-acting'

// GET  /api/admin/shifts?week=YYYY-MM-DD   — the week: shifts, tasks, events
// POST /api/admin/shifts                   — update one task instance
//
// ═══ WHO IS ACTING ═════════════════════════════════════════════════════════
// The trc_admin_staff cookie, set by PIN at /admin/who. That is the identity the
// database rule keys on — auth.uid() is a SHARED staff login and would let any
// signed-in person tick anyone's box.
//
// A REVERT additionally requires the supervisor's PIN in the request, verified
// through kiosk_verify_pin. The acting cookie says who is at the desk; the PIN
// proves who is doing THIS, which is what makes the trail worth having.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
// Identity comes from the signed helper — never straight off the cookie.

const mondayOf = (d: string) => {
  const x = new Date(d + 'T00:00:00Z')
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}
const vnToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const sb = svc()
  const week = mondayOf(req.nextUrl.searchParams.get('week') || vnToday())

  const actingId = await actingStaffId()
  const { data: acting } = actingId
    ? await sb.from('team_members').select('id, display_name, is_shift_supervisor').eq('id', actingId).maybeSingle()
    : { data: null }

  const [{ data: templates }, { data: tasks }, { data: instances }, { data: notes }, { data: objectives }] = await Promise.all([
    sb.from('shift_templates').select('*').eq('active', true).order('day_of_week'),
    sb.from('shift_template_tasks').select('*').eq('active', true).order('sort'),
    sb.from('shift_task_instances').select('*').eq('week_start', week),
    sb.from('shift_shared_notes').select('*'),
    sb.from('shift_week_objectives').select('*').eq('week_start', week),
  ])

  // Events only for this week's instances — the revert a person needs to see is
  // on their own row, not in a log they would have to go and find.
  const ids = (instances || []).map(i => i.id)
  const { data: events } = ids.length
    ? await sb.from('shift_task_events').select('*').in('instance_id', ids).order('created_at', { ascending: false })
    : { data: [] }

  const { data: team } = await sb.from('team_members').select('id, display_name, is_shift_supervisor').eq('active', true)

  // ═══ LAPSE WATCH ═══════════════════════════════════════════════════════
  // A task lapsing three weeks running is a DESIGN FAULT, not a discipline
  // problem. Either it gets a name against it or it stops existing.
  //
  // "Daily Open Check" reached 95 cards and one completion before anyone looked,
  // because nothing ever put it in front of a person. This does — on the one
  // screen a supervisor opens every Monday. Counted in WEEKS, not cards, so a
  // daily task and a weekly one are judged the same way.
  const since = new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10)
  const [{ data: recurring }, { data: cards }] = await Promise.all([
    sb.from('task_templates').select('id, title, default_assignee').eq('active', true),
    sb.from('tasks').select('template_id, status, due_date').gte('due_date', since).not('template_id', 'is', null),
  ])

  const weekKey = (d: string) => mondayOf(d)
  const lastThree = [1, 2, 3].map(n =>
    mondayOf(new Date(Date.now() - n * 7 * 864e5).toISOString().slice(0, 10)))

  const lapsing = (recurring || []).map(tpl => {
    const mine = (cards || []).filter(c => c.template_id === tpl.id)
    // Every one of the last three COMPLETE weeks must have produced a card and
    // finished none of them. A single completion breaks the run, as it should.
    const weeks = lastThree.filter(w => {
      const inWeek = mine.filter(c => weekKey(c.due_date) === w)
      return inWeek.length > 0 && inWeek.every(c => c.status === 'lapsed')
    })
    return {
      id: tpl.id, title: tpl.title, has_owner: !!tpl.default_assignee,
      weeks: weeks.length, cards: mine.filter(c => c.status === 'lapsed').length,
    }
  }).filter(r => r.weeks >= 3)

  return NextResponse.json({
    week, acting, lapsing, templates: templates || [], tasks: tasks || [],
    instances: instances || [], events: events || [], notes: notes || [],
    objectives: objectives || [], team: team || [],
  })
}

const REFUSAL: Record<string, string> = {
  not_yours: 'That is not your task. Only the person the shift belongs to can change it.',
  needs_evidence: 'Add the evidence first — where it is, or a link. No evidence, not done.',
  needs_reason: 'Say what is blocking it.',
  revert_needs_note: 'A revert needs a note saying why.',
  unknown: 'That task no longer exists.',
  no_actor: 'Pick who you are first.',
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const sb = svc()

  const actingId = await actingStaffId()
  if (!actingId) return NextResponse.json({ error: REFUSAL.no_actor }, { status: 400 })

  // A revert is SIGNED. The cookie says who is at the desk; the PIN proves who
  // is doing this one thing — the difference matters on a shared device.
  if (b.revert_note) {
    if (typeof b.pin !== 'string' || !b.pin) {
      return NextResponse.json({ error: 'Enter your PIN to revert.' }, { status: 400 })
    }
    const { data: verified } = await sb.rpc('kiosk_verify_pin', { p_team_member: actingId, p_pin: b.pin })
    if (!verified) return NextResponse.json({ error: 'Wrong PIN, or too many tries — wait a moment.' }, { status: 401 })
  }

  const { data: refusal, error } = await sb.rpc('shift_task_update', {
    p_instance: b.instance_id,
    p_actor: actingId,
    p_status: b.status ?? null,
    p_evidence: b.evidence ?? null,
    p_blocked_reason: b.blocked_reason ?? null,
    p_blocked_unblocker: b.blocked_unblocker ?? null,
    p_note: b.note ?? null,
    p_revert_note: b.revert_note ?? null,
    p_prospect: b.prospect_id ?? null,
  })
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  if (refusal) return NextResponse.json({ error: REFUSAL[refusal as string] || 'Refused.' }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/shifts — template and objective editing, supervisors only.
//
// DEACTIVATE, NEVER DELETE. A template task that is removed would orphan every
// historic instance pointing at it, and a completed week would lose its wording.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const sb = svc()
  const actingId = await actingStaffId()
  const { data: acting } = actingId
    ? await sb.from('team_members').select('is_shift_supervisor').eq('id', actingId).maybeSingle()
    : { data: null }
  if (!acting?.is_shift_supervisor) {
    return NextResponse.json({ error: 'Only Mr Sĩ or Miss Chau can change the standing lists.' }, { status: 403 })
  }

  const b = await req.json().catch(() => ({}))

  if (b.kind === 'template') {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of ['title_en', 'title_vi', 'charter_en', 'charter_vi', 'measure_en', 'measure_vi'] as const) {
      if (k in b) patch[k] = b[k] ? String(b[k]).slice(0, 8000) : null
    }
    if ('assignee_team_member_id' in b) patch.assignee_team_member_id = b.assignee_team_member_id || null
    if ('active' in b) patch.active = !!b.active
    const { error } = await sb.from('shift_templates').update(patch).eq('id', b.id)
    return error ? NextResponse.json({ error: 'Could not save.' }, { status: 500 }) : NextResponse.json({ ok: true })
  }

  if (b.kind === 'task') {
    if (b.create) {
      const { data: max } = await sb.from('shift_template_tasks')
        .select('sort').eq('template_id', b.template_id).order('sort', { ascending: false }).limit(1).maybeSingle()
      const { error } = await sb.from('shift_template_tasks').insert({
        template_id: b.template_id, sort: (max?.sort ?? 0) + 1,
        title_en: String(b.title_en || '').slice(0, 2000),
        title_vi: b.title_vi ? String(b.title_vi).slice(0, 2000) : null,
      })
      return error ? NextResponse.json({ error: 'Could not add.' }, { status: 500 }) : NextResponse.json({ ok: true })
    }
    const patch: Record<string, unknown> = {}
    for (const k of ['title_en', 'title_vi'] as const) if (k in b) patch[k] = b[k] ? String(b[k]).slice(0, 2000) : null
    if ('sort' in b) patch.sort = Number(b.sort)
    if ('active' in b) patch.active = !!b.active          // deactivate, never delete
    const { error } = await sb.from('shift_template_tasks').update(patch).eq('id', b.id)
    return error ? NextResponse.json({ error: 'Could not save.' }, { status: 500 }) : NextResponse.json({ ok: true })
  }

  if (b.kind === 'objective') {
    const { error } = await sb.from('shift_week_objectives').upsert({
      week_start: b.week_start, template_id: b.template_id,
      objective_en: String(b.objective_en || '').slice(0, 2000),
      objective_vi: b.objective_vi ? String(b.objective_vi).slice(0, 2000) : null,
      created_by: actingId,
    }, { onConflict: 'week_start,template_id' })
    return error ? NextResponse.json({ error: 'Could not save.' }, { status: 500 }) : NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Bad kind.' }, { status: 400 })
}
