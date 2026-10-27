import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { svc, DEVICE_COOKIE, deviceCookieOpts } from '@/lib/kiosk/server'

// PAIR BY OPENING A LINK. No JavaScript, no form, no button.
//
// Built 2026-10-27, during a launch setup, after a tablet could not be paired
// three ways running. The failures were all in the BROWSER, not the handshake:
// the keyboard did not reach the input, so the submit button stayed disabled;
// the soft keyboard buried the button; and a cached JS bundle meant even the
// ?code= auto-pair never ran, because the cached page did not contain it.
//
// This is a GET route. The server does the pairing and sets the cookie on a
// redirect, so nothing depends on the tablet's JavaScript being current, on a
// keyboard appearing, or on a tap landing anywhere. A stale service worker
// cannot serve a stale version of a route that has no client bundle.
//
//   /kiosk/pair/go?code=1234
//
// SECURITY: identical to posting the same code to /api/kiosk/pair — the same
// RPC, the same one-use code, the same expiry, the same httpOnly cookie. A
// pairing code in a URL is no weaker than one typed into a box on the same
// device; it is useless once used and useless after it expires.
//
// ⚠ A GET that changes state is normally wrong, and it is a deliberate
//   exception here: a kiosk being enrolled by a member of staff who is
//   standing at it, with a code only they have. It is not linkable from
//   anywhere and it is not idempotent by nature — the code dies on use.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = (url.searchParams.get('code') || '').trim().toUpperCase()
  const back = (msg: string) =>
    NextResponse.redirect(new URL(`/kiosk/pair?e=${encodeURIComponent(msg)}`, url.origin))

  if (!code) return back('Add ?code= to the link.')

  const { data: token } = await svc().rpc('kiosk_pair_device', { p_code: code })
  if (!token) return back('That code is used or expired. Ask for a new one.')

  const hash = createHash('sha256').update(token as string).digest('hex')
  let purpose: string | null = null
  const dev = await svc().from('kiosk_devices').select('purpose').eq('token_hash', hash).maybeSingle()
  if (!dev.error) purpose = dev.data?.purpose ?? null

  // Land somewhere useful, and let the destination be chosen in the link so a
  // shop kiosk can go straight to its own page rather than the club board.
  const next = url.searchParams.get('next')
    || (purpose === 'door' ? '/kiosk/door' : '/kiosk/board')

  const res = NextResponse.redirect(new URL(next, url.origin))
  res.cookies.set(DEVICE_COOKIE, token as string, deviceCookieOpts)
  return res
}
