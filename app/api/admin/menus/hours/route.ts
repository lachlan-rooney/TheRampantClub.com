import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { svc } from '@/lib/kiosk/server'

// WHEN A KITCHEN TAKES ORDERS — set by staff, one restaurant at a time.
//
// PUT replaces a venue's whole week rather than patching single rows: a week
// is edited as a week ("Tuesday to Sunday, 17:00 to 21:30"), and replacing it
// wholesale means a removed window is actually removed instead of surviving as
// an orphan nobody can see on the form that wrote it.
//
// Times arrive as 'HH:MM'. A row with no opening or no last-order time is
// dropped, which is how a day is cleared: send it empty.

export const dynamic = 'force-dynamic'

const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s })
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return bad('Admins only.', 403)

  const body = await req.json().catch(() => null) as
    { venue_id?: string; windows?: { weekday?: number; opens_at?: string; last_order_at?: string }[] } | null
  if (!body?.venue_id) return bad('Which restaurant?')

  const windows = (body.windows ?? [])
    .filter(w => Number.isInteger(w.weekday) && (w.weekday as number) >= 0 && (w.weekday as number) <= 6)
    .filter(w => typeof w.opens_at === 'string' && typeof w.last_order_at === 'string')
    .map(w => ({ weekday: w.weekday as number, opens_at: (w.opens_at as string).slice(0, 5), last_order_at: (w.last_order_at as string).slice(0, 5) }))
    .filter(w => w.opens_at && w.last_order_at)

  for (const w of windows) {
    if (!HHMM.test(w.opens_at) || !HHMM.test(w.last_order_at)) return bad(`${w.opens_at}–${w.last_order_at} is not a time.`)
    // Equal times would be a window of zero length that reads as "open all
    // night" to the past-midnight rule. Rejected rather than quietly stored.
    if (w.opens_at === w.last_order_at) return bad('A window cannot open and close at the same minute.')
  }

  const sb = svc()
  const { error: delErr } = await sb.from('menu_venue_hours').delete().eq('venue_id', body.venue_id)
  if (delErr) return bad(delErr.message, 500)
  if (windows.length) {
    const { error } = await sb.from('menu_venue_hours')
      .insert(windows.map(w => ({ ...w, venue_id: body.venue_id })))
    if (error) return bad(error.message, 500)
  }

  const { data } = await sb.from('menu_venue_hours')
    .select('id, venue_id, weekday, opens_at, last_order_at').eq('venue_id', body.venue_id).order('weekday')
  return NextResponse.json({
    ok: true,
    hours: (data ?? []).map(h => ({ ...h, opens_at: String(h.opens_at).slice(0, 5), last_order_at: String(h.last_order_at).slice(0, 5) })),
  })
}
