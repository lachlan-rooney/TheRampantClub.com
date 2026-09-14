import { NextResponse } from 'next/server'
import { svc } from '@/lib/kiosk/server'
import { doorDevice } from '@/lib/kiosk/door'
import { greetingName } from '@/lib/guests'
import { verifiedStaff, pendingVisit, DECIDABLE_MS } from '../shared'

// POST /api/kiosk/door/decide  { visit_id, team_member_id, pin, decision, reason? }
//
// The duty manager admits or refuses. The PIN is verified again here rather than
// trusted from /review, and the update is conditional on the row STILL being
// undecided — two managers tapping at once cannot both decide, and the second
// is told so.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const dev = await doorDevice()
  if (!dev) return NextResponse.json({ error: 'This tablet is not the door.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const decision = body?.decision
  if (decision !== 'admitted' && decision !== 'refused') return NextResponse.json({ error: 'Admit or refuse.' }, { status: 400 })

  const staff = await verifiedStaff(body?.team_member_id, body?.pin)
  if (!staff) return NextResponse.json({ error: 'Wrong PIN, or too many tries — wait a moment.' }, { status: 401 })
  const visit = await pendingVisit(dev.id, body?.visit_id)
  if (!visit) return NextResponse.json({ error: 'This sign-in is no longer waiting.' }, { status: 409 })

  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 300) : null
  const now = new Date().toISOString()
  const { data, error } = await svc().from('guest_visits')
    .update({ decision, decision_reason: reason, decided_by_staff: staff.id, decided_at: now })
    .eq('id', visit.id).eq('device_id', dev.id).is('decision', null)
    .gte('signed_in_at', new Date(Date.now() - DECIDABLE_MS).toISOString())
    .select('id')
  if (error) return NextResponse.json({ error: 'Could not record the decision.' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Someone has already decided.' }, { status: 409 })

  return NextResponse.json({ ok: true, decision, first_name: decision === 'admitted' ? greetingName(visit.guest_name) : null })
}
