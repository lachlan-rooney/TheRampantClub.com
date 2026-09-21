/**
 * Tết 2027 Programme — shared types
 *
 * These mirror the JSON shapes returned by the Postgres functions in
 * supabase/migrations/20260918120000_tet2027_foundations.sql and
 * supabase/migrations/20260918123000_tet2027_calendar.sql.
 *
 * There is deliberately no pricing arithmetic anywhere in the front end.
 * If you find yourself multiplying a cost by a margin in a component,
 * something has gone wrong: the cost should never have reached the
 * browser in the first place.
 */

export type OfferCategory = 'blend' | 'cask'

export type CaskStatus =
  | 'available'
  | 'reserved' // genuinely held back, with a recorded reason
  | 'pending' // a reservation request is in, awaiting confirmation
  | 'sold'
  | 'withdrawn'

export type BottlingStrength = 'cask_strength' | 'reduced'

export type ReservationStatus =
  | 'submitted'
  | 'contacted'
  | 'confirmed'
  | 'invoiced'
  | 'fulfilled'
  | 'cancelled'
  | 'lapsed'

export type Locale = 'en' | 'vn'

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export interface TetCategory {
  slug: 'duncan-taylor' | 'octave' | (string & {})
  kind: OfferCategory
  name_en: string
  name_vn: string
  standfirst_en: string | null
  standfirst_vn: string | null
  body_en: string | null
  body_vn: string | null
  accent_hex: string
  display_order: number
}

/* ------------------------------------------------------------------ */
/* Casks — the public board. No cost fields exist on this type.        */
/* ------------------------------------------------------------------ */

export interface CaskBoardRow {
  cask_ref: string
  distillery: string
  region: string
  vintage_year: number | null
  age_years: number
  cask_type: string
  wood: string | null
  cask_abv_pct: number
  status: CaskStatus
  tasting_note_en: string | null
  tasting_note_vn: string | null
  colour_hex: string | null
  image_path: string | null
  display_order: number
  is_placeholder: boolean

  bottles_cask_strength: number
  unit_vnd_cask_strength: number
  total_vnd_cask_strength: number

  bottles_reduced: number
  unit_vnd_reduced: number
  total_vnd_reduced: number

  /** bottles_reduced − bottles_cask_strength. The whole story of the offer. */
  extra_bottles: number

  /** 55%, the middle option (added 2026-09-18). On a cask already at or below
   *  55% these equal the cask-strength figures: there is no 55% bottling of a
   *  51% cask, and the board says so rather than inventing one. */
  bottles_55: number
  unit_vnd_55: number
  total_vnd_55: number
  extra_bottles_55: number

  /** 45% and 40% (added 2026-09-21). Same rule as 55%, and 40% is the floor:
   *  Scotch below 40% abv is not Scotch, and the quote refuses it. A board
   *  served before the migration has run simply has these absent — which is
   *  why every one of them is optional, and why the page checks. */
  bottles_45?: number | null
  unit_vnd_45?: number | null
  total_vnd_45?: number | null
  extra_bottles_45?: number | null

  bottles_40?: number | null
  unit_vnd_40?: number | null
  total_vnd_40?: number | null
  extra_bottles_40?: number | null
}

/** One row of the published tier ladder. Terms, not prices — these are the
 *  same four tiers that appear on the leaflet. */
export interface VolumeTier {
  label_en: string
  label_vn: string
  min_bottles: number
  max_bottles: number | null
  discount_pct: number
  sleeve_price_vnd: number
}

/** A blend as the browser may see it — no UK list price, no cost. */
export interface BlendBoardRow {
  sku: string
  name_en: string
  name_vn: string
  expression: string | null
  age_years: number | null
  abv_pct: number
  bottle_size_ml: number
  min_order_bottles: number
  display_order: number
  is_placeholder: boolean
  tier_min_bottles: number
  unit_vnd_with_sleeve: number | null
}

export interface CaskQuote {
  cask_ref: string
  distillery: string
  region: string
  age_years: number
  cask_abv_pct: number
  target_abv_pct: number
  is_cask_strength: boolean
  status: CaskStatus
  bottles: number
  bottles_at_cask_strength: number
  extra_bottles: number
  unit_inc_vat_vnd: number
  cask_total_vnd: number
  vat_pct: number
  currency: 'VND'
  is_placeholder: boolean
  pricing_version_id: string
  /** admin calls only — tet_quote_cask returns these three when p_admin is
   *  true (foundations §9b). They were missing from this type, so the Quote
   *  Builder could not read the margin the database was already sending. */
  landed_cost_vnd?: number
  gross_margin_pct?: number
  gross_profit_vnd?: number
}

