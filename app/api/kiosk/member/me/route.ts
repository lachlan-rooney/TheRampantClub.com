import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, memberSession, memberClient, DEVICE_COOKIE } from '@/lib/kiosk/server'
import { fetchCategories } from '@/components/whisky/flavour-data'
import { vectorToShape, type TasteVector } from '@/lib/whisky/taste-narrative'

// The member landing payload — read AS THE MEMBER, through the member-own RLS
// proven in S0–S2d. Nothing here is filtered by hand: `profiles` returns one row
// because that member can only see their own, and member_taste_profiles likewise.
// Phase 2 adds ZERO new member RLS; `visits` is deliberately not read (see Part 7).

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await memberSession()
  if (!session) return NextResponse.json({ member: null }, { status: 401 })

  const mc = memberClient(session.profileId)
  // Everything the FIXED column needs, in one call — the greeting and the palate
  // paint together so the member's own name lands before anything is still loading.
  // The radar is composed exactly as /members/taste composes it, server-side.
  const [{ data: profile }, { data: taste }, cats] = await Promise.all([
    mc.from('profiles').select('display_name').eq('id', session.profileId).maybeSingle(),
    mc.from('member_taste_profiles').select('vector').maybeSingle(),
    fetchCategories(mc).catch(() => []),
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
      // RadarChart's own inputs, so the kiosk renders the SAME component rather
      // than a second radar that would not inherit f5d2c90.
      cats,
      shape: v && typeof v === 'object' ? vectorToShape(v as TasteVector) : null,
    },
  })
}
