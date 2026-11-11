import { createHash, randomUUID } from 'node:crypto'

// ═══════════════════════════════════════════════════════════════════════════
// THE DEVICE HANDLE — one cookie, three routes.
// ───────────────────────────────────────────────────────────────────────────
// A guest bidding from a QR code has no account, so there is nothing to key a
// rate limit to and nothing to recognise them by when they come back to the
// work later. This is that key: a random id we set in a cookie, stored only as
// a salted hash.
//
// ⚠ IT IS NOT A FINGERPRINT AND NOT AN IDENTIFIER. It is a value we generated
// ourselves, it is hashed before it is written, and it can be cleared by
// clearing cookies — which is the point. It does two jobs: slowing a script
// down, and letting the work say "you have been outbid" to the phone that bid.
//
// It lives here rather than in the bid route because the enquiry route and the
// "where do my bids stand" route must hash the SAME cookie the same way. Two
// copies of this three-line function would eventually disagree, and the
// symptom would be a guest whose own bids stop being recognised.
// ═══════════════════════════════════════════════════════════════════════════

export const BID_COOKIE = 'trc_bidder'

export const hashDevice = (v: string): string =>
  createHash('sha256').update(`${v}:${process.env.SUPABASE_JWT_SECRET || 'trc'}`).digest('hex')

/** The cookie we have, or a new one. `fresh` is set only when it must be sent. */
export function deviceFrom(existing: string | undefined): { device: string; fresh: string | null } {
  if (existing && existing.length >= 8) return { device: existing, fresh: null }
  const made = randomUUID()
  return { device: made, fresh: made }
}

export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
}
