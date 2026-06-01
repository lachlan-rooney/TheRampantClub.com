import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// GET  /api/admin/recap   — list evening recap logs with rollup counts
// POST /api/admin/recap   — create a new shift log (draft status)

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_LABELS = ['early', 'evening', 'late', 'all-day']

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 60))

  const sb = svc()
  const { data, error } = await sb
    .from('harmony_logs_with_counts')
    .select('*')
    .order('shift_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data || [] })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const submitted_by = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const narrative = String(body.narrative || '').trim()
  if (!narrative) return NextResponse.json({ error: 'narrative required' }, { status: 400 })
  if (narrative.length > 200_000) {
    return NextResponse.json({ error: 'narrative too long (max 200k chars)' }, { status: 400 })
  }

  const shift_date = typeof body.shift_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.shift_date)
    ? body.shift_date
    : new Date().toISOString().slice(0, 10)

  const shift_label_raw = typeof body.shift_label === 'string' ? body.shift_label : 'evening'
  const shift_label = ALLOWED_LABELS.includes(shift_label_raw) ? shift_label_raw : 'evening'

  const attendeeRaw = Number(body.attendee_count)
  const attendee_count = Number.isInteger(attendeeRaw) && attendeeRaw >= 0 ? attendeeRaw : null

  const row = {
    shift_date,
    shift_label,
    attendee_count,
    weather:     body.weather    ? String(body.weather).slice(0, 200) : null,
    room_state:  body.room_state ? String(body.room_state).slice(0, 400) : null,
    narrative,
    submitted_by,
  }

  const sb = svc()
  const { data, error } = await sb.from('harmony_logs').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, log: data })
}
