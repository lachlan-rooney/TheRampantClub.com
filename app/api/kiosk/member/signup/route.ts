import { NextResponse } from 'next/server'
import { memberSession, memberClient } from '@/lib/kiosk/server'

// POST /api/kiosk/member/signup { fixture_id }
//
// PUTTING YOUR NAME DOWN, FROM THE ROOM YOU ARE SITTING IN. The board's What's
// On told members to sign in to do this and the tablet had no way to do it
// (owner, 2026-09-25: "To sign up to events on the Tablet they'd need to sign
// in using the pin") — a promise the screen could not keep.
//
// IT RUNS AS THE MEMBER, not as the club: memberClient() carries that member's
// own JWT, so the same RLS and the same fixture_signup() decide it here as
// decide it in their browser. The cap and the deadline are the database's
// call, and it returns WHY it refused so the tablet can say so.
//
// A tablet is shoulder height, so this route answers about the person signed
// in and nobody else: it never reads who else is going.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await memberSession()
  if (!session) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const fixtureId = typeof body?.fixture_id === 'string' ? body.fixture_id : ''
  if (!fixtureId) return NextResponse.json({ error: 'No event.' }, { status: 400 })

  const mc = memberClient(session.profileId)
  const { data: reason, error } = await mc.rpc('fixture_signup', { p_fixture_id: fixtureId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (reason) {
    // The function's own words for why: full, closed, already, unknown, auth.
    return NextResponse.json({ ok: false, reason }, { status: 200 })
  }
  return NextResponse.json({ ok: true })
}
