import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// The double-blind hinge. A's match list carries an opaque TOKEN per candidate —
// the candidate's uid, AES-256-GCM encrypted with a server-only key and bound to
// the requester (AAD). A's client can express interest against the token but can
// NEVER reverse it to B's identity; the server decrypts it (and only for the same
// requester). Stateless — no token table.

const KEY = createHash('sha256').update((process.env.SUPABASE_SERVICE_ROLE_KEY || '') + ':palate-twins').digest()

export function encryptMatch(requesterId: string, targetId: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', KEY, iv)
  c.setAAD(Buffer.from(requesterId))
  const ct = Buffer.concat([c.update(targetId, 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url')
}

// Returns the target uid, or null if the token is malformed / tampered / not this
// requester's (AAD mismatch → auth tag fails).
export function decryptMatch(requesterId: string, token: string): string | null {
  try {
    const buf = Buffer.from(token, 'base64url')
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28)
    const d = createDecipheriv('aes-256-gcm', KEY, iv)
    d.setAAD(Buffer.from(requesterId))
    d.setAuthTag(tag)
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
  } catch { return null }
}