/* ------------------------------------------------------------------ */
/* Blends                                                              */
/* ------------------------------------------------------------------ */

export interface BlendLineInput {
  sku: string
  qty: number
}

export interface BlendQuoteLine {
  sku: string
  name_en: string
  name_vn: string
  expression: string | null
  qty: number
  unit_ex_vat_vnd: number
  sleeve_vnd: number
  unit_inc_vat_vnd: number
  line_total_vnd: number
  is_placeholder: boolean
  /** admin calls only */
  landed_cost_vnd?: number
  gross_margin_pct?: number
}

export interface TierSummary {
  label_en: string
  label_vn: string
  discount_pct: number
  sleeve_price_vnd: number
}

export interface NextTier extends TierSummary {
  min_bottles: number
  /** how many more bottles to reach it — the honest version of an upsell */
  bottles_away: number
}

export interface BlendQuote {
  total_bottles: number
  tier: TierSummary
  next_tier: NextTier | null
  lines: BlendQuoteLine[]
  sleeve_selected: boolean
  setup_fee_vnd: number
  setup_fee_waived: boolean
  subtotal_vnd: number
  total_inc_vat_vnd: number
  vat_pct: number
  currency: 'VND'
  pricing_version_id: string
  /** admin calls only */
  total_cost_vnd?: number
  gross_profit_vnd?: number
}

export type QuoteError =
  | { error: 'empty_order' }
  | { error: 'below_minimum'; min_bottles: number; total_bottles: number }
  | { error: 'cask_not_found' }
  | { error: 'cask_unavailable'; status: CaskStatus }
  | { error: 'cannot_increase_strength' }
  | { error: 'below_legal_minimum_abv' }
  | { error: 'age_not_confirmed' }
  | { error: 'missing_contact' }
  | { error: 'no_active_programme' }

export function isQuoteError(v: unknown): v is QuoteError {
  return typeof v === 'object' && v !== null && 'error' in v
}

/* ------------------------------------------------------------------ */
/* Countdown                                                           */
/* ------------------------------------------------------------------ */

export interface Cutoff {
  date: string // ISO date
  days_remaining: number
  is_past: boolean
  overridden?: boolean
}

export interface Milestone {
  slug: string
  kind: string
  applies_to: OfferCategory | null
  name_en: string
  name_vn: string
  note_en: string | null
  note_vn: string | null
  due_at: string
  is_hard: boolean
  days_remaining: number
}

export interface Countdown {
  season: string
  timezone: string
  now: string
  festival_date: string
  days_to_festival: number
  in_hand_date: string
  cutoffs: {
    cask: Cutoff
    blend: Cutoff
    artwork: Cutoff
  }
  next_gate: {
    kind: string
    applies_to: string
    cutoff_date: string
    days_remaining: number
  } | null
  milestones: Milestone[]
  is_placeholder: boolean
}

/* ------------------------------------------------------------------ */
/* Reservations                                                        */
/* ------------------------------------------------------------------ */

export interface Personalisation {
  company_name?: string
  logo_path?: string
  tet_message_en?: string
  tet_message_vn?: string
  box?: 'sleeve' | 'gift_box' | 'none'
}

export interface DeliverySplit {
  label: string
  qty: number
  address: string
  recipient?: string
  phone?: string
}

export interface ReservationContact {
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  tax_code?: string
  /** 18+ gate. The database rejects a reservation without it. */
  age_confirmed: boolean
  locale?: Locale
  source?: string
}

export interface ReservationReceipt {
  reference: string
  status: ReservationStatus
  cask_ref?: string
  quote: CaskQuote | BlendQuote
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

export function vnd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  return vndFormatter.format(amount)
}

/** Compact form for dense grids: 1,635,000 → "1.64tr" */
export function vndShort(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}tr`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`
  return String(amount)
}

export function pct(fraction: number | null | undefined, dp = 0): string {
  if (fraction == null || Number.isNaN(fraction)) return '—'
  return `${(fraction * 100).toFixed(dp)}%`
}
