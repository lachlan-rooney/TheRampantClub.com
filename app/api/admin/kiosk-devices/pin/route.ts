import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { svc } from '@/lib/kiosk/server'

// Admin manages staff PINs (the picker attribution). GET = the staff roster with
// whether each has a PIN. POST = set a PIN (hashed in the DB fn; never plaintext).
// The set_team_member_pin fn checks is_admin_uid(auth.uid()), so it's called via
// the admin's SESSION client (not service role, whose auth.uid() is null).

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { data } = await svc().from('team_members').select('id, display_name, role_title, active, pin_hash').order('display_name')
  return NextResponse.json({ staff: (data || []).map(t => ({ id: t.id, display_name: t.display_name, role_title: t.role_title, active: t.active, has_pin: !!t.pin_hash })) })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { team_member_id, pin } = await req.json().catch(() => ({}))
  if (typeof team_member_id !== 'string' || typeof pin !== 'string' || !/^[0-9]{4,8}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4–8 digits.' }, { status: 400 })
  }
  const sb = await createServerSupabaseClient()
  const { error } = await sb.rpc('set_team_member_pin', { p_team_member: team_member_id, p_pin: pin })
  if (error) return NextResponse.json({ error: 'Could not set the PIN.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
