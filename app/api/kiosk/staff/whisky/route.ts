import { NextResponse, type NextRequest } from 'next/server'
import { svc, deviceOk, actingStaffId } from '@/lib/kiosk/server'

// STOCKTAKE FROM THE ROOM TABLET.
//
// The admin stocktake at /admin/whisky needs an admin Supabase session. Mr Sĩ
// — and every other person who actually counts bottles — has a kiosk PIN and
// no login at all. The only way to use the admin page on a room tablet would
// be to sign a SHARED admin account into a tablet that lives in a public room,
// which puts member records, finance and the MIS one tap from anybody who
// picks it up, and stamps the count "staff@" rather than a person.
//
// So: a twin, gated on the enrolled device, with the SAME writes as the admin
// route — the whisky row, and a whisky_fill_history audit row.
//
// ── THE AUDIT IS BETTER HERE, NOT WORSE ───────────────────────────────────
// The admin route stamps auth.uid() + the session email, which for the floor
// has always been the shared staff@ inbox: 235 fill edits, every one of them
// "staff". This route has no auth user to stamp, so it writes the acting staff
// member's NAME — "Mr Sĩ" — into updated_by_email, verified against
// team_members rather than taken from the cookie. For stock control, where the
// whole point is noticing who counted what, a name beats a shared mailbox.
//
// updated_by stays null: there is no auth.uid() to put there and inventing one
// would be worse than an honest gap.

export const dynamic = 'force-dynamic'

/** The acting staff member, verified — the cookie is unsigned, so its contents
 *  are a claim until team_members agrees. */
async function actor(): Promise<{ id: string; name: string } | null> {
  const id = await actingStaffId()
  if (!id) return null
  const { data } = await svc().from('team_members')
    .select('id, display_name, active, pin_hash').eq('id', id).maybeSingle()
  if (!data || data.active === false || !data.pin_hash) return null
  return { id: data.id, name: data.display_name }
}

const denyDevice = () => NextResponse.json({ error: 'This tablet is not paired.' }, { status: 403 })
const denyStaff = () => NextResponse.json({ error: 'Sign in first.' }, { status: 403 })

// ── The catalogue, as a person counting bottles needs it ───────────────────
export async function GET() {
  if (!(await deviceOk())) return denyDevice()
  const me = await actor()
  if (!me) return denyStaff()

  const { data, error } = await svc().from('whiskies')
    .select('id, name, distillery, region, current_fill_pct, last_fill_updated_at, last_fill_updated_email')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ staff: me, whiskies: data ?? [] })
}

// ── One bottle's fill ──────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  if (!(await deviceOk())) return denyDevice()
  const me = await actor()
  if (!me) return denyStaff()

  const body = await req.json().catch(() => null) as { id?: string; fill_pct?: unknown; note?: unknown } | null
  const id = String(body?.id || '').trim()
  if (!id) return NextResponse.json({ error: 'Which bottle?' }, { status: 400 })

  const n = Number(body?.fill_pct)
  if (!Number.isFinite(n)) return NextResponse.json({ error: 'A fill level is required.' }, { status: 400 })
  const fill_pct = Math.max(0, Math.min(100, Math.round(n)))
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null

  const sb = svc()

  // The prior value is read BEFORE the write, so the delta is against what was
  // really there and not what the tablet believed.
  const { data: prior, error: priorErr } = await sb.from('whiskies')
    .select('current_fill_pct').eq('id', id).single()
  if (priorErr) return NextResponse.json({ error: 'That bottle is not in the catalogue.' }, { status: 404 })
  const previous_fill_pct = prior?.current_fill_pct == null ? null : Number(prior.current_fill_pct)

  const nowIso = new Date().toISOString()
  const { error: updErr } = await sb.from('whiskies').update({
    current_fill_pct: fill_pct,
    last_fill_updated_at: nowIso,
    last_fill_updated_by: null,
    last_fill_updated_email: me.name,
  }).eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const { error: histErr } = await sb.from('whisky_fill_history').insert({
    whisky_id: id, fill_pct, previous_fill_pct,
    updated_by: null, updated_by_email: me.name, note,
  })

  // The bottle is already correct; a missing audit row is recoverable and an
  // inconsistent bottle row would mislead the bar. Say so rather than rolling
  // back the thing that mattered.
  return NextResponse.json({
    ok: true, id, fill_pct, previous_fill_pct,
    last_fill_updated_at: nowIso, last_fill_updated_email: me.name,
    ...(histErr ? { warning: 'Saved, but the audit row failed: ' + histErr.message } : {}),
  })
}

// ── Finish: record the session ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await deviceOk())) return denyDevice()
  const me = await actor()
  if (!me) return denyStaff()

  const body = await req.json().catch(() => null) as {
    started_at?: string
    summary?: { id?: string; name?: string; fill_before?: unknown; fill_after?: unknown; changed?: unknown }[]
  } | null

  if (!Array.isArray(body?.summary) || !body.summary.length) {
    return NextResponse.json({ error: 'Nothing was counted.' }, { status: 400 })
  }
  if (body.summary.length > 2000) {
    return NextResponse.json({ error: 'Too many entries.' }, { status: 400 })
  }

  const clamp = (v: unknown) =>
    v == null || v === '' ? null
      : Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Math.round(Number(v)))) : null

  const summary = body.summary
    .filter(r => typeof r?.id === 'string' && typeof r?.name === 'string')
    .map(r => ({
      id: String(r.id).slice(0, 60),
      name: String(r.name).slice(0, 240),
      fill_before: clamp(r.fill_before),
      fill_after: clamp(r.fill_after) ?? 0,
      changed: !!r.changed,
    }))
  if (!summary.length) return NextResponse.json({ error: 'Nothing was counted.' }, { status: 400 })

  const sb = svc()
  const { count } = await sb.from('whiskies').select('id', { count: 'exact', head: true })

  const changed_count = summary.filter(s => s.changed).length
  const { data, error } = await sb.from('whisky_stocktake_sessions').insert({
    started_at: typeof body.started_at === 'string' ? body.started_at : new Date().toISOString(),
    // The name, not a shared inbox. This is the field the admin page has always
    // left null and the reason every past edit reads as "staff".
    finished_by: me.name,
    finished_by_email: null,
    reviewed_count: summary.length,
    changed_count,
    unchanged_count: summary.length - changed_count,
    total_catalogue_count: count ?? 0,
    summary,
  }).select('id, finished_at, reviewed_count, changed_count').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, session: data })
}
