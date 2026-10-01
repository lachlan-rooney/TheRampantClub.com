import { NextResponse } from 'next/server'
import { svc, deviceOk, actingStaff, denyDevice, denyStaff } from '@/lib/kiosk/server'

// YOUR SHIFT LIST, ON THE TABLET YOU ARE HOLDING.
//
// Weekly Shift Tasks shipped as an /admin page. Five of the six people it is
// FOR do not have a login — they have a PIN — so the list of things they are
// meant to do during the shift lived on a screen they could not open, and the
// Monday review asked them about work they had been reading off a printout.
//
// ── THE RULES ARE NOT RE-IMPLEMENTED HERE ─────────────────────────────────
// shift_task_update(p_instance, p_actor, …) decides everything: that done comes
// with evidence, that blocked comes with a reason, that turning back a done
// costs a note, and it writes the event row. This route's whole job is to hand
// it an actor it can trust.
//
// That actor is the SIGNED kiosk cookie. Before 1 October it was a bare id in a
// cookie, which is exactly why this screen could not exist: the actor is a
// PARAMETER to that function, so an unsigned cookie meant anybody could act as
// anybody. Same reasoning as lib/acting-identity's original note, now on the
// tablets.
//
// ── THE ROSTER IS THE EXPECTATION, NOT THE PERMISSION ─────────────────────
// db/day_shifts.sql removed the 'not_yours' refusal on purpose: in a club of
// five with a moving roster, somebody covering a colleague's day could not tick
// anything. So ANY active staff member may act here too, and completed_by
// records who actually did it. The rostered name is still shown — "Sy's
// Wednesday, done by Tiên" is more useful than the task sitting undone.
//
// Not re-adding that rule on the tablet matters: a floor screen stricter than
// the desk would send people back to the laptop, which is the whole problem.
//
// ── TODAY FIRST, THE WEEK UNDERNEATH ──────────────────────────────────────
// The admin page shows the week because a supervisor plans the week. On the
// floor the question is "what is left on this shift, now", so today's list is
// what opens and the rest of the week is behind one tap. Carried-over work is
// marked, because a task on its third week is the one worth asking about.

export const dynamic = 'force-dynamic'

// Every string the function can return, worded for somebody standing up. The
// function no longer returns 'not_yours' — db/day_shifts.sql dropped it — and
// it stays listed because an older copy of the function in some environment
// returning it must not reach the floor as the word "Refused."
const REFUSAL: Record<string, string> = {
  not_yours: 'That is not your task.',
  needs_evidence: 'Add the evidence first — where it is, or a link. No evidence, not done.',
  needs_reason: 'Say what is blocking it.',
  revert_needs_note: 'Say why you are turning it back.',
  unknown: 'That task no longer exists.',
  no_actor: 'Sign in with your PIN first.',
}

// The four the floor may set. 'not_required' is a third state, not a shade of
// done — a task nobody needed, reversible, with who and when in the event row.
const STATUSES = ['not_started', 'in_progress', 'done', 'blocked', 'not_required']

const vnToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const mondayOf = (d: string) => {
  const x = new Date(d + 'T00:00:00Z')
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}

