import { createHmac, timingSafeEqual } from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════
// THE TICKET — server-only.
// ───────────────────────────────────────────────────────────────────────────
// popup_bookings.ticket_code is eight hex characters, generated in Postgres and
// unique per event. That alone is unguessable enough to be a ticket. This adds
// the signature that makes the QR tamper-proof: a code pulled off someone
// else's screen is still just a code, but a code INVENTED by someone is
// refused before it ever reaches the database.
//
// Same shape as lib/embassy/pass and lib/tet/gate — one secret, one HMAC, no
// session to look up and no personal data inside it.
//
// ⚠ THE SIGNATURE IS A SECOND LOCK, NOT THE ONLY ONE. Staff can always type
// the eight characters by hand, and the door list works with neither. A guest
// whose phone is flat is still on the list under their own name. Nothing about
// getting into this pop-up depends on cryptography working on a Friday night.
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  throw new Error('lib/popup/ticket is server-only and must never reach the browser')
}

function secret(): string {
  const s = process.env.SUPABASE_JWT_SECRET
  if (!s) throw new Error('SUPABASE_JWT_SECRET is not set — a ticket cannot be signed')
  return s
}

/** Eight characters of signature is plenty against guessing a short code. */
function sign(eventSlug: string, code: string): string {
  return createHmac('sha256', secret())
    .update(`popup:${eventSlug}:${code}`)
    .digest('base64url')
    .slice(0, 12)
}

/** What the QR carries, and what staff could read aloud: CODE.SIGNATURE */
export function ticketToken(eventSlug: string, code: string): string {
  return `${code}.${sign(eventSlug, code)}`
}

/**
 * Pull the code back out of a scanned string.
 *
 * Accepts the bare eight-character code too, because that is what a member of
 * staff types when a camera will not focus — the signature is a convenience of
 * the QR, not a requirement of entry. A bare code returns `signed: false` so
 * the door can show that it was typed rather than scanned.
 */
export function readTicket(eventSlug: string, scanned: string): { code: string; signed: boolean } | null {
  const raw = (scanned || '').trim()
  if (!raw) return null

  // A full URL is fine too: the QR points at a page, and some scanners hand
  // back the whole address.
  const tail = raw.includes('/') ? raw.split('/').filter(Boolean).pop()! : raw
  const [code, sig] = tail.split('.')
  const clean = (code || '').toUpperCase().replace(/[^0-9A-F]/g, '')
  if (clean.length !== 8) return null

  if (!sig) return { code: clean, signed: false }

  const expect = Buffer.from(sign(eventSlug, clean))
  const given = Buffer.from(sig)
  // timingSafeEqual throws on a length mismatch, which is itself the answer.
  const ok = expect.length === given.length && timingSafeEqual(expect, given)
  return ok ? { code: clean, signed: true } : null
}

/** Where the QR points. Scanning it with a phone camera opens the ticket. */
export function ticketUrl(eventSlug: string, code: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  return `${site}/popup/t/${ticketToken(eventSlug, code)}`
}

// ── THE UNSUBSCRIBE LINK ──────────────────────────────────────────────────
// ⚠ SIGNED, AND IT CARRIES THE ADDRESS ITSELF, so the link works for somebody
// whose booking has been deleted and so one person's link can never
// unsubscribe another. Same secret, a different prefix, so an unsubscribe
// token and a ticket token can never be swapped for one another.
//
// It is deliberately NOT one-use: a guest who clicks it twice, or forwards the
// mail to a spouse who clicks it, must get the same quiet "you are off the
// list" both times rather than an error that reads like a refusal.
export function unsubToken(emailKey: string): string {
  const key = emailKey.toLowerCase().trim()
  const sig = createHmac('sha256', secret()).update(`popup-unsub:${key}`).digest('base64url').slice(0, 16)
  return `${Buffer.from(key).toString('base64url')}.${sig}`
}

export function readUnsub(token: string): string | null {
  const [b64, sig] = (token || '').split('.')
  if (!b64 || !sig) return null
  let key: string
  try { key = Buffer.from(b64, 'base64url').toString('utf8').toLowerCase().trim() } catch { return null }
  if (!key || key.length > 200) return null
  const expect = Buffer.from(createHmac('sha256', secret()).update(`popup-unsub:${key}`).digest('base64url').slice(0, 16))
  const given = Buffer.from(sig)
  return expect.length === given.length && timingSafeEqual(expect, given) ? key : null
}

export function unsubUrl(emailKey: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  return `${site}/api/popup/unsubscribe?t=${unsubToken(emailKey)}`
}
