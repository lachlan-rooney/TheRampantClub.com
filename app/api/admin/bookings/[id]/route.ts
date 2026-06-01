import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

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
  const { data: before } = await sb.from('bookings').select('start_time, session_label, status').eq('booking_id', id).maybeSingle()
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

  const { error } = await sb.from('bookings').update(patch).eq('booking_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
