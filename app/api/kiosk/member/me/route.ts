import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, memberSession, memberClient, DEVICE_COOKIE } from '@/lib/kiosk/server'

// The member landing payload — read AS THE MEMBER, through the member-own RLS
// proven in S0–S2d. Nothing here is filtered by hand: `profiles` returns one row
// because that member can only see their own, and member_taste_profiles likewise.
// Phase 2 adds ZERO new member RLS; `visits` is deliberately not read (see Part 7).

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await memberSession()
  if (!session) return NextResponse.json({ member: null }, { status: 401 })

  const mc = memberClient(session.profileId)
  const [{ data: profile }, { data: taste }] = await Promise.all([
    mc.from('profiles').select('display_name').eq('id', session.profileId).maybeSingle(),
    mc.from('member_taste_profiles').select('vector').maybeSingle(),
  ])

  // Top palate families, from the member's own vector. Slugs only — the page
  // renders them; no scores, no raw parameters.
  let palate: string[] = []
  const v = taste?.vector as Record<string, number> | null | undefined
  if (v && typeof v === 'object') {
    palate = Object.entries(v).filter(([, n]) => typeof n === 'number' && n > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
  }

  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  const { data: board } = await svc().rpc('kiosk_board', { p_device_token: token })
  const room = (Array.isArray(board) ? board[0] : board)?.room ?? null

  const full = (profile?.display_name || '').trim()
  return NextResponse.json({
    member: {
      first_name: full ? full.split(/\s+/)[0] : null,
      palate,
      room,
      expires_at: session.expiresAt,
    },
  })
}