export async function GET() {
  if (!(await deviceOk())) return denyDevice()
  const me = await actingStaff()
  if (!me) return denyStaff()

  const a = svc()
  const today = vnToday()
  const week = mondayOf(today)

  const [instRes, taskRes, tplRes, teamRes] = await Promise.all([
    a.from('shift_task_instances')
      // THE TITLE IS ON THE INSTANCE, not the template. The instance carries
      // its own title_en/title_vi, which is how a task can be reworded for a
      // week without rewriting history — and how the stocktake task came to
      // read "Staff → Count the back bar" on the weeks after the tablet could
      // do it (supabase/migrations/20260921100000). Reading the wording off
      // the template would quietly show the floor the old sentence.
      .select('id, template_task_id, template_id, shift_date, status, evidence, blocked_reason, note, title_en, title_vi, is_one_off, carried_over_count, assignee_team_member_id, completed_at, completed_by')
      .eq('week_start', week),
    // ORDER ONLY, and so NO active filter: a retired template task must not
    // make the instance somebody did it in disappear off the list.
    a.from('shift_template_tasks').select('id, sort'),
    a.from('shift_templates').select('id, day_of_week, title_en, title_vi, charter_en, charter_vi, measure_en, measure_vi, assignee_team_member_id'),
    a.from('team_members').select('id, display_name').eq('active', true),
  ])

  const tasks = new Map((taskRes.data || []).map(t => [t.id, t]))
  const tpls = new Map((tplRes.data || []).map(t => [t.id, t]))
  const names = new Map((teamRes.data || []).map(t => [t.id, t.display_name]))

  const rows = (instRes.data || []).map(i => {
    const tt = i.template_task_id ? tasks.get(i.template_task_id) : null
    const tpl = tpls.get(i.template_id)
    return {
      id: i.id,
      date: i.shift_date,
      title_en: i.title_en,
      title_vn: i.title_vi,
      one_off: !!i.is_one_off,
      shift_en: tpl?.title_en || null,
      shift_vn: tpl?.title_vi || null,
      status: i.status,
      evidence: i.evidence,
      blocked_reason: i.blocked_reason,
      carried: i.carried_over_count || 0,
      sort: tt?.sort ?? 999,
      mine: i.assignee_team_member_id === me.id,
      owner: i.assignee_team_member_id ? names.get(i.assignee_team_member_id) || null : null,
      // WHO ACTUALLY DID IT, which is not always who was rostered.
      done_by: i.completed_by ? names.get(i.completed_by) || null : null,
    }
  }).sort((x, y) => x.date.localeCompare(y.date) || x.sort - y.sort)

  // Only MY unfinished work counts for the badge on the hub card. A number that
  // includes other people's tasks is a number that never reaches zero, and one
  // badge nobody can clear makes every other badge on the screen untrusted.
  const mineToday = rows.filter(r => r.mine && r.date === today)

  return NextResponse.json({
    today, week, me: { id: me.id, name: me.name, supervisor: me.supervisor },
    rows,
    waiting: mineToday.filter(r => r.status !== 'done').length,
    charter: (() => {
      // The day's charter and measure: what this shift is FOR, and how it is
      // judged. It is the one piece of the admin page worth carrying over whole.
      const dow = ((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1
      const t = (tplRes.data || []).find(x => x.day_of_week === dow)
      return t ? { title_en: t.title_en, title_vn: t.title_vi, charter_en: t.charter_en, charter_vn: t.charter_vi, measure_en: t.measure_en, measure_vn: t.measure_vi } : null
    })(),
  })
}

export async function POST(req: Request) {
  if (!(await deviceOk())) return denyDevice()
  const me = await actingStaff()
  if (!me) return NextResponse.json({ error: REFUSAL.no_actor }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  if (typeof b.instance_id !== 'string') return NextResponse.json({ error: 'Which task?' }, { status: 400 })

  if (b.status != null && !STATUSES.includes(String(b.status))) {
    return NextResponse.json({ error: 'That is not a state a task can be in.' }, { status: 400 })
  }

  const sb = svc()

  // ── A REVERT IS SIGNED, HERE TOO ────────────────────────────────────────
  // Turning back a done costs a note, from anybody. The desk additionally asks
  // for the PIN — the cookie says who is signed in, the PIN proves who is doing
  // THIS one thing, and that distinction is worth MORE on a tablet that stands
  // on the bar than on a laptop in the office. So the same second gate, through
  // the same function.
  //
  // It is not barred from the floor. A person covering a shift who ticks the
  // wrong line and can only fix it by finding a laptop will leave it ticked.
  if (b.revert_note) {
    if (typeof b.pin !== 'string' || !b.pin) {
      return NextResponse.json({ error: 'Enter your PIN to turn it back.' }, { status: 400 })
    }
    const { data: verified } = await sb.rpc('kiosk_verify_pin', { p_team_member: me.id, p_pin: b.pin })
    if (!verified) return NextResponse.json({ error: 'Wrong PIN, or too many tries — wait a moment.' }, { status: 401 })
  }

  const { data: refusal, error } = await sb.rpc('shift_task_update', {
    p_instance: b.instance_id,
    p_actor: me.id,
    p_status: b.status ?? null,
    p_evidence: b.evidence ? String(b.evidence).slice(0, 4000) : null,
    p_blocked_reason: b.blocked_reason ? String(b.blocked_reason).slice(0, 2000) : null,
    p_blocked_unblocker: null,
    p_note: b.note ? String(b.note).slice(0, 2000) : null,
    p_revert_note: b.revert_note ? String(b.revert_note).slice(0, 2000) : null,
    p_prospect: null,
  })
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  if (refusal) return NextResponse.json({ error: REFUSAL[refusal as string] || 'Refused.' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
