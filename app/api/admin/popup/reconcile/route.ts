import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isAdmin } from '@/lib/admin'
import { ACTING_COOKIE, verifyActor } from '@/lib/acting-identity'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 8 · RECONCILING THE PAPER.  The morning after.
// ───────────────────────────────────────────────────────────────────────────
// A phone was flat, or the pocket router went down and stayed down, and names
// were ticked on a printed A4 sheet. Those ticks have to reach the record
// BEFORE the follow-up goes out, because the follow-up only goes to people who
// were actually admitted — and somebody who came, enjoyed it, and is missing
// from the data gets nothing.
//
// ══ WHY IT IS NOT JUST "EDIT THE ROW" ════════════════════════════════════
// ⚠ A TICK ENTERED AT TEN THE NEXT MORNING IS NOT EVIDENCE THAT SOMEBODY WAS
// SCANNED AT 19:04. popup_reconcile stamps reconciled_at and a note, so the
// night's live record and the morning's corrections can always be told apart.
// Without that, a week later nobody can say whether the door saw a guest or
// whether somebody decided afterwards that it probably had.
//
// It works in both directions: a sheet can also show that somebody the system
// thinks came in never actually arrived.
// ═══════════════════════════════════════════════════════════════════════════

const SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'

const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } })

async function whoIsCorrecting(): Promise<string> {
  const a = svc()
  const actor = verifyActor((await cookies()).get(ACTING_COOKIE)?.value)
  if (actor) {
    const { data } = await a.from('team_members').select('display_name').eq('id', actor).maybeSingle()
    if (data?.display_name) return data.display_name
  }
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (user) {
    const { data } = await a.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    if (data?.display_name) return data.display_name
  }
  return 'Admin'
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()
  const { data: ev } = await a.from('popup_events').select('id, title_en, event_date, followup_sent_at')
    .eq('slug', SLUG).maybeSingle()
  if (!ev) return NextResponse.json({ error: 'No pop-up is set up.' }, { status: 500 })

  const [{ data: rows }, { data: sheet }] = await Promise.all([
    a.from('popup_bookings')
      // ⚠ ONE STRING LITERAL. Built with `+` it is no longer a literal, the
      // generated types give up, and every field below errors as
      // GenericStringError — which reads like a database fault and is a
      // formatting one. Same trap as app/api/kiosk/popup/door/route.ts.
      .select('id, name, email, party_size, status, ticket_code, session_id, source, admitted_at, admitted_by, admitted_party, admitted_offline, reconciled_at, reconcile_note, taken_by, consent_marketing, followup_sent_at')
      .eq('event_id', ev.id).order('name'),
    a.rpc('popup_runsheet', { p_event_id: ev.id }),
  ])

  const all = (rows || []) as Record<string, unknown>[]
  const confirmed = all.filter(r => r.status === 'confirmed')
  const inside = confirmed.filter(r => r.admitted_at)

  return NextResponse.json({
    event: ev,
    sessions: sheet ?? [],
    bookings: all,
    // The three numbers that decide whether anything needs doing at all.
    summary: {
      booked_people: confirmed.reduce((n, r) => n + (r.party_size as number), 0),
      arrived_people: inside.reduce((n, r) => n + ((r.admitted_party as number) ?? (r.party_size as number)), 0),
      never_ticked: confirmed.filter(r => !r.admitted_at).length,
      taken_offline: inside.filter(r => r.admitted_offline).length,
      already_reconciled: all.filter(r => r.reconciled_at).length,
      followup_already_sent: all.filter(r => r.followup_sent_at).length,
    },
    // ⚠ SAID OUT LOUD, because it is the one thing that cannot be undone.
    followup_gone: !!ev.followup_sent_at,
  })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // ── WHO IS DOING THE CORRECTING ─────────────────────────────────────────
  // The signed desk cookie if there is one (a shared staff login must say who
  // is at it), otherwise the signed-in admin's own name. Read from the server,
  // never from the body — the same rule the door and the sign-up both follow.
  const by = await whoIsCorrecting()

  const one = async (id: string, arrived: boolean, party: number | null, note: string | null) => {
    const { data, error } = await a.rpc('popup_reconcile', {
      p_booking_id: id, p_arrived: arrived,
      p_party: party, p_by: by, p_note: note,
    })
    if (error) throw new Error(error.message)
    return Array.isArray(data) ? data[0] : data
  }

  if (body.action === 'one') {
    try {
      const r = await one(String(body.booking_id || ''), body.arrived === true,
        body.party == null ? null : Number(body.party),
        String(body.note || '').trim() || null)
      return NextResponse.json({ ok: true, ...r })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
  }

  // A whole printed sheet, entered in one go. Each row is applied on its own,
  // and a row that fails does not take the others down with it.
  if (body.action === 'sheet') {
    const rows = (body.rows || []) as { booking_id: string; arrived: boolean; party?: number; note?: string }[]
    if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ error: 'Nothing to enter.' }, { status: 400 })
    const done: unknown[] = []; const failed: { booking_id: string; error: string }[] = []
    for (const r of rows) {
      try {
        const res = await one(r.booking_id, r.arrived === true, r.party ?? null, r.note ?? null)
        // ⚠ ok:false IS A FAILURE, NOT A ROW ENTERED. popup_reconcile answers
        // ok:false for a booking id that does not exist rather than raising, so
        // pushing the answer blindly counted a typo'd line as done and the
        // sheet looked fully entered when a name had been missed.
        if (res?.ok) done.push(res)
        else failed.push({ booking_id: r.booking_id, error: 'no booking with that id' })
      } catch (e) { failed.push({ booking_id: r.booking_id, error: e instanceof Error ? e.message : String(e) }) }
    }
    return NextResponse.json({ ok: true, entered: done.length, failed })
  }

  return NextResponse.json({ error: 'Nothing addressed.' }, { status: 400 })
}
