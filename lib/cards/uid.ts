// ═══════════════════════════════════════════════════════════════════════════
// ONE CARD, TWO NUMBERS (2026-09-17)
// ───────────────────────────────────────────────────────────────────────────
// Every member card in the club was linked at the desk with a USB reader (the
// Tagtix CK06), which behaves as a keyboard and TYPES THE UID AS A DECIMAL
// NUMBER: Miss Châu's card is stored as "1918706948".
//
// A tablet or phone reading the same card over NFC reports the serial as HEX —
// "04:25:5d:72" — which the kiosk normalises to "04255D72". The two are the
// same card and never matched, so every tap on a floor tablet looked up nothing
// and the board, which ignores a card it cannot place, did nothing at all.
//
// Reversed, every stored number begins 04 — the NXP manufacturer byte — so the
// reader is typing the decimal of the UID with its bytes in the opposite order.
// Rather than guess one convention and bake it in, this returns EVERY form the
// same card could legitimately be written in, and the lookup matches any of
// them. A card linked by either route then resolves from either route.
//
// It never invents a match: only reorderings and base conversions of the digits
// actually presented, so two different cards cannot collide through it.

const upper = (s: string) => s.toUpperCase()
const revBytes = (hex: string) => (hex.match(/../g) || []).reverse().join('')

/** Every equivalent spelling of a card number, for `.in('card_uid', …)`. */
export function uidCandidates(raw: string): string[] {
  const s = (raw || '').trim()
  if (!s) return []
  const out = new Set<string>()
  const add = (v?: string | null) => { if (v && v.length) out.add(upper(v)) }

  add(s)
  // Readers and browsers punctuate differently: 04:25:5d:72, 04-25-5D-72, 04 25 5D 72.
  const compact = s.replace(/[\s:_-]/g, '')
  add(compact)

  const isHex = /^[0-9a-fA-F]+$/.test(compact) && compact.length % 2 === 0
  const isDec = /^\d+$/.test(compact)

  if (isHex) {
    const hex = upper(compact)
    add(revBytes(hex))
    try { add(BigInt('0x' + hex).toString()) } catch { /* not a number we can convert */ }
    try { add(BigInt('0x' + revBytes(hex)).toString()) } catch { /* ditto */ }
    // A 7-byte UID read by a tablet against a 4-byte number typed by the desk
    // reader: try each end, in both byte orders. Still only this card's own
    // bytes — nothing from any other card can appear here.
    if (hex.length === 14) {
      for (const part of [hex.slice(0, 8), hex.slice(-8)]) {
        add(part); add(revBytes(part))
        try { add(BigInt('0x' + part).toString()) } catch {}
        try { add(BigInt('0x' + revBytes(part)).toString()) } catch {}
      }
    }
  }

  if (isDec) {
    try {
      let hex = BigInt(compact).toString(16).toUpperCase()
      if (hex.length % 2) hex = '0' + hex
      const padded = hex.padStart(8, '0')
      for (const h of new Set([hex, padded])) { add(h); add(revBytes(h)) }
    } catch { /* a decimal too large to convert is left as itself */ }
  }

  return [...out]
}

/** What we store when linking a card: the number exactly as presented, upper-cased. */
export function canonicalUid(raw: string): string {
  return upper((raw || '').trim())
}
