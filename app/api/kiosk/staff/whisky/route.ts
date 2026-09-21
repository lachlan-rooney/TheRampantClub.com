import { NextResponse, type NextRequest } from 'next/server'
import { svc, deviceOk, actingStaffId } from '@/lib/kiosk/server'

// STOCKTAKE FROM THE ROOM TABLET.
//
// The admin stocktake at /admin/whisky needs an admin Supabase session. The
// people who actually count bottles have a kiosk PIN and no login at all, so
// the only way to use the admin page on a room tablet would be to sign a
// SHARED admin account into a tablet that lives in a public room — putting
// member records, finance and the MIS one tap from anybody who picks it up,
// and stamping the count "staff@" rather than a person.
//
// ── THE HISTORY IS THE SESSION ────────────────────────────────────────────
// The first version kept the count in the tablet's memory and wrote the
// session only at Finish. Counting 333 bottles takes over an hour, and if the
// tablet slept or somebody tapped Home at bottle 200 the WORK survived (each
// fill is saved as it is made) but the STOCKTAKE did not — no record that it
// ever happened.
//
// So whisky_fill_history is now the single source of truth. Every count writes
// a row there, INCLUDING "no change" and "not on the shelf", and both the
// resume and the finished summary are built from those rows on the server. The
// tablet can be dropped, locked or reloaded and the count is still there.
//
// ── THE AUDIT IS BETTER HERE, NOT WORSE ───────────────────────────────────
// The admin route stamps the session email, which on the floor has always been
// the shared staff@ inbox — all 235 prior edits read "staff". This route has no
// auth user to stamp, so it writes the acting person's NAME, verified against
// team_members rather than taken from the unsigned cookie.

export const dynamic = 'force-dynamic'

/** How far back a resume looks. A stocktake is one sitting; anything older is
 *  a different count, not this one. */
const SESSION_HOURS = 12

const NOTE = {
  count: 'stocktake',
  same: 'stocktake · no change',
  missing: 'stocktake · NOT ON THE SHELF',
} as const

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

/** Everything this person has counted since `since` — the session, rebuilt. */
async function countedSince(name: string, sinceIso: string) {
  const { data } = await svc().from('whisky_fill_history')
    .select('whisky_id, fill_pct, previous_fill_pct, note, created_at')
    .eq('updated_by_email', name)
    .gte('created_at', sinceIso)
    .like('note', 'stocktake%')
    .order('created_at', { ascending: true })
  // One entry per bottle — a bottle counted twice keeps the LAST reading.
  const byBottle = new Map<string, { fill_pct: number; previous_fill_pct: number | null; note: string | null }>()
  for (const r of data ?? []) byBottle.set(r.whisky_id, r)
  return byBottle
}

const sessionStart = () => new Date(Date.now() - SESSION_HOURS * 3600_000).toISOString()

// ── The catalogue, plus whatever this count has already done ───────────────
export async function GET(req: NextRequest) {
  if (!(await deviceOk())) return denyDevice()
  const me = await actor()
  if (!me) return denyStaff()

  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since') || sessionStart()

  const { data, error } = await svc().from('whiskies')
    .select('id, name, distillery, region, current_fill_pct, last_fill_updated_at, last_fill_updated_email')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counted = await countedSince(me.name, since)
  return NextResponse.json({
    staff: me,
    since,
    whiskies: data ?? [],
    counted: [...counted.entries()].map(([whisky_id, r]) => ({
      whisky_id,
      fill_pct: r.fill_pct,
      changed: r.previous_fill_pct !== null && r.previous_fill_pct !== r.fill_pct,
      missing: r.note === NOTE.missing,
    })),
  })
}

