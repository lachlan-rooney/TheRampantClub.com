import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { svc } from '@/lib/kiosk/server'

// The admin "who are you?" acting-staff identity (ATTRIBUTION on the shared staff
// login; the personal login + is_admin remains the access boundary).
//   GET           → { staff, required } — who's acting + whether this account must pick.
//   POST {action:'roster'} → the staff roster (names) to pick from.
//   POST {action:'pick', team_member_id, pin} → verify PIN, set the acting cookie.
//   POST {action:'logout'} → clear it (switch user).
// Reuses the kiosk PIN functions (kiosk_staff_roster / kiosk_verify_pin).

export const dynamic = 'force-dynamic'
export const ADMIN_STAFF_COOKIE = 'trc_admin_staff'
const opts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 12 }

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const { data: prof } = await a.from('profiles').select('requires_staff_pick').eq('id', user!.id).maybeSingle()
  const id = (await cookies()).get(ADMIN_STAFF_COOKIE)?.value
  let staff = null
  if (id) { const { data: tm } = await a.from('team_members').select('id, display_name, role_title').eq('id', id).maybeSingle(); staff = tm || null }
  return NextResponse.json({ staff, required: !!prof?.requires_staff_pick })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const a = svc()

  if (body.action === 'roster') {
    const { data } = await a.rpc('kiosk_staff_roster')
    return NextResponse.json({ staff: data || [] })
  }
  if (body.action === 'verify') {
    // Verify a PIN against a team member WITHOUT setting the acting cookie —
    // used to sign an action (e.g. sealing a checklist) as a proven person,
    // without changing who is globally "acting" on the device.
    if (typeof body.team_member_id !== 'string' || typeof body.pin !== 'string') return NextResponse.json({ error: 'Pick a name and enter your PIN.' }, { status: 400 })
    const { data: id } = await a.rpc('kiosk_verify_pin', { p_team_member: body.team_member_id, p_pin: body.pin })
    if (!id) return NextResponse.json({ ok: false, error: 'Wrong PIN, or too many tries — wait a moment.' }, { status: 401 })
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'logout') {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(ADMIN_STAFF_COOKIE, '', { path: '/', maxAge: 0 })
    return res
  }
  if (body.action === 'pick') {
    if (typeof body.team_member_id !== 'string' || typeof body.pin !== 'string') return NextResponse.json({ error: 'Pick a name and enter your PIN.' }, { status: 400 })
    const { data: id } = await a.rpc('kiosk_verify_pin', { p_team_member: body.team_member_id, p_pin: body.pin })
    if (!id) return NextResponse.json({ error: 'Wrong PIN, or too many tries — wait a moment.' }, { status: 401 })
    const { data: tm } = await a.from('team_members').select('display_name').eq('id', id).maybeSingle()
    const res = NextResponse.json({ ok: true, name: tm?.display_name || 'Staff' })
    res.cookies.set(ADMIN_STAFF_COOKIE, id as string, opts)
    return res
  }
  return NextResponse.json({ error: 'Bad action.' }, { status: 400 })
}
