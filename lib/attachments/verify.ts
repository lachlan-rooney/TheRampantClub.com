// ═══════════════════════════════════════════════════════════════════════════
// WHAT IS THIS FILE, ACTUALLY? — decided by its bytes, never by its name.
// ───────────────────────────────────────────────────────────────────────────
// A file called invitation.jpg that is really HTML, served from our own origin,
// is stored XSS. These files come from OUTSIDE PARTNERS, which is precisely the
// untrusted case, and the browser's Content-Type is whatever the uploader says
// it is. So the extension and the declared type are both ignored; the first few
// bytes decide.
export type VerifiedKind = 'jpeg' | 'png' | 'webp' | 'pdf'

export const MIME_OF: Record<VerifiedKind, string> = {
  jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
}
export const EXT_OF: Record<VerifiedKind, string> = {
  jpeg: 'jpg', png: 'png', webp: 'webp', pdf: 'pdf',
}

export const MAX_BYTES = 5 * 1024 * 1024   // 5MB — an invitation is well under 2MB;
                                           // a partner will eventually send a 40MB export.

const starts = (b: Uint8Array, sig: number[], at = 0) =>
  sig.every((v, i) => b[at + i] === v)

/** The kind, or null if it is not one of the four we accept. */
export function sniff(buf: Uint8Array): VerifiedKind | null {
  if (buf.length < 12) return null
  // JPEG  FF D8 FF
  if (starts(buf, [0xff, 0xd8, 0xff])) return 'jpeg'
  // PNG   89 50 4E 47 0D 0A 1A 0A
  if (starts(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  // WEBP  'RIFF' ....  'WEBP'
  if (starts(buf, [0x52, 0x49, 0x46, 0x46]) && starts(buf, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp'
  // PDF   '%PDF-'
  if (starts(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'
  return null
}

/** A message a staff member can act on, not a stack trace. */
export const REFUSAL = {
  tooBig: (n: number) =>
    `That file is ${(n / 1048576).toFixed(1)}MB. The limit is 5MB — ask for a smaller export, or a JPEG rather than a PDF.`,
  wrongKind:
    'That file is not a JPEG, PNG, WebP or PDF. Renaming a file does not change what it is — check what was actually sent.',
  unreadable:
    'That file says it is an image but could not be read. It may be corrupt, or not what its name suggests.',
  badPdf:
    'That PDF could not be read. It may be corrupt, or password-protected.',
} as const
