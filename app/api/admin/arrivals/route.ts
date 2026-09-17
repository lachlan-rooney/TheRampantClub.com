import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { arrivalsFor, markArrived, markLeft, addGuest } from '@/lib/arrivals'

// ARRIVED · LEFT · +GUEST, for the admin surfaces (the dashboard and the
// calendar). The tablet at the door has its own door-gated twin at
// /api/kiosk/door/arrivals; both call lib/arrivals, so the two can never drift.
//
// GET  → tonight's list (bookings + walk-ins, with who is in and who has gone)
// POST → { action: 'arrived' | 'left' | 'guest', ... }

export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const date = new URL(req.url).searchParams.get('date') || undefined
  const data = await arrivalsFor(svc(), date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()
  const actor = user?.email || user?.id || 'admin'

  const body = await req.json().catch(() => null)
  const action = body?.action
  const sb = svc()

  if (action === 'arrived') {
    const r = await markArrived(sb, { member_no: body.member_no, booking_id: body.booking_id, actor })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, visit_id: r.visit_id, ...(await arrivalsFor(sb)) })
  }
  if (action === 'left') {
    if (typeof body.visit_id !== 'string') return NextResponse.json({ error: 'No visit to close.' }, { status: 400 })
    const r = await markLeft(sb, body.visit_id)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, minutes: r.minutes, ...(await arrivalsFor(sb)) })
  }
  if (action === 'guest') {
    const r = await addGuest(sb, { name: String(body.name || ''), host_member_no: body.member_no, actor })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, ...(await arrivalsFor(sb)) })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
