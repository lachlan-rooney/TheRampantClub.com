import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, deviceOk, DEVICE_COOKIE, MEMBER_COOKIE, STAFF_COOKIE, memberCookieOpts } from '@/lib/kiosk/server'

// PIN → member session. The DB function returns the opaque token, or null for
// EVERY failure: wrong PIN, unknown member, no PIN set, locked out, dead device,
// unlinked profile. This route must not add a distinction the DB refused to make,
// so there is exactly one error message and one status code.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  const { member_no, pin } = await req.json().catch(() => ({}))
  if (typeof member_no !== 'string' || typeof pin !== 'string') {
    return NextResponse.json({ error: 'Enter your membership number and PIN.' }, { status: 400 })
  }
  const device = (await cookies()).get(DEVICE_COOKIE)!.value
  const { data: token } = await svc().rpc('kiosk_member_login', {
    p_device_token: device, p_member_no: member_no.toUpperCase().trim(), p_pin: pin,
  })

  // ONE generic failure. Never "no PIN set", never "no such member" — the tablet
  // must not confirm which membership numbers are live. The set-a-PIN guidance is
  // static copy shown on every failure, so it carries no signal.
  if (!token) return NextResponse.json({ error: 'generic' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(MEMBER_COOKIE, token as string, memberCookieOpts)
  // ENTERING MEMBER MODE DESTROYS THE STAFF SESSION, in the same response. Staff
  // re-PIN on the way back is then structural, not a UI rule — there is no staff
  // attribution left on this tablet to return to.
  res.cookies.set(STAFF_COOKIE, '', { ...memberCookieOpts, maxAge: 0 })
  return res
}
