// Matching a member by the name they'd say out loud.
//
// TWO THINGS VIETNAMESE NAMES BREAK IF YOU IGNORE THEM:
//  1. Diacritics. "Nguyễn" typed as "Nguyen" must match. NFD decomposition handles
//     the tone and vowel marks, but NOT đ/Đ — that is a distinct letter, not a d
//     with a mark, so it survives normalisation and needs an explicit map.
//  2. Name ORDER. Vietnamese puts the family name FIRST (Nguyễn Văn Bình → Nguyễn),
//     Western order puts it last. Rather than guess which convention a given row
//     follows, match ANY token of the name. The PIN is the barrier; the name is
//     only how we find who to check it against.
export function normaliseName(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining tone/vowel marks
    .replace(/[\u0111\u0110]/g, 'd')   // đ / Đ — a distinct letter, not a marked d
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** Every token of a member's name, normalised — family name first or last. */
export function nameTokens(fullName?: string | null, nickname?: string | null): string[] {
  const out = new Set<string>()
  for (const src of [fullName, nickname]) {
    for (const t of (src || '').split(/\s+/)) {
      const n = normaliseName(t)
      if (n.length >= 2) out.add(n)
    }
  }
  return [...out]
}
