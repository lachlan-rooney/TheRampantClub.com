import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, MEMBER_COOKIE, memberCookieOpts } from '@/lib/kiosk/server'

// Exit member mode → BOARD, never back to STAFF. The staff cookie was already
// destroyed when this session was minted, so there is nothing to fall back into.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { reason } = await req.json().catch(() => ({}))
  const token = (await cookies()).get(MEMBER_COOKIE)?.value
  if (token) {
    await svc().rpc('kiosk_member_logout', {
      p_session_token: token,
      p_reason: ['done', 'idle', 'staff_reclaim'].includes(reason) ? reason : 'done',
    })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(MEMBER_COOKIE, '', { ...memberCookieOpts, maxAge: 0 })
  return res
}
