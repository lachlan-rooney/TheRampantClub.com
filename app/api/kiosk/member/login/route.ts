import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, deviceOk, DEVICE_COOKIE, MEMBER_COOKIE, STAFF_COOKIE, memberCookieOpts } from '@/lib/kiosk/server'
import { normaliseName, nameTokens } from '@/lib/kiosk/names'

// PIN → member session. The DB function returns the opaque token, or null for
// EVERY failure: wrong PIN, unknown member, no PIN set, locked out, dead device,
// unlinked profile. This route must not add a distinction the DB refused to make,
// so there is exactly one error message and one status code.

export const dynamic = 'force-dynamic'

/** Members should not have to type "TRC-M". Accepts 1 · 001 · M1 · TRC-M001. */
export function normaliseMemberNo(raw: string): string {
  const v = raw.trim().toUpperCase().replace(/\s+/g, '')
  const digits = v.replace(/^TRC-?M?/, '').replace(/^M/, '')
  if (/^\d{1,3}$/.test(digits)) return `TRC-M${digits.padStart(3, '0')}`
  return v
}

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

  // Resolve who to check the PIN against. A bare number still works; otherwise the
  // typed word is matched against any token of a member's name.
  let candidates: string[] = []
  const asNo = normaliseMemberNo(who)
  if (/^TRC-M\d{3}$/.test(asNo)) {
    candidates = [asNo]
  } else {
    const needle = normaliseName(who)
    if (needle.length >= 2) {
      const { data: all } = await a.from('members').select('member_no, full_name, nickname')
      candidates = (all || [])
        .filter(m => nameTokens(m.full_name, m.nickname).includes(needle))
        .map(m => m.member_no)
    }
  }

  // Try each candidate. A shared surname is common here, so more than one is normal;
  // the PIN decides. Every failure is recorded against that member's own number, so
  // lockout stays keyed to the membership number and not to the device.
  let token: string | null = null
  for (const member_no of candidates) {
    const { data: t } = await a.rpc('kiosk_member_login', {
      p_device_token: device, p_member_no: member_no, p_pin: pin,
    })
    if (t) { token = t as string; break }
  }

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
