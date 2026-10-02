import { NextResponse } from 'next/server'
import { displayFirstName } from '@/lib/kiosk/name'
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
    // nickname AND full_name, not just the display name: what to call somebody
    // is decided by lib/kiosk/name, and it needs both. Read as the MEMBER, so
    // it is still their own row and nobody else's.
    mc.from('profiles').select('display_name, member_no').eq('id', session.profileId).maybeSingle(),
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

  // ── WHAT TO CALL THEM ───────────────────────────────────────────────────
  // This line used to be `full.split(/\s+/)[0]` over the profile's display
  // name, which greeted the owner — display name "Mr Rooney" — as
  // "Good afternoon Mr". The card-tap route next door already had this right,
  // so there were two answers to one question and only one of them was correct.
  // Both go through lib/kiosk/name now.
  //
  // The roster's nickname and full name are better sources than a display name
  // a member typed into their profile, so they are preferred when the account
  // is linked to a membership.
  // ── AND SOMETHING WORTH LOOKING AT ──────────────────────────────────────
  // Owner, 2026-10-02: "theres also literally nothing on that oage when you log
  // in it's shite." He is right, and for most members it is unavoidable with
  // what this route returned: a member with no taste profile got a greeting, a
  // date and a Done button. Nothing about THEM.
  //
  // So: the balance on their card and their locker. Both are things a member
  // standing at a bar actually wants, both are facts the club already holds,
  // and both are theirs — scoped to session.memberNo, which the kiosk session
  // has already proven in Postgres (kiosk_member_touch). Nothing here can be
  // asked about anybody else, because there is nowhere to put another member's
  // number.
  const [{ data: m }, card, locker] = await Promise.all([
    session.memberNo
      ? svc().from('members').select('nickname, full_name').eq('member_no', session.memberNo).maybeSingle()
      : Promise.resolve({ data: null }),
    session.memberNo
      ? svc().from('member_cards').select('credit_vnd').eq('member_number', session.memberNo).maybeSingle()
      : Promise.resolve({ data: null }),
    session.memberNo
      ? svc().from('lockers').select('locker_no, label').eq('member_no', session.memberNo).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return NextResponse.json({
    member: {
      first_name: displayFirstName(m?.nickname, m?.full_name || profile?.display_name),
      palate,
      room,
      expires_at: session.expiresAt,
      // RadarChart's own inputs, so the kiosk renders the SAME component rather
      // than a second radar that would not inherit f5d2c90.
      cats,
      shape: v && typeof v === 'object' ? vectorToShape(v as TasteVector) : null,
      // Null where there is nothing to say, so the screen can leave it out
      // rather than print a zero that looks like a problem.
      card_credit_vnd: card.data?.credit_vnd ?? null,
      locker: locker.data ? { no: locker.data.locker_no, label: locker.data.label } : null,
    },
  })
}
