import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, deviceOk, DEVICE_COOKIE, MEMBER_COOKIE, STAFF_COOKIE, memberCookieOpts } from '@/lib/kiosk/server'
import { resolveMember, SENTINEL } from '@/lib/kiosk/resolve'

// PIN → member session. The DB function returns the opaque token, or null for
// EVERY failure: wrong PIN, unknown member, no PIN set, locked out, dead device,
// unlinked profile. This route must not add a distinction the DB refused to make,
// so there is exactly one error message and one status code.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!(await deviceOk())) return NextResponse.json({ error: 'Device not enrolled.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const who: string = typeof body.member_no === 'string' ? body.member_no
                    : typeof body.name === 'string' ? body.name : ''
  const pin: string = typeof body.pin === 'string' ? body.pin : ''
  if (!who.trim() || !pin) {
    return NextResponse.json({ error: 'Enter your name and code.' }, { status: 400 })
  }
  const device = (await cookies()).get(DEVICE_COOKIE)!.value
  const a = svc()

  // ── RESOLUTION BEFORE VERIFICATION, AND IT WRITES NOTHING ──────────────
  // resolveMember returns EXACTLY ONE member or nothing; see lib/kiosk/resolve.ts
  // for why an ambiguous name must resolve to nothing rather than to a list.
  const member_no = await resolveMember(who, a)

  // ONE attempt, ONE row, whatever the name matched. An unresolved name still goes
  // through kiosk_member_login so the failure costs the same bcrypt and is
  // indistinguishable from outside — it is simply pointed at a key no member holds.
  const { data: token } = await a.rpc('kiosk_member_login', {
    p_device_token: device, p_member_no: member_no ?? SENTINEL, p_pin: pin,
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
