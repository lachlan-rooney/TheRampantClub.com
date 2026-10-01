import { NextResponse } from 'next/server'
import { svc, deviceOk, actingStaffId, actingStaff, denyDevice, denyStaff } from '@/lib/kiosk/server'
import { textIsMedical } from '@/lib/mis/extraction-decay'
import { CANONICAL_CATEGORIES } from '@/lib/mis/decay-priors'

// WHO THIS IS, AND WHAT THE CLUB ALREADY KNOWS ABOUT THEM.
//
// A server has been asking members what they like on every visit while the club
// held 159 recorded preferences they could not reach — the Snug, the dossier
// and the rest all live behind /admin, and floor staff have PINs rather than
// logins. This is the answer to that, on the tablet in their hand.
//
// ── WHY THIS COULD NOT BE BUILT UNTIL TODAY ───────────────────────────────
// trc_kiosk_staff held a bare team_members id, so "who is acting" was whatever
// the caller typed, and the floor route said in as many words that the cookie
// must not carry member PII. It is signed now (lib/acting-identity, kiosk
// prefix). Both gates are required here: an enrolled tablet AND a staff member
// who actually entered a PIN on it.
//
// ── WHAT IS DELIBERATELY NOT RETURNED ─────────────────────────────────────
// Birthday, email, phone. None of them helps anybody pour a drink, and this
// screen stands in a public room on a tablet that any member of staff can
// unlock. The rule is: what helps you SERVE them, not what the club happens to
// store. If a server needs to ring a member, that is a job for the desk.
//
// Also not here: anything another member said about them. Introductions and
// messages are theirs.

export const dynamic = 'force-dynamic'

const LIST_MAX = 8

export async function GET(req: Request) {
  if (!(await deviceOk())) return NextResponse.json({ error: 'This tablet is not paired.' }, { status: 403 })
  const staff = await actingStaffId()
  if (!staff) return NextResponse.json({ error: 'Sign in with your PIN first.' }, { status: 401 })

  const a = svc()
  // The acting id is signed, which proves WHO. It does not prove they are still
  // on the team, so the row is checked too — the same belt-and-braces the floor
  // route has always done.
  const { data: tm } = await a.from('team_members').select('id').eq('id', staff).eq('active', true).not('pin_hash', 'is', null).maybeSingle()
  if (!tm) return NextResponse.json({ error: 'Sign in with your PIN first.' }, { status: 401 })

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const memberNo = (url.searchParams.get('member_no') || '').trim()

  // ── THE LIST ────────────────────────────────────────────────────────────
  if (!memberNo) {
    if (q.length < 2) return NextResponse.json({ members: [] })
    const like = `%${q.replace(/[%_,]/g, '')}%`
    const { data } = await a.from('members')
      .select('member_no, full_name, nickname, tier, status')
      .or(`full_name.ilike.${like},nickname.ilike.${like},member_no.ilike.${like}`)
      .order('full_name').limit(LIST_MAX)
    return NextResponse.json({ members: data || [] })
  }

  // ── ONE MEMBER ──────────────────────────────────────────────────────────
  const { data: m } = await a.from('members')
    .select('member_no, full_name, nickname, tier, status, join_date')
    .eq('member_no', memberNo).maybeSingle()
  if (!m) return NextResponse.json({ error: 'No such member.' }, { status: 404 })

  const [prefs, locker, visit, card] = await Promise.all([
    // The gold. Highest confidence first — a server reading three lines wants
    // the three the club is most sure of.
    a.from('preferences')
      .select('category, subcategory, preference_name, detail, confidence')
      .eq('member_no', memberNo).order('confidence', { ascending: false, nullsFirst: false }),
    a.from('lockers').select('locker_no, label').eq('member_no', memberNo).maybeSingle(),
    a.from('visits').select('visit_date, space').eq('member_no', memberNo)
      .is('archived_at', null).order('visit_date', { ascending: false }).limit(1).maybeSingle(),
    // The balance on the card, which is the one number a bar actually needs.
    a.from('member_cards').select('credit_vnd').eq('member_number', memberNo).maybeSingle(),
  ])

  // Grouped, because 52 whisky notes in one column is a wall nobody reads
  // mid-service.
  const groups: Record<string, { name: string; detail: string | null; sub: string | null }[]> = {}
  for (const p of prefs.data || []) {
    const g = p.category || 'Other'
    ;(groups[g] ||= []).push({ name: p.preference_name, detail: p.detail, sub: p.subcategory })
  }

  return NextResponse.json({
    member: {
      member_no: m.member_no, name: m.full_name, nickname: m.nickname,
      tier: m.tier, status: m.status, member_since: m.join_date,
    },
    locker: locker.data ? { no: locker.data.locker_no, label: locker.data.label } : null,
    last_visit: visit.data ? { date: visit.data.visit_date, space: visit.data.space } : null,
    card_credit_vnd: card.data?.credit_vnd ?? null,
    preference_count: (prefs.data || []).length,
    preferences: groups,
  })
}

