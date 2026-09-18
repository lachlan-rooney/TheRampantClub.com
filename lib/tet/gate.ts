import { createHmac, timingSafeEqual } from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════
// THE TẾT DOOR — server-only.
// ───────────────────────────────────────────────────────────────────────────
// /tet is a public page behind an 18+ confirmation and a shared password. Once
// through, the visitor carries a signed pass in an httpOnly cookie.
//
// The pass is a signature, not a session: there is nothing to look up, nothing
// to revoke per visitor, and no personal data in it. Change the password in
// tet_access and the next person through gets a new pass; existing passes stay
// valid until they expire, which is the right behaviour for a leaflet code
// handed to a room of corporate buyers.
//
// Signed with SUPABASE_JWT_SECRET — the same tier as lib/kiosk/mint, server-only
// and never NEXT_PUBLIC_. A pass says only "this browser answered the door and
// confirmed 18+, until this timestamp".
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  throw new Error('lib/tet/gate is server-only and must never reach the browser')
}

export const TET_COOKIE = 'trc_tet'

/** Long enough that a buyer is not re-typing it mid-conversation, short enough
 *  that a shared laptop forgets. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

export const tetCookieOpts = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: Math.floor(TTL_MS / 1000),
}

function sign(payload: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set — the Tết door cannot issue a pass')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

/** `<expires>.<signature>` — the whole pass. */
export function mintTetPass(now = Date.now()): string {
  const exp = String(now + TTL_MS)
  return `${exp}.${sign(exp)}`
}

/** True only for a pass this server signed, which has not expired. */
export function tetPassValid(value: string | null | undefined, now = Date.now()): boolean {
  if (!value) return false
  const [exp, sig] = value.split('.')
  if (!exp || !sig) return false
  const expiry = Number(exp)
  if (!Number.isFinite(expiry) || expiry < now) return false
  // Compared byte-for-byte in constant time: a length-independent equality here
  // leaks, slowly, how much of a forged signature is right.
  let a: Buffer, b: Buffer
  try {
    a = Buffer.from(sig)
    b = Buffer.from(sign(exp))
  } catch { return false }
  return a.length === b.length && timingSafeEqual(a, b)
}
