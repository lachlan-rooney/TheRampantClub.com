import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE BODIES, SEALED.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-10-01: the members' page is to say "Private conversations, opened
// by an introduction. Staff see that introductions happen — they never read
// your messages… All messages are encrypted." — and then: "encrypt messages and
// prove they're encrypted."
//
// A sentence like that has to be true before it is printed, so this is what it
// means here, exactly.
//
// ── WHAT IS PROTECTED ─────────────────────────────────────────────────────
// A message body never sits in the database as text. A dump, a backup, a
// leaked service-role key, a mistaken RLS policy, a support engineer with a
// console — every one of those yields ciphertext. AES-256-GCM, a fresh 96-bit
// IV per message, and an authentication tag, so a body cannot be read OR
// altered without the key.
//
// ── WHAT IS NOT PROTECTED, said plainly ───────────────────────────────────
// This is encryption at rest with a server-held key, NOT end-to-end. The
// running application can read a message, because it has to: the member asks
// for their own thread and it must come back as words. Anyone holding the
// deployment's environment variables can therefore decrypt. That is the honest
// limit, and the copy must not claim past it.
//
// ── WHY TWO KEYS, AND WHY THAT MATTERS ────────────────────────────────────
// The same `messages` table carries two different promises:
//
//   · DIRECT    — member to member, opened by an introduction. The club says
//                 staff never read these.
//   · CONCIERGE — member to the club. Staff MUST read these; that is the point
//                 of the Concierge.
//
// One key for both would make "staff never read your messages" a matter of
// which query somebody happened to write. So there are two, and the staff
// Concierge code is given ONLY the concierge key. A direct message handed to
// it does not come back as text — it throws. The guarantee is in the shape of
// the code rather than in a promise about who looks.
//
// The scope is also bound into the ciphertext as additional authenticated
// data, with the thread id. So a sealed body cannot be moved from a direct
// thread into a concierge thread to be read — the tag will not verify.
//
// ── IF A KEY IS LOST ──────────────────────────────────────────────────────
// Every message sealed with it is unreadable, permanently. There is no
// recovery and that is the design. Keep both keys wherever the rest of the
// deployment's secrets live, and never rotate one without re-sealing first.
// ═══════════════════════════════════════════════════════════════════════════

export type Scope = 'direct' | 'concierge'

const VERSION = 'v1'
const IV_BYTES = 12
const KEY_BYTES = 32

const ENV: Record<Scope, string> = {
  direct: 'MSG_KEY_DIRECT',
  concierge: 'MSG_KEY_CONCIERGE',
}

/** The key for one scope, or a refusal. Never logged, never returned. */
function keyFor(scope: Scope): Buffer {
  const raw = process.env[ENV[scope]]
  if (!raw) throw new Error(`${ENV[scope]} is not set — message bodies cannot be sealed or opened`)
  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new Error(`${ENV[scope]} must be ${KEY_BYTES} bytes of base64 (got ${key.length})`)
  }
  return key
}

/** True when both keys are present and the right length — for a health check
 *  that must not reveal anything about them. */
export function keysReady(): boolean {
  try { keyFor('direct'); keyFor('concierge'); return true } catch { return false }
}

/** The bytes a tag is computed over besides the body: the scope and the thread.
 *  Moving a ciphertext between threads, or between scopes, breaks the tag. */
function aad(scope: Scope, threadId: string): Buffer {
  return Buffer.from(`${VERSION}:${scope}:${threadId}`, 'utf8')
}

/**
 * Seal a message body.
 *
 * The envelope is `v1.<scope>.<iv>.<tag>.<ciphertext>`, each part base64url.
 * The scope travels in the clear ON PURPOSE: a reader has to know which key to
 * try, and it is already authenticated by the tag, so it cannot be edited to
 * point at the other key.
 */
export function sealBody(plain: string, scope: Scope, threadId: string): string {
  const iv = randomBytes(IV_BYTES)
  const c = createCipheriv('aes-256-gcm', keyFor(scope), iv)
  c.setAAD(aad(scope, threadId))
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  const tag = c.getAuthTag()
  return [VERSION, scope, iv.toString('base64url'), tag.toString('base64url'), body.toString('base64url')].join('.')
}

/** Is this already sealed? Lets a reader carry rows written before this
 *  existed without pretending they were encrypted. */
export function isSealed(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^v1\.(direct|concierge)\./.test(value)
}

/**
 * Open a sealed body — ONLY in the scope asked for.
 *
 * @throws if the envelope belongs to another scope. This is the line that makes
 *   "staff never read your messages" structural: the Concierge opens with
 *   scope 'concierge', and a direct message handed to it does not come back as
 *   text, whatever the caller intended.
 * @throws if the tag does not verify — a tampered body is not half-read, it is
 *   refused.
 */
export function openBody(sealed: string, scope: Scope, threadId: string): string {
  const parts = sealed.split('.')
  if (parts.length !== 5 || parts[0] !== VERSION) throw new Error('not a sealed message body')
  const [, envScope, ivB, tagB, bodyB] = parts

  // Constant-time, so the error cannot be used to probe which scope a body is.
  const a = Buffer.from(envScope), b = Buffer.from(scope)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error(`this message is not readable here`)
  }

  const d = createDecipheriv('aes-256-gcm', keyFor(scope), Buffer.from(ivB, 'base64url'))
  d.setAAD(aad(scope, threadId))
  d.setAuthTag(Buffer.from(tagB, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(bodyB, 'base64url')), d.final()]).toString('utf8')
}

/**
 * What a reader should show when a body cannot be opened — a key missing, a
 * scope it may not read, a row from before this existed. It never throws, and
 * it never returns half a message.
 *
 * A thread that cannot be read says so. Silently dropping the line would make
 * a conversation look shorter than it was, which is worse than a gap that
 * explains itself.
 */
export function openBodySafe(sealed: string | null | undefined, scope: Scope, threadId: string): string {
  if (sealed == null) return ''
  if (!isSealed(sealed)) return sealed            // written before sealing; shown as it is
  try { return openBody(sealed, scope, threadId) } catch { return '' }
}
