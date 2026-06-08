import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { checkBookingAvailability } from '@/lib/booking-availability'

const ACTIVE_STATUS = ['pending', 'confirmed', 'arrived']

// GET    /api/admin/bookings/[id]   — single booking + member context
// PATCH  /api/admin/bookings/[id]   — edit any field
// DELETE /api/admin/bookings/[id]   — soft cancel (status='cancelled')

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_STATUS = ['pending', 'confirmed', 'arrived', 'cancelled', 'no_show']

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const sb = svc()
  const { data, error } = await sb.from('bookings_with_member').select('*').eq('booking_id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ booking: data })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const sb = svc()
  const { data: before } = await sb.from('bookings')
    .select('booking_date, start_time, end_time, session_label, status, party_size, space')
    .eq('booking_id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'booking not found' }, { status: 404 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.booking_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.booking_date)) patch.booking_date = body.booking_date
  if ('start_time' in body)  patch.start_time = body.start_time && typeof body.start_time === 'string' && /^\d{2}:\d{2}/.test(body.start_time) ? body.start_time : null
  if ('end_time' in body)    patch.end_time = body.end_time && typeof body.end_time === 'string' && /^\d{2}:\d{2}/.test(body.end_time) ? body.end_time : null
  if (typeof body.session_label === 'string') patch.session_label = body.session_label.slice(0, 20) || null
  if (typeof body.space === 'string')         patch.space = body.space.slice(0, 40)
  if (typeof body.notes === 'string')         patch.notes = body.notes.slice(0, 2000) || null
  if (Number.isInteger(body.party_size) && (body.party_size as number) >= 1 && (body.party_size as number) <= 50) patch.party_size = body.party_size
  if (typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status)) {
    patch.status = body.status
    if (body.status === 'cancelled') patch.cancelled_at = new Date().toISOString()
    if (body.status === 'arrived' && before.status !== 'arrived') patch.arrived_at = new Date().toISOString()
  }

  // Enforce the POST invariant on the post-merge state: a booking must
  // always have either a start_time or a session_label. PATCH can't strip
  // both — otherwise the calendar would render the row with no time hint.
  const mergedStart   = 'start_time'    in patch ? patch.start_time    : before.start_time
  const mergedSession = 'session_label' in patch ? patch.session_label : before.session_label
  if (!mergedStart && !mergedSession) {
    return NextResponse.json({ error: 'either start_time or session_label must be set' }, { status: 400 })
  }

  // Availability guard (the hole the recon found — PATCH was unguarded). When
  // an edit touches scheduling AND the booking is still active, re-check the
  // MERGED state with the SAME function POST uses, excluding this booking's own
  // holds so an edit can't conflict with itself.
  const touchesSchedule = ['booking_date', 'start_time', 'end_time', 'session_label', 'party_size', 'space'].some(k => k in body) || 'unit_ids' in body
  const mergedStatus = (patch.status as string) ?? before.status
  const explicitUnits = 'unit_ids' in body && Array.isArray(body.unit_ids)
  if (touchesSchedule && ACTIVE_STATUS.includes(mergedStatus)) {
    // Units to check: the edit's explicit set, else the booking's current holds.
    let unitIds: string[]
    if (explicitUnits) {
      unitIds = (body.unit_ids as unknown[]).filter(x => typeof x === 'string') as string[]
    } else {
      const { data: held } = await sb.from('booking_tables').select('unit_id').eq('booking_id', id)
      unitIds = (held || []).map(h => h.unit_id as string)
    }
    const avail = await checkBookingAvailability({
      sb,
      unit_ids: unitIds,
      space: (patch.space as string) ?? before.space,
      booking_date: (patch.booking_date as string) ?? before.booking_date,
      start_time: (mergedStart as string | null),
      end_time: 'end_time' in patch ? (patch.end_time as string | null) : before.end_time,
      session_label: (mergedSession as string | null),
      party_size: (patch.party_size as number) ?? before.party_size,
      excludeBookingId: id,
    })
    if (!avail.ok) return NextResponse.json({ error: avail.error }, { status: avail.status || 409 })
    if (unitIds.length > 0 && avail.resolvedSpace) patch.space = avail.resolvedSpace
  }

  const { error } = await sb.from('bookings').update(patch).eq('booking_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync unit holds when the edit explicitly set them (replace the lot).
  if (explicitUnits) {
    const unitIds = [...new Set((body.unit_ids as unknown[]).filter(x => typeof x === 'string') as string[])]
    await sb.from('booking_tables').delete().eq('booking_id', id)
    if (unitIds.length > 0) {
      const { error: btErr } = await sb.from('booking_tables').insert(unitIds.map(unit_id => ({ booking_id: id, unit_id })))
      if (btErr) return NextResponse.json({ error: `Could not update table holds: ${btErr.message}` }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  void user  // soft-cancel; staff identity recorded via updated_at if we ever extend

  const sb = svc()
  const { error } = await sb.from('bookings').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('booking_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