// ── AND WHAT THE FLOOR LEARNS, BACK THE OTHER WAY ─────────────────────────
// The dossier was a one-way mirror: 159 things the club knew, and no way for
// the person who had just been told the 160th to record it. A server hears
// "no ice, ever" at the table and the club has forgotten it by Tuesday.
//
// ── IT DOES NOT GO INTO THE MEMBER'S RECORD ───────────────────────────────
// It goes to preference_candidates — the queue /admin/mis/candidates already
// reviews, with promote_preference_candidate doing the insert on accept. That
// is the same path an AI-read Harmony Log takes, and for the same reason: a
// preference carries a confidence, a decay rate and a score that feed the
// recommendation engine, and none of that can be set by somebody typing
// one-handed between two tables.
//
// So the floor PROPOSES and the desk DECIDES, and the screen says so — a note
// that looks saved but is actually queued is worse than no note at all.
//
// ── EXCEPT WHEN IT IS MEDICAL ─────────────────────────────────────────────
// An allergy is not a preference and must never decay. The MIS already decides
// this deterministically — textIsMedical() over the raw words, fail-safe,
// covering keyword-free phrasings like "can't have that, my throat closes up" —
// and locks the row at s0 5 / confidence 1.00 / lambda 0. A floor note gets the
// IDENTICAL treatment, from the identical function, because the one thing worse
// than two code paths is two code paths where one of them is about allergies.
// It is still reviewed; it just cannot arrive at the desk looking casual.
export async function POST(req: Request) {
  if (!(await deviceOk())) return denyDevice()
  const me = await actingStaff()
  if (!me) return denyStaff()

  const b = await req.json().catch(() => ({}))
  const memberNo = String(b.member_no || '').trim()
  const note = String(b.note || '').trim()
  if (!memberNo) return NextResponse.json({ error: 'Which member?' }, { status: 400 })
  if (note.length < 3) return NextResponse.json({ error: 'Say what you heard.' }, { status: 400 })

  const a = svc()
  const { data: m } = await a.from('members').select('member_no').eq('member_no', memberNo).maybeSingle()
  if (!m) return NextResponse.json({ error: 'No such member.' }, { status: 404 })

  // The nine canonical categories, imported rather than retyped: a tenth
  // spelling here would be dropped by reconcile() and silently lost.
  const category = CANONICAL_CATEGORIES.includes(String(b.category))
    ? String(b.category) : 'Personal & Lifestyle'

  const medical = textIsMedical(note)

  const { error } = await a.from('preference_candidates').insert({
    member_no: m.member_no,
    suggested_category: medical ? 'Wellness & Comfort' : category,
    // The whole note is the suggestion. It is deliberately not split into a
    // name and a detail on the tablet: the reviewer rewrites it into the club's
    // own wording, and a form asking for both would get neither.
    suggested_name: note.slice(0, 200),
    detail: note.length > 200 ? note.slice(0, 2000) : null,
    // The words as they were typed. For a medical note this is the part that
    // matters most, and a reviewer must not have to trust a paraphrase.
    verbatim_quote: note.slice(0, 1000),
    // Locked for medical. Otherwise 0.50, not the 0.75 a Harmony Log gets:
    // this is one person's recollection of one remark, typed at the time. The
    // reviewer can raise it.
    suggested_s0: medical ? 5 : 3,
    suggested_confidence: medical ? 1.00 : 0.50,
    suggested_lambda: medical ? 0.000 : 0.010,
    suggested_frequency: 1.0,
    // Provenance names the PERSON, not the tablet. "Floor · Quy" is what a
    // reviewer needs to decide whether to go and ask them about it.
    source: `Floor · ${me.name}`.slice(0, 30),
  })
  if (error) return NextResponse.json({ error: 'Could not send that to the desk.' }, { status: 500 })
  return NextResponse.json({ ok: true, queued: true, medical })
}
