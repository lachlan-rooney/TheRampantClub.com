/**
 * Tết 2027 Programme — data access
 *
 * Every function here is a thin wrapper over a Postgres function or view.
 * The rules this file exists to enforce:
 *
 *   1. The browser calls only the *_public RPCs and the two board views.
 *      Those return finished VND prices and nothing else.
 *   2. Cost, margin and gross profit come only from the admin helpers at
 *      the bottom, which require the service-role client and must never
 *      be imported into a client component. They carry `import 'server-only'`
 *      at the point of use for exactly that reason.
 *   3. No price is ever computed here. If a number is not in the response,
 *      the answer is to change the SQL, not to compute it in TypeScript.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BlendBoardRow,
  BlendLineInput,
  BlendQuote,
  CaskBoardRow,
  CaskQuote,
  Countdown,
  DeliverySplit,
  OfferCategory,
  Personalisation,
  QuoteError,
  ReservationContact,
  ReservationReceipt,
  TetCategory,
  VolumeTier,
} from './types'
import { isQuoteError } from './types'

type DB = SupabaseClient<any, 'public', any>

/* ================================================================== */
/*  READ — safe for anon / the browser                                 */
/* ================================================================== */

export async function getCategories(db: DB): Promise<TetCategory[]> {
  const { data, error } = await db
    .from('tet_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order')
  if (error) throw error
  return (data ?? []) as TetCategory[]
}

/**
 * The cask grid. Returns all fourteen, priced at both strengths,
 * including the ones that are held back — the board is meant to show
 * what is gone as well as what is there. Status is live: a cask that
 * moves to 'pending' stops being selectable for everyone at once.
 */
export async function getCaskBoard(db: DB): Promise<CaskBoardRow[]> {
  const { data, error } = await db
    .from('tet_cask_board')
    .select('*')
    .order('display_order')
  if (error) throw error
  return (data ?? []) as CaskBoardRow[]
}

/**
 * The blends, one row per SKU per tier (the view is a deliberate cross join,
 * so a page can show the ladder). Deduplicated to one row per SKU here, at the
 * lowest tier, because that is what a page lists.
 */
export async function getBlendBoard(db: DB): Promise<BlendBoardRow[]> {
  const { data, error } = await db
    .from('tet_blend_board')
    .select('*')
    .order('display_order')
    .order('tier_min_bottles')
  if (error) throw error
  const seen = new Set<string>()
  return ((data ?? []) as BlendBoardRow[]).filter(r => !seen.has(r.sku) && seen.add(r.sku))
}

/** The published tier ladder. Terms rather than prices, so it shows even while
 *  every per-bottle figure is still a placeholder. */
export async function getTiers(db: DB): Promise<VolumeTier[]> {
  const { data, error } = await db
    .from('tet_volume_tiers')
    .select('label_en, label_vn, min_bottles, max_bottles, discount_pct, sleeve_price_vnd')
    .order('min_bottles')
  if (error) throw error
  return (data ?? []) as VolumeTier[]
}

export async function getCask(
  db: DB,
  caskRef: string,
): Promise<CaskBoardRow | null> {
  const { data, error } = await db
    .from('tet_cask_board')
    .select('*')
    .eq('cask_ref', caskRef)
    .maybeSingle()
  if (error) throw error
  return (data as CaskBoardRow) ?? null
}

/* ================================================================== */
/*  QUOTE                                                              */
/* ================================================================== */

/**
 * Price a cask at a chosen strength.
 * @param targetAbv null for cask strength, 50 for the reduced bottling.
 */
export async function quoteCask(
  db: DB,
  caskRef: string,
  targetAbv: number | null,
): Promise<CaskQuote | QuoteError> {
  const { data, error } = await db.rpc('tet_quote_cask_public', {
    p_cask_ref: caskRef,
    p_target_abv: targetAbv,
  })
  if (error) throw error
  return data as CaskQuote | QuoteError
}

/**
 * Price a blend order. The tier is set by the total across all SKUs, so
 * a customer may mix 5 Star, 12 and 18 and still climb a tier.
 */
export async function quoteBlends(
  db: DB,
  lines: BlendLineInput[],
  withSleeve = true,
): Promise<BlendQuote | QuoteError> {
  const { data, error } = await db.rpc('tet_quote_blends_public', {
    p_lines: lines,
    p_sleeve: withSleeve,
  })
  if (error) throw error
  return data as BlendQuote | QuoteError
}

/* ================================================================== */
/*  COUNTDOWN                                                          */
/* ================================================================== */

/**
 * The last order dates, derived from the lead times in tet_programme.
 * Not a marketing number — move a lead time and this moves with it.
 */
export async function getCountdown(db: DB): Promise<Countdown> {
  const { data, error } = await db.rpc('tet_countdown')
  if (error) throw error
  if (isQuoteError(data)) throw new Error('No active Tết programme configured')
  return data as Countdown
}

export async function isOrderingOpen(
  db: DB,
  kind: OfferCategory,
): Promise<boolean> {
  const { data, error } = await db.rpc('tet_ordering_open', { p_kind: kind })
  if (error) throw error
  return Boolean(data)
}

/**
 * Client-side ticking display. Takes the server's cut-off date and the
 * server's clock, so a customer with a wrong system clock still sees the
 * true remaining time. Recompute on an interval; do not trust Date.now()
 * alone for the gate itself — the gate is enforced in the database.
 */
