// ═══════════════════════════════════════════════════════════════════════════
// WHAT AN EVENT IS — one place, so the vocabulary cannot drift apart.
// ───────────────────────────────────────────────────────────────────────────
// `fixtures` used to carry `sport`, NOT NULL, golf|tennis|padel|hash|other. Every
// whisky dinner therefore went in as 'other', so the column said nothing and
// could not be filtered. It is now `type`, and it covers what the club actually
// runs — see db/fixtures_type.sql.
//
// House events live in this table rather than in calendar_entries because they
// need RSVPs with a cap, and the capacity machinery (fixture_signups, the
// FOR UPDATE lock in fixture_signup(), the deadline check) exists here and is
// proven. A second copy would have to be hardened a second time.
export const SPORT_TYPES = ['golf', 'tennis', 'padel', 'hash'] as const
export const HOUSE_TYPES = ['dinner', 'tasting', 'social', 'other'] as const
export const FIXTURE_TYPES = [...SPORT_TYPES, ...HOUSE_TYPES] as const
export type FixtureType = typeof FIXTURE_TYPES[number]

/** Sports appear on the PUBLIC /sports page; house events must never be counted
 *  there. This is the one predicate that decides it. */
export const isSport = (t: string | null | undefined): boolean =>
  (SPORT_TYPES as readonly string[]).includes(t || '')

export const TYPE_LABEL: Record<string, string> = {
  golf: 'Golf', tennis: 'Tennis', padel: 'Padel', hash: 'Hash',
  dinner: 'Dinner', tasting: 'Tasting', social: 'Social', other: 'Other',
}

export const TYPE_LABEL_VN: Record<string, string> = {
  golf: 'Golf', tennis: 'Quần vợt', padel: 'Padel', hash: 'Hash',
  dinner: 'Bữa tối', tasting: 'Nếm thử', social: 'Giao lưu', other: 'Khác',
}

// The four sports keep the colours they have always had; the house types take
// warmer tones so a dinner never reads as a fixture at a glance.
export const TYPE_COLOR: Record<string, string> = {
  golf: '#5E6650', tennis: '#28483C', padel: '#B2AA98', hash: '#052E20',
  dinner: '#6E4A2E', tasting: '#7A5C2E', social: '#4A3A5E', other: '#221E20',
}

/** Ring colour for the member calendar dots. */
export const TYPE_RING: Record<string, string> = {
  golf: '#5E6650', tennis: '#28483C', padel: '#B2AA98', hash: '#E5D4C2',
  dinner: '#C79A6B', tasting: '#D4B85A', social: '#9E8FC4', other: '#D4B85A',
}

/** Display name for a type, falling back to the raw value so an unknown type
 *  shows something rather than an empty badge. */
// NOTE: the admin language context uses 'vi' and lib/members/surfaces.ts uses
// 'vn'. Both are accepted here so neither caller has to translate its own
// language code on the way in.
export const typeLabel = (t: string | null | undefined, lang: 'en' | 'vi' | 'vn' = 'en'): string => {
  const k = t || 'other'
  const vi = lang === 'vi' || lang === 'vn'
  return (vi ? TYPE_LABEL_VN[k] : TYPE_LABEL[k]) || (k.charAt(0).toUpperCase() + k.slice(1))
}
