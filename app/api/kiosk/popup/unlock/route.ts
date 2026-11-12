import { NextRequest, NextResponse } from 'next/server'
import { deviceOk, actingStaff, denyDevice, denyStaff, svc } from '@/lib/kiosk/server'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// LEAVING KIOSK MODE.
// ───────────────────────────────────────────────────────────────────────────
// The pop-up screen is locked to the sign-up flow: a guest holding the tablet
// can reach no admin, no list of other guests, and no other part of the site.
// The way out is the PIN of the member of staff who is standing there.
//
// ⚠ IT VERIFIES THE ACTING STAFF MEMBER'S OWN PIN, not "any staff PIN". The
// person manning the stand signed in at the start of the evening; asking for
// THEIR PIN means a guest who has watched somebody else type theirs at a bar
// last week still cannot get out.
//
// The PIN never leaves this route, is never logged, and is checked by
// kiosk_verify_pin in Postgres — the same function every other kiosk screen
// uses, so there is one implementation of "is this PIN right" and not two.
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  if (!(await deviceOk())) return denyDevice()
  const staff = await actingStaff()
  if (!staff) return denyStaff()

  let body: { pin?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const pin = typeof body.pin === 'string' ? body.pin : ''
  if (pin.length < 4) return NextResponse.json({ error: 'Enter your PIN.' }, { status: 400 })

  const { data: id } = await svc().rpc('kiosk_verify_pin', {
    p_team_member: staff.id, p_pin: pin,
  })

  if (!id) {
    // Deliberately the same wording whatever went wrong. A message that
    // distinguishes "wrong PIN" from anything else is a message that helps
    // somebody guess.
    return NextResponse.json({ error: 'Wrong PIN.' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, staff: staff.name })
}