export function timeRemaining(
  cutoffISODate: string,
  serverNowISO: string,
  clientNow: number = Date.now(),
  clientAtFetch: number = Date.now(),
): { days: number; hours: number; minutes: number; seconds: number; past: boolean } {
  const skew = new Date(serverNowISO).getTime() - clientAtFetch
  const now = clientNow + skew
  // Cut-offs are end-of-day in Ho Chi Minh City (UTC+7).
  const target = new Date(`${cutoffISODate}T23:59:59+07:00`).getTime()
  let delta = Math.floor((target - now) / 1000)
  const past = delta <= 0
  if (past) delta = 0
  return {
    days: Math.floor(delta / 86400),
    hours: Math.floor((delta % 86400) / 3600),
    minutes: Math.floor((delta % 3600) / 60),
    seconds: delta % 60,
    past,
  }
}

/* ================================================================== */
/*  RESERVE — reserve, never sell                                      */
/* ================================================================== */

export async function reserveCask(
  db: DB,
  args: {
    caskRef: string
    targetAbv: number | null
    contact: ReservationContact
    personalisation?: Personalisation
    splitDelivery?: DeliverySplit[]
  },
): Promise<ReservationReceipt | QuoteError> {
  const { data, error } = await db.rpc('tet_reserve_cask', {
    p_cask_ref: args.caskRef,
    p_target_abv: args.targetAbv,
    p_company: args.contact.company_name,
    p_contact_name: args.contact.contact_name,
    p_contact_email: args.contact.contact_email,
    p_contact_phone: args.contact.contact_phone ?? null,
    p_tax_code: args.contact.tax_code ?? null,
    p_personalisation: args.personalisation ?? {},
    p_split_delivery: args.splitDelivery ?? [],
    p_age_confirmed: args.contact.age_confirmed,
    p_locale: args.contact.locale ?? 'en',
    p_source: args.contact.source ?? null,
  })
  if (error) throw error
  return data as ReservationReceipt | QuoteError
}

export async function reserveBlends(
  db: DB,
  args: {
    lines: BlendLineInput[]
    withSleeve: boolean
    contact: ReservationContact
    personalisation?: Personalisation
    splitDelivery?: DeliverySplit[]
  },
): Promise<ReservationReceipt | QuoteError> {
  const { data, error } = await db.rpc('tet_reserve_blends', {
    p_lines: args.lines,
    p_sleeve: args.withSleeve,
    p_company: args.contact.company_name,
    p_contact_name: args.contact.contact_name,
    p_contact_email: args.contact.contact_email,
    p_contact_phone: args.contact.contact_phone ?? null,
    p_tax_code: args.contact.tax_code ?? null,
    p_personalisation: args.personalisation ?? {},
    p_split_delivery: args.splitDelivery ?? [],
    p_age_confirmed: args.contact.age_confirmed,
    p_locale: args.contact.locale ?? 'en',
    p_source: args.contact.source ?? null,
  })
  if (error) throw error
  return data as ReservationReceipt | QuoteError
}

/* ================================================================== */
/*  ADMIN — service-role only. Never import into a client component.   */
/* ================================================================== */

/**
 * The internal Quote Builder. Returns landed cost, gross margin per line
 * and gross profit on the order. Requires a service-role client.
 *
 * Put `import 'server-only'` at the top of any module that calls these.
 */
export async function quoteBlendsAdmin(
  adminDb: DB,
  lines: BlendLineInput[],
  withSleeve = true,
): Promise<BlendQuote | QuoteError> {
  const { data, error } = await adminDb.rpc('tet_quote_blends', {
    p_lines: lines,
    p_sleeve: withSleeve,
    p_admin: true,
  })
  if (error) throw error
  return data as BlendQuote | QuoteError
}

export async function quoteCaskAdmin(
  adminDb: DB,
  caskRef: string,
  targetAbv: number | null,
): Promise<CaskQuote | QuoteError> {
  const { data, error } = await adminDb.rpc('tet_quote_cask', {
    p_cask_ref: caskRef,
    p_target_abv: targetAbv,
    p_admin: true,
  })
  if (error) throw error
  return data as CaskQuote | QuoteError
}

/** What still has to be replaced before anything goes to a customer. */
export async function placeholderAudit(
  adminDb: DB,
): Promise<{ area: string; item: string; detail: string }[]> {
  const { data, error } = await adminDb.rpc('tet_placeholder_audit')
  if (error) throw error
  return (data ?? []) as { area: string; item: string; detail: string }[]
}

/**
 * Move a cask's status. The database logs every change with an actor and
 * refuses to mark a cask 'reserved' without a recorded reason — scarcity
 * on the board has to be real.
 */
export async function setCaskStatus(
  adminDb: DB,
  caskRef: string,
  status: CaskBoardRow['status'],
  reservedFor?: string,
): Promise<void> {
  const { error } = await adminDb
    .from('tet_casks')
    .update({
      status,
      reserved_for: status === 'reserved' ? (reservedFor ?? null) : null,
    })
    .eq('cask_ref', caskRef)
  if (error) throw error
}

/* ================================================================== */
/*  COMPASS — the Flavour Compass profile of a linked cask             */
/* ================================================================== */

export interface CaskCompassRow {
  cask_ref: string
  category_slug: string
  category_name: string
  sort_order: number
  intensity: number
  confidence: number
}

/** Confirmed Compass values for casks that point at a tagged whisky. Throws
 *  if the function is missing (before its migration), so callers catch. */
export async function getCaskCompass(db: SupabaseClient): Promise<CaskCompassRow[]> {
  const { data, error } = await db.rpc('tet_cask_compass')
  if (error) throw error
  return (data ?? []).map((r: CaskCompassRow) => ({ ...r, intensity: Number(r.intensity), confidence: Number(r.confidence) }))
}
