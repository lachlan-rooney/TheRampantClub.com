import { NextResponse } from 'next/server'
import { svc } from '@/lib/kiosk/server'
import { doorDevice } from '@/lib/kiosk/door'
import { verifiedStaff, pendingVisit } from '../shared'

// POST /api/kiosk/door/review  { visit_id, team_member_id, pin }
//
// The duty manager's view of the guest waiting in front of them: the name as
// typed, why it came to them, and — only now, behind a PIN — whose guest the
// list says they are. The guest has been looking at "please wait"; the host's
// name is never on the screen before a member of staff has proved who they are.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const dev = await doorDevice()
  if (!dev) return NextResponse.json({ error: 'This tablet is not the door.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const staff = await verifiedStaff(body?.team_member_id, body?.pin)
  if (!staff) return NextResponse.json({ error: 'Wrong PIN, or too many tries — wait a moment.' }, { status: 401 })

  const visit = await pendingVisit(dev.id, body?.visit_id)
  if (!visit) return NextResponse.json({ error: 'This sign-in is no longer waiting.' }, { status: 409 })

  let host: string | null = null
  if (visit.host_member_no) {
    const { data: m } = await svc().from('members').select('full_name').eq('member_no', visit.host_member_no).maybeSingle()
    host = m?.full_name || null
  }
  return NextResponse.json({
    staff_name: staff.display_name,
    guest_name: visit.guest_name,
    reason: visit.referred_reason,
    on_list: visit.on_list,
    host,
    signed_in_at: visit.signed_in_at,
  })
}
