import { NextResponse } from 'next/server'
import { svc, deviceOk, STAFF_COOKIE, staffCookieOpts } from '@/lib/kiosk/server'

// The staff picker — ATTRIBUTION, on top of the device session. Verify the PIN
// (hashed + rate-limited in the DB fn) → set the acting-staff cookie. This is NOT
// the access boundary (the device session is); it's "who is logging this".

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  const { team_member_id, pin } = await req.json().catch(() => ({}))
  if (typeof team_member_id !== 'string' || typeof pin !== 'string') return NextResponse.json({ error: 'Pick a name and enter your PIN.' }, { status: 400 })
  const a = svc()
  const { data: id } = await a.rpc('kiosk_verify_pin', { p_team_member: team_member_id, p_pin: pin })
  if (!id) return NextResponse.json({ error: 'Wrong PIN, or too many tries — wait a moment.' }, { status: 401 })
  const { data: tm } = await a.from('team_members').select('display_name').eq('id', id).maybeSingle()
  const res = NextResponse.json({ ok: true, name: tm?.display_name || 'Staff' })
  res.cookies.set(STAFF_COOKIE, id as string, staffCookieOpts)
  return res
}
