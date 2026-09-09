import { createHmac, timingSafeEqual } from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════
// THE ACTING-STAFF IDENTITY, SIGNED.  (Pure — no request context, so it can be
// exercised directly by scripts/verify-shift-ownership.mts.)
// ───────────────────────────────────────────────────────────────────────────
// trc_admin_staff says WHO IS AT THE DESK. It is set only after a verified PIN
// and it is httpOnly, so page scripts cannot read or write it.
//
// That is not the same as unforgeable. The value used to be the bare
// team_members.id, and httpOnly only constrains a BROWSER — any HTTP client can
// put whatever it likes in a Cookie header. The shifts route is admin-gated, so
// a forger must be a signed-in admin; but all five shift staff are signed-in
// admins. "Nobody ticks anyone else's box" would have been a rule a one-line
// curl could step around — the same shape of mistake as passing the actor to
// shift_task_update as a parameter.
//
// So the value is now id.HMAC(id), secret server-side only. A cookie that does
// not verify is treated as ABSENT: the person picks their name and enters their
// PIN again, which is the right outcome for a value we cannot vouch for.
export const ACTING_COOKIE = 'trc_admin_staff'

const secret = () => {
  const s = process.env.SUPABASE_JWT_SECRET
  // Fail closed. Without the secret we cannot tell a real identity from a forged
  // one, and guessing in that situation is how attribution rots.
  if (!s) throw new Error('SUPABASE_JWT_SECRET missing — cannot sign the acting identity')
  return s
}

const tag = (id: string) => createHmac('sha256', secret()).update(`acting:${id}`).digest('base64url')

export const signActor = (id: string) => `${id}.${tag(id)}`

/** The acting team_members.id, or null if absent, malformed, or not ours. */
export function verifyActor(raw: string | undefined | null): string | null {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null                       // unsigned legacy value → re-pick
  const id = raw.slice(0, dot)
  const got = Buffer.from(raw.slice(dot + 1))
  const want = Buffer.from(tag(id))
  if (got.length !== want.length) return null
  return timingSafeEqual(got, want) ? id : null
}
