// Shared types and constants for the gifting feature.

export const OCCASIONS = [
  'birthday',
  'anniversary',
  'thoughtful',
  'apology',
  'recovery',
  'dining_moment',
  'referral_thanks',
  'other',
] as const

export type Occasion = typeof OCCASIONS[number]

export const OCCASION_LABELS: Record<Occasion, string> = {
  birthday:         'Birthday',
  anniversary:      'Membership anniversary',
  thoughtful:       'Thoughtful gesture',
  apology:          'Apology',
  recovery:         'Recovery / service moment',
  dining_moment:    'Dining moment',
  referral_thanks:  'Referral thank-you',
  other:            'Other',
}

export const CATEGORIES = [
  'bottle', 'experience', 'dining', 'accommodation', 'merchandise', 'service', 'other',
] as const

export type Category = typeof CATEGORIES[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  bottle:        'Bottle',
  experience:    'Experience',
  dining:        'Dining',
  accommodation: 'Accommodation',
  merchandise:   'Merchandise',
  service:       'Service',
  other:         'Other',
}

export function formatVnd(v: number | string | null | undefined): string {
  const n = Number(v) || 0
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₫`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k ₫`
  return `${n} ₫`
}

export function percentUsed(spent: number, budget: number): number {
  if (!budget) return 0
  return Math.min(100, Math.round((spent / budget) * 100))
}
