import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/membership/activate → start a one-year membership period for
// an honorary/complimentary member. No fee amount, no email, no receipt. Runs
// through the cookie client so the SECURITY DEFINER RPC's auth.uid() gate + the
// activity-log attribution resolve to the admin.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const member_no = String(body.member_no || '').trim()
  const member_name = String(body.member_name || '').trim()
  const tier = body.tier ? String(body.tier).trim() : null
  const start_date = body.start_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.start_date)) ? String(body.start_date) : null
  const note = body.note ? String(body.note).slice(0, 300) : null

  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })
  if (!member_name) return NextResponse.json({ error: 'member_name required' }, { status: 400 })

  const cookieClient = await createServerSupabaseClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  const { data, error } = await cookieClient.rpc('activate_membership', {
    p_member_no: member_no,
    p_member_name: member_name,
    p_tier: tier,
    p_start_date: start_date,
    p_note: note,
    p_staff_id: user?.id || null,
    p_staff_email: user?.email || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ ok: true, period: row ? { start: row.start_date, end: row.end_date } : null })
}