// ── One bottle ─────────────────────────────────────────────────────────────
// kind: 'count'   — a reading from the slider
//       'same'    — verified, unchanged (still writes a row: a bottle checked
//                   and found untouched is a fact worth keeping, and without it
//                   a resumed session would forget it was ever looked at)
//       'missing' — in the catalogue, not on the shelf. Recorded as 0 with a
//                   loud note, because for stock purposes absent is zero
//                   available — and the drop from last week's reading to 0 is
//                   exactly the signal the count exists to produce.
export async function PATCH(req: NextRequest) {
  if (!(await deviceOk())) return denyDevice()
  const me = await actor()
  if (!me) return denyStaff()

  const body = await req.json().catch(() => null) as
    { id?: string; fill_pct?: unknown; kind?: keyof typeof NOTE } | null
  const id = String(body?.id || '').trim()
  if (!id) return NextResponse.json({ error: 'Which bottle?' }, { status: 400 })

  const kind: keyof typeof NOTE = body?.kind && body.kind in NOTE ? body.kind : 'count'

  const sb = svc()
  const { data: prior, error: priorErr } = await sb.from('whiskies')
    .select('current_fill_pct').eq('id', id).single()
  if (priorErr) return NextResponse.json({ error: 'That bottle is not in the catalogue.' }, { status: 404 })
  const previous_fill_pct = prior?.current_fill_pct == null ? null : Number(prior.current_fill_pct)

  // 'same' takes the value already on record rather than trusting the tablet,
  // so "no change" can never quietly change something.
  const asked = Number(body?.fill_pct)
  const fill_pct =
    kind === 'missing' ? 0
      : kind === 'same' ? (previous_fill_pct ?? 0)
        : Number.isFinite(asked) ? Math.max(0, Math.min(100, Math.round(asked))) : NaN
  if (!Number.isFinite(fill_pct)) {
    return NextResponse.json({ error: 'A fill level is required.' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const { error: updErr } = await sb.from('whiskies').update({
    current_fill_pct: fill_pct,
    last_fill_updated_at: nowIso,
    last_fill_updated_by: null,
    last_fill_updated_email: me.name,
  }).eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // The history row is what makes the session survivable, so a failure here is
  // reported rather than swallowed — the bottle is right either way.
  const { error: histErr } = await sb.from('whisky_fill_history').insert({
    whisky_id: id, fill_pct, previous_fill_pct,
    updated_by: null, updated_by_email: me.name, note: NOTE[kind],
  })

  return NextResponse.json({
    ok: true, id, fill_pct, previous_fill_pct,
    changed: previous_fill_pct !== null && previous_fill_pct !== fill_pct,
    missing: kind === 'missing',
    ...(histErr ? { warning: 'Saved, but this bottle may not survive a reload: ' + histErr.message } : {}),
  })
}

// ── Add a bottle found on the shelf, or finish the count ───────────────────
export async function POST(req: NextRequest) {
  if (!(await deviceOk())) return denyDevice()
  const me = await actor()
  if (!me) return denyStaff()

  const body = await req.json().catch(() => null) as
    { action?: string; name?: string; started_at?: string } | null
  const sb = svc()

  // A bottle on the shelf that is not in the catalogue used to go on a piece of
  // paper, which is the thing this screen exists to replace. Name only: the
  // person counting knows what it is called and nothing else, and guessing a
  // distillery would put fiction in the catalogue.
  if (body?.action === 'add') {
    const name = String(body.name || '').trim().slice(0, 240)
    if (name.length < 2) return NextResponse.json({ error: 'A name is needed.' }, { status: 400 })

    const { data: dupe } = await sb.from('whiskies').select('id, name').ilike('name', name).maybeSingle()
    if (dupe) return NextResponse.json({ ok: true, whisky: dupe, existed: true })

    const { data, error } = await sb.from('whiskies')
      .insert({ name, in_stock: true, current_fill_pct: null })
      .select('id, name, distillery, region, current_fill_pct, last_fill_updated_at, last_fill_updated_email')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, whisky: data })
  }

  // FINISH. The summary is built from the HISTORY, not from anything the
  // tablet sends: that is what makes a count survive a reload, a flat battery
  // or somebody tapping Home at bottle 200.
  const since = typeof body?.started_at === 'string' ? body.started_at : sessionStart()
  const counted = await countedSince(me.name, since)
  if (!counted.size) return NextResponse.json({ error: 'Nothing has been counted yet.' }, { status: 400 })

  const ids = [...counted.keys()]
  const { data: names } = await sb.from('whiskies').select('id, name').in('id', ids)
  const nameById = new Map((names ?? []).map(w => [w.id, w.name]))

  const summary = ids.map(id => {
    const r = counted.get(id)!
    return {
      id, name: nameById.get(id) ?? id,
      fill_before: r.previous_fill_pct,
      fill_after: r.fill_pct,
      changed: r.previous_fill_pct !== null && r.previous_fill_pct !== r.fill_pct,
      missing: r.note === NOTE.missing,
    }
  })

  const { count } = await sb.from('whiskies').select('id', { count: 'exact', head: true })
  const changed_count = summary.filter(s => s.changed).length

  const { data, error } = await sb.from('whisky_stocktake_sessions').insert({
    started_at: since,
    finished_by: me.name,
    finished_by_email: null,
    reviewed_count: summary.length,
    changed_count,
    unchanged_count: summary.length - changed_count,
    total_catalogue_count: count ?? 0,
    summary,
  }).select('id, finished_at, reviewed_count, changed_count').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    session: data,
    missing: summary.filter(s => s.missing).map(s => s.name),
  })
}
