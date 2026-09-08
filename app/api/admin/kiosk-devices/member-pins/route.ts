import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Member PIN state and lockouts, for the admin portal. METADATA ONLY — pin_hash is
// returned by nothing, ever, and there is no path here that SETS a PIN. Admin has
// exactly two powers: reset to no-PIN-set, and clear a lockout. Neither sets a
// value; neither reveals one. Members set their own PIN in their own portal.
//
// Runs as the admin's session (not service role) so the DB's own is_admin_uid()
// check is the thing that actually gates it.

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const sb = await createServerSupabaseClient()
  const { data, error } = await sb.rpc('member_kiosk_pin_status')
  if (error) return NextResponse.json({ error: 'Could not read.' }, { status: 500 })
  return NextResponse.json({ members: data || [] })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { action, member_no } = await req.json().catch(() => ({}))
  if (typeof member_no !== 'string' || !member_no) return NextResponse.json({ error: 'Which member?' }, { status: 400 })
  const sb = await createServerSupabaseClient()

  if (action === 'reset') {
    // Clears the hash → "no PIN set". The member is then prompted in their portal
    // to choose a new one. This does not, and cannot, set a value.
    const { error } = await sb.rpc('reset_member_kiosk_pin', { p_member_no: member_no })
    if (error) return NextResponse.json({ error: 'Could not reset.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'unlock') {
    const { error } = await sb.rpc('clear_member_kiosk_lockout', { p_member_no: member_no })
    if (error) return NextResponse.json({ error: 'Could not clear.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Bad action.' }, { status: 400 })
}
