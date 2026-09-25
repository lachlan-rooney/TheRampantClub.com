import { createHmac, timingSafeEqual } from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════
// THE SHOWCASE DOOR — server-only.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: "Can you give me a fake kiosk URL to share with shawn so
// that he can see how it works? It will just be a showcase version and not a
// real kiosk."
//
// WHY NOT JUST PAIR HIM A DEVICE. A kiosk token is a real device: it can send
// real orders to the floor board, it stamps last_seen, and it sits in
// kiosk_devices next to the four tablets the club actually runs. A demo that
// can ring the kitchen is not a demo. This is a separate door into a separate,
// read-only page, and the kiosk's own gate is untouched.
//
// The pass is a signature, not a session — the same shape as the Tết door: no
// row to look up, no personal data in it, and nothing to revoke per visitor.
// Signed with SUPABASE_JWT_SECRET, which is server-only and never
// NEXT_PUBLIC_. It says only "this browser was given the link, until this
// timestamp".
//
// LONG ENOUGH TO BE USEFUL, SHORT ENOUGH TO EXPIRE. Sixty days: a link sent to
// someone to look at once should not still open the club's menus next year.
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  throw new Error('lib/showcase/gate is server-only and must never reach the browser')
}

export const SHOWCASE_COOKIE = 'trc_showcase'
const TTL_MS = 60 * 24 * 60 * 60 * 1000

export const showcaseCookieOpts = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: Math.floor(TTL_MS / 1000),
}

const secret = () => {
  const s = process.env.SUPABASE_JWT_SECRET
  if (!s) throw new Error('SUPABASE_JWT_SECRET is not set')
  return s
}

const sign = (exp: string) => createHmac('sha256', secret()).update(exp).digest('base64url')

/** A pass to put in the link, and then in the cookie. */
export function mintShowcasePass(ttlMs = TTL_MS): string {
  const exp = String(Date.now() + ttlMs)
  return `${exp}.${sign(exp)}`
}

/** True only for a pass this server signed, that has not run out. */
export function verifyShowcasePass(pass: string | undefined | null): boolean {
  if (!pass) return false
  const [exp, sig] = String(pass).split('.')
  if (!exp || !sig) return false
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false
  const want = Buffer.from(sign(exp))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got)
}
