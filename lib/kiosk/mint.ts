// ═══════════════════════════════════════════════════════════════════════════
// THE MEMBER JWT MINT — the ONLY place a token is signed. Server-only.
// ───────────────────────────────────────────────────────────────────────────
// A kiosk member session is an OPAQUE token on the tablet. This turns a resolved
// identity into a 60-second Supabase-compatible JWT so the request runs AS THAT
// MEMBER against the member-own RLS proven in S0–S2d. The JWT is minted per
// request and NEVER leaves the server — the browser only ever holds the opaque
// handle, which is what makes account-level GoTrue calls unreachable from the
// tablet and a lifted token useless.
//
// SUPABASE_JWT_SECRET mints a token as ANY user. It sits in the same tier as the
// service-role key: server-only, never NEXT_PUBLIC_, never sent to a client.
//
// SWAPPABLE SIGNING: Supabase is migrating projects to asymmetric signing keys.
// If this project migrates, ONLY `sign()` and the header change — ES256/RS256 with
// a private key and a `kid` matching the project's JWKS. Claims, TTL and every
// caller stay exactly as they are. That is why the mint lives behind one function.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from 'crypto'

// `server-only` isn't a dependency here, so guard at import time instead. A
// client bundle importing this is a loud crash, not a silent undefined secret.
if (typeof window !== 'undefined') {
  throw new Error('lib/kiosk/mint is server-only and must never reach the browser')
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** HS256 today. The one seam to change if the project moves to JWKS. */
function sign(signingInput: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set — the kiosk member session cannot be minted')
  return b64u(createHmac('sha256', secret).update(signingInput).digest())
}

/**
 * Mint a short-lived member identity token.
 *
 * `exp` is NOT optional and never can be: the probe established that this project
 * ACCEPTS a token carrying no exp claim, and such a token never expires. The TTL
 * is the only thing standing between a minted identity and a permanent one.
 * (Verification also allows ~60s of clock-skew leeway, so a 60s token may be
 * honoured for up to ~120s. Immaterial: session lifetime is enforced by
 * kiosk_member_touch in Postgres, not by this token.)
 */
export function mintMemberJwt(profileId: string, ttlSeconds = 60): string {
  if (!profileId) throw new Error('mintMemberJwt: no profile id')
  const now = Math.floor(Date.now() / 1000)
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64u(JSON.stringify({
    sub: profileId,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: now + ttlSeconds,        // never optional — see above
    kiosk: true,                  // marks provenance; carries no privilege
  }))
  const body = `${header}.${payload}`
  return `${body}.${sign(body)}`
}
