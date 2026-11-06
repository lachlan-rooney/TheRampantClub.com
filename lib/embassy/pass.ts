import { createHmac, timingSafeEqual } from 'crypto'

// THE EMBASSY PASS — server-only.
//
// A guest scans the QR, leaves their name and email, and the cask board opens.
// This is the token that says "this browser completed the form".
//
// ── WHY THIS IS NOT THE TẾT PASSWORD ──────────────────────────────────────
// The club's Tết door is a shared password, and on the night of the shop
// launch it locked staff out of their own page: the field would not keep what
// was typed and the Enter button never enabled. The lesson stuck. This gate
// has no password and no secret to mistype — the form IS the key, and anyone
// willing to fill it in gets through. The worst case for a guest is that they
// type their name. Nobody can be locked out.
//
// A signature, not a session: nothing to look up, nothing to revoke per
// visitor, no personal data in it. Same shape as lib/tet/gate.

if (typeof window !== 'undefined') {
  throw new Error('lib/embassy/pass is server-only and must never reach the browser')
}

export const EMBASSY_PASS_COOKIE = 'trc_embassy'

/** Long enough that a guest browsing later that night is not asked twice. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

export const embassyPassOpts = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: Math.floor(TTL_MS / 1000),
}

function sign(payload: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set — the Embassy pass cannot be issued')
  return createHmac('sha256', secret).update(`embassy:${payload}`).digest('base64url')
}

/** `<expires>.<signature>` */
export function mintEmbassyPass(now = Date.now()): string {
  const exp = String(now + TTL_MS)
  return `${exp}.${sign(exp)}`
}

export function embassyPassValid(value: string | null | undefined, now = Date.now()): boolean {
  if (!value) return false
  const [exp, sig] = value.split('.')
  if (!exp || !sig) return false
  const expiry = Number(exp)
  if (!Number.isFinite(expiry) || expiry < now) return false
  let a: Buffer, b: Buffer
  try { a = Buffer.from(sig); b = Buffer.from(sign(exp)) } catch { return false }
  return a.length === b.length && timingSafeEqual(a, b)
}
