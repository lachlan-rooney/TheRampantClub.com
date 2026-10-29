# Tết Đinh Mùi 2027 — complete subsystem source

The whole Tết cask and corporate-gifting subsystem: data layer, API routes and UI.

| | |
|---|---|
| Generated | 2026-10-13 17:15:54Z |
| Commit | `92687ff` on `main` |
| Files | 32 |
| Lines | 6,449 |
| Size | 352,609 bytes (344 KB) |

Ordered by dependency: data layer first, then routes, then components.

> `lib/tet/scotland.ts` is 28 lines but ~25 KB — a minified coastline polygon for the cask map. Included in full for completeness; there is nothing to read in it.

## Contents

### Data layer — `lib/tet`

- [`lib/tet/types.ts`](#libtettypests) — 352 lines
- [`lib/tet/gate.ts`](#libtetgatets) — 65 lines
- [`lib/tet/colour.ts`](#libtetcolourts) — 164 lines
- [`lib/tet/distilleries.ts`](#libtetdistilleriests) — 67 lines
- [`lib/tet/scotland.ts`](#libtetscotlandts) — 28 lines
- [`lib/tet/boxes.ts`](#libtetboxests) — 101 lines
- [`lib/tet/box-measurements.json`](#libtetbox-measurementsjson) — 230 lines
- [`lib/tet/queries.ts`](#libtetqueriests) — 344 lines
- [`lib/tet/notify.ts`](#libtetnotifyts) — 125 lines

### Routes — `app`

- [`app/tet/page.tsx`](#apptetpagetsx) — 62 lines
- [`app/admin/tet/page.tsx`](#appadmintetpagetsx) — 339 lines
- [`app/api/tet/enter/route.ts`](#appapitetenterroutets) — 71 lines
- [`app/api/tet/quote/route.ts`](#appapitetquoteroutets) — 45 lines
- [`app/api/tet/reserve/route.ts`](#appapitetreserveroutets) — 174 lines
- [`app/api/tet/artwork/route.ts`](#appapitetartworkroutets) — 102 lines
- [`app/api/admin/tet/route.ts`](#appapiadmintetroutets) — 38 lines
- [`app/api/admin/tet/quote/route.ts`](#appapiadmintetquoteroutets) — 43 lines

### Components — `components/tet`

- [`components/tet/TetGate.tsx`](#componentstettetgatetsx) — 269 lines
- [`components/tet/TetProgramme.tsx`](#componentstettetprogrammetsx) — 896 lines
- [`components/tet/TetPlate.tsx`](#componentstettetplatetsx) — 133 lines
- [`components/tet/TetScroll.tsx`](#componentstettetscrolltsx) — 128 lines
- [`components/tet/TetTimeline.tsx`](#componentstettettimelinetsx) — 443 lines
- [`components/tet/TetTiers.tsx`](#componentstettettierstsx) — 218 lines
- [`components/tet/TetLabels.tsx`](#componentstettetlabelstsx) — 117 lines
- [`components/tet/TetEnquiry.tsx`](#componentstettetenquirytsx) — 245 lines
- [`components/tet/TetCaskMap.tsx`](#componentstettetcaskmaptsx) — 328 lines
- [`components/tet/TetCaskChart.tsx`](#componentstettetcaskcharttsx) — 192 lines
- [`components/tet/TetColourLadder.tsx`](#componentstettetcolourladdertsx) — 126 lines
- [`components/tet/TetFlight.tsx`](#componentstettetflighttsx) — 213 lines
- [`components/tet/SleeveStudio.tsx`](#componentstetsleevestudiotsx) — 554 lines
- [`components/tet/SleeveBox.tsx`](#componentstetsleeveboxtsx) — 80 lines
- [`components/tet/FoldedBox.tsx`](#componentstetfoldedboxtsx) — 157 lines

**TOTAL — 32 files · 6,449 lines · 352,609 bytes**

---

## `lib/tet/types.ts`

352 lines · 10,012 bytes

```ts
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
  /** Measured on the beer scale by Huntly. Null = no measurement. */
  colour_srm?: number | null
  colour_source?: string | null
  /** Duncan Taylor Vietnam's own quote per bottle. Where these are set the
   *  page prints THEM rather than a price built from a margin — the owner's
   *  decision, 2026-09-24. The club's cost is never in this type. */
  list_price_vnd?: number | null
  list_price_inc_vat_vnd?: number | null
  price_source?: string | null
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
```

## `lib/tet/gate.ts`

65 lines · 3,070 bytes

```ts
import { createHmac, timingSafeEqual } from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════
// THE TẾT DOOR — server-only.
// ───────────────────────────────────────────────────────────────────────────
// /tet is a public page behind an 18+ confirmation and a shared password. Once
// through, the visitor carries a signed pass in an httpOnly cookie.
//
// The pass is a signature, not a session: there is nothing to look up, nothing
// to revoke per visitor, and no personal data in it. Change the password in
// tet_access and the next person through gets a new pass; existing passes stay
// valid until they expire, which is the right behaviour for a leaflet code
// handed to a room of corporate buyers.
//
// Signed with SUPABASE_JWT_SECRET — the same tier as lib/kiosk/mint, server-only
// and never NEXT_PUBLIC_. A pass says only "this browser answered the door and
// confirmed 18+, until this timestamp".
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  throw new Error('lib/tet/gate is server-only and must never reach the browser')
}

export const TET_COOKIE = 'trc_tet'

/** Long enough that a buyer is not re-typing it mid-conversation, short enough
 *  that a shared laptop forgets. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

export const tetCookieOpts = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: Math.floor(TTL_MS / 1000),
}

function sign(payload: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set — the Tết door cannot issue a pass')
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

/** `<expires>.<signature>` — the whole pass. */
export function mintTetPass(now = Date.now()): string {
  const exp = String(now + TTL_MS)
  return `${exp}.${sign(exp)}`
}

/** True only for a pass this server signed, which has not expired. */
export function tetPassValid(value: string | null | undefined, now = Date.now()): boolean {
  if (!value) return false
  const [exp, sig] = value.split('.')
  if (!exp || !sig) return false
  const expiry = Number(exp)
  if (!Number.isFinite(expiry) || expiry < now) return false
  // Compared byte-for-byte in constant time: a length-independent equality here
  // leaks, slowly, how much of a forged signature is right.
  let a: Buffer, b: Buffer
  try {
    a = Buffer.from(sig)
    b = Buffer.from(sign(exp))
  } catch { return false }
  return a.length === b.length && timingSafeEqual(a, b)
}
```

## `lib/tet/colour.ts`

164 lines · 9,071 bytes

```ts
// ═══════════════════════════════════════════════════════════════════════════
// A NUMBER FOR THE COLOUR — EBC, and the SRM it is converted from.
// ───────────────────────────────────────────────────────────────────────────
// The owner asked for "the spectrometer beer scale" on each cask. That is SRM
// (Standard Reference Method) and its European twin EBC, which are the same
// measurement in different units: both come from absorbance at 430nm through a
// known path length, and EBC = SRM × 1.97. Scotch is quoted in EBC — a lab
// sheet from Huntly would use it — so EBC leads and SRM follows in brackets.
//
// ── WHAT THIS NUMBER HONESTLY IS ──────────────────────────────────────────
// It is derived from the cask's DISPLAY COLOUR, not measured. tet_casks stores
// colour_hex, which somebody chose to draw a swatch with; a real SRM reading
// needs a spectrophotometer, a cuvette of known width and the actual liquid.
// So this places a colour on the published SRM ladder by LIGHTNESS and reports
// that rung. It is an estimate FROM A SWATCH, and every surface that prints it
// says "≈" and says so in words. When Huntly send real figures they
// should be stored per cask and shown instead of this — see EBC_IS_ESTIMATED.
//
// Doing it the other way round — inventing an absorbance from RGB via a
// transmission formula — looks more like science and is worse: sRGB is a
// display encoding with a gamma curve and a white point, not a transmission
// measurement, and the result would carry decimal places it has not earned.
// Nearest-swatch at least cannot claim more precision than the ladder has.
// ═══════════════════════════════════════════════════════════════════════════

/** True while a cask's number comes from the swatch rather than from a lab.
 *  Per-cask now: a cask with colour_srm has been MEASURED (Duncan Taylor's
 *  assessment reads it off a spectrometer — the owner, 2026-09-24: "it is the
 *  beer scale, spectrometer"), and those show their number plainly. The rest
 *  still wear a "≈". */
export const EBC_IS_ESTIMATED = true

/** The ladder's own hex for a rung, for drawing a measured cask. */
export function srmSwatch(srm: number): string {
  const n = Math.min(40, Math.max(1, Math.round(srm)))
  return SRM_SWATCH[n]
}

/** A cask's colour, preferring what was measured over what we inferred.
 *  `measured` is true when the figure came off a spectrometer, which is what
 *  lets a surface drop the "≈" honestly. */
export function caskColourOf(
  c: { colour_srm?: number | null; colour_hex?: string | null },
): (CaskColour & { measured: boolean }) | null {
  if (c.colour_srm != null && Number.isFinite(Number(c.colour_srm))) {
    const srm = Math.min(SRM_CEILING, Math.max(1, Math.round(Number(c.colour_srm))))
    return { srm, ebc: Math.round(srm * 1.97), swatch: SRM_SWATCH[srm], measured: true }
  }
  const est = caskColour(c.colour_hex)
  return est ? { ...est, measured: false } : null
}

/** THE CEILING (owner, 2026-10-01: "stop the srm scale at 20").
 *
 *  The published chart runs to 40, and we drew all of it. Duncan Taylor's own
 *  assessments are the numbers on this page — "current colour FIFTEEN", "colour
 *  FOUR" — and across all twenty casks they run 4 to 15. So half the ladder was
 *  empty space, and every real cask was squeezed into its left third.
 *
 *  Nothing collapses onto the cap: there is no cask above 20 to flatten. If a
 *  darker one is ever measured it sits on the last rung, which is a cask at the
 *  dark end of the scale rather than a wrong number — and the day that matters,
 *  this constant is the one thing to change.
 */
export const SRM_CEILING = 20

/** The published SRM swatches. Kept to 40 so a number past the ceiling still
 *  has a colour to draw; only the LADDER stops at 20. The index is the SRM
 *  value, so SRM_SWATCH[17] is SRM 17. */
const SRM_SWATCH: Record<number, string> = {
  1:'#FFE699',  2:'#FFD878',  3:'#FFCA5A',  4:'#FFBF42',  5:'#FBB123',
  6:'#F8A600',  7:'#F39C00',  8:'#EA8F00',  9:'#E58500', 10:'#DE7C00',
  11:'#D77200', 12:'#CF6900', 13:'#CB6200', 14:'#C35900', 15:'#BB5100',
  16:'#B54C00', 17:'#B04500', 18:'#A63E00', 19:'#A13700', 20:'#9B3200',
  21:'#952D00', 22:'#8E2900', 23:'#882300', 24:'#821E00', 25:'#7B1A00',
  26:'#771900', 27:'#701400', 28:'#6A0E00', 29:'#660D00', 30:'#5E0B00',
  31:'#5A0A02', 32:'#600903', 33:'#520907', 34:'#4C0505', 35:'#470606',
  36:'#440607', 37:'#3F0708', 38:'#3B0607', 39:'#3A070B', 40:'#36080A',
}

/** The ladder in order, SRM 1 → SRM_CEILING, for anything that draws the scale
 *  itself (the Tết colour ladder). Same table, not a copy. */
export const SRM_LADDER: { srm: number; hex: string }[] =
  Object.keys(SRM_SWATCH).map(Number).filter(srm => srm <= SRM_CEILING)
    .sort((a, b) => a - b).map(srm => ({ srm, hex: SRM_SWATCH[srm] }))

function rgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
}

/** sRGB → CIE Lab (D65). Nearest-colour in raw RGB puts a dark red next to a
 *  dark brown that no eye would confuse; Lab is roughly perceptual, so the
 *  rung it picks is the rung a person would point at. */
function lab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
  const Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 1.00000
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(X), f(Y), f(Z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export interface CaskColour {
  /** SRM, 1–SRM_CEILING. */
  srm: number
  /** EBC, rounded. The number Scotch is actually quoted in. */
  ebc: number
  /** The ladder's own hex for that rung — NOT the cask's, so a page can show
   *  what the number means beside what was chosen. */
  swatch: string
}

/** SRM for a display colour, interpolated along the ladder by LIGHTNESS.
 *
 *  WHY NOT NEAREST-COLOUR. The first version took the nearest rung in Lab
 *  across all three axes, and against the real cask list it put five visibly
 *  different browns — #7A2E2E, #6B2B20, #5E3A1E, #63301A, #5A2F1C — on exactly
 *  SRM 33. The ladder's dark end is compressed and its hues are BEER hues, so
 *  chroma distance was mostly measuring "how red is this chart swatch", which
 *  is noise. Casks that look different read the same, and a number that cannot
 *  separate the things it describes is worse than no number.
 *
 *  SRM is an absorbance scale: it is about how much light gets through, which
 *  is lightness. So the match runs on L* alone, interpolated between the two
 *  rungs that bracket it. That is monotonic — darker always means a higher
 *  number — and it cannot collapse a range onto one rung.
 *
 *  Null for a missing or malformed hex: a cask with no colour gets no number,
 *  rather than a confident 1.
 */
export function caskColour(hex: string | null | undefined): CaskColour | null {
  if (!hex) return null
  const c = rgb(hex)
  if (!c) return null
  const L = lab(c)[0]

  // The ladder by lightness, darkest last. Built once per call from the table
  // so there is no second copy of the numbers to fall out of step.
  // Only the rungs the ladder actually has. Interpolating across all forty and
  // then clamping would put every dark swatch on exactly SRM 20 with none of
  // the spread between 15 and 20 that the scale still has to give.
  const rungs = Object.keys(SRM_SWATCH)
    .map(Number).filter(srm => srm <= SRM_CEILING)
    .map(srm => ({ srm, L: lab(rgb(SRM_SWATCH[srm])!)[0] }))
    .sort((a, b) => b.L - a.L)

  let srm: number
  if (L >= rungs[0].L) srm = rungs[0].srm
  else if (L <= rungs[rungs.length - 1].L) srm = rungs[rungs.length - 1].srm
  else {
    let i = 0
    while (i < rungs.length - 1 && rungs[i + 1].L > L) i++
    const a = rungs[i], b = rungs[i + 1]
    const t = (a.L - L) / (a.L - b.L || 1)
    srm = a.srm + t * (b.srm - a.srm)
  }
  srm = Math.min(SRM_CEILING, Math.max(1, Math.round(srm)))
  return { srm, ebc: Math.round(srm * 1.97), swatch: SRM_SWATCH[srm] }
}
```

## `lib/tet/distilleries.ts`

67 lines · 4,578 bytes

```ts
// ═══════════════════════════════════════════════════════════════════════════
// WHERE EACH DISTILLERY IS — for the map on the Tết page.
// ───────────────────────────────────────────────────────────────────────────
// The map used to carry one pin per REGION, at the centroid the club's whisky
// atlas uses. That answers "how many Speyside casks" and not "where is this
// whisky from", which is the question a buyer looking at a named distillery
// actually has.
//
// EVERY COORDINATE HERE CAME OFF WIKIDATA (P625, coordinate location), not
// out of my head, and each row says where it came from.
//
// TWO TRADE NAMES, PLACED ON THE OWNER'S WORD (2026-09-24): "Burnside is
// Balvenue, Islay is Lagavulin". Duncan Taylor's paperwork does not disclose
// either — Burnside is the trade name a Speyside blended malt is sold under,
// and "Islay Single Malt" is the usual form for an Islay whose owner will not
// have its name on someone else's bottle. They now sit at the real place,
// because that was not a guess: it came from the club.
//
// ⚠ THE PAGE STILL PRINTS THE TRADE NAME, not the distillery, and TRADE_NAMES
// below says only the town. Putting "Balvenie" or "Lagavulin" in print on a
// price list is the thing those owners license against, and it is Duncan
// Taylor's exposure before it is ours. Changing that is a decision for the
// club and DT together, not a detail of this file.
//
// ⚠ GLENROTHES IS A TRAP. Wikidata's "Glenrothes" with coordinates is the TOWN
// in Fife, a hundred miles from the distillery, which sits in Rothes in Moray
// and has no coordinate of its own on Wikidata. It is placed at Rothes, and
// marked approximate.
// ═══════════════════════════════════════════════════════════════════════════

export interface DistilleryPlace {
  lat: number
  lng: number
  /** Where the coordinate came from, and how exact it is. */
  source: string
  /** True where the point is the village, not the distillery itself. */
  approximate?: boolean
}

export const DISTILLERIES: Record<string, DistilleryPlace> = {
  'Auchentoshan':  { lat: 55.9220, lng: -4.4390, source: 'Wikidata Q758604' },
  // Sold as Burnside. Placed at Balvenie, Dufftown, on the owner's word.
  'Burnside':      { lat: 57.4572, lng: -3.1291, source: 'Wikidata Q805853 (owner, 2026-09-24)' },
  'Aultmore':      { lat: 57.5681, lng: -3.0011, source: 'Wikidata Q4821838' },
  'Craigellachie': { lat: 57.4885, lng: -3.1846, source: 'Wikidata Q1138727' },
  'Girvan':        { lat: 55.2609, lng: -4.8336, source: 'Wikidata Q1527141' },
  'Invergordon':   { lat: 57.6972, lng: -4.1587, source: 'Wikidata Q1671709' },
  // Sold as "Islay Single Malt". Placed at Lagavulin, on the owner's word.
  'Islay Single Malt': { lat: 55.6355, lng: -6.1262, source: 'Wikidata Q280 (owner, 2026-09-24)' },
  'Miltonduff':    { lat: 57.6237, lng: -3.3702, source: 'Wikidata Q1526981' },
  'North British': { lat: 55.9404, lng: -3.2350, source: 'Wikidata Q1432194' },
  'Tamnavulin':    { lat: 57.3175, lng: -3.3081, source: 'Wikidata Q1474840' },
  'Teaninich':     { lat: 57.6917, lng: -4.2605, source: 'Wikidata (Teaninich distillery)' },
  'Tullibardine':  { lat: 56.2578, lng: -3.7856, source: 'Wikidata (Tullibardine distillery)' },
  // The distillery has no coordinate on Wikidata; this is the village it is in.
  'Glenrothes':    { lat: 57.5298, lng: -3.2140, source: 'Rothes, Moray (Wikidata) — the village, not the distillery', approximate: true },
}

/** The two that cannot honestly be pinned, and why. */
/** Casks sold under a trade name: what the map may say about them. The town,
 *  not the distillery — see the ⚠ at the top of this file. */
export const TRADE_NAMES: Record<string, [string, string]> = {
  'Burnside': ['a Speyside single malt from Dufftown, sold under a trade name',
               'rượu single malt vùng Speyside từ Dufftown, bán dưới một tên thương mại'],
  'Islay Single Malt': ['an Islay single malt from the south shore, sold without its name',
                        'rượu single malt Islay từ bờ nam, bán mà không kèm tên nhà chưng cất'],
}
```

## `lib/tet/scotland.ts`

28 lines · 24,895 bytes

```ts
// ═══════════════════════════════════════════════════════════════════════════
// SCOTLAND, AS ONE SVG PATH — for the Tết cask map.
// ───────────────────────────────────────────────────────────────────────────
// Generated, not drawn: the Scotland map unit from Natural Earth
// (ne_10m_admin_0_map_units, public domain), mainland plus every island
// bigger than a speck, Shetland left out (no cask region there, and it
// doubles the map's height). Projected equirectangular with longitude scaled by
// cos 57° — Scotland's middle — so it is not stretched sideways, then
// simplified (Douglas–Peucker, 0.7 px).
//
// project() is the SAME projection, so a latitude and longitude land on the
// coast where they should. Regenerate with the source file if it ever needs
// to change; do not hand-edit the path.
// ═══════════════════════════════════════════════════════════════════════════

export const SCOTLAND = { w: 600, h: 871 }
const LON0 = -7.8, LON1 = -1.6, LAT0 = 54.55, LAT1 = 59.45
const K = Math.cos(57 * Math.PI / 180)

export function project(lat: number, lng: number): [number, number] {
  return [
    ((lng - LON0) * K) / ((LON1 - LON0) * K) * SCOTLAND.w,
    ((LAT1 - lat) / (LAT1 - LAT0)) * SCOTLAND.h,
  ]
}

export const SCOTLAND_PATH =
  'M559.1 647.8L553.7 650.5L552.4 656.4L545.1 663.0L537.8 675.5L529.5 677.6L529.6 679.9L534.1 685.8L536.4 693.3L540.3 700.6L540.7 703.9L543.4 708.2L543.0 711.2L538.8 715.4L534.9 716.5L529.8 720.2L526.5 726.6L523.7 727.9L521.3 726.2L517.6 726.4L507.9 735.1L501.0 743.7L500.8 750.7L497.3 753.2L491.7 761.3L481.7 767.0L475.8 776.1L471.5 778.8L469.0 783.7L462.0 782.0L459.6 794.3L451.4 796.7L420.6 794.3L416.0 792.3L413.6 795.1L409.3 791.8L408.0 796.7L409.5 805.9L408.2 811.7L406.6 812.7L395.1 812.2L393.0 815.9L386.1 814.8L386.8 816.1L385.9 816.8L384.1 814.8L385.2 812.6L386.1 813.7L385.5 811.2L382.8 814.8L383.5 817.3L381.5 818.6L384.8 822.2L378.8 825.4L371.2 831.6L366.6 832.2L363.6 832.0L362.3 829.7L363.1 824.2L361.5 821.0L359.0 824.8L359.6 830.7L355.8 831.4L350.9 827.9L347.5 821.9L348.3 814.8L344.5 818.9L341.5 819.6L333.2 814.9L330.3 807.9L328.8 807.5L326.5 814.2L327.4 818.4L328.8 822.2L332.9 823.6L334.4 827.5L333.1 831.7L334.5 834.3L333.2 836.9L334.1 844.0L330.7 847.9L323.1 844.1L319.7 844.2L310.0 831.0L298.6 823.4L292.2 820.7L290.4 815.7L284.6 814.8L278.2 819.9L275.3 825.7L276.0 830.6L281.0 843.5L283.8 846.1L283.3 853.4L284.6 856.3L276.4 852.7L274.9 848.7L276.1 844.1L274.9 841.8L275.4 839.3L272.1 838.1L270.6 831.7L267.8 829.7L258.6 817.9L255.8 812.5L253.5 799.1L254.4 789.5L255.8 788.1L258.9 788.0L259.8 785.4L264.2 793.5L265.1 803.3L268.0 806.8L269.7 807.1L271.4 805.2L272.1 802.6L268.6 795.2L266.1 786.2L266.4 781.1L270.2 765.9L276.1 761.2L282.3 752.2L283.8 751.5L286.6 740.5L287.2 732.2L292.9 725.4L295.2 717.5L298.4 714.5L304.8 711.3L307.1 707.7L308.0 702.9L307.1 698.6L304.8 695.5L301.2 694.3L303.3 691.1L302.8 687.1L300.7 683.4L297.9 680.9L288.6 677.7L289.3 674.8L283.7 670.9L278.7 665.1L282.9 660.3L284.4 656.5L282.3 645.0L282.0 627.5L285.5 622.5L290.4 620.7L302.7 625.0L318.8 627.6L321.1 626.0L306.8 622.8L302.6 620.0L297.6 613.5L291.9 610.1L289.3 605.5L288.0 599.3L286.5 598.9L286.0 600.3L286.7 604.3L292.4 614.7L291.7 616.1L290.0 616.4L285.3 615.4L284.3 612.9L284.0 601.4L287.8 591.2L294.6 579.8L294.6 576.5L292.3 579.2L285.3 593.2L283.2 593.3L282.5 591.9L282.7 586.5L281.3 582.3L280.0 581.8L278.7 583.4L282.0 599.0L281.7 601.7L280.2 603.6L281.4 615.1L280.0 615.8L275.4 613.9L275.4 615.1L278.9 618.0L279.3 620.0L274.0 634.6L271.5 636.4L268.4 635.7L266.9 633.7L264.1 620.6L260.2 615.2L259.0 611.5L257.5 612.8L262.7 625.4L263.4 629.1L262.6 630.8L254.4 624.7L253.5 618.7L250.4 628.0L247.5 632.3L251.5 643.2L242.3 639.4L240.6 633.6L238.2 630.4L239.6 620.6L238.2 613.9L251.2 592.0L256.8 589.6L260.8 586.3L266.8 574.8L276.8 568.6L278.7 563.9L273.4 569.2L266.2 571.1L260.4 582.2L248.9 590.3L240.9 602.9L237.5 604.2L235.3 611.6L233.2 612.2L229.0 611.4L228.7 607.9L228.0 608.4L226.9 621.1L229.3 622.5L231.0 631.1L232.2 632.3L231.6 634.6L232.9 635.7L231.6 637.0L236.9 643.0L239.3 647.3L240.2 651.8L239.6 654.3L233.5 657.6L229.0 662.8L226.3 668.7L225.6 674.8L223.5 676.4L224.1 682.6L226.9 685.8L226.3 688.1L223.7 689.9L224.3 693.2L221.6 699.1L221.5 704.9L220.3 705.2L216.6 713.6L214.4 715.0L214.4 716.1L216.6 716.4L218.4 718.7L221.1 724.6L220.2 727.3L215.4 733.8L211.3 736.5L209.0 737.0L205.1 735.7L200.8 738.2L196.2 737.5L193.9 723.6L194.4 720.2L201.7 711.4L201.1 699.7L202.5 694.4L201.1 690.6L205.8 677.1L206.2 673.6L205.1 671.1L210.3 666.5L214.7 656.3L222.1 650.7L226.9 640.7L217.6 651.7L213.0 655.2L211.7 655.2L212.3 652.9L207.1 649.3L205.7 640.7L211.0 630.5L215.7 624.9L206.0 633.4L204.4 632.2L203.6 628.2L214.2 611.1L215.7 606.6L214.5 606.0L210.4 608.9L209.8 612.2L205.7 617.2L205.7 621.1L204.1 624.3L202.8 624.5L202.5 623.5L203.6 616.4L215.1 596.0L219.5 597.9L216.9 590.0L221.6 579.8L218.7 580.7L212.3 588.4L214.2 581.1L217.7 574.8L216.8 572.4L218.0 570.6L223.1 568.3L223.3 567.0L221.4 565.1L213.7 568.8L213.3 565.3L215.6 554.9L218.4 550.5L220.1 551.6L222.8 551.3L227.6 549.3L227.6 548.2L221.1 549.8L219.0 549.3L221.6 542.0L224.7 539.9L224.3 538.4L226.7 534.9L230.0 533.3L239.7 532.4L247.5 534.7L250.8 533.8L259.5 523.0L264.7 512.8L262.6 514.0L258.8 522.5L251.5 531.1L247.4 531.6L237.1 529.2L234.4 531.7L232.8 530.5L231.2 523.7L228.8 525.9L226.9 529.8L225.6 528.7L229.6 517.7L231.9 520.0L236.5 520.9L247.5 512.8L244.3 514.8L240.9 515.1L234.9 519.0L230.9 516.4L236.1 505.5L242.1 498.3L240.2 497.0L240.2 495.7L243.2 493.3L246.9 493.4L249.8 490.8L256.1 492.2L261.9 489.0L271.4 486.0L255.4 489.6L247.9 485.9L248.9 482.3L256.0 474.2L259.4 467.8L253.6 473.0L251.4 476.5L248.4 478.0L247.5 482.3L245.0 486.5L241.0 487.7L238.0 490.1L233.4 496.8L228.9 499.0L227.5 502.2L224.3 504.2L212.9 519.2L205.7 524.9L203.7 521.9L199.3 520.2L196.4 517.7L198.5 511.6L194.1 516.7L188.3 515.4L173.9 503.3L173.4 499.1L175.8 497.2L180.6 496.9L187.1 499.2L189.8 501.9L190.5 500.6L187.2 497.5L187.2 495.7L197.4 488.7L199.8 488.4L208.3 492.2L213.5 491.8L218.4 489.6L209.4 490.8L198.4 486.2L187.8 492.2L183.2 493.3L178.5 490.8L171.8 491.4L164.6 489.4L162.2 489.6L158.5 492.7L152.6 489.6L151.5 483.7L153.4 483.6L156.7 479.1L171.6 477.5L177.6 473.7L188.5 480.5L187.9 476.7L185.2 475.1L185.2 473.7L187.6 473.7L189.8 475.1L193.3 472.5L197.7 473.7L190.5 470.1L188.6 467.8L188.6 465.9L189.9 464.5L199.9 463.1L203.9 461.3L207.1 458.1L204.0 457.7L200.9 461.5L198.9 461.4L195.1 460.4L199.8 454.3L195.4 453.5L186.3 455.6L181.8 454.3L188.5 453.2L188.5 451.9L185.8 449.4L187.5 447.3L190.5 436.0L194.9 431.8L197.9 430.8L200.4 431.3L204.4 437.3L207.2 439.1L210.4 439.7L220.3 436.0L220.3 434.8L215.7 436.7L214.4 436.0L212.2 437.5L210.1 436.9L204.6 433.8L205.2 429.1L203.0 427.5L199.1 428.7L195.5 426.3L194.4 425.0L195.9 422.0L201.0 414.8L202.9 414.0L205.8 414.3L208.5 412.5L216.9 417.7L226.5 417.8L227.7 415.9L232.2 416.6L232.2 415.3L230.3 414.0L218.6 416.6L214.4 411.7L206.3 409.3L205.1 407.4L205.8 404.4L210.4 397.1L208.6 394.0L211.0 390.7L215.0 388.1L218.4 387.3L227.8 395.9L231.6 394.6L231.6 393.4L227.5 392.5L222.4 386.1L226.0 381.0L228.3 380.1L228.3 378.7L226.0 377.7L222.0 382.5L215.0 386.1L207.4 383.7L201.2 384.9L200.4 382.5L203.0 376.4L207.6 372.6L209.4 375.1L211.6 374.7L222.5 369.6L226.8 365.5L227.6 360.5L226.0 360.2L216.4 371.0L209.0 369.0L212.2 366.3L211.0 361.4L202.5 371.5L195.0 373.5L192.8 372.4L191.1 365.4L192.5 364.2L191.1 359.3L192.5 356.9L187.8 355.0L186.5 347.7L188.5 342.3L189.0 336.2L190.5 336.2L189.8 332.5L193.2 332.2L200.1 338.6L201.7 339.8L202.5 339.1L204.2 341.7L209.0 344.7L207.7 341.0L214.7 339.8L221.0 340.4L221.4 339.2L218.4 336.8L214.0 335.8L209.7 336.4L207.1 338.7L203.8 334.8L205.1 332.5L201.8 331.9L197.1 322.8L193.0 321.3L193.0 316.9L195.0 314.7L194.4 311.8L199.9 309.7L202.7 312.8L204.0 312.7L205.7 309.4L201.2 305.1L193.2 303.3L192.8 285.5L194.6 282.3L198.3 280.3L200.8 280.2L205.7 282.5L205.7 288.5L207.1 294.7L209.3 297.9L212.3 298.5L210.4 294.7L214.4 296.0L214.3 287.7L208.0 279.5L209.0 277.7L207.7 276.5L211.7 270.4L214.1 272.8L217.7 272.8L217.1 277.7L219.9 281.3L223.8 283.4L226.9 283.7L226.3 282.5L228.7 275.9L229.6 274.1L230.8 274.1L235.2 276.0L242.5 282.3L249.5 285.0L247.0 281.4L244.2 280.1L239.9 275.8L232.9 272.3L232.9 269.2L235.0 270.0L235.5 267.9L242.2 274.1L246.2 272.8L251.7 275.9L255.3 279.3L259.4 281.2L262.1 286.1L264.1 287.4L261.6 280.7L251.9 272.3L249.5 271.7L249.5 270.4L251.4 270.4L252.2 269.1L251.2 264.8L242.6 261.2L238.7 256.2L236.2 255.7L236.9 254.6L235.5 252.6L229.6 252.2L230.9 248.4L227.7 242.7L229.5 240.3L233.2 241.4L235.5 246.0L237.6 244.3L241.9 245.3L244.2 242.4L242.9 236.3L244.2 236.3L244.2 235.1L242.2 233.8L247.5 231.5L247.5 230.1L242.8 230.0L241.5 228.9L242.2 227.8L241.5 226.9L238.9 225.4L239.6 221.6L237.4 221.0L232.9 214.2L233.0 211.3L234.6 210.8L242.5 214.9L250.1 211.3L254.2 213.1L258.4 209.5L264.4 213.1L270.7 213.1L277.4 218.1L272.7 213.1L278.1 210.7L270.0 209.5L268.1 211.6L266.1 211.5L261.6 208.5L257.8 203.4L255.5 199.7L254.2 194.8L256.1 194.8L255.2 191.2L257.1 184.0L265.4 188.9L269.4 188.8L265.8 185.5L265.4 182.7L263.6 184.1L261.5 184.0L262.7 181.5L260.8 180.2L266.1 177.1L271.4 180.2L260.8 171.1L260.7 167.9L261.7 165.5L268.3 161.0L270.5 147.9L272.1 146.1L284.6 148.7L286.8 150.2L288.6 152.3L290.0 158.3L288.6 164.5L291.1 161.5L291.7 155.2L293.1 152.8L292.6 149.8L297.3 155.1L303.9 158.9L303.2 163.2L298.6 167.9L294.1 178.1L295.9 177.8L302.6 171.1L303.2 168.3L308.5 164.5L311.1 155.7L313.5 154.7L321.7 157.2L326.5 160.6L326.5 164.5L324.2 167.1L319.8 177.8L323.1 175.5L325.8 171.8L325.7 169.5L334.5 162.0L338.0 160.6L345.0 164.5L343.7 163.2L346.4 159.6L350.6 160.6L353.3 157.2L359.9 157.9L363.0 152.9L364.9 152.0L367.4 156.3L377.8 157.2L386.1 155.9L396.9 149.1L406.7 146.3L412.0 147.4L410.7 148.6L413.0 150.7L421.3 148.6L426.6 151.0L429.3 150.9L430.6 147.4L427.2 145.4L424.6 141.2L428.2 137.4L429.8 137.7L431.6 142.5L444.8 140.2L449.8 143.8L459.4 142.5L462.7 143.9L459.8 153.4L453.1 163.2L452.0 166.6L453.0 171.6L455.1 172.9L458.3 171.9L459.4 175.0L457.1 177.8L456.2 184.1L452.0 192.1L443.2 203.4L427.3 210.7L422.1 215.8L418.7 223.4L414.6 227.8L393.4 244.9L386.2 248.5L384.4 250.3L382.1 257.1L368.6 264.8L367.6 269.2L365.5 267.9L366.2 266.8L359.6 264.1L360.2 267.9L366.2 269.8L368.9 274.1L366.9 277.4L366.8 281.2L360.9 280.1L357.6 283.7L354.9 283.7L346.6 280.1L338.8 282.1L333.6 276.4L329.8 274.1L334.9 281.6L338.0 284.1L341.7 285.0L347.6 282.8L353.3 288.0L354.8 287.9L354.3 285.0L360.5 289.2L363.9 290.1L369.3 285.8L372.4 286.5L374.2 288.7L372.8 291.0L376.0 291.9L379.6 290.3L387.2 281.5L388.4 281.7L389.1 283.4L388.1 287.8L368.9 311.8L365.5 311.5L365.0 309.7L366.2 306.9L363.6 304.4L360.2 305.7L351.4 312.9L342.7 314.9L339.2 314.6L337.9 319.1L328.7 327.2L326.3 332.8L331.0 330.7L335.9 324.2L348.2 315.5L351.4 317.5L358.4 318.5L366.8 313.1L367.3 315.3L365.3 319.0L359.7 324.7L356.3 330.1L357.6 332.5L351.2 334.0L349.6 336.2L349.8 338.1L342.3 337.4L342.3 338.7L347.6 339.8L343.7 347.1L348.9 348.1L350.9 347.1L353.3 343.4L356.5 342.7L359.7 338.7L364.4 336.5L359.6 331.3L371.2 330.1L380.5 331.0L383.5 330.1L398.2 319.2L404.0 317.8L402.0 321.5L403.3 322.5L407.3 321.5L405.3 316.7L408.9 318.0L412.7 317.8L415.6 314.9L416.9 308.7L419.9 309.4L424.9 306.9L437.0 307.4L444.2 312.1L456.9 316.5L461.1 316.7L465.0 315.4L472.6 310.6L487.9 310.6L490.5 313.1L493.2 312.0L494.2 313.1L497.5 311.5L505.8 314.4L508.8 314.2L510.4 316.7L513.1 314.2L519.4 316.7L520.1 315.4L522.8 316.7L526.4 314.2L529.5 315.7L532.7 311.8L541.0 315.4L543.5 314.9L550.8 310.2L561.5 310.6L563.9 315.4L567.8 314.2L577.8 326.5L579.5 335.9L581.0 338.7L580.6 342.0L584.4 347.1L583.0 347.2L582.5 350.1L584.6 351.3L577.7 359.7L575.8 365.4L565.7 374.9L563.2 378.7L557.0 395.2L554.7 404.5L554.4 411.4L556.5 414.4L543.2 438.2L541.9 444.6L543.3 450.7L541.0 454.0L540.0 458.1L535.3 462.8L530.3 470.8L520.0 479.7L518.6 482.6L517.6 490.4L514.1 497.0L514.8 501.9L511.5 508.1L500.9 516.7L499.3 520.4L493.6 523.7L490.9 529.8L489.9 530.2L487.3 528.7L458.6 533.0L451.6 537.4L441.5 547.9L437.4 549.6L433.2 548.2L436.1 550.5L442.2 550.0L469.3 536.5L471.2 533.6L475.6 531.8L479.0 534.7L482.4 535.0L483.6 537.2L483.1 543.7L480.2 548.2L482.6 548.2L483.6 551.9L486.9 554.2L495.8 554.9L497.9 556.0L505.5 562.8L505.5 563.9L500.3 569.1L498.5 572.6L491.6 574.8L485.5 579.1L480.9 579.3L475.0 576.1L468.0 576.7L466.2 579.6L461.1 583.4L455.7 589.7L452.2 591.4L448.7 601.9L447.3 602.9L440.5 603.3L431.4 608.4L423.8 608.8L408.1 604.1L399.5 604.2L392.4 600.4L386.8 594.2L383.5 593.2L383.5 594.3L390.9 600.4L394.7 607.8L398.1 607.8L399.8 611.0L408.6 610.2L425.3 615.1L432.5 614.3L435.1 617.2L452.7 618.7L456.9 622.7L463.0 622.1L470.3 618.7L475.9 611.7L478.3 611.4L477.0 607.8L481.6 602.6L483.6 601.7L499.8 602.9L506.2 608.9L504.8 612.8L508.6 612.8L510.1 613.9L512.1 611.4L531.5 624.8L547.9 628.4L548.8 632.8L553.5 636.5L559.1 647.8ZM264.1 700.5L262.0 702.1L263.4 710.1L259.6 712.8L255.1 713.7L249.9 713.2L241.5 708.9L237.5 705.2L236.2 696.7L237.5 693.2L233.3 686.1L232.9 676.1L236.6 668.4L239.6 665.7L242.9 665.1L242.2 662.5L245.5 662.5L251.8 665.8L255.5 670.8L256.8 674.6L258.8 683.4L257.7 685.8L261.8 690.3L262.1 694.3L258.8 695.6L259.4 697.9L264.1 700.5ZM268.1 657.8L270.1 661.4L268.2 662.4L266.1 657.8L259.8 651.6L257.5 641.3L253.5 637.6L251.7 629.1L254.8 627.3L263.1 634.7L263.7 638.7L267.3 643.0L269.9 653.3L268.1 657.8ZM171.3 661.4L171.9 669.8L169.8 671.2L168.6 673.7L168.0 672.3L166.2 675.1L161.4 678.7L153.4 679.6L152.2 684.0L146.4 688.2L144.1 687.3L142.7 683.4L143.3 679.3L145.4 676.8L150.7 673.7L147.4 665.9L142.7 663.8L143.1 660.6L150.0 652.9L145.1 651.3L142.4 651.8L140.4 653.5L136.8 662.6L133.7 664.9L129.4 671.1L126.7 671.6L125.5 669.9L126.8 663.8L125.4 662.5L130.8 652.9L127.5 650.5L129.6 648.2L131.1 640.1L142.1 632.8L143.4 633.4L141.5 640.7L142.2 643.9L144.1 645.5L143.4 640.8L145.5 636.9L152.0 631.5L154.4 628.1L160.6 623.7L162.6 625.8L164.6 648.6L169.4 654.8L168.6 659.0L171.3 661.4ZM154.3 595.0L157.3 594.3L156.6 592.0L160.8 591.1L161.3 593.2L157.0 602.3L157.3 605.5L155.4 607.0L150.1 607.7L148.1 606.6L149.6 605.3L151.7 598.7L154.3 595.0ZM193.8 593.2L201.7 586.0L203.8 587.1L204.3 593.4L199.3 599.7L187.3 626.3L185.2 633.4L184.2 633.0L179.5 638.4L177.9 648.0L175.4 649.8L171.6 649.5L168.2 647.1L165.8 634.1L166.9 628.2L174.4 621.8L182.0 620.3L185.2 617.5L176.1 618.6L174.6 615.7L175.8 611.7L181.5 603.3L186.4 600.8L193.8 593.2ZM204.4 577.3L205.8 581.4L200.8 584.3L198.5 584.6L199.5 581.7L204.4 577.3ZM209.7 566.4L210.7 567.5L211.7 566.4L211.9 568.9L210.2 574.1L209.3 579.6L206.5 573.7L209.7 566.4ZM209.7 556.6L214.4 555.4L212.4 560.5L213.0 562.8L210.8 564.2L209.0 563.0L208.4 560.1L209.7 556.6ZM217.0 539.6L220.0 539.7L222.3 538.4L219.1 543.5L214.4 544.5L217.0 539.6ZM158.7 529.8L151.2 529.7L148.7 527.4L150.8 524.5L153.4 523.7L158.7 529.8ZM95.0 517.7L102.4 515.9L103.6 519.0L102.3 521.2L96.4 522.0L96.2 524.9L90.1 528.0L88.3 531.1L88.9 534.3L86.9 534.4L80.8 531.5L78.4 523.7L87.0 521.4L95.0 517.7ZM204.4 536.0L207.3 542.1L206.1 543.3L202.9 543.3L201.5 542.6L201.1 540.0L199.1 539.6L199.4 541.9L195.1 546.9L195.1 548.2L198.4 546.2L202.0 545.7L203.6 546.5L203.0 548.5L192.7 556.6L188.9 557.5L185.8 555.4L188.4 552.2L188.5 550.5L186.5 549.7L184.1 550.5L182.4 553.6L170.6 559.0L167.8 561.8L164.3 560.2L160.0 562.8L151.0 562.8L148.4 566.4L145.2 565.6L140.7 562.0L138.8 556.0L139.6 553.5L141.7 552.0L146.1 551.9L150.3 557.9L152.0 556.6L152.0 555.4L150.0 554.2L151.8 553.4L156.1 554.4L159.3 552.0L166.0 550.5L172.2 545.3L171.6 544.5L169.7 545.0L164.0 548.2L159.3 549.4L156.9 549.3L154.5 545.7L155.9 542.5L159.0 540.8L161.9 533.5L166.3 533.5L172.1 530.8L173.8 528.0L172.6 523.7L161.9 528.9L157.3 521.4L146.3 518.6L141.5 515.1L146.1 511.6L142.7 505.5L146.3 505.2L149.4 503.0L151.9 505.1L152.9 500.9L159.6 497.4L162.7 497.0L168.6 499.5L168.0 503.0L170.9 503.3L173.3 506.8L177.8 519.7L188.5 520.1L190.7 522.5L194.1 521.4L197.7 526.1L202.2 527.1L205.1 532.9L208.2 533.7L207.7 537.2L204.4 536.0ZM129.8 492.7L125.3 501.3L123.2 501.9L119.6 506.8L114.5 511.0L112.9 511.6L109.5 510.6L108.6 514.0L106.3 509.2L108.9 508.7L111.5 506.1L117.0 497.4L126.8 490.8L130.4 490.9L129.8 492.7ZM39.3 433.7L41.3 438.5L37.6 439.1L34.6 442.1L34.3 444.9L32.8 445.6L23.5 443.8L24.7 440.4L26.3 439.7L27.9 437.0L26.7 433.7L33.2 429.9L33.9 425.1L37.3 427.5L35.3 431.3L39.3 433.7ZM142.7 425.1L149.9 430.8L148.1 433.7L150.7 433.7L147.5 443.8L144.8 445.5L141.1 445.8L139.4 444.9L137.8 440.6L130.1 434.8L138.9 425.6L142.7 425.1ZM115.5 426.3L122.2 422.6L125.7 424.2L126.8 425.1L124.3 426.5L115.5 426.3ZM178.2 384.9L173.4 381.5L172.8 379.1L175.2 377.6L178.5 378.3L181.0 380.9L181.4 383.7L178.2 384.9ZM53.8 377.6L56.9 381.3L58.5 381.2L58.0 383.8L54.8 386.7L52.6 393.4L50.7 394.3L43.3 392.3L43.3 393.4L49.5 395.3L51.2 397.1L52.5 403.5L51.2 409.2L47.7 407.8L43.9 408.0L43.9 409.2L50.6 409.2L54.6 414.0L56.5 414.2L54.3 417.6L46.3 416.0L43.3 417.8L39.6 412.6L37.1 403.2L37.3 397.1L33.3 393.4L39.7 380.0L36.0 366.6L43.3 363.0L51.9 369.0L50.4 369.7L48.5 369.0L48.5 370.2L55.9 373.9L55.9 375.1L53.2 376.5L51.1 375.5L45.3 371.3L41.5 366.6L39.3 367.8L41.6 372.4L46.3 373.9L49.3 377.1L53.8 377.6ZM51.9 349.6L51.2 350.8L52.0 351.6L54.5 350.8L57.9 353.3L57.3 354.4L55.9 353.6L53.7 355.6L51.9 355.7L53.3 358.1L56.9 358.7L57.5 361.1L49.2 363.6L39.1 358.4L38.0 356.3L38.4 353.0L41.6 348.5L46.2 349.7L48.5 348.4L49.9 349.7L51.9 349.6ZM168.0 373.9L166.7 369.4L167.5 358.0L168.2 355.0L169.8 353.6L172.6 353.3L170.6 348.4L172.7 347.2L174.6 348.4L173.2 344.7L174.8 345.4L175.9 347.1L172.5 361.2L172.6 366.6L175.2 373.8L168.9 377.5L167.2 376.4L168.0 373.9ZM177.3 343.4L175.2 340.8L176.5 336.2L175.9 334.8L177.2 333.0L178.5 333.7L177.3 343.4ZM64.9 319.4L68.5 319.6L70.2 320.6L71.1 322.8L67.8 327.5L60.9 321.5L56.5 321.5L56.5 322.8L58.3 323.3L57.9 326.5L61.5 327.1L62.5 331.1L67.2 330.1L65.3 334.0L62.9 335.7L54.5 337.4L52.6 333.7L47.2 337.4L47.2 338.7L54.2 338.7L59.9 337.0L63.5 338.0L64.5 339.8L62.2 344.7L56.1 344.7L54.5 346.0L53.0 344.8L47.9 344.7L43.9 338.7L46.6 337.4L43.4 337.1L37.6 333.3L34.6 332.5L33.3 334.5L31.9 334.7L24.7 330.1L31.3 317.8L33.4 319.0L40.0 317.8L40.0 319.1L37.3 320.3L39.0 322.6L47.2 313.1L45.2 317.8L52.6 320.3L52.6 319.1L50.6 317.8L57.2 313.6L59.8 313.1L61.4 316.4L59.1 319.1L60.7 320.0L63.6 318.5L64.9 319.4ZM119.6 373.9L118.0 375.3L106.8 370.7L105.0 368.6L103.4 361.4L99.4 358.3L98.3 354.4L104.3 354.4L101.9 348.8L104.9 344.1L112.4 354.9L115.5 356.6L114.9 353.3L116.2 352.1L113.1 347.8L113.2 346.3L115.0 344.5L119.6 346.0L118.6 342.8L116.2 339.9L110.8 337.4L113.1 333.0L112.2 327.5L114.2 327.6L118.8 332.0L120.5 337.3L125.7 340.3L129.2 344.4L133.5 343.4L131.3 348.7L132.2 349.0L134.3 346.4L135.5 342.9L144.1 353.3L142.8 347.2L136.5 337.3L139.4 330.1L135.5 328.9L135.9 326.5L134.0 320.7L139.4 316.7L141.5 311.2L142.7 311.8L144.1 310.6L151.7 321.5L157.9 327.5L159.3 330.7L161.3 350.8L160.0 359.9L156.0 365.4L158.8 363.1L161.9 363.0L162.8 364.8L160.6 369.0L161.1 372.0L164.6 376.4L159.3 381.2L167.6 380.1L169.8 380.7L170.2 382.2L166.6 384.9L166.6 386.1L173.4 384.5L176.5 387.4L181.6 388.1L183.2 391.3L185.2 392.5L187.2 389.8L191.2 390.0L194.0 387.2L196.7 386.2L199.5 386.2L201.1 388.5L208.3 388.5L206.7 392.9L206.8 397.7L200.6 404.8L195.3 405.9L193.5 413.5L188.5 417.2L180.5 428.2L173.5 430.5L171.3 427.5L171.6 424.5L174.2 420.6L173.9 417.8L175.5 414.5L179.8 408.0L189.2 403.2L189.2 402.0L183.8 404.3L175.5 404.5L174.6 400.7L169.9 394.6L171.9 400.7L169.3 405.6L169.9 406.9L167.0 412.1L165.6 412.8L164.4 411.5L163.3 402.0L162.0 400.8L160.6 402.0L158.3 399.7L157.3 399.6L157.3 400.7L158.7 402.1L157.0 403.3L143.4 406.9L147.4 399.6L143.9 400.0L140.7 402.0L137.4 395.8L140.7 392.3L134.7 392.2L130.1 386.1L127.5 380.1L133.9 376.0L136.1 376.4L141.5 381.9L144.1 382.5L142.9 380.1L134.9 373.0L129.4 373.9L130.8 371.5L128.1 370.2L129.4 369.0L127.9 367.6L128.1 364.2L123.5 367.8L124.1 364.6L122.8 361.6L122.0 364.0L118.9 366.6L119.6 373.9ZM55.9 309.4L60.0 304.9L61.8 304.5L62.7 306.4L58.2 309.7L55.9 309.4ZM-79.5 287.4L-72.8 289.9L-74.4 292.0L-76.5 292.5L-78.5 291.0L-79.5 287.4ZM73.1 275.1L72.1 278.3L69.7 279.0L69.9 277.1L73.8 272.6L75.9 271.6L77.7 272.8L77.7 276.7L76.5 277.4L73.1 275.1ZM89.7 219.2L91.0 219.2L91.0 218.1L89.8 217.4L88.4 213.7L89.0 211.9L90.9 212.7L94.0 216.2L95.0 215.6L95.8 216.5L97.6 220.4L89.7 220.4L89.7 219.2ZM81.8 303.3L79.3 304.8L66.5 290.5L65.3 286.7L68.0 286.5L69.7 291.0L78.9 281.8L85.7 281.2L81.0 277.7L81.0 276.5L88.9 273.0L93.7 275.1L90.4 271.7L93.0 270.4L93.0 269.2L87.4 269.2L82.1 265.4L76.5 265.7L73.9 264.7L73.1 261.9L71.0 262.9L66.5 259.5L70.5 255.6L72.4 255.7L71.8 253.3L77.9 251.7L83.7 248.4L71.8 250.9L73.0 248.4L75.1 248.4L75.1 247.3L72.4 247.3L75.1 243.6L70.1 246.7L66.5 240.0L67.0 237.8L65.2 235.7L65.5 233.5L68.4 227.8L66.5 225.4L75.8 224.1L72.2 222.0L72.6 216.4L74.4 214.2L79.6 217.3L81.1 216.8L86.4 219.2L86.4 220.4L83.5 220.2L87.4 227.2L88.3 233.6L91.0 238.7L91.0 233.8L88.3 227.8L90.0 224.1L96.9 221.8L101.8 225.2L102.9 227.8L105.5 224.1L102.3 221.6L100.9 216.8L98.3 216.8L95.6 210.7L97.6 209.5L96.7 207.4L95.0 207.1L104.9 197.4L106.1 198.0L108.3 196.2L114.1 195.4L120.2 192.2L123.5 188.3L140.7 175.4L148.3 166.7L150.7 166.9L152.6 169.0L158.0 183.2L155.6 185.0L153.4 192.4L155.3 194.4L158.0 194.8L158.0 196.2L150.0 202.1L150.3 204.9L147.2 206.4L146.3 208.9L143.4 210.1L143.4 214.2L142.5 215.1L138.8 215.6L140.5 218.4L148.0 219.3L150.7 218.1L155.3 213.1L159.6 211.8L158.0 216.8L158.7 219.2L155.3 221.0L151.6 225.0L145.8 222.3L141.5 222.9L135.5 220.4L138.8 228.9L137.6 230.4L138.1 232.7L131.5 235.1L126.8 240.0L123.5 238.7L120.9 241.2L114.3 242.4L114.3 243.6L117.9 243.7L130.5 240.7L134.8 238.7L137.0 241.4L137.4 246.0L138.8 247.3L135.5 249.7L140.1 250.9L135.4 256.4L133.1 257.1L121.5 254.6L120.9 256.0L125.3 259.1L128.7 260.1L130.1 263.1L125.1 269.1L120.9 267.9L122.2 271.7L120.0 272.8L116.7 271.1L113.2 265.4L113.3 268.4L114.9 271.7L114.3 272.8L109.7 269.5L105.5 257.1L107.0 252.4L109.8 249.8L116.9 248.4L116.9 247.3L107.6 247.3L107.2 250.5L100.3 257.1L103.5 264.3L109.0 270.4L106.9 271.7L109.6 274.1L110.2 279.0L102.3 277.1L98.9 275.1L98.0 275.7L96.2 279.0L100.3 281.2L102.9 286.3L102.4 287.7L97.6 288.7L98.3 291.0L96.2 290.7L91.7 287.4L91.0 288.7L93.0 291.0L88.3 296.0L89.7 297.2L81.8 303.3ZM469.1 108.4L475.8 109.8L475.6 112.0L472.3 114.4L472.8 118.2L471.6 119.3L473.1 124.7L472.5 126.5L470.3 127.9L465.7 123.1L467.0 120.5L463.0 113.3L466.6 114.1L467.7 112.0L461.1 112.0L461.1 110.9L469.1 108.4ZM440.5 116.9L443.4 116.7L449.0 114.1L451.8 114.4L449.4 117.9L444.6 119.3L435.6 119.3L432.8 112.3L427.9 106.0L427.9 102.4L426.0 103.2L423.7 102.4L422.6 100.4L424.2 96.3L426.5 94.2L430.7 92.7L440.7 98.4L445.8 106.0L444.4 108.4L446.4 109.1L447.8 112.0L443.7 113.0L440.5 116.9ZM490.9 85.2L492.8 87.3L492.9 92.0L490.3 94.2L485.3 95.9L481.6 101.0L471.6 96.9L466.3 87.1L462.2 90.6L456.3 90.1L457.7 92.7L454.7 92.4L453.1 95.0L450.7 94.0L444.9 94.9L442.5 92.7L441.4 88.7L441.7 84.9L444.4 79.1L442.5 73.1L440.7 74.6L441.2 78.0L439.4 77.2L437.8 78.0L439.6 83.8L436.5 88.8L433.2 87.6L430.3 83.0L429.0 77.1L431.2 70.6L430.6 62.6L433.2 57.3L437.5 54.5L442.2 53.6L449.4 54.7L452.8 58.0L456.3 57.2L457.3 58.0L459.8 60.8L457.7 62.0L465.0 67.0L463.7 68.2L465.0 69.4L458.4 71.2L455.7 76.7L451.8 79.1L453.2 80.3L458.7 81.5L463.4 76.9L467.0 80.2L471.0 78.0L474.6 81.6L476.3 80.3L475.6 84.1L477.6 84.5L482.6 81.5L485.7 81.7L485.6 84.6L480.2 88.8L482.7 92.6L484.4 93.1L486.3 92.7L484.3 87.7L490.9 85.2ZM508.8 58.6L508.8 61.7L511.5 63.3L509.7 65.1L503.5 67.0L503.3 62.9L501.8 60.9L499.9 60.7L498.2 62.0L498.5 64.8L496.4 65.5L494.9 64.1L496.9 60.8L501.1 59.3L501.5 57.2L497.9 53.1L496.9 52.4L502.1 51.3L501.5 53.6L506.2 54.7L503.9 55.4L504.8 58.6L509.5 57.2L508.8 58.6ZM464.1 57.2L458.2 56.2L453.4 51.8L452.9 48.6L454.6 46.2L459.8 45.0L461.7 47.6L466.4 46.7L469.1 47.4L466.7 50.9L466.9 56.2L464.1 57.2ZM481.0 45.0L482.2 46.0L485.2 45.0L484.7 37.9L486.1 35.0L487.6 35.2L486.9 37.7L490.2 38.5L490.9 40.1L487.6 45.7L487.8 50.8L488.6 52.2L490.2 52.4L490.2 53.6L485.7 54.9L484.9 54.2L483.7 50.1L481.0 48.7L481.0 45.0ZM518.1 27.9L521.5 23.3L523.3 29.2L516.9 30.4L512.5 38.5L511.5 39.0L511.3 35.2L509.7 35.3L505.5 40.1L506.2 36.5L504.3 37.6L502.8 36.5L497.2 43.2L495.6 42.7L494.7 46.2L494.7 41.2L497.5 39.0L500.8 34.1L503.7 32.9L504.1 30.4L502.1 27.9L510.8 25.5L510.8 26.8L505.5 31.8L506.8 32.9L511.1 31.2L513.6 28.6L518.1 27.9ZM459.8 23.1L457.4 22.3L457.1 20.6L463.7 20.6L467.9 15.8L469.7 17.9L468.0 19.5L468.4 21.9L465.7 21.9L465.7 23.1L474.6 26.1L477.0 31.8L480.1 32.9L481.0 35.2L479.0 35.2L475.6 39.0L477.0 34.1L469.6 28.2L467.0 27.9L468.4 31.8L467.0 30.4L465.5 32.5L463.7 31.8L459.8 23.1Z'
```

## `lib/tet/boxes.ts`

101 lines · 6,434 bytes

```ts
// ═══════════════════════════════════════════════════════════════════════════
// THE DESIGN COMPANY'S BOX COVERS — twelve of them, and how each one folds.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: a folder of new cover options, to be background-removed
// and shown on the Tết page as foldable boxes. The cutouts and every number
// below came out of scripts/tet/box-cutouts.mjs, which reads the artwork
// rather than being told about it; lib/tet/box-measurements.json is its
// output, and this file is the reading of it.
//
// ONE DIELINE, ELEVEN COVERS. Every 2752 × 1069 cover has its outline at the
// same four places — a glue flap, then four faces under a gabled top:
//
//   x    0 –  115  flap: it tucks inside and is never seen
//   x  115 –  878  the warning and barcode panel        763 wide
//   x  878 – 1652  THE ILLUSTRATION, under the gable    774 wide
//   x 1652 – 2415  Duncan Taylor's text                 763 wide
//   x 2415 – 3200  the crest                            785 wide
//
// Opposite faces match — 763 against 763, and 774 against 785, 1.4% apart —
// which is what says the reading is right: opposite faces of a box must be
// the same size, and if this were mis-read they would not be.
//
// The ±2 px between covers (some measure 114/877/1654/2417) is the JPEG's
// edge, not a different dieline, so one set of folds is used for all eleven
// and each is drawn from its own artwork.
//
// THE TWELFTH IS NOT THE SAME BOX. "COVER COMBO 3 Chai" is 2732 × 1397 with
// no gable and no shoulders — a wrap for the three-bottle box. It has no fold
// table here, so it is shown flat and says so, exactly as Sleeve 2 did until
// its dieline was confirmed. Guessing folds would draw a box that does not
// exist.
//
// ⚠ THE NAMES. Where the artwork signs itself — Chợ Bến Thành, BƯU ĐIỆN — the
// name is read off the picture. Where it does not, the landmark is named only
// when it is unmistakable (the Opera House, Tháp Rùa, Long Biên, Dinh Độc
// Lập). Two are described rather than named, because being wrong in print
// about somebody's temple is worse than being vague.
// ═══════════════════════════════════════════════════════════════════════════

export interface BoxFace { x: number; w: number }

export interface BoxFolds {
  /** The cutout these numbers describe. */
  art: { w: number; h: number; top: number; bottom: number }
  /** Around the box: left end, front, right end, back. */
  faces: { endL: BoxFace; front: BoxFace; endR: BoxFace; back: BoxFace }
}

export interface TetBox {
  slug: string
  /** EN, VN. */
  name: [string, string]
  /** What the tall panel shows, EN and VN. */
  subject: [string, string]
  /** True where the landmark is read off the artwork's own signage. */
  signed?: boolean
  /** Three bottles rather than one. */
  combo?: boolean
  folds: BoxFolds | null
}

/** The shared dieline, in the 3200-wide cutout's own pixels. */
export const HOUSE_FOLDS: BoxFolds = {
  art: { w: 3200, h: 1243, top: 2, bottom: 1242 },
  faces: {
    endL:  { x: 115,  w: 763 },   // warning, barcode
    front: { x: 878,  w: 774 },   // the illustration, under the gable
    endR:  { x: 1652, w: 763 },   // Duncan Taylor
    back:  { x: 2415, w: 785 },   // the crest
  },
}

export const BOXES: TetBox[] = [
  { slug: 'cover-hop-ruou-01', name: ['Chợ Bến Thành', 'Chợ Bến Thành'],
    subject: ['The market clock tower, Sài Gòn', 'Tháp đồng hồ chợ Bến Thành, Sài Gòn'], signed: true, folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-02', name: ['The temple gate', 'Cổng tam quan'],
    subject: ['A triple gateway under cloud', 'Cổng tam quan dưới mây'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-03', name: ['Khuê Văn Các', 'Khuê Văn Các'],
    subject: ['The pavilion over the lotus pond, Hà Nội', 'Gác Khuê Văn bên hồ sen, Hà Nội'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-04', name: ['Bưu Điện', 'Bưu Điện'],
    subject: ['The Central Post Office, Sài Gòn', 'Bưu điện Trung tâm, Sài Gòn'], signed: true, folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-05', name: ['Dinh Độc Lập', 'Dinh Độc Lập'],
    subject: ['The palace and its fountain, Sài Gòn', 'Dinh và đài phun nước, Sài Gòn'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-06', name: ['Tháp Rùa', 'Tháp Rùa'],
    subject: ['The tower on Hoàn Kiếm lake, Hà Nội', 'Tháp Rùa hồ Hoàn Kiếm, Hà Nội'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-07', name: ['The Opera House', 'Nhà hát Thành phố'],
    subject: ['Nhà hát Thành phố, Sài Gòn', 'Nhà hát Thành phố, Sài Gòn'], folds: HOUSE_FOLDS },
  { slug: 'cover-hop-ruou-08', name: ['Cầu Long Biên', 'Cầu Long Biên'],
    subject: ['The bridge over the Red River, Hà Nội', 'Cầu bắc qua sông Hồng, Hà Nội'], folds: HOUSE_FOLDS },
  { slug: 'cover-combo-3-v1', name: ['The dragon · Chợ Bến Thành', 'Rồng · Chợ Bến Thành'],
    subject: ['A dragon above the market', 'Rồng bay trên chợ'], combo: true, folds: HOUSE_FOLDS },
  { slug: 'cover-combo-3-v2', name: ['The dragon · City Hall', 'Rồng · Trụ sở UBND'],
    subject: ['A dragon above the old Hôtel de Ville', 'Rồng bay trên toà thị chính cũ'], combo: true, folds: HOUSE_FOLDS },
  { slug: 'cover-combo-3-v3', name: ['The dragon · the cathedral', 'Rồng · Nhà thờ Đức Bà'],
    subject: ['A dragon above Notre-Dame, Sài Gòn', 'Rồng bay trên Nhà thờ Đức Bà, Sài Gòn'], combo: true, folds: HOUSE_FOLDS },
  { slug: 'cover-combo-3-chai', name: ['The three-bottle wrap', 'Hộp ba chai'],
    subject: ['The dragon over the whole skyline', 'Rồng bay trên toàn cảnh thành phố'], combo: true, folds: null },
]

export const boxArt = (slug: string, px: 640 | 1600 | 3200 = 1600) =>
  `/images/tet/boxes/${slug}-${px}.webp`
```

## `lib/tet/box-measurements.json`

230 lines · 3,788 bytes

```json
[
  {
    "slug": "cover-combo-3-chai",
    "file": "COVER COMBO 3 Chai.jpg",
    "w": 2732,
    "h": 1397,
    "transparent_pct": 4,
    "bbox": {
      "x": 17,
      "y": 17,
      "w": 2698,
      "h": 1397
    },
    "peak": {
      "y": 17,
      "from": 17,
      "to": 2714
    },
    "shoulders": []
  },
  {
    "slug": "cover-combo-3-v1",
    "file": "COVER COMBO 3 v1.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 14,
    "bbox": {
      "x": 0,
      "y": 1,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 1,
      "from": 752,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-combo-3-v2",
    "file": "COVER COMBO 3 v2.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 14,
    "bbox": {
      "x": 0,
      "y": 1,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 1,
      "from": 752,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-combo-3-v3",
    "file": "COVER COMBO 3 v3.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 14,
    "bbox": {
      "x": 0,
      "y": 1,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 1,
      "from": 752,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-hop-ruou-01",
    "file": "COVER HỘP RƯỢU-01.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 15,
    "bbox": {
      "x": 0,
      "y": 3,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 3,
      "from": 753,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-hop-ruou-02",
    "file": "COVER HỘP RƯỢU-02.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 14,
    "bbox": {
      "x": 0,
      "y": 1,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 1,
      "from": 752,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-hop-ruou-03",
    "file": "COVER HỘP RƯỢU-03.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 15,
    "bbox": {
      "x": 0,
      "y": 3,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 3,
      "from": 753,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-hop-ruou-04",
    "file": "COVER HỘP RƯỢU-04.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 14,
    "bbox": {
      "x": 0,
      "y": 1,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 1,
      "from": 752,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-hop-ruou-05",
    "file": "COVER HỘP RƯỢU-05.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 15,
    "bbox": {
      "x": 0,
      "y": 3,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 3,
      "from": 753,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-hop-ruou-06",
    "file": "COVER HỘP RƯỢU-06.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 14,
    "bbox": {
      "x": 0,
      "y": 1,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 1,
      "from": 752,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-hop-ruou-07",
    "file": "COVER HỘP RƯỢU-07.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 15,
    "bbox": {
      "x": 0,
      "y": 3,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 3,
      "from": 753,
      "to": 1429
    },
    "shoulders": []
  },
  {
    "slug": "cover-hop-ruou-08",
    "file": "COVER HỘP RƯỢU-08.jpg",
    "w": 2752,
    "h": 1069,
    "transparent_pct": 14,
    "bbox": {
      "x": 0,
      "y": 1,
      "w": 2752,
      "h": 1069
    },
    "peak": {
      "y": 1,
      "from": 752,
      "to": 1429
    },
    "shoulders": []
  }
]
```

## `lib/tet/queries.ts`

344 lines · 11,515 bytes

```ts
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
```

## `lib/tet/notify.ts`

125 lines · 6,187 bytes

```ts
import { Resend } from 'resend'
import { EMAIL, emailShell } from '@/lib/email/shell'

// SOMEBODY IS TOLD WHEN AN ENQUIRY ARRIVES.
//
// The Tết page has been live behind its gate for three days with no way for
// anybody to learn that somebody used it. An enquiry landed in tet_enquiries
// and sat there. Against a cask window that shuts on 31 October, a buyer who
// waits a week for an answer is a buyer who has bought somewhere else.
//
// ── IT CANNOT LOSE AN ENQUIRY ─────────────────────────────────────────────
// Every failure here is swallowed and reported, never thrown. The enquiry is
// already committed by the time this runs; a mail outage must not turn a saved
// enquiry into a 500 and a buyer who thinks the form is broken and gives up.
// The caller logs what happened and returns the reference regardless.
//
// ── IT DOES NOT SAY WHAT THINGS COST US ───────────────────────────────────
// The email carries what the buyer told us and nothing the club knows: no
// margin, no cost, no cask economics. It is read on a phone, possibly forwarded
// to a colleague, and the Tết cost model has never been allowed near a client.

// ── WHO IS TOLD ───────────────────────────────────────────────────────────
// The club AND Duncan Taylor Vietnam. The owner gave the DT address on
// 2026-09-23 ("tet email is truongminhquy@duncantaylorvn.com"); membership@
// stays on it so the club keeps a copy of its own enquiries rather than
// hearing about them second-hand.
//
// It is a DEFAULT IN THE CODE, not only an environment variable, because
// TET_ENQUIRY_TO is not set in production and an unset variable would have
// meant Duncan Taylor never being told at all. Setting TET_ENQUIRY_TO (a
// comma-separated list) still overrides this completely.
const DEFAULT_TO = 'membership@therampantclub.com,truongminhquy@duncantaylorvn.com'
const TO = (process.env.TET_ENQUIRY_TO || DEFAULT_TO)
  .split(',').map(s => s.trim()).filter(Boolean)

export interface EnquiryNote {
  reference: string
  mode: 'enquiry' | 'reservation'
  company: string
  name: string
  email: string
  phone?: string | null
  kind: string
  caskRef?: string | null
  bottles?: number | null
  message?: string | null
  locale?: string
  personalised?: boolean
}

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The email's body, separated from the sending so it can be inspected without
 *  putting anything in anybody's inbox. */
export function enquiryEmailHtml(e: EnquiryNote): { subject: string; html: string; what: string } {
  const row = (k: string, v: string) => `
    <tr>
      <td style="padding:7px 0;color:${EMAIL.muted};font-size:12px;letter-spacing:.08em;
                 text-transform:uppercase;white-space:nowrap;vertical-align:top;">${esc(k)}</td>
      <td style="padding:7px 0 7px 20px;color:${EMAIL.ink};font-size:15px;line-height:1.6;">${v}</td>
    </tr>`

  const what = e.kind === 'cask'
    ? `A cask${e.caskRef ? ` — ${esc(e.caskRef)}` : ''}`
    : `Blends${e.bottles ? ` — ${e.bottles} bottles` : ''}`

  const inner = `
    <p style="margin:0 0 6px;color:${EMAIL.gold};font-size:12px;letter-spacing:.2em;text-transform:uppercase;">
      Tết Đinh Mùi ${e.mode === 'reservation' ? '· Reserved' : '· Enquiry'}
    </p>
    <h1 style="margin:0 0 4px;color:${EMAIL.ink};font-size:27px;font-weight:500;">${esc(e.company)}</h1>
    <p style="margin:0 0 26px;color:${EMAIL.muted};font-size:14px;">${esc(e.reference)}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${row('Wants', what)}
      ${row('Contact', `${esc(e.name)}<br><a href="mailto:${esc(e.email)}" style="color:${EMAIL.gold};">${esc(e.email)}</a>${e.phone ? `<br>${esc(e.phone)}` : ''}`)}
      ${e.message ? row('They said', esc(e.message)) : ''}
      ${e.personalised ? row('Sleeve', 'They designed one — it is on the enquiry') : ''}
      ${row('Reading', e.locale === 'vn' ? 'Tiếng Việt' : 'English')}
    </table>

    <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid ${EMAIL.rule};
              color:${EMAIL.muted};font-size:13px;line-height:1.8;">
      ${e.mode === 'reservation'
        ? 'The cask is held. Prepare the invoice.'
        : 'Prices are still provisional, so nothing is promised. Reply with the cask list and pricing when it is confirmed.'}
      <br><br>
      Casks must be ordered from Scotland by <strong style="color:${EMAIL.ink};">31 October</strong>.
    </p>`

  return {
    what,
    subject: `Tết ${e.mode === 'reservation' ? 'reservation' : 'enquiry'} — ${e.company} (${e.reference})`,
    // Escaped here too. The body was escaped and these were not, which is the
    // usual shape of this bug: the obvious field gets guarded and the title and
    // the preheader — both of which end up inside markup — do not.
    html: emailShell(inner, {
      title: `Tết — ${esc(e.company)}`,
      preheader: `${esc(what)}. ${esc(e.name)}, ${esc(e.email)}`,
    }),
  }
}

export async function notifyTetEnquiry(e: EnquiryNote): Promise<{ sent: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { sent: false, error: 'no RESEND_API_KEY' }
  if (!TO.length) return { sent: false, error: 'no recipient configured' }

  const { subject, html } = enquiryEmailHtml(e)

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    // Reply-To is the buyer, so hitting reply answers them rather than the club.
    const { error } = await resend.emails.send({
      from: 'The Rampant Club <tet@therampantclub.com>',
      to: TO,
      replyTo: e.email,
      subject,
      html,
    })
    return error ? { sent: false, error: String(error.message || error) } : { sent: true }
  } catch (err) {
    return { sent: false, error: String((err as Error)?.message || err) }
  }
}
```

## `app/tet/page.tsx`

62 lines · 2,887 bytes

```tsx
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'
import { getCategories, getCaskBoard, getBlendBoard, getTiers, getCountdown, getCaskCompass } from '@/lib/tet/queries'
import TetGate from '@/components/tet/TetGate'
import TetProgramme from '@/components/tet/TetProgramme'

// THE TẾT PAGE — public site, behind the door (18+ and a password).
//
// Server-rendered on purpose: the gate is checked before a single figure is
// fetched, so a visitor without a pass never receives the programme at all,
// rather than receiving it and being asked politely not to look.
//
// Data comes through the ANON key, exactly as a browser would get it — so if
// the RLS or the grants are wrong, this page is wrong too and we find out here
// instead of in front of a buyer.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tết Đinh Mùi 2027 · The Rampant Club',
  description: 'Corporate gifting and single casks for Tết 2027.',
  // A password-gated commercial page has no business in a search index.
  robots: { index: false, follow: false },
}

export default async function TetPage() {
  const pass = (await cookies()).get(TET_COOKIE)?.value
  if (!tetPassValid(pass)) return <TetGate />

  // NEVER A CACHED BOARD. supabase-js calls fetch, and Next caches fetch — so a
  // server-rendered page will happily serve yesterday's availability. Caught on
  // 18 Sept: four casks had been marked sold and the page still showed them as
  // held. On a board whose whole job is to say what is gone, a stale answer is
  // worse than a slow one.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url: RequestInfo | URL, init?: RequestInit) => fetch(url, { ...init, cache: 'no-store' }) },
    },
  )

  // Each is guarded separately: a programme with no casks yet should still show
  // its countdown, and a missing countdown should not take the page down.
  const [categories, casks, blends, tiers, countdown, compass] = await Promise.all([
    getCategories(db).catch(() => []),
    getCaskBoard(db).catch(() => []),
    getBlendBoard(db).catch(() => []),
    getTiers(db).catch(() => []),
    getCountdown(db).catch(() => null),
    // The Compass profile of any cask linked to a tagged whisky — confirmed
    // tags only (supabase/migrations/20260922200000_tet2027_cask_compass.sql).
    // Before that migration runs the function does not exist, and a cask
    // simply has no radar.
    getCaskCompass(db).catch(() => []),
  ])

  return <TetProgramme categories={categories} casks={casks} blends={blends} tiers={tiers} countdown={countdown} compass={compass} />
}
```

## `app/admin/tet/page.tsx`

339 lines · 19,526 bytes

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'
import { vnd, pct, type BlendQuote, type CaskQuote, type Countdown } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE QUOTE BUILDER — internal, and the only screen in the club that shows the
// Tết cost model.
// ───────────────────────────────────────────────────────────────────────────
// A salesperson on the phone needs three things the public page must never
// carry: what it costs us, what the margin is at this quantity, and what the
// next tier would do to both. All three come from the database with p_admin
// set, through /api/admin/tet/quote, which is the single place that flag is
// ever sent.
//
// It also shows what is still a placeholder, on the same screen as the prices
// it produces — because a quote built on an invented FX rate looks exactly like
// a real one, and the only thing standing between the two is somebody
// remembering. The banner is there so nobody has to.
// ═══════════════════════════════════════════════════════════════════════════

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const AMBER = '#C49555'
const SAGE = '#7AB07A'
const MUTED = '#B2AA98'

interface Cask { cask_ref: string; distillery: string; region: string; age_years: number; abv_pct: number; status: string; is_placeholder: boolean }
interface Product { sku: string; name_en: string; expression: string | null; uk_list_price_gbp: number; is_placeholder: boolean }
interface Tier { label_en: string; min_bottles: number; max_bottles: number | null; discount_pct: number; sleeve_price_vnd: number }
interface Enquiry {
  reference: string; company_name: string; contact_name: string; contact_email: string
  contact_phone: string | null; kind: string; cask_ref: string | null; message: string | null
  status: string; created_at: string
}

export default function AdminTet() {
  const { t } = useLang()
  const [data, setData] = useState<{
    provisional: boolean | null; countdown: Countdown | null
    audit: { area: string; item: string; detail: string }[]
    enquiries: Enquiry[]; casks: Cask[]; products: Product[]; tiers: Tier[]
  } | null>(null)

  const [mode, setMode] = useState<'blend' | 'cask'>('blend')
  const [qty, setQty] = useState<Record<string, string>>({})
  const [sleeve, setSleeve] = useState(true)
  const [caskRef, setCaskRef] = useState('')
  const [reduced, setReduced] = useState(true)
  const [quote, setQuote] = useState<BlendQuote | CaskQuote | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/tet', { cache: 'no-store' })
    if (r.ok) setData(await r.json())
  }, [])
  useEffect(() => { load() }, [load])

  const price = async () => {
    setBusy(true); setErr(''); setQuote(null)
    try {
      const payload = mode === 'cask'
        ? { kind: 'cask', cask_ref: caskRef, target_abv: reduced ? 50 : null }
        : { kind: 'blend', sleeve, lines: Object.entries(qty).map(([sku, q]) => ({ sku, qty: Number(q) || 0 })).filter(l => l.qty > 0) }
      const r = await fetch('/api/admin/tet/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error === 'empty_order' ? t('Put a quantity in first.', 'Nhập số lượng trước.') : (j.error || 'failed')); return }
      if (j.quote?.error) { setErr(String(j.quote.error)); return }
      setQuote(j.quote)
    } finally { setBusy(false) }
  }

  if (!data) return <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>{t('Loading…', 'Đang tải…')}</div>

  const cd = data.countdown
  const blendQuote = quote && 'total_bottles' in quote ? quote as BlendQuote : null
  const caskQuote = quote && 'cask_ref' in quote ? quote as CaskQuote : null

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: CREAM }}>
            {cd?.season || 'Tết Đinh Mùi 2027'}
          </h1>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 4 }}>
            {t('Duncan Taylor × The Rampant Club · internal quote builder', 'Duncan Taylor × The Rampant Club · công cụ báo giá nội bộ')}
          </div>
        </div>
        <Link href="/tet" target="_blank" style={btnGhost}>{t('The buyer’s page ↗', 'Trang khách hàng ↗')}</Link>
      </div>

      {data.provisional !== false && (
        <div style={{ ...card, borderColor: `${AMBER}66`, background: `${AMBER}10`, marginTop: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: AMBER }}>
            {t('Provisional', 'Tạm thời')}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: CREAM, lineHeight: 1.8, marginTop: 6 }}>
            {t(`Every price below is built on placeholder numbers — ${data.audit.length} of them. Quote from this and you are quoting an invented FX rate. The buyer's page shows no prices at all until these are cleared.`,
               `Mọi mức giá bên dưới đều dựa trên số liệu tạm — ${data.audit.length} mục. Đừng báo giá từ đây. Trang khách hàng chưa hiển thị giá cho đến khi hoàn tất.`)}
          </div>
        </div>
      )}

      {cd && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 16 }}>
          {[
            [t('Casks close', 'Hạn đặt thùng'), cd.cutoffs.cask.date, cd.cutoffs.cask.days_remaining],
            [t('Blends close', 'Hạn đặt pha trộn'), cd.cutoffs.blend.date, cd.cutoffs.blend.days_remaining],
            [t('Artwork', 'Thiết kế'), cd.cutoffs.artwork.date, cd.cutoffs.artwork.days_remaining],
            [t('In hand', 'Giao tận tay'), cd.in_hand_date, cd.days_to_festival],
          ].map(([label, date, days]) => (
            <div key={String(label)} style={card}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED }}>{label}</div>
              <div style={{ fontFamily: SERIF, fontSize: 22, color: Number(days) < 30 ? AMBER : GOLD, marginTop: 4 }}>{days}d</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED, marginTop: 2 }}>{String(date)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── THE BUILDER ──────────────────────────────────────────────── */}
      <section style={{ ...card, marginTop: 22 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => { setMode('blend'); setQuote(null) }} style={tab(mode === 'blend')}>{t('Blends', 'Rượu pha trộn')}</button>
          <button onClick={() => { setMode('cask'); setQuote(null) }} style={tab(mode === 'cask')}>{t('A cask', 'Một thùng')}</button>
        </div>

        {mode === 'blend' ? (
          <>
            {data.products.map(p => (
              <div key={p.sku} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 16, color: CREAM }}>{p.name_en}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED }}>
                    {p.sku}{p.is_placeholder ? ` · ${t('placeholder price', 'giá tạm')}` : ''}
                  </div>
                </div>
                <input inputMode="numeric" value={qty[p.sku] ?? ''} onChange={e => setQty(q => ({ ...q, [p.sku]: e.target.value.replace(/\D/g, '') }))}
                       placeholder="0" style={numField} aria-label={`${p.name_en} quantity`} />
              </div>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 12, color: CREAM, marginTop: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={sleeve} onChange={e => setSleeve(e.target.checked)} style={{ width: 18, height: 18, accentColor: GOLD }} />
              {t('With a printed sleeve', 'Kèm hộp in tên')}
            </label>
          </>
        ) : (
          <>
            <select value={caskRef} onChange={e => setCaskRef(e.target.value)} style={{ ...numField, width: '100%', textAlign: 'left' }}>
              <option value="">{t('Choose a cask…', 'Chọn một thùng…')}</option>
              {data.casks.map(c => (
                <option key={c.cask_ref} value={c.cask_ref}>
                  {c.cask_ref} · {c.distillery} · {c.age_years}yo · {c.abv_pct}%{c.status !== 'available' ? ` · ${c.status}` : ''}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setReduced(false)} style={tab(!reduced)}>{t('Cask strength', 'Nguyên độ')}</button>
              <button onClick={() => setReduced(true)} style={tab(reduced)}>{t('Bottled at 50%', 'Đóng chai 50%')}</button>
            </div>
          </>
        )}

        <button onClick={price} disabled={busy} style={{ ...btnGold, marginTop: 16, opacity: busy ? .5 : 1 }}>
          {busy ? t('Pricing…', 'Đang tính…') : t('Price it', 'Tính giá')}
        </button>
        {err && <div style={{ fontFamily: MONO, fontSize: 11.5, color: '#C27070', marginTop: 10 }}>{err}</div>}

        {blendQuote && <BlendResult q={blendQuote} t={t} />}
        {caskQuote && <CaskResult q={caskQuote} t={t} />}
      </section>

      {/* ── ENQUIRIES ────────────────────────────────────────────────── */}
      <section style={{ ...card, marginTop: 22 }}>
        <h2 style={h2}>{t('Interest registered', 'Đăng ký quan tâm')} <span style={{ color: MUTED, fontSize: 13 }}>{data.enquiries.length}</span></h2>
        {data.enquiries.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.8 }}>
            {t('Nobody yet. They appear here the moment someone fills the form on /tet.',
               'Chưa có ai. Sẽ hiển thị ngay khi có người điền biểu mẫu trên /tet.')}
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            {data.enquiries.map(e => (
              <div key={e.reference} style={{ ...row, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 15, color: CREAM }}>{e.company_name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 3 }}>
                    {e.contact_name} · <a href={`mailto:${e.contact_email}`} style={{ color: GOLD }}>{e.contact_email}</a>
                    {e.contact_phone ? ` · ${e.contact_phone}` : ''}
                  </div>
                  {e.message && <div style={{ fontFamily: MONO, fontSize: 11.5, color: CREAM, marginTop: 6, lineHeight: 1.7 }}>{e.message}</div>}
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: GOLD }}>{e.cask_ref || e.kind}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 3 }}>
                    {new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>{e.reference}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── WHAT IS STILL INVENTED ───────────────────────────────────── */}
      <section style={{ ...card, marginTop: 22, marginBottom: 40 }}>
        <h2 style={h2}>{t('Still to replace', 'Còn phải thay')} <span style={{ color: MUTED, fontSize: 13 }}>{data.audit.length}</span></h2>
        <div style={{ marginTop: 10 }}>
          {data.audit.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', borderTop: i ? '1px solid rgba(229,212,194,.07)' : 'none' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: AMBER, minWidth: 58, textTransform: 'uppercase' }}>{a.area}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: CREAM, minWidth: 150 }}>{a.item}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTED }}>{a.detail}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ */

function BlendResult({ q, t }: { q: BlendQuote; t: (en: string, vn: string) => string }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${GOLD}44` }}>
      <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
        {q.total_bottles} {t('bottles', 'chai')} · {q.tier.label_en} · {pct(q.tier.discount_pct)} {t('off', 'giảm')}
      </div>
      {q.lines.map(l => (
        <div key={l.sku} style={row}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, color: CREAM }}>{l.name_en}</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED }}>
              {l.qty} × {vnd(l.unit_inc_vat_vnd)}
              {l.landed_cost_vnd != null && ` · ${t('cost', 'giá vốn')} ${vnd(l.landed_cost_vnd)}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: SERIF, fontSize: 16, color: CREAM }}>{vnd(l.line_total_vnd)}</div>
            {l.gross_margin_pct != null && (
              <div style={{ fontFamily: MONO, fontSize: 11, color: l.gross_margin_pct < 0.3 ? AMBER : SAGE }}>
                {pct(l.gross_margin_pct, 1)} {t('margin', 'biên lợi nhuận')}
              </div>
            )}
          </div>
        </div>
      ))}
      <Totals rows={[
        [t('Subtotal', 'Tạm tính'), vnd(q.subtotal_vnd)],
        ...(q.setup_fee_vnd ? [[t('Artwork setup', 'Phí thiết kế'), vnd(q.setup_fee_vnd)] as [string, string]] : []),
        [t('Total inc VAT', 'Tổng gồm VAT'), vnd(q.total_inc_vat_vnd)],
        ...(q.total_cost_vnd != null ? [[t('Our cost', 'Giá vốn'), vnd(q.total_cost_vnd)] as [string, string]] : []),
        ...(q.gross_profit_vnd != null ? [[t('Gross profit', 'Lợi nhuận gộp'), vnd(q.gross_profit_vnd)] as [string, string]] : []),
      ]} />
      {q.next_tier && (
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: GOLD, marginTop: 10, lineHeight: 1.7 }}>
          {t(`${q.next_tier.bottles_away} more bottles reaches ${q.next_tier.label_en} — ${Math.round(q.next_tier.discount_pct * 100)}% off.`,
             `Thêm ${q.next_tier.bottles_away} chai sẽ đạt mức ${q.next_tier.label_en} — giảm ${Math.round(q.next_tier.discount_pct * 100)}%.`)}
        </div>
      )}
    </div>
  )
}

function CaskResult({ q, t }: { q: CaskQuote; t: (en: string, vn: string) => string }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${GOLD}44` }}>
      <div style={{ fontFamily: SERIF, fontSize: 18, color: CREAM }}>{q.cask_ref} · {q.distillery}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 3 }}>
        {q.region} · {q.age_years}yo · {q.cask_abv_pct}% → {q.target_abv_pct}%
        {q.extra_bottles > 0 && ` · +${q.extra_bottles} ${t('bottles', 'chai')}`}
      </div>
      <Totals rows={[
        [t('Bottles', 'Số chai'), String(q.bottles)],
        [t('A bottle', 'Mỗi chai'), vnd(q.unit_inc_vat_vnd)],
        [t('The cask', 'Cả thùng'), vnd(q.cask_total_vnd)],
        ...(q.landed_cost_vnd != null ? [[t('Cost a bottle', 'Giá vốn mỗi chai'), vnd(q.landed_cost_vnd)] as [string, string]] : []),
        ...(q.gross_margin_pct != null ? [[t('Margin', 'Biên lợi nhuận'), pct(q.gross_margin_pct, 1)] as [string, string]] : []),
        ...(q.gross_profit_vnd != null ? [[t('Gross profit', 'Lợi nhuận gộp'), vnd(q.gross_profit_vnd)] as [string, string]] : []),
      ]} />
    </div>
  )
}

function Totals({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ marginTop: 12 }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', borderTop: i ? '1px solid rgba(229,212,194,.07)' : 'none' }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTED }}>{k}</span>
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: CREAM }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */

const card: React.CSSProperties = {
  border: '1px solid rgba(229,212,194,.14)', borderRadius: 12, padding: '16px 18px',
  background: 'rgba(229,212,194,.03)',
}
const h2: React.CSSProperties = { fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: CREAM, margin: 0 }
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
  borderBottom: '1px solid rgba(229,212,194,.07)',
}
const numField: React.CSSProperties = {
  width: 90, minHeight: 42, padding: '0 12px', borderRadius: 8, textAlign: 'right',
  background: 'rgba(229,212,194,.07)', border: '1px solid rgba(229,212,194,.2)',
  color: CREAM, fontFamily: MONO, fontSize: 15, outline: 'none',
}
const tab = (on: boolean): React.CSSProperties => ({
  fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
  padding: '9px 14px', minHeight: 38, borderRadius: 8, cursor: 'pointer',
  background: on ? CREAM : 'none', color: on ? '#052E20' : CREAM,
  border: on ? 'none' : '1px solid rgba(229,212,194,.25)',
})
const btnGold: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
  padding: '12px 24px', minHeight: 44, borderRadius: 8, cursor: 'pointer',
  background: GOLD, color: '#052E20', border: 'none',
}
const btnGhost: React.CSSProperties = {
  fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
  padding: '10px 16px', borderRadius: 8, textDecoration: 'none',
  background: 'none', color: CREAM, border: '1px solid rgba(229,212,194,.25)',
}
```

## `app/api/tet/enter/route.ts`

71 lines · 3,070 bytes

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mintTetPass, TET_COOKIE, tetCookieOpts } from '@/lib/tet/gate'

// THE DOOR TO /tet — 18+ and a shared password, in one request.
//
// The password is checked by tet_check_access in Postgres, which compares a
// bcrypt hash and returns only true or false. The hash never comes here, so a
// leak of this route's code or logs cannot leak the password.
//
// RATE LIMITED, because a shared password with no limit is a password anyone
// patient can have. Ten attempts per IP per ten minutes: generous for someone
// mistyping a phrase from a leaflet, useless for a script.

export const dynamic = 'force-dynamic'

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { n: number; until: number }>()

function tooMany(ip: string): boolean {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || rec.until < now) { attempts.set(ip, { n: 1, until: now + WINDOW_MS }); return false }
  rec.n += 1
  // Keep the map from growing without bound on a long-lived instance.
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.until < now) attempts.delete(k)
  return rec.n > MAX_ATTEMPTS
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (tooMany(ip)) {
    return NextResponse.json({ error: 'too_many', message: 'Too many attempts. Try again in a few minutes.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : ''
  const age = body?.age_confirmed === true

  // The 18+ confirmation is not decoration: the database refuses a reservation
  // without one, so the door asks the same question the reservation will.
  if (!age) {
    return NextResponse.json({ error: 'age_not_confirmed', message: 'Please confirm you are 18 or over.' }, { status: 400 })
  }
  if (!password.trim()) {
    return NextResponse.json({ error: 'no_password', message: 'Please enter the password.' }, { status: 400 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await sb.rpc('tet_check_access', { p_password: password })

  if (error) {
    // Most likely: the migration has not been run. Say which, rather than
    // "something went wrong" at a door nobody can open.
    const missing = /could not find the function|does not exist/i.test(error.message)
    return NextResponse.json({
      error: 'not_configured',
      message: missing
        ? 'The Tết page is not set up yet.'
        : 'Could not check that just now.',
    }, { status: 503 })
  }
  if (data !== true) {
    return NextResponse.json({ error: 'wrong_password', message: 'That password is not right.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(TET_COOKIE, mintTetPass(), tetCookieOpts)
  return res
}
```

## `app/api/tet/quote/route.ts`

45 lines · 2,196 bytes

```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'

// A PRICE FOR THE PAGE — the buyer's side, never the cost side.
//
// It calls tet_quote_blends_public, which hard-codes p_admin => false, so the
// answer carries finished VND figures and nothing else: no ex-works, no
// freight, no margin. The admin flag is reachable only from /api/admin/tet/quote,
// behind isAdmin.
//
// Behind the door as well, because the prices are the reason the door exists.
//
// AND IT REFUSES WHILE ANYTHING IS PROVISIONAL. Every figure in the system is
// still invented; a quote built on an invented FX rate looks exactly like a real
// one once it is on a screen. The page asks for a price only when the flags are
// cleared, and this refuses in case a page somewhere forgets.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const pass = (await cookies()).get(TET_COOKIE)?.value
  if (!tetPassValid(pass)) return NextResponse.json({ error: 'not_open' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const lines = Array.isArray(body?.lines)
    ? body.lines
        .filter((l: { sku?: string; qty?: number }) => typeof l?.sku === 'string' && Number(l?.qty) > 0)
        .slice(0, 10)
        .map((l: { sku: string; qty: number }) => ({ sku: l.sku, qty: Math.min(10000, Math.round(Number(l.qty))) }))
    : []
  if (!lines.length) return NextResponse.json({ error: 'empty_order' }, { status: 400 })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: provisional } = await sb.rpc('tet_is_provisional')
  if (provisional !== false) {
    return NextResponse.json({ error: 'provisional', message: 'Prices are not published yet.' }, { status: 409 })
  }

  const { data, error } = await sb.rpc('tet_quote_blends_public', { p_lines: lines, p_sleeve: body?.sleeve !== false })
  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 })
  return NextResponse.json({ quote: data })
}
```

## `app/api/tet/reserve/route.ts`

174 lines · 8,638 bytes

```ts
import { notifyTetEnquiry } from '@/lib/tet/notify'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'

// RESERVE, OR REGISTER INTEREST — the page's only action.
//
// Which of the two it is is decided HERE, not by the buyer and not by the
// browser: while any cask, product or the programme still carries the
// placeholder flag, a "reservation" would hold a cask that does not exist and
// issue a reference for it. So the same submission becomes an enquiry, and
// nothing changes status.
//
// THE 18+ STAMP. The door already refused entry without it, and a valid pass
// is proof it was given — so the confirmation is recorded here with its
// timestamp rather than asked for twice. If the door ever stops asking, this
// must start.
//
// Everything runs through the service role behind the gate, so the contact
// details land in a table anon cannot read, and the rate limit is ours.

export const dynamic = 'force-dynamic'

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_HOUR = 20
const hits = new Map<string, { n: number; until: number }>()

function tooMany(ip: string): boolean {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || rec.until < now) { hits.set(ip, { n: 1, until: now + WINDOW_MS }); return false }
  rec.n += 1
  if (hits.size > 5000) for (const [k, v] of hits) if (v.until < now) hits.delete(k)
  return rec.n > MAX_PER_HOUR
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(req: Request) {
  const pass = (await cookies()).get(TET_COOKIE)?.value
  if (!tetPassValid(pass)) {
    return NextResponse.json({ error: 'not_open', message: 'Please enter through the front of the page.' }, { status: 403 })
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (tooMany(ip)) {
    return NextResponse.json({ error: 'too_many', message: 'Too many submissions. Try again later.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const kind = body?.kind === 'cask' ? 'cask' : 'blend'
  const company = str(body?.company_name)
  const name = str(body?.contact_name)
  const email = str(body?.contact_email)
  const phone = str(body?.contact_phone, 40)
  const tax = str(body?.tax_code, 40)
  const message = str(body?.message, 1200)
  const locale = body?.locale === 'vn' ? 'vn' : 'en'
  const caskRef = str(body?.cask_ref, 40) || null
  const targetAbv = typeof body?.target_abv === 'number' ? body.target_abv : null
  const lines = Array.isArray(body?.lines) ? body.lines.slice(0, 20) : []
  const sleeve = body?.sleeve !== false

  if (!company || !name || !email) {
    return NextResponse.json({ error: 'missing_contact', message: 'Company, name and email are needed.' }, { status: 400 })
  }
  // Deliberately loose: an address this side of the invoice only has to be
  // something a person can be replied to at.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'bad_email', message: 'That email address does not look right.' }, { status: 400 })
  }
  if (kind === 'cask' && !caskRef) {
    return NextResponse.json({ error: 'no_cask', message: 'No cask was chosen.' }, { status: 400 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: provisional, error: provErr } = await sb.rpc('tet_is_provisional')
  if (provErr) {
    const missing = /could not find the function|does not exist/i.test(provErr.message)
    return NextResponse.json({
      error: 'not_configured',
      message: missing ? 'The Tết programme is not finished being set up.' : 'Could not take that just now.',
    }, { status: 503 })
  }

  // ── PROVISIONAL: an enquiry, and nothing that pretends otherwise ──────
  if (provisional !== false) {
    const { data, error } = await sb.from('tet_enquiries').insert({
      company_name: company, contact_name: name, contact_email: email,
      contact_phone: phone || null, tax_code: tax || null,
      age_confirmed_at: new Date().toISOString(), locale,
      kind, cask_ref: caskRef,
      bottling_strength: kind === 'cask' ? (targetAbv && targetAbv < 60 ? 'reduced' : 'cask_strength') : null,
      line_items: lines, total_bottles: lines.reduce((s: number, l: { qty?: number }) => s + (Number(l?.qty) || 0), 0) || null,
      message: message || null, source: str(body?.source, 40) || 'tet-page',
      // The sleeve design, as they left it in the studio. Colour, words and the
      // storage path of their logo — the conversation, already half had.
      personalisation: body?.personalisation && typeof body.personalisation === 'object' ? body.personalisation : {},
    }).select('reference').single()
    if (error) return NextResponse.json({ error: 'save_failed', message: error.message }, { status: 500 })

    // TELL SOMEBODY. Awaited so it actually runs before the function is frozen
    // — a fire-and-forget promise on a serverless platform is a promise that
    // may never resolve — but its result is never allowed to affect the reply.
    // The enquiry is already saved; a mail outage must not become a 500 that
    // sends a buyer away thinking the form is broken.
    const sent = await notifyTetEnquiry({
      reference: data.reference, mode: 'enquiry',
      company, name, email, phone: phone || null,
      kind, caskRef,
      bottles: lines.reduce((s2: number, l: { qty?: number }) => s2 + (Number(l?.qty) || 0), 0) || null,
      message: message || null, locale,
      personalised: !!(body?.personalisation && Object.keys(body.personalisation as object).length),
    })
    if (!sent.sent) console.error('[tet] enquiry', data.reference, 'saved but NOT notified:', sent.error)

    return NextResponse.json({ mode: 'enquiry', reference: data.reference })
  }

  // ── REAL: a reservation, which holds the cask ─────────────────────────
  const args = {
    p_company: company, p_contact_name: name, p_contact_email: email,
    p_contact_phone: phone || null, p_tax_code: tax || null,
    p_personalisation: body?.personalisation ?? {},
    p_split_delivery: body?.split_delivery ?? [],
    p_age_confirmed: true,   // proved by the pass — see the note at the top
    p_locale: locale, p_source: str(body?.source, 40) || 'tet-page',
  }
  const { data, error } = kind === 'cask'
    ? await sb.rpc('tet_reserve_cask', { ...args, p_cask_ref: caskRef, p_target_abv: targetAbv })
    : await sb.rpc('tet_reserve_blends', { ...args, p_lines: lines, p_sleeve: sleeve })

  if (error) {
    // The ordering gate speaks in exceptions; turn it into something a buyer
    // can act on rather than a raised Postgres error.
    const closed = /ordering_closed_for/.test(error.message)
    return NextResponse.json({
      error: closed ? 'ordering_closed' : 'save_failed',
      message: closed
        ? 'The last order date for this has passed. Please speak to us directly.'
        : 'Could not take that just now.',
    }, { status: closed ? 409 : 500 })
  }
  if (data && typeof data === 'object' && 'error' in data) {
    return NextResponse.json({ error: data.error, message: readable(String(data.error)) }, { status: 409 })
  }
  // A reservation holds a cask, so it matters more than an enquiry, not less.
  const ref = (data as { reference?: string } | null)?.reference
  if (ref) {
    const sent = await notifyTetEnquiry({
      reference: ref, mode: 'reservation',
      company, name, email, phone: phone || null,
      kind, caskRef,
      bottles: lines.reduce((s2: number, l: { qty?: number }) => s2 + (Number(l?.qty) || 0), 0) || null,
      message: message || null, locale,
      personalised: !!(body?.personalisation && Object.keys(body.personalisation as object).length),
    })
    if (!sent.sent) console.error('[tet] reservation', ref, 'saved but NOT notified:', sent.error)
  }

  return NextResponse.json({ mode: 'reservation', ...data })
}

function readable(code: string): string {
  switch (code) {
    case 'cask_unavailable': return 'That cask has just been taken.'
    case 'cask_not_found': return 'That cask is no longer listed.'
    case 'below_minimum': return 'The minimum order is fifty bottles.'
    case 'age_not_confirmed': return 'Please confirm you are 18 or over.'
    case 'missing_contact': return 'Company and email are needed.'
    default: return 'That could not be completed.'
  }
}
```

## `app/api/tet/artwork/route.ts`

102 lines · 5,021 bytes

```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { TET_COOKIE, tetPassValid } from '@/lib/tet/gate'

// THE BUYER'S LOGO.
//
// It goes into a PRIVATE bucket. A customer's logo is their property and is
// often unreleased — it is never given a public URL, and the enquiry records
// only the path.
//
// ── THE BYTES NO LONGER COME THROUGH HERE (2026-09-21) ────────────────────
// The limit went from 2MB to 5MB, and raising the number alone would not have
// worked. The file used to arrive as a base64 data URL in the JSON body, and
// base64 is 4/3 the size: a 5MB logo is ~6.7MB on the wire. A serverless
// function on Vercel rejects a request body over 4.5MB before any of this code
// runs, so the upload would have failed with a platform 413 that no message
// here could soften — and it would have failed in production only, because
// `next dev` has no such limit.
//
// So this route hands out a SIGNED UPLOAD URL and the browser PUTs the file
// straight to storage. Nothing large crosses the function at all, which also
// means the ceiling is no longer the largest thing we can carry — it is just
// the number we chose. It is 25MB.
//
// WHAT STILL GUARDS IT:
//   · the pass — the same door as the rest of the page
//   · the rate limit — 20 an hour per IP, unchanged
//   · the mime type — png, jpeg or webp. An SVG is a document that can carry
//     script, and this one is opened later by a member of staff
//   · the SIZE, at the bucket. file_size_limit is 25MB and Supabase enforces
//     it on the real upload, so a client that lies about `size` is refused by
//     storage rather than trusted. The check below is only there to say so
//     politely before the file is sent.
//
//     ⚠ THE BUCKET IS THE REAL CEILING. Raising MAX_BYTES here without raising
//     `file_size_limit` on the tet-artwork bucket changes nothing: the browser
//     is told the file is fine and then storage refuses the PUT. Both moved
//     together on 2026-10-01, from 5MB to 25MB — a customer sent a 20.9MB
//     logo, which is an ordinary size for an unflattened brand export.
//   · the path — minted here, never supplied by the caller, so nobody can
//     aim an upload at somebody else's object
//
// The file is never decoded, resized or inspected: it is handed to the
// customer's own designer eventually, and re-encoding someone's logo is how a
// brand team ends up with a blurry one.

export const dynamic = 'force-dynamic'

const MAX_BYTES = 25 * 1024 * 1024
const KIND: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_HOUR = 20
const hits = new Map<string, { n: number; until: number }>()
function tooMany(ip: string): boolean {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || rec.until < now) { hits.set(ip, { n: 1, until: now + WINDOW_MS }); return false }
  rec.n += 1
  if (hits.size > 5000) for (const [k, v] of hits) if (v.until < now) hits.delete(k)
  return rec.n > MAX_PER_HOUR
}

export async function POST(req: Request) {
  const pass = (await cookies()).get(TET_COOKIE)?.value
  if (!tetPassValid(pass)) return NextResponse.json({ error: 'not_open' }, { status: 403 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (tooMany(ip)) return NextResponse.json({ error: 'too_many', message: 'Too many uploads. Try again later.' }, { status: 429 })

  const body = await req.json().catch(() => null)
  const mime = typeof body?.content_type === 'string' ? body.content_type : ''
  const size = Number(body?.size)

  if (!KIND[mime]) {
    return NextResponse.json({ error: 'bad_file', message: 'Please use a PNG, JPEG or WebP.' }, { status: 400 })
  }
  if (Number.isFinite(size) && size > MAX_BYTES) {
    return NextResponse.json({
      error: 'too_big',
      message: `That file is ${(size / 1048576).toFixed(1)}MB. The limit is 5MB.`,
    }, { status: 400 })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const path = `logos/${randomUUID()}.${KIND[mime]}`
  const { data, error } = await sb.storage.from('tet-artwork').createSignedUploadUrl(path)
  if (error || !data) {
    const missing = /not found|does not exist/i.test(error?.message ?? '')
    return NextResponse.json({
      error: 'upload_failed',
      message: missing ? 'Artwork storage is not set up yet.' : 'That did not upload.',
    }, { status: 503 })
  }

  // The browser gets a one-shot URL for this path and nothing else. Only the
  // path travels on to the enquiry; the image comes back through an admin
  // route when somebody is actually preparing the sleeve.
  return NextResponse.json({ ok: true, path, signed_url: data.signedUrl, max_bytes: MAX_BYTES })
}
```

## `app/api/admin/tet/route.ts`

38 lines · 2,164 bytes

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// EVERYTHING THE INTERNAL TẾT PAGE NEEDS, IN ONE CALL.
//
// Admin-gated and service-role: this is the side of the programme the browser
// on /tet may never see — the enquiries with their contact details, and the
// list of what is still a placeholder.
//
// The quote itself is a separate route, because it is a POST and because the
// margin it returns deserves a boundary of its own.

export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()

  // Each guarded: a missing migration should cost that panel, not the page.
  const [provisional, countdown, audit, enquiries, casks, products, tiers] = await Promise.all([
    sb.rpc('tet_is_provisional').then(r => r.data ?? null, () => null),
    sb.rpc('tet_countdown').then(r => r.data ?? null, () => null),
    sb.rpc('tet_placeholder_audit').then(r => r.data ?? [], () => []),
    sb.from('tet_enquiries').select('reference, company_name, contact_name, contact_email, contact_phone, kind, cask_ref, message, status, created_at')
      .order('created_at', { ascending: false }).limit(50).then(r => r.data ?? [], () => []),
    sb.from('tet_casks').select('cask_ref, distillery, region, age_years, abv_pct, status, is_placeholder, display_order')
      .eq('is_active', true).order('display_order').then(r => r.data ?? [], () => []),
    sb.from('tet_products').select('sku, name_en, expression, uk_list_price_gbp, is_placeholder')
      .eq('is_active', true).order('display_order').then(r => r.data ?? [], () => []),
    sb.from('tet_volume_tiers').select('label_en, min_bottles, max_bottles, discount_pct, sleeve_price_vnd')
      .order('min_bottles').then(r => r.data ?? [], () => []),
  ])

  return NextResponse.json({ provisional, countdown, audit, enquiries, casks, products, tiers })
}
```

## `app/api/admin/tet/quote/route.ts`

43 lines · 2,082 bytes

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// THE QUOTE BUILDER'S ONE ROUTE — the only place p_admin => true is ever sent.
//
// That flag is what makes tet_quote_blends and tet_quote_cask return landed
// cost, gross margin per line and gross profit on the order. The browser cannot
// reach those functions at all (foundations §14 revokes them from anon and
// authenticated, and the public wrappers hard-code false), so a margin can only
// come from here, behind isAdmin, with the service-role key.
//
// If this route is ever made public, the cost model is public. There is no
// second line of defence behind it.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  if (body?.kind === 'cask') {
    const ref = typeof body.cask_ref === 'string' ? body.cask_ref : ''
    if (!ref) return NextResponse.json({ error: 'no_cask' }, { status: 400 })
    const { data, error } = await sb.rpc('tet_quote_cask', {
      p_cask_ref: ref,
      p_target_abv: typeof body.target_abv === 'number' ? body.target_abv : null,
      p_admin: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ quote: data })
  }

  const lines = Array.isArray(body?.lines) ? body.lines.filter((l: { sku?: string; qty?: number }) => l?.sku && Number(l.qty) > 0) : []
  if (!lines.length) return NextResponse.json({ error: 'empty_order' }, { status: 400 })
  const { data, error } = await sb.rpc('tet_quote_blends', {
    p_lines: lines, p_sleeve: body?.sleeve !== false, p_admin: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote: data })
}
```

## `components/tet/TetGate.tsx`

269 lines · 15,440 bytes

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'

// THE DOOR, AS A VISITOR SEES IT. One screen: confirm 18 or over, type the
// password. Both in one submission, because the server requires both and two
// screens for two facts is one screen too many.
//
// Bilingual throughout — the buyer for a Vietnamese company's Tết gifting is
// more likely reading the Vietnamese.
//
// ── IT IS THE FIRST THING A BUYER SEES ────────────────────────────────────
// Owner, 2026-09-30: "This page neeeds to be more exciting", then "Maybe the
// two logos side by side as opposed to the two words..."
//
// It was a form on a flat green field: a centred box, two lines of grey type
// and a cream button. Everything behind it — twenty single casks, the labels,
// the boxes — was hidden behind a door that looked like a login.
//
// So: the two CRESTS, side by side over a hairline, because a joint programme
// is announced by two marks and not by two words in 11px mono. The club's
// whisky lit by a fire, full-bleed and bleeding off the right, which is the
// only thing on this page that says what is behind it. And the title set as
// large as the page will take.
//
// WHAT DID NOT CHANGE: the age confirmation, the password, and the line about
// this not being an offer for sale. Those are the door, and the door is the
// point — the rest is only the reason to knock.

export default function TetGate() {
  const { t } = useLang()
  const [password, setPassword] = useState('')
  const [age, setAge] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [invited, setInvited] = useState(false)

  // THE INVITE LINK. /tet?k=the-phrase fills the password in, so a buyer
  // scanning the QR on a leaflet has one thing left to do: confirm their age.
  // That confirmation is never skipped — it is the half of this door that the
  // law cares about, and the database refuses a reservation without it.
  //
  // The key is stripped from the address bar immediately: a password sitting in
  // browser history, or in a screenshot of a phone handed round a meeting room,
  // is a password that has left the leaflet.
  useEffect(() => {
    const url = new URL(window.location.href)
    const k = url.searchParams.get('k')
    if (!k) return
    setPassword(k)
    setInvited(true)
    url.searchParams.delete('k')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/tet/enter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, age_confirmed: age }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.message || t('That did not work.', 'Không thành công.')); return }
      // A full reload, not a router push: the page is server-rendered behind
      // the cookie the server has just set.
      window.location.reload()
    } catch {
      setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.'))
    } finally { setBusy(false) }
  }

  const ready = !busy && age && !!password.trim()

  return (
    <main className="tg">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* THE WHISKY, LIT. One photograph, full height, bleeding off the right
          on a desk and sitting behind everything on a phone. The gradient over
          it is what stops it being a picture with words on top: the green eats
          its edge, so the page has one surface, not two. */}
      <div className="tg-art" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/tet/octave-fire.webp" alt="" />
        <span className="tg-fade" />
        <span className="tg-glow" />
      </div>

      {/* The door asks for a password in two languages, so it has to offer the
          switch as well. A Vietnamese buyer should not have to read English to
          find out how to read Vietnamese. */}
      <div className="tg-lang"><LangToggle /></div>

      <div className="tg-col">
        {/* TWO CRESTS, NOT TWO WORDS (owner, 2026-09-30). The club's lion and
            Duncan Taylor's crest, set to the same optical height either side of
            a hairline — the way a joint bottling is signed. */}
        <div className="tg-marks">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tg-mark tg-mark-trc" src="/images/logo-mark-cream.svg" alt="The Rampant Club" />
          <span className="tg-rule" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tg-mark tg-mark-dt" src="/images/tet/dt-crest.png" alt="Duncan Taylor Scotch Whisky" />
        </div>

        <h1 className="tg-title">Tết Đinh Mùi<span>2027</span></h1>
        <p className="tg-lede">
          {t('Twenty single casks from Duncan Taylor, bottled and dressed for the year of the goat — your company’s name on the label.',
             'Hai mươi thùng rượu đơn từ Duncan Taylor, đóng chai và khoác áo cho năm Đinh Mùi — tên công ty quý vị trên nhãn.')}
        </p>

        <form onSubmit={submit} className="tg-form">
          <div className="tg-door">{t('Please confirm your age and enter the password you were given.',
                                      'Vui lòng xác nhận độ tuổi và nhập mật khẩu đã được cung cấp.')}</div>

          <label className="tg-check">
            <input type="checkbox" checked={age} onChange={e => setAge(e.target.checked)} />
            <span>{t('I am 18 years of age or over', 'Tôi từ 18 tuổi trở lên')}</span>
          </label>

          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('Password', 'Mật khẩu')}
            autoComplete="off" spellCheck={false}
            className="tg-field" aria-label={t('Password', 'Mật khẩu')}
          />
          {invited && (
            <div className="tg-note">{t('Password filled in from your invitation.', 'Mật khẩu đã được điền từ lời mời của bạn.')}</div>
          )}

          {err && <div className="tg-err">{err}</div>}

          <button type="submit" disabled={!ready} className="tg-btn" style={{ opacity: ready ? 1 : 0.42 }}>
            {busy ? t('One moment…', 'Chờ một chút…') : <>{t('Enter', 'Vào trang')} <span className="tg-go" aria-hidden="true">→</span></>}
          </button>
        </form>

        <p className="tg-fine">
          {t('Nothing on this page is an offer for sale. Prices are indicative and any order is completed on invoice.',
             'Nội dung trang này không phải là lời chào bán. Giá chỉ mang tính tham khảo; đơn hàng được hoàn tất bằng hóa đơn.')}
        </p>
      </div>
    </main>
  )
}

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const GREEN = '#052E20'

const CSS = `
.tg { position: relative; min-height: 100dvh; background: ${GREEN}; color: ${CREAM};
      display: flex; align-items: center; overflow: hidden;
      padding: clamp(28px, 6vh, 72px) clamp(22px, 7vw, 96px); }

/* ── the photograph ───────────────────────────────────────────────────── */
.tg-art { position: absolute; inset: 0 0 0 42%; z-index: 0; }
.tg-art img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 42%; display: block;
              /* The scrim over it is green, and green on amber goes to mud.
                 A little saturation back keeps the whisky the colour it is. */
              filter: saturate(1.12) contrast(1.04);
              /* THE PICTURE FADES OUT RATHER THAN BEING PAINTED OVER (owner,
                 2026-09-30: "fade out the octave image better"). Green washed
                 over the photograph left a visible seam where the wash ended
                 and dulled everything it crossed. A MASK dissolves the image
                 itself into the page, so there is no edge to see: transparent
                 at the left, opaque by the time it reaches the whisky, and
                 softened along the top and bottom so it is not a rectangle. */
              -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.08) 12%, rgba(0,0,0,.42) 30%, rgba(0,0,0,.86) 50%, #000 66%),
                                  linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
              -webkit-mask-composite: source-in;
              mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,.08) 12%, rgba(0,0,0,.42) 30%, rgba(0,0,0,.86) 50%, #000 66%),
                          linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
              mask-composite: intersect; }
/* Green over the left edge of the picture, so the two surfaces are one. */
.tg-fade { position: absolute; inset: 0;
           background: linear-gradient(90deg, rgba(5,46,32,.55) 0%, rgba(5,46,32,.30) 22%, rgba(5,46,32,.10) 46%, rgba(5,46,32,0) 70%); }
/* The fire moves. Barely — a room with a fire in it is never quite still, and
   a still photograph of one reads as a poster. */
.tg-glow { position: absolute; inset: 0; pointer-events: none;
           background: radial-gradient(52% 44% at 28% 56%, rgba(212,150,60,.30), rgba(212,150,60,0) 70%);
           animation: tg-flicker 7.5s ease-in-out infinite; }
@keyframes tg-flicker {
  0%, 100% { opacity: .55; transform: scale(1); }
  38%      { opacity: .95; transform: scale(1.04); }
  61%      { opacity: .68; transform: scale(.99); }
}

.tg-lang { position: fixed; top: 18px; right: 18px; z-index: 3; }

.tg-col { position: relative; z-index: 2; width: min(520px, 100%); }

/* ── the two crests ───────────────────────────────────────────────────── */
.tg-marks { display: flex; align-items: center; gap: clamp(16px, 3vw, 26px); }
.tg-mark { display: block; width: auto; }
.tg-mark-trc { height: clamp(58px, 8vh, 84px); }
/* The DT crest is round and the lion is tall, so they are matched by EYE and
   not by number: the same height would leave the round one looking larger. */
.tg-mark-dt  { height: clamp(48px, 6.6vh, 68px); }
.tg-rule { width: 1px; align-self: stretch; margin: 6px 0;
           background: linear-gradient(180deg, rgba(229,212,194,0), rgba(229,212,194,.45), rgba(229,212,194,0)); }

/* THE GAP THE EYEBROW USED TO HOLD (owner, 2026-09-30: "keep the gap between
   the logos and the header though"). Deleting the line above the title closed
   the space it occupied as well, and the crests ended up sitting on the T. */
.tg-title { font-family: ${SERIF}; font-weight: 500; line-height: .94; margin: clamp(46px, 7.5vh, 82px) 0 0;
            font-size: clamp(44px, 8.4vw, 92px); letter-spacing: -.01em; }
/* The year drops to its own line and takes the gold: a date is a fact, and the
   festival is the name. */
.tg-title span { display: block; color: ${GOLD}; font-size: .62em; letter-spacing: .04em; margin-top: .08em; }
.tg-lede { font-family: ${MONO}; font-size: 13.5px; line-height: 1.95; color: rgba(229,212,194,.80);
           margin: 22px 0 0; max-width: 46ch; }

/* ── the door ─────────────────────────────────────────────────────────── */
.tg-form { margin-top: clamp(26px, 5vh, 44px); padding-top: clamp(22px, 4vh, 34px);
           border-top: 1px solid rgba(229,212,194,.16); }
.tg-door { font-family: ${MONO}; font-size: 12px; line-height: 1.8; color: rgba(229,212,194,.6); margin-bottom: 18px; }
.tg-check { display: flex; align-items: center; gap: 12px; font-family: ${MONO}; font-size: 13.5px;
            color: ${CREAM}; cursor: pointer; margin-bottom: 16px; user-select: none; }
.tg-check input { width: 22px; height: 22px; accent-color: ${GOLD}; cursor: pointer; flex: none; }
.tg-field { width: 100%; min-height: 54px; padding: 0 16px; border-radius: 8px; box-sizing: border-box;
            background: rgba(229,212,194,.07); border: 1px solid rgba(229,212,194,.22);
            color: ${CREAM}; font-family: ${MONO}; font-size: 16px; outline: none;
            transition: border-color .25s ease, background .25s ease; }
.tg-field:focus { border-color: rgba(212,184,90,.7); background: rgba(229,212,194,.10); }
.tg-note { font-family: ${MONO}; font-size: 11px; color: rgba(229,212,194,.55); margin-top: 8px; }
.tg-err  { font-family: ${MONO}; font-size: 12px; color: #C27070; margin-top: 12px; line-height: 1.7; }
.tg-btn { width: 100%; min-height: 54px; margin-top: 14px; border-radius: 8px; cursor: pointer;
          background: ${GOLD}; color: ${GREEN}; border: none;
          font-family: ${MONO}; font-size: 13px; letter-spacing: .12em; text-transform: uppercase;
          transition: transform .2s ease, box-shadow .3s ease; }
.tg-btn:not(:disabled):hover { box-shadow: 0 10px 30px rgba(212,184,90,.22); }
.tg-btn:disabled { cursor: not-allowed; }
.tg-go { display: inline-block; margin-left: 6px; transition: transform .3s ease; }
.tg-btn:not(:disabled):hover .tg-go { transform: translateX(6px); }
.tg-fine { font-family: ${MONO}; font-size: 10.5px; color: rgba(229,212,194,.42); line-height: 1.8; margin-top: 26px; max-width: 52ch; }

/* ── a phone: the picture is a BAND, not a backdrop ───────────────────── */
/* Behind the whole page it fought the words: the label sat under the age
   confirmation and both lost. A band across the top is the same picture doing
   the same job — say what is behind the door — without anything reading
   through it. */
@media (max-width: 860px) {
  .tg { display: block; align-items: stretch; padding: 0 0 clamp(34px, 7vh, 60px); }
  .tg-art { position: relative; inset: auto; width: 100%; height: 40vh; min-height: 260px; }
  .tg-art img { object-position: 56% 38%;
                -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 42%, rgba(0,0,0,.55) 72%, transparent 100%);
                -webkit-mask-composite: source-over;
                mask-image: linear-gradient(180deg, #000 0%, #000 42%, rgba(0,0,0,.55) 72%, transparent 100%);
                mask-composite: add; }
  .tg-fade { background: linear-gradient(180deg, rgba(5,46,32,.30) 0%, rgba(5,46,32,.10) 34%, rgba(5,46,32,.35) 78%, rgba(5,46,32,.55) 100%); }
  .tg-glow { background: radial-gradient(62% 44% at 44% 58%, rgba(212,150,60,.34), rgba(212,150,60,0) 72%); }
  .tg-col { width: 100%; padding: 0 clamp(22px, 6vw, 34px); margin-top: -7vh; }
  .tg-marks { gap: 18px; }
  .tg-lede { font-size: 13px; }
}

@media (prefers-reduced-motion: reduce) {
  .tg-glow { animation: none; opacity: .7; }
  .tg-btn, .tg-go, .tg-field { transition: none; }
}
`
```

## `components/tet/TetProgramme.tsx`

896 lines · 51,681 bytes

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'
import NavOverlay from '@/components/NavOverlay'
import { PublicPage, Masthead, SectionHead, Details, Cta, MONO, GOLD } from '@/components/public/kit'
import { timeRemaining } from '@/lib/tet/queries'
import { caskColourOf } from '@/lib/tet/colour'
import { vnd, type BlendBoardRow, type CaskBoardRow, type Countdown, type TetCategory, type VolumeTier } from '@/lib/tet/types'
import TetEnquiry, { type EnquiryTarget } from '@/components/tet/TetEnquiry'
import TetTiers from '@/components/tet/TetTiers'
import SleeveStudio, { type SleeveDesign } from '@/components/tet/SleeveStudio'
import { BOXES } from '@/lib/tet/boxes'
import TetTimeline from '@/components/tet/TetTimeline'
import TetLabels from '@/components/tet/TetLabels'
import TetFlight from '@/components/tet/TetFlight'
import TetCaskChart from '@/components/tet/TetCaskChart'
import TetCaskMap from '@/components/tet/TetCaskMap'
import TetColourLadder from '@/components/tet/TetColourLadder'
import RadarChart from '@/components/whisky/RadarChart'
import { RADAR_GOLD, type Cat, type ShapeValues } from '@/components/whisky/flavour-data'
import type { CaskCompassRow } from '@/lib/tet/queries'
import TetPlate, { TET_PLATE_CSS } from '@/components/tet/TetPlate'
import { Reveal, ScrollRail, TET_SCROLL_CSS } from '@/components/tet/TetScroll'

// ═══════════════════════════════════════════════════════════════════════════
// THE TẾT PROGRAMME — built from the public kit, like the rest of the site.
// ───────────────────────────────────────────────────────────────────────────
// Left-aligned, huge display type, mono for everything else, hairlines instead
// of boxes, and full-bleed pictures fading into the ground. The first version
// of this page was a wall of bordered cards — the admin portal's furniture on
// a page meant for a buyer.
//
// PICTURES ARE SHOWN WHOLE, AND THEY ARE NOT CROPPED EITHER. They used to be full-bleed bands, which sounds
// generous and is the opposite: a band crops the photograph to the band's
// shape, and on a picture of a bottle the part that does not fit IS the
// bottle. Every photograph here is now a TetPlate, framed at its own aspect
// ratio, so nothing is cut off at any screen width. See components/tet/TetPlate.
//
// The second half of that took another pass. Boxing the files I had only ever
// preserved the ratio of MY OWN CROPS — the first version had resized the
// source photography to fit the bands with fit:'cover', so the frame was
// honest about a picture that had already lost its edges. These are the
// photographs at their native shape, lifted from Duncan Taylor's own decks
// (The Octave Brand Guidelines, The Octave, the 2025 deck) where they sit as
// embedded images at full resolution, and exported with fit:'inside' so no
// pixel is thrown away: 1828×1372 stays 1.332, 1082×592 stays 1.828.
//
// Two pictures were dropped rather than re-framed. The Blend 18 and the Black
// Bull 30 are pack shots on a WHITE background — on this green ground they
// are white boxes with a bottle in them, and no amount of framing fixes that.
// The Black Bull was also in the Octave section, which is single casks: it is
// a blend, so it was arguing against the words next to it.
//
// The blends came back as their LABELS (2026-09-22, the owner: "use the images
// of the 5 star, 12 and 18"): Duncan Taylor's print artwork cut inside the
// dieline, so there is no white ground to fight — see TetLabels. The tasting
// flight moved down to the casks, where its five bottles now each carry a fact
// about a wood in that list (TetFlight), and the casks gained a chart of the
// whole selection (TetCaskChart).
//
// The masthead carries the Duncan Taylor crest instead. It is the right mark
// for a page that is a Duncan Taylor programme, it is gold on green rather
// than a white rectangle, and it is drawn from the high-resolution master and
// tinted, not scaled up from a thumbnail.
//
// NO PRICE APPEARS WHILE ANYTHING IS PROVISIONAL. What can be shown honestly
// is the SHAPE of the offer — the tier ladder (published terms, not prices),
// the bottle counts at each strength, and the dates. Those carry the argument
// on their own.
// ═══════════════════════════════════════════════════════════════════════════

const GROUND = '#052E20'
const CREAM = '#E5D4C2'
const AMBER = '#C49555'
const SAGE = '#7AB07A'

type Strength = 'cask' | '55' | '50' | '45' | '40'

// ── ONE TABLE, READ BY BOTH THE BUTTONS AND THE ROW ────────────────────────
// Three strengths fitted in a ternary. Five do not, and the ternary had the
// bottle count, the price and the gain each choosing independently — three
// places to forget a strength in. The columns are named here once.
//
// 40% is the last entry there will ever be: the quote refuses anything lower
// because Scotch below 40% abv is not Scotch.
const STRENGTHS: {
  key: Strength; en: string; vn: string
  bottles: keyof CaskBoardRow; unit: keyof CaskBoardRow; gain: keyof CaskBoardRow | null
}[] = [
  { key: 'cask', en: 'cask strength', vn: 'nguyên độ',
    bottles: 'bottles_cask_strength', unit: 'unit_vnd_cask_strength', gain: null },
  { key: '55', en: '55%', vn: '55%', bottles: 'bottles_55', unit: 'unit_vnd_55', gain: 'extra_bottles_55' },
  { key: '50', en: '50%', vn: '50%', bottles: 'bottles_reduced', unit: 'unit_vnd_reduced', gain: 'extra_bottles' },
  { key: '45', en: '45%', vn: '45%', bottles: 'bottles_45', unit: 'unit_vnd_45', gain: 'extra_bottles_45' },
  { key: '40', en: '40%', vn: '40%', bottles: 'bottles_40', unit: 'unit_vnd_40', gain: 'extra_bottles_40' },
]

export default function TetProgramme({
  categories, casks, blends, tiers, countdown, compass = [],
}: {
  categories: TetCategory[]
  casks: CaskBoardRow[]
  blends: BlendBoardRow[]
  tiers: VolumeTier[]
  countdown: Countdown | null
  /** Confirmed Flavour Compass values for casks linked to a tagged whisky. */
  compass?: CaskCompassRow[]
}) {
  const { t, lang } = useLang()
  const vn = lang === 'vn'
  const [strength, setStrength] = useState<Strength>('50')
  const [target, setTarget] = useState<EnquiryTarget | null>(null)
  // One at a time. Several open at once turns the list back into the wall of
  // text it was, and nothing is being compared side by side anyway.
  const [openCask, setOpenCask] = useState<string | null>(null)
  const [design, setDesign] = useState<SleeveDesign | null>(null)
  // The Compass, folded into what RadarChart takes: the families in their
  // order, and one set of values per linked cask.
  const compassCats: Cat[] = useMemo(() => {
    const m = new Map<string, Cat>()
    for (const r of compass) m.set(r.category_slug, { slug: r.category_slug, name: r.category_name, sort_order: r.sort_order })
    return [...m.values()].sort((a, b) => a.sort_order - b.sort_order)
  }, [compass])
  const compassByCask = useMemo(() => {
    const m: Record<string, ShapeValues> = {}
    for (const r of compass) (m[r.cask_ref] ??= {})[r.category_slug] = { intensity: r.intensity, confidence: r.confidence }
    return m
  }, [compass])

  // One region choice, shared by the map, the chart and the colour ladder.
  const [region, setRegion] = useState<string | null>(null)
  const pickCask = (ref: string) => {
    setOpenCask(ref)
    requestAnimationFrame(() => document.getElementById(`cask-${ref}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  // ── ONLY OFFER A STRENGTH THE BOARD CAN ANSWER FOR ──────────────────────
  // The 45% and 40% columns arrive with a migration. Until it has run they are
  // simply absent, and a row asked for a figure it does not have would have
  // said "already below 45%" about a 60% cask — a confident lie. A missing
  // column is not an option, so it is not a button.
  //
  // Once the migration HAS run the column is never null: a cask too weak to be
  // reduced is quoted at its own strength, and the row says so on its own.
  const offered = STRENGTHS.filter(s =>
    s.key === 'cask' || casks.length === 0 || casks.some(c => c[s.bottles] != null))

  const maxBottles = Math.max(0, ...casks.flatMap(c => offered.map(s => {
    const v = c[s.bottles]; return typeof v === 'number' ? v : 0
  })))

  const blendCat = categories.find(c => c.kind === 'blend')
  const caskCat = categories.find(c => c.kind === 'cask')
  // ── ONE FLAG WAS DOING THREE JOBS ───────────────────────────────────────
  // It used to be `countdown.is_placeholder || any cask placeholder`, which
  // meant the cask prices, the blend prices and the DELIVERY DATES all stood
  // or fell together. They are three different facts and they became true at
  // three different times:
  //   · casks — Duncan Taylor's own sheet, final (owner, 2026-09-24);
  //   · blends — still quoted from placeholder pricing inputs (FX, duty, VAT,
  //     freight, bottling all read placeholder in tet_placeholder_audit), so
  //     the tier calculator must keep its mouth shut;
  //   · dates — tet_programme.is_placeholder: the cut-offs are counted back
  //     from a bottling slot Huntly have not committed and an assumed transit.
  // Joined together, confirming the prices would have switched on a blend
  // price built from a placeholder FX rate. Kept apart, each surface waits for
  // its own fact.
  const datesProvisional = !!countdown?.is_placeholder
  const caskProvisional = casks.some(c => c.is_placeholder)
  const blendProvisional = blends.some(b => b.is_placeholder)
  /** Every cask carries Duncan Taylor's own quote. */
  const quotedPrices = casks.length > 0 && casks.every(c => typeof c.list_price_inc_vat_vnd === 'number')

  const openCaskDiscount = () => setTarget({
    kind: 'cask',
    title: t('A member price for a cask', 'Giá thùng dành cho hội viên'),
    target_abv: null,
  })

  const openBlend = () => setTarget({ kind: 'blend', title: blendCat ? (vn ? blendCat.name_vn : blendCat.name_en) : 'Duncan Taylor' })

  return (
    <PublicPage ground={GROUND} ink={CREAM}>
      <style dangerouslySetInnerHTML={{ __html: TET_PLATE_CSS + CASK_CSS + TET_SCROLL_CSS }} />
      <ScrollRail />
      {/* THE SWITCH STAYS WITH YOU. It was absolute, so it scrolled away after
          the masthead — on a page this long that is the same as not having one.
          And it was tone="light", which is the control for a CREAM page: on
          this ground it all but disappeared. */}
      {/* THE WAY OUT, WHICH THIS PAGE DID NOT HAVE. Every other public surface
          carries NavOverlay; /tet was built as a standalone campaign page and
          got neither the menu nor the crest that returns you home — so a
          visitor who followed a QR code into it was stuck with the back
          gesture. `dark` because the ground is #052E20.
          No collision with the switch below: the trigger is pinned top-LEFT
          and the crest sits centre-right. */}
      <NavOverlay variant="public" dark />

      <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 8000 }}>
        <LangToggle />
      </div>

      <Masthead
        title={<>Tết<br />Đinh Mùi</>}
        sub="2027"
        lede={t('Whisky for the companies you thank at Tết — three blends in a sleeve carrying your name, or a single cask with every bottle numbered.',
                'Rượu whisky để tri ân đối tác dịp Tết — ba dòng pha trộn trong hộp in tên công ty, hoặc trọn một thùng đơn với từng chai được đánh số.')}
        art={
          /* The Octave Huntly 27 by the fire, from The Octave Brand Guidelines,
             at its own 2:3 — the owner: "a portrait Octave bottle photo… the
             beautiful ones". The Duncan Taylor crest that stood here moved to
             the foot of the page, as "brought to you by". */
          <div className="pk-thumb" style={{ aspectRatio: '800 / 1201', maxWidth: 360, marginInline: 'auto' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/tet/octave-fire.webp"
                 srcSet="/images/tet/octave-fire-sm.webp 480w, /images/tet/octave-fire.webp 800w"
                 sizes="(max-width: 780px) 70vw, 360px" width={800} height={1201}
                 alt={t('The Octave Huntly 27 by the fire, a glass poured', 'The Octave Huntly 27 bên lò sưởi, một ly đã rót')}
                 fetchPriority="high" />
          </div>
        }
      >
        <Cta onClick={openBlend}>{t('Register interest', 'Đăng ký quan tâm')}</Cta>
      </Masthead>

      {countdown && <NextGate cd={countdown} t={t} />}

      {/* The first photograph, straight under the masthead — an Octave in
          Scottish heather. Eager and high priority because it is the page's
          first impression; everything below it waits its turn. As a band this
          one lost its neck and its base to the crop. */}
      <section className="pk-wrap" style={{ paddingTop: 64 }}>
        <TetPlate
          src="/images/tet/burn.webp" sm="/images/tet/burn-sm.webp"
          width={1400} height={1051} smWidth={820} eager
          alt={t('An Octave blended malt beside a Highland burn',
                 'Chai Octave blended malt bên dòng suối vùng cao nguyên')}
          caption={t('The Octave · Campbeltown', 'The Octave · Campbeltown')}
        />
      </section>

      {countdown && <TetTimeline cd={countdown} t={t} locale={vn ? 'vi-VN' : 'en-GB'} />}

      {/* ── THE BLENDS ────────────────────────────────────────────────── */}
      <section className="pk-wrap pk-section">
        <Reveal>
          {/* The eyebrow stating the minimum is gone (owner, 2026-10-01).
              The minimum is still said — it moved to the end of the section,
              after the tiers, where somebody has just seen what that many
              bottles actually buys. Leading with a minimum is leading with the
              thing that stops people reading. */}
          <SectionHead
            title={blendCat ? (vn ? blendCat.name_vn : blendCat.name_en) : 'Duncan Taylor'}
          />
        </Reveal>
        {blendCat && (
          <Reveal step={1}>
            <p className="pk-lede">{vn ? blendCat.standfirst_vn : blendCat.standfirst_en}</p>
          </Reveal>
        )}

        {/* The three labels, before the words about them. */}
        <Reveal step={2}>
          <TetLabels blends={[...new Map(blends.map(b => [b.sku, b])).values()].map(b => ({
            sku: b.sku,
            name: b.expression || (vn ? b.name_vn : b.name_en),
            detail: `${b.abv_pct}% · ${b.bottle_size_ml}ml`,
          }))} />
        </Reveal>

        <Reveal step={3} style={{ marginTop: 40 }}>
          <Details rows={blends.map(b => ({
            label: b.expression || b.sku,
            value: (
              <>
                {vn ? b.name_vn : b.name_en}
                <span style={{ opacity: .55 }}>
                  {' · '}{b.abv_pct}% · {b.bottle_size_ml}ml
                  {b.min_order_bottles ? ` · ${t('from', 'từ')} ${b.min_order_bottles} ${t('bottles', 'chai')}` : ''}
                </span>
              </>
            ),
          }))} />
        </Reveal>

        {tiers.length > 0 && (
          <div style={{ marginTop: 52 }}>
            <TetTiers tiers={tiers} provisional={blendProvisional} />
            <p className="pk-meta" style={{ marginTop: 22, maxWidth: 560, lineHeight: 1.9 }}>
              {t('The tier is set by the total across all three, so a mixed order still climbs. Every sleeve carries your logo. From purchases of fifty bottles and above.',
                 'Mức chiết khấu tính trên tổng số chai của cả ba dòng, nên đơn hàng pha trộn vẫn được nâng mức. Mỗi hộp đều in logo của quý vị. Áp dụng cho đơn hàng từ năm mươi chai trở lên.')}
            </p>
          </div>
        )}

        <Cta onClick={openBlend}>{t('Register interest', 'Đăng ký quan tâm')}</Cta>
      </section>

      {/* ── THE SLEEVE STUDIO ─────────────────────────────────────────
          The question a buyer is actually asking is "what will it look like
          with our logo on it". Prose cannot answer that. */}
      <section className="pk-wrap pk-section">
        <Reveal>
          {/* The last fringe title on this page, gone with the others. */}
          <SectionHead
            title={t('The sleeve', 'Hộp đựng')}
          />
        </Reveal>
        <Reveal step={1}>
        <p className="pk-lede">
          {t(`Every bottle comes in a Tết box. ${BOXES.length + 2} designs to choose from — landmarks of Sài Gòn and Hà Nội drawn in gold on Tết red — and the first one takes your logo. See any of them flat as it prints, or folded into the box it becomes.`,
             `Mỗi chai đều có hộp Tết. ${BOXES.length + 2} mẫu để lựa chọn — những địa danh Sài Gòn và Hà Nội vẽ vàng trên nền đỏ Tết — và mẫu đầu tiên nhận logo của quý vị. Xem bất kỳ mẫu nào ở dạng trải phẳng như khi in, hoặc đã gấp thành hộp.`)}
        </p>
        </Reveal>
        <div style={{ marginTop: 44 }}>
          <SleeveStudio
            onUse={d => {
              setDesign(d)
              setTarget({ kind: 'blend', title: blendCat ? (vn ? blendCat.name_vn : blendCat.name_en) : 'Duncan Taylor' })
            }}
            onAsk={b => setTarget({ kind: 'blend', title: t(`The ${b.name[0]} box`, `Hộp ${b.name[1]}`) })} />
        </div>

      </section>

      {/* Before the casks: the man who closes them, and the thing itself. Side
          by side because they are one argument — a single cask is a place and
          a pair of hands, not a product line. Each keeps its own shape; they
          stack on a phone rather than shrinking to stamps. */}
      <section className="pk-wrap" style={{ paddingTop: 96 }}>
        <div className="tp-pair is-levelled">
          <TetPlate
            src="/images/tet/cooper.webp" sm="/images/tet/cooper-sm.webp"
            width={1082} height={592} smWidth={820} maxWidth={620}
            alt={t('A cooper at work among the casks', 'Thợ đóng thùng làm việc giữa những thùng rượu')}
            caption={t('Huntly · the cooperage', 'Huntly · xưởng đóng thùng')}
          />
          <TetPlate
            src="/images/tet/char.webp" sm="/images/tet/char-sm.webp"
            width={1152} height={768} smWidth={820} maxWidth={620}
            step={2}
            alt={t('A cask being charred', 'Thùng gỗ đang được nung cháy bề mặt')}
            caption={t('The char that makes the whisky', 'Lớp than tạo nên hương vị')}
          />
        </div>
      </section>

      {/* ── THE CASKS ─────────────────────────────────────────────────── */}
      <section className="pk-wrap pk-section">
        <Reveal>
          {/* The counted eyebrow ("20 single casks") is gone — owner,
              2026-10-01. The number is still true and still visible: the list
              below it is the casks, and counting them for somebody about to
              scroll through them was telling them what they were about to
              see. */}
          <SectionHead
            title={caskCat ? (vn ? caskCat.name_vn : caskCat.name_en) : 'The Octave Selection'}
          />
        </Reveal>
        {caskCat && (
          <Reveal step={1}>
            <p className="pk-lede">{vn ? caskCat.standfirst_vn : caskCat.standfirst_en}</p>
          </Reveal>
        )}

        {/* THE CASK-END OFFER IS GONE (2026-10-01). It read "Every Octave
            bought this Tết is shipped with its cask end" — the owner's own
            words from 22 September. Duncan Taylor pushed back on it, so it is
            off the page rather than left standing as a promise the club cannot
            keep. The drawing and its styles go with it; nothing about the
            casks themselves changes. git remembers the markup if it returns. */}

        {/* THE MEMBERS' PRICE (owner, 2026-09-24: "Get in touch for a member
            cask price discount ... somewhere clear and big"). The prices on
            this page are Duncan Taylor's list; what a member pays is a
            conversation, and this is the invitation to have it. It is a
            BUTTON, not a line of type: the enquiry it opens is the whole
            point, and a member should not have to hunt for the way in. */}
        <Reveal step={2}>
          <button className="ck-member" onClick={openCaskDiscount}>
            <span className="ck-member-eyebrow">{t('Members', 'Hội viên')}</span>
            <span className="ck-member-line">
              {t('Get in touch for a member cask price', 'Liên hệ để nhận giá thùng dành cho hội viên')}
            </span>
            <span className="ck-member-sub">
              {t('The prices below are Duncan Taylor’s list. Members do not pay them.',
                 'Giá bên dưới là giá niêm yết của Duncan Taylor. Hội viên không trả mức giá đó.')}
              <span className="ck-member-go"> {t('Ask about a cask', 'Hỏi về một thùng')} →</span>
            </span>
          </button>
        </Reveal>

        {/* Where, then what: the map picks a region, and the chart and the
            colour ladder below follow it. */}
        <Reveal step={3}>
          <TetCaskMap casks={casks} t={t} vn={vn} region={region} onRegion={setRegion} onPick={pickCask} />
        </Reveal>
        <Reveal step={3}>
          <TetCaskChart casks={casks} t={t} onPick={pickCask} region={region} onRegion={setRegion} />
        </Reveal>
        <Reveal step={3}>
          <TetColourLadder casks={casks} t={t} onPick={pickCask} region={region} />
        </Reveal>

        {/* THE TOGGLE IS THE ARGUMENT. Duty and tax are charged on value, not
            on alcohol, so bottling a strong young cask at 50% multiplies the
            bottles without multiplying the tax — and on a weak old cask it
            does almost nothing. The page shows both, honestly. */}
        {/* IT WAS HIDDEN ONCE THE PRICES WERE QUOTED, on the reasoning that a
            control which changes nothing is worse than no control. The
            reasoning was right and the premise was wrong: the cask is one
            price, so a lower bottling strength still fills more bottles and
            still drops the price of each — which is the whole argument. The
            owner asked for it back within the hour. */}
        <Reveal step={4} style={{ display: 'flex', gap: 22, alignItems: 'baseline', marginTop: 48, flexWrap: 'wrap' }}>
          <span className="pk-eyebrow">{t('Bottled at', 'Đóng chai ở')}</span>
          {offered.map(s => (
            <button key={s.key} onClick={() => setStrength(s.key)} style={pick(strength === s.key)}>
              {t(s.en, s.vn)}
            </button>
          ))}
        </Reveal>

        {/* The list arrives in order, capped at eight steps — fourteen rows
            each waiting on the one above is a queue, not a reveal. */}
        <div style={{ marginTop: 24 }}>
          {casks.map((c, i) => (
            <Reveal key={c.cask_ref} variant="slide" step={Math.min(i, 8)}>
            <CaskRow c={c} strength={strength} vn={vn} t={t} provisional={caskProvisional} maxBottles={maxBottles}
                     compass={compassByCask[c.cask_ref] && compassCats.length >= 3 ? { cats: compassCats, values: compassByCask[c.cask_ref] } : null}
                     open={openCask === c.cask_ref}
                     onToggle={() => setOpenCask(o => o === c.cask_ref ? null : c.cask_ref)}
                     onChoose={() => setTarget({
                       kind: 'cask', cask_ref: c.cask_ref,
                       title: `${c.cask_ref} · ${c.distillery}`,
                       target_abv: strength === 'cask' ? null : Number(strength),
                     })} />
            </Reveal>
          ))}
        </div>

        {/* The flight, after the list: five samples, each a fact about a wood
            the list above is made of. */}
        <div style={{ marginTop: 88 }}>
          <TetFlight casks={casks} t={t} />
        </div>
      </section>

      <section className="pk-wrap" style={{ paddingTop: 96 }}>
        <TetPlate
          src="/images/tet/moss.webp" sm="/images/tet/moss-sm.webp"
          width={1400} height={933} smWidth={820}
          alt={t('An Octave single malt on a Speyside hillside',
                 'Chai Octave single malt trên sườn đồi Speyside')}
          caption={t('Fons et origo · the source', 'Fons et origo · khởi nguồn')}
          overlay={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 1.6vw, 20px)' }}>
              <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(20px, 2.8vw, 36px)', lineHeight: 1,
                             color: '#E5D4C2', letterSpacing: '.01em' }}>
                {t('brought to you by', 'được mang đến bởi')}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/tet/dt-crest.png" width={900} height={913} alt="Duncan Taylor Scotch Whisky"
                   style={{ width: 'clamp(58px, 7vw, 92px)', height: 'auto', display: 'block' }} />
            </div>
          }
        />
      </section>

      <footer className="pk-wrap" style={{ paddingTop: 80, paddingBottom: 110 }}>
        {/* THE NOTICE HAS TO MATCH THE PAGE. It used to say "no price is shown
            until it is" — true while the club was calculating prices from a
            placeholder model, and a plain contradiction the moment every row
            began printing Duncan Taylor's own list price. */}
        {quotedPrices && (
          <p className="pk-meta" style={{ maxWidth: 620, lineHeight: 1.9 }}>
            {t('Cask prices are Duncan Taylor Vietnam’s list price, per bottle, including VAT.',
               'Giá thùng là giá niêm yết của Duncan Taylor Việt Nam, mỗi chai, đã gồm VAT.')}
          </p>
        )}
        {/* WHAT THE DIVISION ASSUMES. Duncan Taylor's ex-works figure is a
            BOTTLED case price at their own outturn, so the cask price carries
            the bottling of those bottles and no more. Filling at a lower
            strength draws more bottles out of the same whisky, and the glass,
            closures and labour for the extra ones are not in the number above.
            The page says so rather than letting a falling per-bottle figure
            imply a quote nobody has given. */}
        {quotedPrices && strength !== 'cask' && (
          <p className="pk-meta" style={{ color: AMBER, maxWidth: 620, lineHeight: 1.9 }}>
            {t(`The cask price is fixed; at ${strength}% it simply fills more bottles, so each one costs less. Bottling the extra bottles is not quoted in it.`,
               `Giá cả thùng là cố định; ở ${strength}% thùng cho ra nhiều chai hơn nên mỗi chai rẻ hơn. Chi phí đóng chai cho số chai tăng thêm chưa nằm trong giá này.`)}
          </p>
        )}
        {caskProvisional && (
          <p className="pk-meta" style={{ color: AMBER, maxWidth: 620, lineHeight: 1.9 }}>
            {quotedPrices
              ? t('The cask list itself is still being confirmed with Huntly — a cask can come off it.',
                  'Danh sách thùng vẫn đang được xác nhận với Huntly — một thùng có thể bị rút khỏi danh sách.')
              : t('The cask list and prices are being confirmed with Huntly. Nothing here is final, and no price is shown until it is.',
                  'Danh sách thùng và bảng giá đang được xác nhận với Huntly. Mọi thông tin chưa phải cuối cùng; giá chưa hiển thị.')}
          </p>
        )}
        {/* THE DATES ARE NOT THE PRICES. The cut-offs on this page are counted
            back from lead times nobody has committed to yet, so a reservation
            can be taken at a settled price against a date that may move. The
            page says which of the two is still moving. */}
        {datesProvisional && (
          <p className="pk-meta" style={{ color: AMBER, maxWidth: 620, lineHeight: 1.9 }}>
            {t('The dates are worked back from lead times Huntly and the freight forwarder have not yet confirmed. A cut-off on this page can move.',
               'Các mốc thời gian được tính ngược từ thời gian sản xuất và vận chuyển mà Huntly và đơn vị vận tải chưa xác nhận. Một mốc trên trang này có thể thay đổi.')}
          </p>
        )}
        <p className="pk-meta" style={{ marginTop: 14, maxWidth: 620, lineHeight: 1.9 }}>
          {t('Nothing on this page is an offer for sale. Orders are completed on invoice by Duncan Taylor Vietnam. Not for anyone under 18.',
             'Nội dung trang này không phải lời chào bán. Đơn hàng hoàn tất bằng hóa đơn của Duncan Taylor Việt Nam. Không dành cho người dưới 18 tuổi.')}
        </p>
      </footer>

      {target && (
        <TetEnquiry
          target={target}
          provisional={target.kind === 'cask' ? caskProvisional : blendProvisional}
          // The design only travels with a blend enquiry: a sleeve is a blend
          // thing, and attaching it to a cask would promise something the cask
          // offer does not include.
          design={target.kind === 'blend' && design ? design : undefined}
          onClose={() => setTarget(null)}
        />
      )}
    </PublicPage>
  )
}

/* ---------------------------------------------------------------- */

// THE GATE THAT IS ACTUALLY NEXT, COUNTING DOWN.
// Five dates in a list are a reference; one of them moving is a reason to act
// today. It ticks every second, corrected for the visitor's own clock, and it
// names which gate it is — a bare number counting down to nothing in particular
// is decoration.
function NextGate({ cd, t }: { cd: Countdown; t: (en: string, vn: string) => string }) {
  const fetchedAt = useMemo(() => Date.now(), [])
  const [now, setNow] = useState(fetchedAt)
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  // The owner's words, and better than mine: a deadline means nothing until it
  // says what shuts. "Casks close" is jargon; "the window closes to order casks
  // from Scotland" is the actual constraint — they are bottled at Huntly and
  // put on a ship.
  const gates = [
    { label: t('until the window closes to order casks from Scotland',
               'đến khi đóng cửa sổ đặt thùng từ Scotland'), date: cd.cutoffs.cask.date },
    { label: t('until the sleeve artwork must be agreed',
               'đến hạn chốt thiết kế hộp'), date: cd.cutoffs.artwork.date },
    { label: t('until the last order for the blends',
               'đến hạn đặt cuối cho rượu pha trộn'), date: cd.cutoffs.blend.date },
  ]
    .map(g => ({ ...g, r: timeRemaining(g.date, cd.now, now, fetchedAt) }))
    .filter(g => !g.r.past)
    .sort((a, b) => (a.r.days * 86400 + a.r.hours * 3600 + a.r.minutes * 60 + a.r.seconds)
                  - (b.r.days * 86400 + b.r.hours * 3600 + b.r.minutes * 60 + b.r.seconds))

  const g = gates[0]
  if (!g) return null
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <section className="pk-wrap" style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', flexWrap: 'wrap',
                    borderTop: '1px solid rgba(229,212,194,.14)', paddingTop: 22 }}>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(34px,5vw,58px)', lineHeight: 1, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
          {g.r.days}
          {/* A margin is not a space: "43days" is what a margin gives you when
              the number and the word are separate elements. */}
          <span style={{ fontFamily: MONO, fontSize: 'clamp(13px,1.4vw,16px)', color: CREAM, marginLeft: 10 }}>
            {`${t('days', 'ngày')} ${pad(g.r.hours)}:${pad(g.r.minutes)}:${pad(g.r.seconds)}`}
          </span>
        </div>
        <div className="pk-meta" style={{ fontSize: 12.5 }}>{g.label}</div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// A CASK, WHICH OPENS WHERE IT SITS.
// ───────────────────────────────────────────────────────────────────────────
// Fourteen casks were fourteen identical lines of small type. Everything that
// makes one cask different from the next — the wood it sat in, the year it
// went in, what it actually tastes like — was in the database and on none of
// the page. A buyer choosing between Glen A and Glen B had a distillery name
// and a bottle count to do it with.
//
// The row opens in place rather than into a modal. A modal would cover the
// strength buttons, which are the one control that changes what the row says;
// opening downward keeps the comparison on screen, and closing it leaves you
// exactly where you were in a long list.
//
// The height animates with grid-template-rows: 0fr → 1fr. A tasting note has
// no height anybody can know in advance, and max-height guesses either clip a
// long note or crawl through empty space on a short one.
// ═══════════════════════════════════════════════════════════════════════════
function CaskRow({ c, strength, vn, t, provisional, onChoose, open, onToggle, maxBottles, compass }: {
  c: CaskBoardRow; strength: Strength; vn: boolean
  /** The most bottles any cask reaches at any offered strength — the bars'
   *  common scale, so they GROW when the strength comes down. */
  maxBottles: number
  /** Its Flavour Compass, when the cask is linked to a confirmed-tagged whisky. */
  compass: { cats: Cat[]; values: ShapeValues } | null
  t: (en: string, v: string) => string
  provisional: boolean
  onChoose: () => void
  open: boolean
  onToggle: () => void
}) {
  const gone = c.status !== 'available'
  const spec = STRENGTHS.find(s => s.key === strength) ?? STRENGTHS[0]
  const num = (k: keyof CaskBoardRow | null) => {
    const v = k ? c[k] : 0
    return typeof v === 'number' ? v : null
  }
  // ── DUNCAN TAYLOR'S OWN QUOTE WINS ──────────────────────────────────────
  // Where a cask carries the list price from DT Vietnam's sheet, the page
  // prints THAT — the owner's decision, 2026-09-24 — rather than a number
  // built from our cost and a margin. Two consequences, both deliberate:
  //   · it is shown even while the cask is provisional, because a quoted
  //     price is a fact about the cask; the ENGINE's price is not, and stays
  //     hidden until the model is signed off;
  //   · THE CASK IS ONE PRICE, and the strength still moves the bottles. The
  //     row used to freeze at DT's own outturn the moment a list price
  //     existed, so the strength toggle did nothing and the extra bottles
  //     stopped appearing — the owner caught it. What is being bought is the
  //     cask: DT's list price across DT's outturn, a figure that does not
  //     change. Filling at a lower strength draws more bottles from the same
  //     whisky, so the BOTTLE price is that fixed cask spread across the
  //     bottling chosen, and the row says which strength it is quoting at.
  const quoted = typeof c.list_price_inc_vat_vnd === 'number' ? c.list_price_inc_vat_vnd : null
  // DT's own outturn — the bottling their sheet prices.
  const dtBottles = num('bottles_cask_strength')
  const bottles = num(spec.bottles) ?? dtBottles
  // THE WHOLE CASK, which is what is actually being bought (owner,
  // 2026-09-24: "we need the full cask price in there as well as the bottle
  // price"). Fixed: DT's per-bottle list across their own outturn.
  const caskTotal = quoted && dtBottles ? quoted * dtBottles : null
  // The same cask, divided by however many bottles this strength fills.
  const unitAt = caskTotal && bottles ? Math.round(caskTotal / bottles) : null
  const gain = num(spec.gain) ?? 0

  // A cask at or below the chosen strength has no bottling AT that strength:
  // the board returns its own figures rather than inventing one, and the row
  // says so instead of showing a gain of nothing as if it were a choice. This
  // used to be asked about 55% alone, which meant a 48% cask offered a "50%"
  // bottling that silently repeated its cask-strength count.
  const asked = strength === 'cask' ? null : Number(strength)
  const noSuchStrength = asked !== null && c.cask_abv_pct <= asked
  const note = vn ? (c.tasting_note_vn || c.tasting_note_en) : c.tasting_note_en

  return (
    <div id={`cask-${c.cask_ref}`} className={`ck ${open ? 'is-open' : ''}`} style={{ opacity: gone ? .42 : 1, scrollMarginTop: 90 }}>
      <button className="ck-head" onClick={onToggle} aria-expanded={open}>
        <span className="ck-name">
          <span className="pk-h3">{c.distillery}</span>
          <span className="pk-meta ck-sub">
            {c.cask_ref} · {c.region} · {Math.floor(c.age_years)}{t('yo', ' năm')} · {c.cask_abv_pct}%
          </span>
        </span>

        <span className="pk-meta ck-figs">
          {noSuchStrength ? (
            <span style={{ opacity: .6 }}>{t(`already below ${asked}%`, `đã dưới ${asked}%`)}</span>
          ) : (
            <>
              <span style={{ color: CREAM, fontSize: 15 }}>{bottles}</span> {t('bottles', 'chai')}
              {gain > 0 && <span style={{ color: SAGE }}> · +{gain}</span>}
            </>
          )}
          {quoted ? (
            <span style={{ display: 'block', marginTop: 4, color: CREAM }}>
              {/* The cask leads: it is the thing on offer. The bottle price is
                  what makes it comparable with the one below it. */}
              {caskTotal && (
                <span style={{ display: 'block', fontSize: 17 }}>{vnd(caskTotal)}</span>
              )}
              <span style={{ display: 'block', fontSize: 10.5, opacity: .5, letterSpacing: '.04em' }}>
                {t('the cask', 'cả thùng')}
              </span>
              <span style={{ display: 'block', marginTop: 6, fontSize: 13, opacity: .8 }}>
                {vnd(unitAt ?? quoted)}
                <span style={{ display: 'block', fontSize: 10.5, opacity: .62, letterSpacing: '.04em' }}>
                  {strength === 'cask' || noSuchStrength
                    ? t('a bottle · Duncan Taylor list', 'mỗi chai · giá niêm yết Duncan Taylor')
                    : t(`a bottle at ${asked}%`, `mỗi chai ở ${asked}%`)}
                </span>
              </span>
            </span>
          ) : !provisional && (
            <span style={{ display: 'block', marginTop: 4, color: CREAM }}>{vnd(num(spec.unit))}</span>
          )}
        </span>

        <span className="ck-chev" aria-hidden>
          {gone
            ? <span className="pk-eyebrow" style={{ color: AMBER }}>
                {c.status === 'sold' ? t('Sold', 'Đã bán') : t('Being confirmed', 'Đang xác nhận')}
              </span>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>}
        </span>
      </button>

      {/* THE BARS (2026-09-22). Cream is what the cask gives at cask strength;
          green is what the chosen strength adds. Same figures as the words
          above, drawn to one scale across the list, so pressing 45% makes
          every bar grow at once — the argument of the toggle, visible. */}
      {/* They were hidden alongside the toggle when the list prices landed,
          on the same wrong premise. The bars ARE the toggle's argument; with
          the cask price fixed they are truer than before. */}
      {!noSuchStrength && bottles != null && maxBottles > 0 && (
        <div className="ck-bar" aria-hidden>
          <span className="ck-bar-base" style={{ width: `${(Math.min(bottles - gain, bottles) / maxBottles) * 100}%` }} />
          <span className="ck-bar-gain" style={{ width: `${(gain / maxBottles) * 100}%` }} />
        </div>
      )}

      <div className="ck-wrap">
        <div className="ck-inner">
          <div className="ck-body">
            <div>
              {note
                ? <p className="ck-note">{note}</p>
                : <p className="ck-note" style={{ opacity: .45 }}>
                    {t('The tasting note is written when the cask is confirmed with Huntly.',
                       'Ghi chú hương vị sẽ được viết khi thùng được xác nhận với Huntly.')}
                  </p>}

              {/* WHAT THE STRENGTH BUTTONS ACTUALLY DO, in a sentence, for this
                  cask. The number above answers "how many"; this answers "why",
                  and it is the argument the whole section is making. */}
              {!noSuchStrength && gain > 0 && (
                <p className="ck-gain">
                  {t(`Bottled at ${asked}% this cask gives ${gain} more bottles than at cask strength — duty is charged on value, not on alcohol.`,
                     `Đóng chai ở ${asked}%, thùng này cho thêm ${gain} chai so với nguyên độ — thuế tính trên giá trị, không theo nồng độ.`)}
                </p>
              )}
            </div>

            <dl className="ck-spec">
              <div><dt>{t('Cask', 'Thùng')}</dt><dd>{c.cask_type}{c.wood ? ` · ${c.wood}` : ''}</dd></div>
              {c.vintage_year && <div><dt>{t('Filled', 'Năm vào thùng')}</dt><dd>{c.vintage_year}</dd></div>}
              <div><dt>{t('Region', 'Vùng')}</dt><dd>{c.region}</dd></div>
              <div>
                <dt>{t('Colour', 'Màu')}</dt>
                <dd>
                  {(() => {
                    // EBC, the scale Scotch is quoted in, with the SRM it
                    // converts from. MEASURED where Huntly gave a figure, and
                    // then printed plainly; estimated from the swatch
                    // otherwise, and then it wears a ≈. See lib/tet/colour.
                    const col = caskColourOf(c)
                    if (!col) return <span style={{ opacity: .45 }}>—</span>
                    return (
                      <span className="ck-colour">
                        <span className="ck-swatch" style={{ background: c.colour_hex || col.swatch }} />
                        <span className="ck-ebc">
                          {col.measured ? '' : '≈ '}{col.ebc} EBC
                          <span className="ck-srm"> · {col.srm} SRM</span>
                        </span>
                      </span>
                    )
                  })()}
                </dd>
              </div>
              {caskTotal && bottles && (
                <div><dt>{t('The cask', 'Cả thùng')}</dt><dd>
                  {vnd(caskTotal)} <span style={{ opacity: .55 }}>
                    · {bottles} {t('bottles at', 'chai ở')} {vnd(quoted)} {t('each', 'mỗi chai')}
                  </span>
                </dd></div>
              )}
              {/* No colour, no note about colour. A cask Huntly have not
                  assessed yet showed "—" and then a sentence explaining how
                  the number that is not there was arrived at. */}
              {caskColourOf(c) && <div className="ck-ebcnote">
                {caskColourOf(c)?.measured
                  ? t(`Measured by Huntly${c.colour_source ? ` · ${c.colour_source}` : ''}.`,
                      `Do bởi Huntly${c.colour_source ? ` · ${c.colour_source}` : ''}.`)
                  : t('Colour is estimated from the swatch, not measured. Huntly’s figures replace it when the cask is confirmed.',
                      'Màu được ước tính từ mẫu hiển thị, chưa đo bằng máy. Số liệu từ Huntly sẽ thay thế khi thùng được xác nhận.')}
              </div>}
            </dl>
          </div>

          {compass && (
            <div className="ck-compass">
              <div className="pk-eyebrow">{t('Flavour Compass', 'La bàn hương vị')}</div>
              {/* Drawn only while the row is open: sixteen spokes behind a
                  collapsed row are work for nothing. */}
              {open && <RadarChart cats={compass.cats} shapes={[{ values: compass.values, color: RADAR_GOLD, label: '' }]} size={280} />}
            </div>
          )}

          {!gone && (
            <button onClick={onChoose} className="pk-cta" style={{ marginTop: 18 }}>
              {provisional ? t('Interest', 'Quan tâm') : t('Reserve', 'Giữ chỗ')} <span className="pk-go">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const CASK_CSS = `
.ck-compass { margin-top: 22px; max-width: 520px; }
.ck-bar { display: flex; height: 3px; margin: -6px 0 12px; background: rgba(229,212,194,.06); border-radius: 2px; overflow: hidden; }
.ck-bar span { display: block; height: 100%; transition: width .7s cubic-bezier(.16,.84,.44,1); }
.ck-bar-base { background: rgba(229,212,194,.45); }
.ck-bar-gain { background: ${SAGE}; }
@media (prefers-reduced-motion: reduce) { .ck-bar span { transition: none; } }
.ck-member { display: block; width: 100%; text-align: left; cursor: pointer;
             background: rgba(212,184,90,.1); border: 1px solid rgba(212,184,90,.55);
             border-radius: 3px; padding: clamp(20px, 3vw, 32px) clamp(20px, 3vw, 34px);
             margin-top: 44px; color: inherit; font: inherit;
             transition: background .25s ease, border-color .25s ease, transform .25s ease; }
.ck-member:hover { background: rgba(212,184,90,.16); border-color: ${GOLD}; transform: translateY(-2px); }
.ck-member-eyebrow { display: block; font-family: ${MONO}; font-size: 11px; letter-spacing: .2em;
                     text-transform: uppercase; color: ${GOLD}; }
.ck-member-line { display: block; font-family: 'Rampant Sans', Georgia, serif;
                  font-size: clamp(26px, 4.4vw, 46px); line-height: 1.08; color: #F2E6D8; margin-top: 10px; }
.ck-member-sub { display: block; font-family: ${MONO}; font-size: 13px; line-height: 1.8;
                 color: rgba(229,212,194,.65); margin-top: 12px; max-width: 62ch; }
.ck-member-go { color: ${GOLD}; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .ck-member { transition: none; } }

.ck { border-top: 1px solid rgba(229,212,194,.14); }
.ck-head { display: grid; grid-template-columns: minmax(0,1.3fr) minmax(0,1fr) auto;
           gap: 18px; align-items: baseline; width: 100%; text-align: left;
           background: none; border: none; padding: 16px 0; cursor: pointer;
           color: inherit; font: inherit; -webkit-tap-highlight-color: transparent; }
.ck-head:hover .ck-name .pk-h3, .ck.is-open .ck-name .pk-h3 { color: ${GOLD}; }
.ck-name .pk-h3 { display: block; transition: color .3s ease; }
.ck-sub { display: block; margin-top: 4px; }
.ck-figs { font-size: 12.5px; }
.ck-chev { display: flex; justify-content: flex-end; align-items: center;
           color: rgba(229,212,194,.5); transition: transform .4s cubic-bezier(.16,.84,.44,1); }
.ck.is-open .ck-chev { transform: rotate(180deg); color: ${GOLD}; }

/* 0fr → 1fr: animates to a height nobody had to measure. */
.ck-wrap { display: grid; grid-template-rows: 0fr;
           transition: grid-template-rows .5s cubic-bezier(.16,.84,.44,1); }
.ck.is-open .ck-wrap { grid-template-rows: 1fr; }
.ck-inner { overflow: hidden; }
.ck.is-open .ck-inner { padding-bottom: 26px; }

.ck-body { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(0,1fr);
           gap: clamp(20px, 4vw, 56px); padding-top: 4px; }
@media (max-width: 720px) { .ck-body { grid-template-columns: 1fr; gap: 22px; }
                            .ck-head { grid-template-columns: minmax(0,1fr) auto; }
                            .ck-figs { grid-column: 1 / -1; } }

.ck-note { font-family: ${MONO}; font-size: 13.5px; line-height: 1.95;
           color: rgba(229,212,194,.8); margin: 0; max-width: 56ch; }
.ck-gain { font-family: ${MONO}; font-size: 12px; line-height: 1.85;
           color: ${SAGE}; margin: 14px 0 0; max-width: 56ch; }

.ck-spec { margin: 0; font-family: ${MONO}; font-size: 12px; }
.ck-spec > div { display: grid; grid-template-columns: 96px 1fr; gap: 12px; padding: 7px 0;
                 border-top: 1px solid rgba(229,212,194,.1); }
.ck-spec dt { letter-spacing: .12em; text-transform: uppercase; opacity: .45; margin: 0; }
.ck-spec dd { margin: 0; color: rgba(229,212,194,.85); }
.ck-colour { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ck-swatch { display: inline-block; width: 42px; height: 14px; border-radius: 2px;
             border: 1px solid rgba(229,212,194,.25); vertical-align: middle; }
.ck-ebc { font-family: ${MONO}; font-size: 12px; color: ${GOLD}; letter-spacing: .04em; }
.ck-srm { opacity: .45; color: rgba(229,212,194,.85); }
/* A note ABOUT the list, not a row in it: block, not the 96px/1fr grid its
   siblings use, and free to run the width of the column. */
.ck-ebcnote { display: block; grid-template-columns: none; border: none;
              border-top: 1px solid rgba(229,212,194,.1);
              font-family: ${MONO}; font-size: 10.5px; line-height: 1.7;
              opacity: .42; margin-top: 10px; padding-top: 10px; max-width: none; }

@media (prefers-reduced-motion: reduce) {
  .ck-wrap, .ck-chev, .ck-name .pk-h3 { transition: none; }
}
`

const pick = (on: boolean): React.CSSProperties => ({
  fontFamily: MONO, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
  color: on ? GOLD : CREAM, opacity: on ? 1 : .5,
  borderBottom: on ? `1px solid ${GOLD}` : '1px solid transparent',
})
```

## `components/tet/TetPlate.tsx`

133 lines · 6,561 bytes

```tsx
'use client'

import type { ReactNode } from 'react'
import { Reveal } from '@/components/tet/TetScroll'

// ═══════════════════════════════════════════════════════════════════════════
// A PLATE — a photograph shown whole.
// ───────────────────────────────────────────────────────────────────────────
// This replaces the full-bleed bands, which threw the pictures away.
//
// A band is width:100vw with a height in vw, and the image inside it is
// object-fit:cover. Those two numbers almost never agree with the photograph's
// own shape, so the browser crops whatever does not fit — and on a picture of a
// BOTTLE, what does not fit is the bottle. A 1700×950 shot in a 1400×560 band
// loses a third of its height, top and bottom, which is exactly where the neck
// and the base are. The page ended up showing the middle of a label and a lot
// of heather.
//
// THE FIX IS ARITHMETIC, NOT TASTE. The frame is given the image's OWN aspect
// ratio, from its real pixel dimensions. When the frame and the image agree,
// cover and contain are the same thing and nothing is cropped at any width.
// That is the whole component.
//
// So there is no parallax here. Parallax needs the image to be bigger than its
// frame — that surplus is what slides — and surplus is the crop we just got rid
// of. Motion that costs you the subject is not worth having.
//
// The plate is UNCOVERED on arrival instead: components/tet/TetScroll wipes the
// frame open from the bottom while the picture settles from 1.06 to 1. A
// photograph that fades up looks like a slow image load, which is the one
// association a photograph must not have.
// ═══════════════════════════════════════════════════════════════════════════

export default function TetPlate({
  src, sm, width, height, smWidth = 900, alt = '', caption, eager = false,
  maxWidth = 1120, align = 'start', step = 0, overlay, layer, after,
}: {
  src: string
  /** The phone-sized file. Same picture, fewer pixels. */
  sm?: string
  /** The image's REAL pixel size. The frame is shaped from these — get them
   *  wrong and the crop this component exists to prevent comes straight back. */
  width: number
  height: number
  smWidth?: number
  alt?: string
  /** Mono, under a hairline. Say where it is, not how it feels. */
  caption?: string
  eager?: boolean
  maxWidth?: number
  align?: 'start' | 'center'
  /** Place in the stagger, so a pair of plates does not arrive as one slab. */
  step?: number
  /** Laid over the photograph, bottom-left, on a soft shade so it reads. */
  overlay?: ReactNode
  /** Laid over the photograph with no shade and taking the pointer — for
   *  things placed ON the picture (the flight's bottles). Position children in
   *  percentages; the frame is the photograph's own shape. */
  layer?: ReactNode
  /** Between the photograph and its caption. */
  after?: ReactNode
}) {
  return (
    <figure className="tp" style={{ maxWidth, marginInline: align === 'center' ? 'auto' : undefined }}>
      <Reveal variant="wipe" step={step} className="tp-frame"
              style={{ aspectRatio: `${width} / ${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={sm ? `${sm} ${smWidth}w, ${src} ${width}w` : undefined}
          sizes={sm ? `(max-width: 780px) 100vw, ${maxWidth}px` : undefined}
          width={width} height={height} alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
        />
        {overlay && <div className="tp-over">{overlay}</div>}
        {layer && <div className="tp-layer">{layer}</div>}
      </Reveal>
      {after}
      {caption && (
        <Reveal step={step + 1}>
          <figcaption className="tp-cap">{caption}</figcaption>
        </Reveal>
      )}
    </figure>
  )
}

export const TET_PLATE_CSS = `
.tp { margin: 0; }

/* A hairline, not a box — the picture has edges of its own. */
.tp-frame { position: relative; width: 100%; overflow: hidden; border-radius: 2px;
            background: rgba(229,212,194,.05); }
/* The PHOTOGRAPH only — "> img". An overlay can carry an image of its own
   (the Duncan Taylor crest), and ".tp-frame img" stretched it to fill. */
.tp-frame > img { display: block; width: 100%; height: 100%; object-fit: cover; }
.tp-over { position: absolute; inset: 0; display: flex; align-items: flex-end;
           padding: clamp(18px, 3.2vw, 44px); pointer-events: none;
           background: linear-gradient(to top, rgba(4,20,14,.72), rgba(4,20,14,0) 58%); }

.tp-layer { position: absolute; inset: 0; }

.tp-cap { margin-top: 14px; padding-top: 12px;
          border-top: 1px solid rgba(229,212,194,.16);
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
          color: rgba(229,212,194,.5); }

/* Two plates side by side, each still at its own shape. They stack on a phone
   rather than shrinking to stamps. */
.tp-pair { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(20px, 3vw, 40px);
           align-items: start; }

/* A PAIR THAT READS AS A PAIR (owner, 2026-10-01: "make these two pictures
   closer to equal sizes").
   Equal columns do NOT give equal pictures: two photographs of different shape
   in two columns of one width come out at two different heights, and the
   squarer one looks bigger. The cooper is 1082×592 and the char 1152×768 —
   1.83 against 1.50 — so the char stood a fifth taller.
   The columns are weighted by those ratios instead, which lands both at the
   same HEIGHT with nothing cropped. The numbers are the pictures' own, so if
   either photograph is replaced this ratio is the thing to update with it.
   A CLASS, NOT AN INLINE STYLE: an inline grid-template-columns would outrank
   the phone breakpoint below and the pair would never stack. */
.tp-pair.is-levelled { grid-template-columns: 1.83fr 1.50fr; }

@media (max-width: 780px) {
  .tp-pair, .tp-pair.is-levelled { grid-template-columns: 1fr; gap: 44px; }
}

`
```

## `components/tet/TetScroll.tsx`

128 lines · 6,015 bytes

```tsx
'use client'

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// SCROLL THAT READS AS SOMETHING.
// ───────────────────────────────────────────────────────────────────────────
// The page had the kit's Rise on three headings: opacity 0→1 and 22px of
// travel over .9s, everything in a section arriving at the same instant. That
// is technically an animation and visually nothing — by the time your eye
// reaches the words they have already finished moving, and a whole section
// landing as one block is indistinguishable from it being there all along.
//
// Three things fix it, and none of them is "more movement":
//
//   1. STAGGER. Eyebrow, then rule, then title, then lede — 90ms apart. The
//      eye follows an order instead of catching a finished state. This is what
//      actually makes a page feel composed rather than animated.
//   2. DISTANCE AND TIME. 22px over .9s is below the threshold you notice.
//      40px over 1.1s on a slow-out curve is not.
//   3. A WIPE FOR THE PICTURES. A photograph fading up looks like a slow
//      image load — which is exactly the wrong association. It is uncovered
//      instead: clip-path from the bottom edge while the image itself sits at
//      1.06 and settles to 1, so the frame reveals and the picture relaxes
//      into it.
//
// ONE OBSERVER PER ELEMENT, DISCONNECTED ON ARRIVAL. Nothing re-animates on
// the way back up: a page that replays itself every scroll is a page people
// stop scrolling. And every one of these is a no-op under
// prefers-reduced-motion — the content is simply there.
// ═══════════════════════════════════════════════════════════════════════════

function useSeen<T extends HTMLElement>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect() }
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [seen, rootMargin])
  return { ref, seen }
}

/** One thing arriving. `step` is its place in the stagger, not milliseconds —
 *  the interval lives in the CSS so it can be tuned in one spot. */
export function Reveal({ children, step = 0, variant = 'rise', className = '', style }: {
  children: ReactNode
  step?: number
  variant?: 'rise' | 'wipe' | 'slide'
  className?: string
  style?: CSSProperties
}) {
  const { ref, seen } = useSeen<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`tr tr-${variant} ${seen ? 'is-in' : ''} ${className}`}
      style={{ ['--i' as string]: step, ...style }}
    >
      {children}
    </div>
  )
}

/** A hairline that fills as the page is read. It is the only thing on the page
 *  that moves continuously, which is why it is one pixel of gold and nothing
 *  else — a progress bar you notice is a progress bar in the way. */
export function ScrollRail() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const read = () => {
      raf = 0
      const h = document.documentElement.scrollHeight - window.innerHeight
      setPct(h > 0 ? Math.min(1, window.scrollY / h) : 0)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read) }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return <div className="tr-rail" aria-hidden><span style={{ transform: `scaleX(${pct})` }} /></div>
}

export const TET_SCROLL_CSS = `
:root { --tr-step: 90ms; --tr-ease: cubic-bezier(.16,.84,.44,1); }

.tr { will-change: transform, opacity; }
.tr-rise, .tr-slide {
  opacity: 0;
  transition: opacity .8s var(--tr-ease), transform 1.1s var(--tr-ease);
  transition-delay: calc(var(--i, 0) * var(--tr-step));
}
.tr-rise  { transform: translateY(40px); }
.tr-slide { transform: translateX(-28px); }
.tr-rise.is-in, .tr-slide.is-in { opacity: 1; transform: none; }

/* The pictures are UNCOVERED, not faded. clip-path animates on the compositor
   and, unlike a height or a mask-image, needs no wrapper to clip against. */
.tr-wipe { clip-path: inset(0 0 100% 0); transition: clip-path 1.15s var(--tr-ease);
           transition-delay: calc(var(--i, 0) * var(--tr-step)); }
.tr-wipe.is-in { clip-path: inset(0 0 0 0); }
.tr-wipe > img { transform: scale(1.06); transition: transform 1.6s var(--tr-ease);
                 transition-delay: calc(var(--i, 0) * var(--tr-step)); }
.tr-wipe.is-in > img { transform: none; }

.tr-rail { position: fixed; top: 0; left: 0; right: 0; height: 1px; z-index: 9000;
           background: rgba(229,212,194,.1); pointer-events: none; }
.tr-rail span { display: block; height: 100%; background: #D4B85A;
                transform-origin: 0 50%; transform: scaleX(0); }

@media (prefers-reduced-motion: reduce) {
  .tr, .tr-wipe > img { opacity: 1 !important; transform: none !important;
                      clip-path: none !important; transition: none !important; }
  .tr-rail { display: none; }
}
`
```

## `components/tet/TetTimeline.tsx`

443 lines · 23,738 bytes

```tsx
'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { timeRemaining } from '@/lib/tet/queries'
import { MONO, GOLD, INK } from '@/components/public/kit'
import type { Countdown } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE RUN TO TẾT — the dates as a distance, not a list.
// ───────────────────────────────────────────────────────────────────────────
// Five rows of "date · N days" is a reference table. It says when things are
// and nothing about how they sit against each other, which is the only part
// that changes what a buyer does today: the casks shut in six weeks, then
// there is nothing to decide for two months, then three things land inside a
// fortnight. A list flattens exactly that.
//
// So: one rail from today to Tết, each gate at its true proportion along it.
// The gold length is the decision window — today to the first gate that can
// still be missed — so the shortening of that segment over the autumn IS the
// urgency, with nothing shouting about it.
//
// Blends and artwork fall on the same date, so they share one marker instead
// of pretending to be two decisions.
//
// ── MOVEMENT AND TOUCH (owner, 2026-09-22: "bring some animation /
// interactivity to this") ─────────────────────────────────────────────────
// It still plays ONCE, but now it plays as a journey instead of a fade:
//   · a pen line runs from Today to Tết at a constant speed, and each gate
//     arrives at the moment the line reaches it — so the gaps are FELT, the
//     long empty stretch across December takes as long as it looks;
//   · each gate's day count runs up as it lands;
//   · the gold window is drawn at the same speed, stopping at the lead gate.
// The only thing that keeps moving is a slow breath on the lead dot — the
// one gate that can still be missed.
//
// And it answers back. Hover a gate (or tap it, or Tab to it and use the
// arrow keys) and the rail fills from Today to that gate, the others step
// back, and it tells you two facts it can compute: days from today, days
// before Tết. Anywhere else on the rail, a hairline follows the pointer with
// the date under it — "what if I leave it until mid-December?" answered by
// pointing. Every figure is arithmetic on the dates; nothing is invented.
// ═══════════════════════════════════════════════════════════════════════════

const CREAM = '#E5D4C2'
const SAGE = '#7AB07A'
/** Seconds for the pen to travel the whole rail. Everything is timed off it. */
const DRAW = 2.2
/** Seconds each day count takes to run up. */
const COUNT = 0.9

interface Stop {
  at: number        // 0–1 along the rail
  date: string
  title: string
  note: string
  tone: string
  lead: boolean     // the next gate that can still be missed
  showDays: boolean
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

export default function TetTimeline({ cd, t, locale }: {
  cd: Countdown
  t: (en: string, vn: string) => string
  locale: string
}) {
  const fetchedAt = useMemo(() => Date.now(), [])
  const [now, setNow] = useState(fetchedAt)
  const [drawn, setDrawn] = useState(false)
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  // Seconds since the rail started drawing; null = not animating (the counts
  // show their real value — which is also what the server renders).
  const [clock, setClock] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const [scrub, setScrub] = useState<number | null>(null)
  const [wide, setWide] = useState(true)
  const stopRefs = useRef<(HTMLDivElement | null)[]>([])

  // Days, not seconds: the ticking clock lives one section up, and two of them
  // on one screen is a countdown competing with itself.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)')
    const read = () => setWide(mq.matches)
    read(); mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])

  useEffect(() => {
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setDrawn(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setDrawn(true); io.disconnect() }
    }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [el])

  // The counts run up on one animation frame loop, which ends by itself.
  useEffect(() => {
    if (!drawn) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const t0 = performance.now()
    const tick = (ts: number) => {
      const s = (ts - t0) / 1000
      if (s > DRAW + COUNT + 0.2) { setClock(null); return }
      setClock(s); raf = requestAnimationFrame(tick)
    }
    setClock(0); raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [drawn])

  const rem = (iso: string) => timeRemaining(iso, cd.now, now, fetchedAt)
  const days = (iso: string) => rem(iso).days
  const fmt = (iso: string) => new Date(iso + 'T12:00:00+07:00')
    .toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })

  // Everything is measured against the distance left to Tết, so the rail
  // shortens from the left as the season closes in.
  const span = Math.max(days(cd.festival_date), 1)
  const sameDay = cd.cutoffs.blend.date === cd.cutoffs.artwork.date

  const raw: Stop[] = [
    {
      at: days(cd.cutoffs.cask.date) / span, date: cd.cutoffs.cask.date,
      title: t('Casks close', 'Đóng đặt thùng'),
      note: t('bottled at Huntly, then shipped', 'đóng chai tại Huntly, rồi vận chuyển'),
      tone: GOLD, lead: false, showDays: true,
    },
    {
      at: days(cd.cutoffs.blend.date) / span, date: cd.cutoffs.blend.date,
      title: sameDay ? t('Blends & artwork', 'Pha trộn & thiết kế') : t('Blends close', 'Đóng đặt pha trộn'),
      note: sameDay
        ? t('last order, and the sleeve signed off', 'hạn đặt cuối, và chốt thiết kế hộp')
        : t('last order', 'hạn đặt cuối'),
      tone: CREAM, lead: false, showDays: true,
    },
    ...(sameDay ? [] : [{
      at: days(cd.cutoffs.artwork.date) / span, date: cd.cutoffs.artwork.date,
      title: t('Artwork agreed', 'Chốt thiết kế'),
      note: t('sleeves go to print', 'hộp vào in'),
      tone: CREAM, lead: false, showDays: true,
    }]),
    {
      at: days(cd.in_hand_date) / span, date: cd.in_hand_date,
      title: t('In your hands', 'Giao tận tay'),
      note: t('before the offices close', 'trước khi các văn phòng nghỉ Tết'),
      tone: SAGE, lead: false, showDays: true,
    },
    {
      at: 1, date: cd.festival_date,
      title: 'Tết Đinh Mùi',
      note: t('the fifteen days', 'mười lăm ngày Tết'),
      tone: GOLD, lead: false, showDays: false,
    },
  ].sort((a, b) => a.at - b.at)

  // The lead is the first gate still ahead — the one thing on this rail that
  // can be lost today. If the casks have shut it moves along on its own.
  const leadIdx = raw.findIndex(s => s.showDays && !rem(s.date).past)
  const stops = raw.map((s, i) => ({ ...s, lead: i === leadIdx }))
  const lead = leadIdx >= 0 ? stops[leadIdx] : null
  const windowPct = Math.max(2, Math.min(100, (lead ? lead.at : 1) * 100))

  // When each gate lands: when the pen reaches it on a wide screen, one after
  // another down the column on a phone.
  const landsAt = (i: number, at: number) => wide ? at * DRAW : 0.25 + i * 0.22
  const shown = (i: number, s: Stop) => {
    const real = days(s.date)
    if (clock === null) return real
    return Math.round(real * ease((clock - landsAt(i, s.at)) / COUNT))
  }

  const active = hover ?? pinned
  const act = active !== null ? stops[active] : null
  const festDays = days(cd.festival_date)

  // The pointer on the rail. Near a gate it becomes that gate; anywhere else
  // it is a date.
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!wide || e.pointerType !== 'mouse') return
    const onStop = (e.target as HTMLElement).closest('[data-stop]')
    if (onStop) { setHover(Number(onStop.getAttribute('data-stop'))); setScrub(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    const f = (e.clientX - r.left) / r.width
    const y = Math.abs(e.clientY - (r.top + r.height / 2))
    if (f < 0 || f > 1 || y > 40) { setScrub(null); setHover(null); return }
    const near = stops.findIndex(s => Math.abs(s.at - f) < 0.025)
    if (near >= 0) { setHover(near); setScrub(null) } else { setHover(null); setScrub(f) }
  }
  const onLeave = () => { setHover(null); setScrub(null) }

  const toggle = (i: number) => setPinned(p => (p === i ? null : i))
  const keys = (e: KeyboardEvent<HTMLDivElement>, i: number) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(i); return }
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const j = Math.min(stops.length - 1, Math.max(0, i + d))
    stopRefs.current[j]?.focus(); setPinned(j)
  }

  // The scrubbed date: today plus that fraction of the run.
  const scrubDays = scrub !== null ? Math.round(scrub * span) : 0
  const scrubDate = scrub !== null
    ? new Date(new Date(cd.now).getTime() + scrubDays * 86400_000)
        .toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
    : ''
  const reachPct = act ? Math.min(100, act.at * 100) : scrub !== null ? scrub * 100 : 0

  return (
    <section className="pk-wrap" style={{ paddingTop: 12, paddingBottom: 8 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .tl { position: relative; padding: 124px 0 142px; }
        .tl-rail, .tl-run, .tl-pen, .tl-reach { position: absolute; left: 0; top: 50%; height: 1px; }
        .tl-rail { right: 0; background: rgba(229,212,194,.16); }
        /* The pen: a brighter line travelling the whole rail at one speed. */
        .tl-pen  { right: 0; background: rgba(229,212,194,.42); transform-origin: left center;
                   transform: scaleX(0); transition: transform ${DRAW}s linear; }
        .tl.is-drawn .tl-pen { transform: scaleX(1); }
        /* The gold window, drawn at the pen's speed so the two leave together
           and the gold stops where the lead gate is. */
        .tl-run  { background: ${GOLD}; height: 2px; margin-top: -.5px; transform-origin: left center;
                   transform: scaleX(0); transition: transform calc(${DRAW}s * var(--w)) linear; }
        .tl.is-drawn .tl-run { transform: scaleX(1); }
        /* Hovering a gate fills the rail up to it. */
        .tl-reach { background: ${CREAM}; opacity: 0; transition: width .45s cubic-bezier(.16,.84,.44,1), opacity .3s ease; }
        .tl-reach.is-on { opacity: .75; }

        .tl-window { position: absolute; top: 50%; left: 0; margin-top: -34px;
                     opacity: 0; transition: opacity .6s ease; transition-delay: calc(${DRAW}s * var(--w)); }
        .tl.is-drawn .tl-window { opacity: 1; }
        .tl-window-inner { font-family: ${MONO}; font-size: 10px; letter-spacing: .18em;
                           text-transform: uppercase; color: ${GOLD}; white-space: nowrap;
                           padding-left: 2px; }
        .tl-window-bars { position: absolute; top: 50%; height: 9px; margin-top: -4px;
                          border-left: 1px solid ${GOLD}; border-right: 1px solid ${GOLD};
                          opacity: 0; transition: opacity .5s ease; transition-delay: calc(${DRAW}s * var(--w)); }
        .tl.is-drawn .tl-window-bars { opacity: .55; }

        .tl-stop { position: absolute; top: 50%; transform: translate(-50%, -50%); outline: none;
                   cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .tl-stop > * { opacity: 0; transition: opacity .7s ease, transform .7s cubic-bezier(.16,.84,.44,1);
                       transition-delay: var(--d); }
        .tl-label { transform: translate(var(--x), 10px); }
        .tl-label.is-up { transform: translate(var(--x), -10px); }
        .tl.is-drawn .tl-stop > * { opacity: 1; }
        .tl.is-drawn .tl-label { transform: translate(var(--x), 0); }
        /* Once something is chosen, the others step back — quickly, with no delay. */
        .tl.has-active .tl-stop > * { transition-delay: 0s; transition-duration: .3s; }
        .tl.has-active .tl-stop:not(.is-active) > * { opacity: .32; }

        .tl-dot { width: 7px; height: 7px; border-radius: 50%; background: ${CREAM}; position: relative;
                  transform: scale(0); transition: transform .5s cubic-bezier(.34,1.8,.5,1), opacity .3s ease !important;
                  transition-delay: var(--d) !important; }
        .tl.is-drawn .tl-dot { transform: scale(1); }
        .tl.has-active .tl-dot { transition-delay: 0s !important; }
        .tl-stop.is-active .tl-dot { transform: scale(1.7); }
        .tl-dot.is-lead { width: 13px; height: 13px; }
        /* The lead gate breathes: the one thing on this page that keeps moving,
           because it is the one thing that can still be missed. */
        .tl-dot.is-lead::after { content: ''; position: absolute; inset: -6px; border-radius: 50%;
                                 border: 1px solid ${GOLD}; opacity: 0;
                                 animation: tl-breathe 2.8s ease-out infinite; animation-delay: calc(var(--d) + .6s); }
        @keyframes tl-breathe { 0% { transform: scale(.7); opacity: .7 } 100% { transform: scale(2.1); opacity: 0 } }
        .tl-stop:focus-visible .tl-dot { box-shadow: 0 0 0 3px rgba(212,184,90,.5); }

        /* 186px, not 164: "31 thg 10, 2026 · 43 ngày" wrapped the day count
           onto its own line in Vietnamese, which read as a stray number. */
        .tl-label { position: absolute; left: 50%; width: 186px; }
        .tl-label.is-up   { bottom: 24px; }
        .tl-label.is-down { top: 24px; }
        .tl-title { font-family: 'Rampant Sans', Georgia, serif; font-size: 17px; line-height: 1.15; transition: color .3s ease; }
        .tl-date  { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .06em; opacity: .62; margin-top: 6px;
                    font-variant-numeric: tabular-nums; }
        .tl-note  { font-family: ${MONO}; font-size: 9.5px; opacity: .4; margin-top: 5px; line-height: 1.7; }
        /* The two computed facts, opened under the chosen gate. */
        .tl-more  { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s cubic-bezier(.16,.84,.44,1); }
        .tl-more > div { overflow: hidden; font-family: ${MONO}; font-size: 10px; letter-spacing: .04em;
                         color: ${GOLD}; line-height: 1.7; }
        .tl-stop.is-active .tl-more { grid-template-rows: 1fr; }
        .tl-more > div > span { display: block; padding-top: 6px; }

        .tl-today { position: absolute; left: 0; top: 50%; transform: translateY(-50%); }
        .tl-today-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(229,212,194,.55);
                        transform: translateX(-50%); }
        .tl-today-cap { position: absolute; top: 20px; left: -2px; font-family: ${MONO};
                        font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
                        color: rgba(229,212,194,.45); white-space: nowrap; }

        /* The pointer's date, between gates. */
        .tl-cursor { position: absolute; top: 50%; width: 1px; height: 26px; margin-top: -13px;
                     background: ${CREAM}; pointer-events: none; opacity: .8; }
        .tl-cursor-cap { position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
                         font-family: ${MONO}; font-size: 10px; letter-spacing: .06em; white-space: nowrap;
                         color: ${CREAM}; background: ${INK}; padding: 3px 7px; border-radius: 2px;
                         font-variant-numeric: tabular-nums; }
        .tl-hint { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase;
                   opacity: 0; margin-top: -70px; text-align: left; color: rgba(229,212,194,.35);
                   transition: opacity .8s ease ${DRAW + 0.6}s; }
        .tl.is-drawn + .tl-hint { opacity: 1; }

        /* A phone cannot hold five labels on one horizontal line without
           turning them into confetti, so the rail stands up and runs down the
           side — same order, same proportions gone, but nothing overlaps. */
        @media (max-width: 860px) {
          .tl { padding: 0; }
          .tl-rail { left: 3px; right: auto; top: 6px; bottom: 6px; width: 1px; height: auto; }
          .tl-pen { left: 3px; right: auto; top: 6px; bottom: 6px; width: 1px; height: auto;
                    transform: scaleY(0); transform-origin: center top; transition-duration: 1.6s; }
          .tl.is-drawn .tl-pen { transform: scaleY(1); }
          /* The gold length means "this much of the run is still yours to
             decide in" — and that only reads while the stops are placed by
             real distance. Stacked evenly down a phone they are not, so the
             segment would be measuring nothing. The lead dot carries the gold
             on its own here. */
          .tl-run, .tl-window, .tl-window-bars, .tl-reach, .tl-cursor, .tl-hint { display: none; }
          .tl-stop { position: relative; top: auto; left: auto !important; transform: none;
                     display: grid; grid-template-columns: 14px 1fr; gap: 16px;
                     align-items: start; padding: 18px 0; }
          .tl-dot { margin-top: 6px; }
          .tl-dot.is-lead { margin-top: 3px; margin-left: -3px; }
          .tl-label, .tl-label.is-up { position: static; width: auto; transform: translateX(-14px); }
          .tl.is-drawn .tl-label { transform: none; }
          .tl-today { position: relative; display: grid; grid-template-columns: 14px 1fr;
                      gap: 16px; transform: none; padding-bottom: 2px; }
          .tl-today-dot { transform: none; margin-top: 6px; }
          .tl-today-cap { position: static; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tl-run, .tl-pen, .tl-reach, .tl-stop > *, .tl-dot, .tl-window, .tl-window-bars, .tl-more, .tl-hint
            { transition: none !important; }
          .tl-run, .tl-pen { transform: none !important; }
          .tl-stop > *, .tl-window { opacity: 1; }
          .tl-dot { transform: none; }
          .tl-dot.is-lead::after { animation: none; }
        }
      ` }} />

      <div
        ref={setEl}
        className={`tl${drawn ? ' is-drawn' : ''}${act ? ' has-active' : ''}`}
        style={{ ['--w' as string]: windowPct / 100 }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <div className="tl-rail" />
        <div className="tl-pen" />
        <div className="tl-run" style={{ width: `${windowPct}%` }} />
        <div className={`tl-reach${act || scrub !== null ? ' is-on' : ''}`} style={{ width: `${reachPct}%` }} />

        {/* The gold length, named. It is the only number on this rail that
            means "act", so it is the only one wearing the gold. */}
        {lead && (
          <>
            <div className="tl-window" style={{ width: `${windowPct}%` }}>
              {/* Named, not counted. The number is already in 60px type one
                  section above; printing it twice makes both of them smaller. */}
              <div className="tl-window-inner">
                {t('Your window to decide', 'Thời gian để quyết định')}
              </div>
            </div>
            <div className="tl-window-bars" style={{ left: 0, width: `${windowPct}%` }} />
          </>
        )}

        <div className="tl-today">
          <div className="tl-today-dot" />
          <div className="tl-today-cap">{t('Today', 'Hôm nay')}</div>
        </div>

        {scrub !== null && (
          <div className="tl-cursor" style={{ left: `${scrub * 100}%` }} aria-hidden>
            <div className="tl-cursor-cap">
              {scrubDate} · {scrubDays} {t('days', 'ngày')}
            </div>
          </div>
        )}

        {stops.map((s, i) => {
          const d = days(s.date)
          const past = rem(s.date).past
          const before = festDays - d
          return (
            <div
              key={s.date + s.title}
              ref={n => { stopRefs.current[i] = n }}
              data-stop={i}
              role="button"
              tabIndex={0}
              aria-expanded={active === i}
              className={`tl-stop${active === i ? ' is-active' : ''}`}
              style={{
                left: `${Math.min(100, Math.max(0, s.at * 100))}%`,
                ['--d' as string]: `${landsAt(i, s.at).toFixed(2)}s`,
                ['--x' as string]: s.at > 0.9 ? '-88%' : s.at < 0.1 ? '-12%' : '-50%',
              }}
              onClick={() => toggle(i)}
              onKeyDown={e => keys(e, i)}
              onBlur={() => setPinned(p => (p === i ? null : p))}
            >
              <div className={`tl-dot${s.lead ? ' is-lead' : ''}`} style={{ background: s.tone }} />
              {/* Labels alternate above and below so neighbouring gates never
                  share a line, and the last one is pulled in off the right edge
                  instead of hanging past it. */}
              <div className={`tl-label ${i % 2 ? 'is-down' : 'is-up'}`}>
                <div className="tl-title" style={{ color: s.lead || active === i ? GOLD : CREAM }}>{s.title}</div>
                <div className="tl-date">
                  {fmt(s.date)}
                  {s.showDays && (
                    past
                      ? <span style={{ opacity: .7 }}> · {t('passed', 'đã qua')}</span>
                      : <span style={{ opacity: .7 }}> · {shown(i, s)} {t('days', 'ngày')}</span>
                  )}
                </div>
                <div className="tl-note">{s.note}</div>
                <div className="tl-more" aria-hidden={active !== i}>
                  <div><span>
                    {past
                      ? t('This gate has passed.', 'Mốc này đã qua.')
                      : s.showDays
                        ? t(`${d} days from today · ${before} before Tết`, `${d} ngày từ hôm nay · ${before} ngày trước Tết`)
                        : t(`${d} days from today`, `${d} ngày từ hôm nay`)}
                  </span></div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {wide && (
        <div className="tl-hint" aria-hidden>{t('Point along the line for any date', 'Rê chuột dọc đường để xem ngày')}</div>
      )}
    </section>
  )
}
```

## `components/tet/TetTiers.tsx`

218 lines · 11,986 bytes

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useLang } from '@/lib/lang'
import { vnd, type VolumeTier } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE LADDER, AS SOMETHING TO PULL ON.
// ───────────────────────────────────────────────────────────────────────────
// The tiers were a static list, which is the least persuasive way to show a
// volume discount: a buyer has a number in their head — "about two hundred" —
// and wants to know what that number buys. So they move it, and the tier, the
// discount and the distance to the next one move with it.
//
// WHAT IS COMPUTED HERE AND WHAT IS NOT. Which tier a count falls in, and how
// many more bottles reach the next one, are the PUBLISHED TERMS — the same four
// rows printed on the leaflet, looked up, not calculated. No price is worked
// out in this file: when the figures are real the page asks the database for a
// finished number, exactly as everywhere else.
//
// THE STAIRCASE (2026-09-22). The same four rows, drawn: bottles along, the
// discount up, one step per tier. The part of the stair you have reached is
// gold and a marker stands on your number, so "twenty more bottles" becomes a
// step you can see is right there. Pointing at the stair moves the number;
// it is the slider, in the shape of the ladder.
// ═══════════════════════════════════════════════════════════════════════════

const GOLD = '#D4B85A'
const CREAM = '#E5D4C2'
const SAGE = '#7AB07A'

// THE QUICK PICKS ARE THE LADDER ITSELF (2026-10-01). They were four
// hand-written numbers — 50, 100, 250, 500 — chosen when the ladder had four
// rungs. It has eight now, and a hard-coded list beside a table-driven chart is
// two sources for one fact. Every rung is a chip, so the control and the thing
// it controls cannot drift.
const MAX = 800

export default function TetTiers({ tiers, provisional }: { tiers: VolumeTier[]; provisional: boolean }) {
  const { t, lang } = useLang()
  const vn = lang === 'vn'
  const [bottles, setBottles] = useState(100)
  const [price, setPrice] = useState<{ unit: number; total: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const current = useMemo(
    () => [...tiers].reverse().find(x => bottles >= x.min_bottles) ?? tiers[0],
    [tiers, bottles],
  )
  const next = useMemo(
    () => tiers.find(x => x.min_bottles > (current?.min_bottles ?? 0)) ?? null,
    [tiers, current],
  )
  const min = tiers[0]?.min_bottles ?? 50
  const STEPS = tiers.map(x => x.min_bottles)

  // Only once the numbers are real. While anything is provisional the page
  // shows no price at all, and asking for one would be asking the database to
  // dress up a placeholder.
  const priceIt = async () => {
    if (provisional || busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/tet/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: [{ sku: 'DT-12YO', qty: bottles }], sleeve: true }),
      })
      const j = await r.json().catch(() => ({}))
      const line = j?.quote?.lines?.[0]
      if (line) setPrice({ unit: line.unit_inc_vat_vnd, total: j.quote.total_inc_vat_vnd })
    } finally { setBusy(false) }
  }

  // The staircase. Bottles to x on the slider's own range, so the marker and
  // the thumb underneath stand at the same place.
  const CW = 1000, CH = 150, top = 26, base = 118
  const maxPct = Math.max(0.01, ...tiers.map(x => x.discount_pct))
  const xOf = (b: number) => ((Math.min(MAX, Math.max(min, b)) - min) / (MAX - min)) * CW
  const yOf = (pct: number) => base - (pct / maxPct) * (base - top)
  const steps = tiers.map((x, i) => ({
    x0: xOf(x.min_bottles), x1: i + 1 < tiers.length ? xOf(tiers[i + 1].min_bottles) : CW, y: yOf(x.discount_pct), tier: x,
  }))
  const stair = steps.map((st, i) => `${i ? 'L' : 'M'}${st.x0} ${i ? steps[i - 1].y : st.y}L${st.x0} ${st.y}L${st.x1} ${st.y}`).join('')
  const reached = xOf(bottles)
  const fromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setBottles(Math.round((min + f * (MAX - min)) / 10) * 10); setPrice(null)
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: `; border-radius: 50%;
                    cursor: grab; border: none; };
                    border: none; border-radius: 50%; cursor: grab; }
        .tt-chip { background: none; border: none; cursor: pointer; padding: 4px 0;
                   font-family: 'Google Sans Code', monospace; font-size: 12px;
                   letter-spacing: .1em; color: ${CREAM}; opacity: .45;
                   border-bottom: 1px solid transparent; }
        .tt-chip.is-on { opacity: 1; color: ${GOLD}; border-bottom-color: ${GOLD}; }
        /* ── REACHABLE BY THUMB (2026-10-01) ──────────────────────────────
           The chips were 17px wide: "50" is two characters and that was the
           whole target. They are the only way to jump to a rung now that the
           slider has gone, so they have to be easy to hit. */
        @media (pointer: coarse) {
          .tt-chip { padding: 11px 14px; min-width: 44px; }
        }
        .tt-num { font-variant-numeric: tabular-nums; }
        .tt-stair { display: block; width: 100%; height: auto; margin-top: 22px; cursor: pointer; touch-action: pan-y; overflow: visible; }
        .tt-stair text { font-family: 'Google Sans Code', monospace; }
        .tt-reach { transition: width .35s cubic-bezier(.16,.84,.44,1); }
        .tt-mark { transition: transform .35s cubic-bezier(.16,.84,.44,1); }
        @media (prefers-reduced-motion: reduce) { .tt-reach, .tt-mark { transition: none; } }
      ` }} />

      {/* TAP A NUMBER. The chips ARE the rungs, so every discount on the chart
          below is one tap away and the thing you want is never between two of
          them. */}
      <div style={{ display: 'flex', gap: 'clamp(6px, 2vw, 22px)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="pk-eyebrow" style={{ marginRight: 4 }}>{t('If you took', 'Nếu quý vị đặt')}</span>
        {STEPS.map(n => (
          <button key={n} onClick={() => { setBottles(n); setPrice(null) }}
                  aria-pressed={bottles === n}
                  className={`tt-chip ${bottles === n ? 'is-on' : ''}`}>{n}</button>
        ))}
      </div>

      <svg className="tt-stair" viewBox={`0 0 ${CW} ${CH}`} aria-hidden
           onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e) }}
           onPointerMove={e => { if (e.buttons) fromPointer(e) }}>
        <defs>
          <clipPath id="tt-clip"><rect className="tt-reach" x="0" y="0" width={reached} height={CH} /></clipPath>
        </defs>
        {/* the whole ladder, faint */}
        <path d={`${stair}L${CW} ${base}L0 ${base}Z`} fill="rgba(229,212,194,.05)" />
        <path d={stair} fill="none" stroke="rgba(229,212,194,.28)" strokeWidth="1.5" />
        {/* the part you have climbed */}
        <g clipPath="url(#tt-clip)">
          <path d={`${stair}L${CW} ${base}L0 ${base}Z`} fill="rgba(212,184,90,.16)" />
          <path d={stair} fill="none" stroke={GOLD} strokeWidth="2" />
        </g>
        {steps.map(st => (
          <g key={st.tier.min_bottles}>
            <text x={st.x0 + 8} y={st.y - 8} fontSize="15"
                  fill={current?.min_bottles === st.tier.min_bottles ? GOLD : 'rgba(229,212,194,.55)'}>
              {st.tier.discount_pct ? `−${Math.round(st.tier.discount_pct * 100)}%` : t('list', 'giá gốc')}
            </text>
            <text x={st.x0} y={base + 22} fontSize="13" fill="rgba(229,212,194,.4)">{st.tier.min_bottles}</text>
          </g>
        ))}
        <g className="tt-mark" style={{ transform: `translateX(${reached}px)` }}>
          <line x1="0" x2="0" y1={top - 16} y2={base} stroke={CREAM} strokeWidth="1" />
          <circle cx="0" cy={yOf(current?.discount_pct ?? 0)} r="6" fill={GOLD} />
        </g>
      </svg>

      {/* THE DRAGGABLE SLIDER IS GONE (owner, 2026-10-01: "the drag discount
          button is not that great"). It was the third way to set one number —
          after the chips above and the staircase itself, which already scrubs
          under a finger — and it was a one-pixel-tall track with an 18px thumb,
          so on a phone the only way to move it was to land on the thumb
          exactly. Two controls, both of them easy to hit. */}

      <div style={{ display: 'flex', gap: 'clamp(24px, 6vw, 72px)', flexWrap: 'wrap', alignItems: 'baseline', marginTop: 24 }}>
        <div>
          <div className="pk-h2 tt-num" style={{ margin: 0 }}>{bottles}</div>
          <div className="pk-meta" style={{ marginTop: 6 }}>{t('bottles', 'chai')}</div>
        </div>
        <div>
          <div className="pk-h2 tt-num" style={{ margin: 0, color: current?.discount_pct ? GOLD : CREAM }}>
            {current ? `${Math.round(current.discount_pct * 100)}%` : '—'}
          </div>
          <div className="pk-meta" style={{ marginTop: 6 }}>
            {current?.discount_pct ? t('off each bottle', 'giảm mỗi chai') : t('list price', 'giá niêm yết')}
          </div>
        </div>
        <div style={{ minWidth: 150 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 'clamp(20px,2.4vw,26px)' }}>
            {current ? (vn ? current.label_vn : current.label_en) : '—'}
          </div>
          <div className="pk-meta" style={{ marginTop: 6 }}>
            {bottles >= 250
              ? t('sleeve setup included', 'miễn phí thiết kế hộp')
              : t('sleeve setup charged under 250', 'dưới 250 chai có phí thiết kế')}
          </div>
        </div>
      </div>

      {/* The honest upsell: the exact distance to the next rung, never a nudge
          dressed as a deadline. */}
      <p className="pk-meta" style={{ marginTop: 20, color: next ? GOLD : SAGE, lineHeight: 1.9 }}>
        {next
          ? t(`${next.min_bottles - bottles} more bottles reaches ${next.label_en} — ${Math.round(next.discount_pct * 100)}% off.`,
              `Thêm ${next.min_bottles - bottles} chai để đạt mức ${next.label_vn} — giảm ${Math.round(next.discount_pct * 100)}%.`)
          : t('That is the best rate on the ladder.', 'Đây là mức tốt nhất trên bảng.')}
      </p>

      {/* The line that said per-bottle prices appear once Huntly confirm them
          is gone (owner, 2026-10-01). While prices are provisional the block
          simply shows nothing rather than explaining its own absence — a buyer
          reading about discounts does not need to be told which supplier has
          not replied yet. */}
      {provisional ? null : (
        <div style={{ marginTop: 14 }}>
          {price ? (
            <p className="pk-meta" style={{ color: CREAM, fontSize: 13 }}>
              {vnd(price.unit)} {t('a bottle', 'mỗi chai')} · {vnd(price.total)} {t('in total, with sleeves', 'tổng cộng, kèm hộp')}
            </p>
          ) : (
            <button onClick={priceIt} className="pk-cta" style={{ marginTop: 0 }}>
              {busy ? t('Working it out', 'Đang tính') : t('Price this', 'Tính giá')} <span className="pk-go">→</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

## `components/tet/TetLabels.tsx`

117 lines · 6,038 bytes

```tsx
'use client'

import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { MONO, GOLD } from '@/components/public/kit'

// ═══════════════════════════════════════════════════════════════════════════
// THE THREE BLENDS, BY THEIR OWN LABELS.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-22: "use the images of the 5 star, 12 and 18 for the duncan
// taylor section". The old Blend 18 picture was a pack shot on a white ground
// and was dropped for exactly that; these are Duncan Taylor's PRINT artwork
// (DT_Blend_Labels_Complete/DT_*_Blend_Front.pdf), rendered from the PDF and
// cut exactly inside the cyan dieline, so they carry no white box and no
// printer's marks — just the label.
//
// THE SHEEN IS THE FOIL. The print spec on each sheet says "gold ink indicates
// matte gold foil-stamping", so the label tilts toward the pointer and a band
// of light crosses it the way it would cross foil in the hand. It is the one
// thing about these bottles a screen otherwise loses.
//
// ⚠ The labels print "750ml"; tet_blend_board says 700 ml. The words under
// each card come from the board, so the page does not contradict itself — but
// one of them is wrong, and Duncan Taylor should say which.
// ═══════════════════════════════════════════════════════════════════════════

export interface BlendLabel {
  sku: string
  name: string
  detail: string
}

const ART: Record<string, string> = {
  'DT-5STAR': 'label-5star',
  'DT-12YO': 'label-12',
  'DT-18YO': 'label-18',
}

export const hasLabel = (sku: string) => sku in ART

export default function TetLabels({ blends }: { blends: BlendLabel[] }) {
  const shown = blends.filter(b => hasLabel(b.sku))
  if (!shown.length) return null
  return (
    <div className="lb-row">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {shown.map((b, i) => <Card key={b.sku} b={b} i={i} />)}
    </div>
  )
}

function Card({ b, i }: { b: BlendLabel; i: number }) {
  const el = useRef<HTMLDivElement>(null)
  const tilt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const n = el.current; if (!n || e.pointerType !== 'mouse') return
    const r = n.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    n.style.setProperty('--rx', `${(0.5 - y) * 12}deg`)
    n.style.setProperty('--ry', `${(x - 0.5) * 14}deg`)
    n.style.setProperty('--gx', `${x * 100}%`)
    n.style.setProperty('--gy', `${y * 100}%`)
  }
  const rest = () => {
    const n = el.current; if (!n) return
    n.style.setProperty('--rx', '0deg'); n.style.setProperty('--ry', '0deg')
  }
  const art = ART[b.sku]
  return (
    <figure className="lb" style={{ ['--i' as string]: i }}>
      <div ref={el} className="lb-card" onPointerMove={tilt} onPointerLeave={rest}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/images/tet/${art}.webp`}
             srcSet={`/images/tet/${art}-sm.webp 380w, /images/tet/${art}.webp 760w`}
             sizes="(max-width: 780px) 30vw, 300px"
             width={760} height={1128} alt={b.name} loading="lazy" decoding="async" />
        <span className="lb-foil" aria-hidden />
      </div>
      <figcaption>
        <div className="lb-name">{b.name}</div>
        <div className="lb-detail">{b.detail}</div>
      </figcaption>
    </figure>
  )
}

const CSS = `
.lb-row { display: grid; grid-template-columns: repeat(3, minmax(0, 300px)); gap: clamp(14px, 3vw, 44px);
          margin-top: 48px; perspective: 1100px; }
.lb { margin: 0; opacity: 0; transform: translateY(34px);
      animation: lb-in 1s cubic-bezier(.16,.84,.44,1) forwards; animation-delay: calc(.15s + var(--i) * .14s);
      animation-play-state: paused; }
.tr.is-in .lb { animation-play-state: running; }
@keyframes lb-in { to { opacity: 1; transform: none; } }
.lb-card { position: relative; border-radius: 3px; overflow: hidden; transform-style: preserve-3d;
           transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
           transition: transform .5s cubic-bezier(.16,.84,.44,1), box-shadow .5s ease;
           box-shadow: 0 22px 44px rgba(0,0,0,.42), 0 2px 6px rgba(0,0,0,.3); }
.lb-card:hover { transition: transform .12s linear, box-shadow .5s ease;
                 box-shadow: 0 34px 60px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.3); }
.lb-card img { display: block; width: 100%; height: auto; }
/* Light on foil: a narrow band that crosses the label with the pointer.
   Overlay blending lifts what is already light — the gold, the panel — and
   leaves the black ground black, which is what foil does and ink does not. */
.lb-foil { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: 0;
           background: linear-gradient(105deg, rgba(255,250,230,0) calc(var(--gx, 50%) - 16%),
                       rgba(255,250,230,.85) var(--gx, 50%), rgba(255,250,230,0) calc(var(--gx, 50%) + 16%));
           transition: opacity .4s ease; }
.lb-card:hover .lb-foil { opacity: 1; }
.lb figcaption { margin-top: 18px; }
.lb-name { font-family: 'Rampant Sans', Georgia, serif; font-size: clamp(15px, 1.8vw, 20px); line-height: 1.15; }
.lb-detail { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .06em; opacity: .55; margin-top: 6px; }
.lb-card:hover + figcaption .lb-name { color: ${GOLD}; }
@media (max-width: 560px) { .lb-detail { font-size: 9.5px; } }
@media (prefers-reduced-motion: reduce) {
  .lb { animation: none; opacity: 1; transform: none; }
  .lb-card { transition: none; transform: none; }
}
`
```

## `components/tet/TetEnquiry.tsx`

245 lines · 12,709 bytes

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { SleeveFaceThumb, type SleeveDesign } from '@/components/tet/SleeveStudio'
import { useLang } from '@/lib/lang'
import LangToggle from '@/components/LangToggle'

// THE FORM, IN THE SITE'S LANGUAGE.
//
// It was a bordered panel floating on a dim backdrop — the admin portal's
// furniture again, on the one screen where a buyer actually commits to
// something. Now it is the page's own ground, its own display type, and
// hairline fields: a rule under the words, nothing boxed.
//
// Five fields, three required. A corporate buyer filling this in on a phone
// between meetings will not finish a longer one, and the tax code, the
// personalisation and the split delivery are a conversation that happens after
// somebody replies.
//
// The 18+ confirmation is not asked again: it was given at the door, and asking
// twice reads as a form that was not paying attention.

export interface EnquiryTarget {
  kind: 'cask' | 'blend'
  cask_ref?: string
  title: string
  target_abv?: number | null
}

/** What the sleeve studio hands over (components/tet/SleeveStudio). The file
 *  is uploaded here, at the moment the buyer actually sends something — never
 *  while they are still playing. */
export type EnquiryDesign = SleeveDesign


export default function TetEnquiry({
  target, provisional, design, onClose,
}: {
  target: EnquiryTarget
  provisional: boolean
  design?: EnquiryDesign
  onClose: () => void
}) {
  const { t, lang } = useLang()
  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ reference: string; mode: string } | null>(null)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => { first.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    // The page behind must not scroll under the form.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const ready = form.company_name.trim() && form.contact_name.trim() && form.contact_email.trim()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !ready) return
    setBusy(true); setErr('')
    try {
      // The logo goes up first, and only now. If it fails the enquiry still
      // goes — losing a whole enquiry over an image would be the wrong trade,
      // and the design is recorded either way so we know to ask for the file.
      let logo_path: string | null = null
      if (design?.logo_file) {
        try {
          // TWO STEPS, AND THE BYTES SKIP OUR SERVER. We ask for a one-shot
          // signed URL, then PUT the file straight to storage. It used to be
          // base64 in a JSON body, which is 4/3 the size — a 25MB logo is
          // ~6.7MB on the wire and Vercel refuses a request body over 4.5MB
          // before the route runs. That failure would have appeared in
          // production only; `next dev` has no such limit.
          const up = await fetch('/api/tet/artwork', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content_type: design.logo_file.type, size: design.logo_file.size }),
          })
          const uj = await up.json().catch(() => ({}))
          if (up.ok && uj.signed_url) {
            const put = await fetch(uj.signed_url, {
              method: 'PUT',
              headers: { 'Content-Type': design.logo_file.type },
              body: design.logo_file,
            })
            // Only claim the path if storage actually took it. The bucket
            // enforces the 25MB ceiling itself, so a file that lies about its
            // size is refused here rather than trusted upstream.
            if (put.ok) logo_path = uj.path
          }
        } catch { /* the enquiry is worth more than the file */ }
      }

      // Where the logo goes, in the artwork's own pixels, so whoever prepares
      // the print file needs nothing but this record and the uploaded file.
      const personalisation = design ? {
        sleeve: design.sleeve, artwork_px: '6431x2387',
        logo_box: design.logo_box,
        logo_path, logo_filename: design.logo_file?.name ?? null,
      } : undefined

      const r = await fetch('/api/tet/reserve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, kind: target.kind, cask_ref: target.cask_ref ?? null,
          target_abv: target.target_abv ?? null, locale: lang, source: 'tet-page',
          ...(personalisation ? { personalisation } : {}),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.message || t('That did not send.', 'Không gửi được.')); return }
      setDone({ reference: j.reference, mode: j.mode })
    } catch {
      setErr(t('Could not reach the club just now.', 'Không thể kết nối lúc này.'))
    } finally { setBusy(false) }
  }

  return (
    <div style={sheet} role="dialog" aria-modal="true">
      <style dangerouslySetInnerHTML={{ __html: `
        .tq-field {
          width: 100%; background: none; border: none; border-radius: 0;
          border-bottom: 1px solid rgba(229,212,194,.22);
          color: #E5D4C2; font-family: 'Google Sans Code','DM Mono',monospace;
          font-size: 15px; line-height: 1.6; padding: 14px 0; outline: none;
        }
        .tq-field::placeholder { color: rgba(229,212,194,.38); }
        .tq-field:focus { border-bottom-color: #D4B85A; }
        .tq-close {
          background: none; border: none; cursor: pointer; padding: 6px;
          color: rgba(229,212,194,.6); font-family: 'Google Sans Code',monospace;
          font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
        }
        .tq-close:hover { color: #E5D4C2; }
      ` }} />

      {/* The sheet covers the page, and the switch with it — so it carries its
          own, or a buyer who wants the other language has to abandon the form. */}
      <div style={{ position: 'absolute', top: 16, right: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
        <LangToggle compact />
        <button onClick={onClose} className="tq-close">{t('Close', 'Đóng')} ✕</button>
      </div>

      <div style={inner}>
        {done ? (
          <>
            <div className="pk-eyebrow">
              {done.mode === 'reservation' ? t('Reserved', 'Đã giữ chỗ') : t('Thank you', 'Cảm ơn quý vị')}
            </div>
            <h2 className="pk-h2" style={{ marginTop: 14 }}>{done.reference}</h2>
            <p className="pk-lede">
              {done.mode === 'reservation'
                ? t('That cask is held for you while we prepare the invoice. We will be in touch to confirm.',
                    'Thùng rượu được giữ cho quý vị trong khi chúng tôi chuẩn bị hóa đơn. Chúng tôi sẽ liên hệ để xác nhận.')
                : t('We have your details, and we will come to you first with the cask list and prices as soon as they are confirmed.',
                    'Chúng tôi đã nhận thông tin, và sẽ liên hệ với quý vị đầu tiên khi có danh sách thùng và bảng giá.')}
            </p>
            <p className="pk-meta" style={{ marginTop: 18 }}>
              {t('Keep this reference — it is how we will find you.', 'Vui lòng giữ mã này — chúng tôi sẽ dùng để tra cứu.')}
            </p>
            <button onClick={onClose} className="pk-cta">{t('Close', 'Đóng')} <span className="pk-go">→</span></button>
          </>
        ) : (
          <>
            <div className="pk-eyebrow">
              {provisional ? t('Register interest', 'Đăng ký quan tâm') : t('Reserve', 'Giữ chỗ')}
            </div>
            <h2 className="pk-h2" style={{ marginTop: 14 }}>{target.title}</h2>
            <p className="pk-lede">
              {provisional
                ? t('The cask list and prices are still being confirmed. Leave your details and we will come to you first.',
                    'Danh sách thùng và bảng giá đang được xác nhận. Hãy để lại thông tin, chúng tôi sẽ liên hệ với quý vị trước tiên.')
                : t('This holds it while we prepare your invoice. Nothing is charged here.',
                    'Thao tác này giữ chỗ trong khi chúng tôi chuẩn bị hóa đơn. Không có khoản thanh toán nào tại đây.')}
            </p>

            {/* What they designed, so they can see it is coming with them. */}
            {design && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 26 }}>
                <SleeveFaceThumb design={design} />
                <div className="pk-meta" style={{ lineHeight: 1.8 }}>
                  {t('Your sleeve comes with this enquiry', 'Thiết kế hộp sẽ được gửi kèm')}
                  <br />
                  <span style={{ opacity: .6 }}>
                    {design.logo_file ? design.logo_file.name : t('no logo yet', 'chưa có logo')}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={submit} style={{ marginTop: 34 }}>
              <input ref={first} className="tq-field" value={form.company_name} onChange={set('company_name')}
                     placeholder={t('Company', 'Công ty')} aria-label={t('Company', 'Công ty')} />
              <input className="tq-field" value={form.contact_name} onChange={set('contact_name')}
                     placeholder={t('Your name', 'Tên của quý vị')} aria-label={t('Your name', 'Tên của quý vị')} />
              <input className="tq-field" type="email" value={form.contact_email} onChange={set('contact_email')}
                     placeholder={t('Email', 'Email')} aria-label={t('Email', 'Email')} />
              <input className="tq-field" value={form.contact_phone} onChange={set('contact_phone')}
                     placeholder={t('Phone or Zalo (optional)', 'Điện thoại hoặc Zalo (không bắt buộc)')} aria-label={t('Phone', 'Điện thoại')} />
              <textarea className="tq-field" rows={2} value={form.message} onChange={set('message')}
                        style={{ resize: 'vertical' }}
                        placeholder={t('Anything we should know (optional)', 'Điều gì chúng tôi nên biết (không bắt buộc)')} />

              {err && <p className="pk-meta" style={{ color: '#C27070', marginTop: 16 }}>{err}</p>}

              <div style={{ display: 'flex', gap: 28, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <button type="submit" disabled={busy || !ready} className="pk-cta"
                        style={{ opacity: busy || !ready ? .4 : 1, cursor: busy || !ready ? 'not-allowed' : 'pointer' }}>
                  {busy ? t('Sending', 'Đang gửi') : provisional ? t('Send', 'Gửi') : t('Reserve', 'Giữ chỗ')} <span className="pk-go">→</span>
                </button>
                <button type="button" onClick={onClose} className="tq-close" style={{ padding: 0 }}>
                  {t('Cancel', 'Huỷ')}
                </button>
              </div>
            </form>

            <p className="pk-meta" style={{ marginTop: 40, maxWidth: 520, lineHeight: 1.9 }}>
              {t('You confirmed you are 18 or over when you entered. Nothing here is an offer for sale; any order is completed on invoice.',
                 'Quý vị đã xác nhận từ 18 tuổi trở lên khi vào trang. Nội dung này không phải lời chào bán; đơn hàng hoàn tất bằng hóa đơn.')}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// The page's own ground, edge to edge — not a card floating on a dimmed copy
// of the page behind it.
const sheet: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9000,
  background: '#052E20', color: '#E5D4C2',
  overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
}
const inner: React.CSSProperties = {
  width: 'min(620px, 100%)', padding: 'clamp(64px, 12vh, 140px) 24px 80px',
}
```

## `components/tet/TetCaskMap.tsx`

328 lines · 19,719 bytes

```tsx
'use client'

import { useMemo, useState } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import { SCOTLAND, SCOTLAND_PATH, project } from '@/lib/tet/scotland'
import { ATLAS_REGIONS } from '@/lib/whisky-atlas-data'
import { DISTILLERIES, TRADE_NAMES } from '@/lib/tet/distilleries'
import type { CaskBoardRow } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// WHERE THE CASKS COME FROM — Scotland, with every distillery on it.
// ───────────────────────────────────────────────────────────────────────────
// The outline is real geography (lib/tet/scotland, from Natural Earth).
//
// IT SHOWS DISTILLERIES NOW, not regions (owner asked, 2026-09-24, whether it
// did — it did not). A pin per region answers "how many Speyside casks"; a
// buyer looking at a named distillery is asking where that whisky is from.
// Coordinates come from Wikidata, one row per distillery, in
// lib/tet/distilleries — including the trap that Wikidata's "Glenrothes" is
// the town in Fife and not the distillery in Moray.
//
// TWO ARE SOLD UNDER A TRADE NAME — Burnside and "Islay Single Malt". The
// owner said where they are from (2026-09-24), so they are pinned at the real
// place and the card names the TOWN, not the distillery: printing the brand on
// a price list is Duncan Taylor's exposure to license, not ours to assume. A
// distillery with no coordinate at all would still be drawn hollow at its
// region rather than guessed onto a plausible spot.
//
// Choosing a pin still filters the chart and the colour ladder — one question,
// "show me Islay", answered in three places.
//
// The English line under a region is the atlas's own; the Vietnamese beside it
// was written for this page (the atlas has none).
// ═══════════════════════════════════════════════════════════════════════════

// Highland's marker sits just west of Speyside's, so its label goes on the
// left, where the Great Glen is empty, instead of running into Speyside.
const LABEL_LEFT = new Set(['Highland', 'Islands'])

// The furthest a pin may be shifted from its true coordinate to stop it
// hiding under a neighbour. At this projection it is a few miles.
const NUDGE_MAX = 9

const VN: Record<string, string> = {
  Islay: 'Một hòn đảo nhỏ vùng Hebrides, nơi rượu malt sấy than bùn mang vị như biển cả ngay trong phòng.',
  Highland: 'Vùng lớn nhất và đa dạng nhất — whisky ven biển ở phía bắc, phong cách nhẹ hơn về phía nam, và gần như mọi thứ ở giữa.',
  Speyside: 'Tập trung dọc sông Spey. Đậm chất sherry, nhiều trái cây, và có nhiều nhà chưng cất hơn bất cứ nơi nào trên thế giới.',
  Campbeltown: 'Từng là thủ đô whisky của thế giới. Nay còn ba nhà chưng cất và một cộng đồng yêu mến — vị biển, béo, khói nhẹ.',
  Islands: 'Orkney, Skye, Mull, Arran, Jura, Lewis. Các nhà chưng cất rải rác khắp Bắc Đại Tây Dương, vừa giống vừa khác nhau.',
  Lowland: 'Nhẹ, hương cỏ, thường chưng cất ba lần. Đầu nhẹ nhàng của Scotch, dịu và hương hoa.',
}

export default function TetCaskMap({ casks, t, vn, region, onRegion, onPick }: {
  casks: CaskBoardRow[]
  t: (en: string, vn: string) => string
  vn: boolean
  region: string | null
  onRegion: (r: string | null) => void
  /** Open a cask in the list below — what a row in the index is for. */
  onPick?: (caskRef: string) => void
}) {
  const [hover, setHover] = useState<string | null>(null)
  const counts = new Map<string, { all: number; open: number }>()
  for (const c of casks) {
    const k = counts.get(c.region) ?? { all: 0, open: 0 }
    k.all++; if (c.status === 'available') k.open++
    counts.set(c.region, k)
  }
  // One pin per distillery, with its casks counted onto it.
  const places = useMemo(() => {
    const byName = new Map<string, { name: string; region: string; casks: CaskBoardRow[] }>()
    for (const c of casks) {
      const g = byName.get(c.distillery) ?? { name: c.distillery, region: c.region, casks: [] }
      g.casks.push(c); byName.set(c.distillery, g)
    }
    return [...byName.values()].map(g => {
      const at = DISTILLERIES[g.name]
      const fallback = ATLAS_REGIONS.find(r => r.key === g.region)
      const tradeName = TRADE_NAMES[g.name]
      if (!at && !fallback) return null
      return {
        ...g,
        lat: at?.lat ?? fallback!.lat,
        lng: at?.lng ?? fallback!.lng,
        pinned: !!at,
        approximate: !!at?.approximate,
        why: tradeName,
        bottles: g.casks.reduce((n, c) => n + (c.bottles_cask_strength ?? 0), 0),
        open: g.casks.filter(c => c.status === 'available').length,
      }
    }).filter(Boolean) as {
      name: string; region: string; casks: CaskBoardRow[]; lat: number; lng: number
      pinned: boolean; approximate: boolean; why?: [string, string]; bottles: number; open: number
    }[]
  }, [casks])

  // ── PINS THAT CAN BE POINTED AT ─────────────────────────────────────────
  // Six of these distilleries stand within a few miles of one another on
  // Speyside, so at this scale their circles land on top of each other and the
  // one underneath can never be hovered: Craigellachie sat beneath Glenrothes
  // and only the list beside the map could reach it. A few passes push
  // overlapping pins apart along the line between them, then every pin is
  // pulled back to within NUDGE_MAX of where its distillery actually stands,
  // so the map never moves a distillery more than a few miles to make room.
  const laid = useMemo(() => {
    const most = Math.max(1, ...places.map(p => p.casks.length))
    const pts = places.map(pl => {
      const [x, y] = project(pl.lat, pl.lng)
      return { pl, x, y, ox: x, oy: y, rad: 5 + (pl.casks.length / most) * 7 }
    })
    for (let pass = 0; pass < 40; pass++) {
      let moved = false
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          const p = pts[a], q = pts[b]
          const need = p.rad + q.rad + 3
          let dx = q.x - p.x, dy = q.y - p.y
          let d = Math.hypot(dx, dy)
          if (d >= need) continue
          if (d < 0.001) { dx = a % 2 ? 1 : -1; dy = 1; d = Math.hypot(dx, dy) }
          const push = (need - d) / 2, ux = dx / d, uy = dy / d
          p.x -= ux * push; p.y -= uy * push
          q.x += ux * push; q.y += uy * push
          moved = true
        }
      }
      if (!moved) break
    }
    for (const p of pts) {
      const dx = p.x - p.ox, dy = p.y - p.oy, d = Math.hypot(dx, dy)
      if (d > NUDGE_MAX) { p.x = p.ox + (dx / d) * NUDGE_MAX; p.y = p.oy + (dy / d) * NUDGE_MAX }
    }
    return pts
  }, [places])

  const regions = ATLAS_REGIONS.filter(r => r.country === 'Scotland' && counts.has(r.key))
  const unplaced = [...counts.keys()].filter(k => !regions.some(r => r.key === k))
  if (!places.length) return null
  const shownRegion = ATLAS_REGIONS.find(r => r.key === (hover ?? region)) ?? null
  const shownPlace = places.find(p => p.name === hover) ?? null

  return (
    <div className="cm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg className="cm-map" viewBox={`0 0 ${SCOTLAND.w} ${SCOTLAND.h}`}
           role="group" aria-label={t('Where the casks come from', 'Nguồn gốc các thùng')}>
        <path d={SCOTLAND_PATH} className="cm-land" />
        {laid.map(({ pl, x, y, rad }, i) => {
          const n = pl.casks.length
          const on = hover === pl.name || region === pl.region
          const dim = region !== null && region !== pl.region
          // Labels lean away from the middle of the country so neighbours do
          // not overprint one another.
          const left = pl.lng < -3.4
          return (
            <g key={pl.name} className={`cm-pin${on ? ' is-on' : ''}${dim ? ' is-dim' : ''}${pl.pinned ? '' : ' is-vague'}`}
               style={{ ['--i' as string]: i }} transform={`translate(${x} ${y})`}
               role="button" tabIndex={0} aria-pressed={on}
               aria-label={`${pl.name}, ${pl.region}: ${n} ${t(n === 1 ? 'cask' : 'casks', 'thùng')}`}
               onClick={() => onRegion(region === pl.region ? null : pl.region)}
               onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRegion(region === pl.region ? null : pl.region) } }}
               onPointerEnter={() => setHover(pl.name)} onPointerLeave={() => setHover(null)}>
              {/* The hit area was rad+14, which on Speyside meant a pin's
                  neighbour swallowed it — Craigellachie could not be pointed
                  at because Glenrothes was over it. The list beside the map is
                  the reliable way in; this is just close work. */}
              <circle r={rad + 5} className="cm-hit" />
              <g className="cm-dot">
                <circle r={rad} className="cm-glow" />
                {pl.pinned && <circle r={Math.max(2, rad * 0.4)} className="cm-core" />}
              </g>
              {/* NAMED ONLY WHEN POINTED AT. Six of these distilleries sit
                  within a few miles of each other on Speyside: printing every
                  label drew them on top of one another and ran Islay off the
                  edge. The names live in the list beside the map, which has
                  room for them; the map keeps the geography. */}
              {on && (
                <>
                  <text x={left ? -(rad + 8) : rad + 8} y={4} className="cm-label"
                        textAnchor={left ? 'end' : 'start'}>{pl.name}</text>
                  <text x={left ? -(rad + 8) : rad + 8} y={23} className="cm-count"
                        textAnchor={left ? 'end' : 'start'}>
                    {n} {t(n === 1 ? 'cask' : 'casks', 'thùng')} · {pl.bottles} {t('bottles', 'chai')}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>

      <div className="cm-side">
        <div className="pk-eyebrow">{t('Where they come from', 'Nguồn gốc')}</div>
        {/* A distillery under the pointer speaks for itself; otherwise the
            chosen region does.
            THE SLOT HOLDS ITS HEIGHT WHATEVER IS IN IT (owner, 2026-09-25:
            "theres also a weird glitch when hovering between the distilleries
            … on the side"). Crossing the gap between two rows cleared the
            hover for an instant, the card vanished, the index jumped up 114px
            to fill the space — and the pointer was suddenly on a different
            row, which brought the card back and pushed everything down again.
            One slot, one height, and the list underneath stays where it is. */}
        <div className="cm-slot">
        {shownPlace ? (
          <div className="cm-card">
            <div className="cm-name">{shownPlace.name}</div>
            <p className="cm-blurb">
              {shownPlace.casks.length} {t(shownPlace.casks.length === 1 ? 'cask' : 'casks', 'thùng')}
              {' · '}{shownPlace.bottles} {t('bottles', 'chai')}
              {' · '}{shownPlace.region}
              {shownPlace.why && <><br />{t(shownPlace.why[0], shownPlace.why[1])}{t(' — shown at its region.', ' — hiển thị theo vùng.')}</>}
              {shownPlace.approximate && <><br />{t('Placed at the village; the distillery has no published coordinate.',
                                                    'Đặt tại ngôi làng; nhà chưng cất chưa có toạ độ công bố.')}</>}
            </p>
            <div className="cm-dist">
              {shownPlace.casks.map(c => `${c.cask_ref} · ${Math.floor(c.age_years)}${t('yo', ' năm')}`).join('   ')}
            </div>
          </div>
        ) : shownRegion ? (
          <div className="cm-card">
            <div className="cm-name">{shownRegion.name}{shownRegion.native && <span> · {shownRegion.native}</span>}</div>
            <p className="cm-blurb">{vn ? (VN[shownRegion.key] ?? shownRegion.blurb) : shownRegion.blurb}</p>
            <div className="cm-dist">{t('Distilleries here include', 'Các nhà chưng cất trong vùng')}: {shownRegion.distilleries.slice(0, 4).join(', ')}</div>
          </div>
        ) : (
          <p className="cm-blurb" style={{ opacity: .6 }}>
            {t('Every distillery in the selection, where it stands. Choose one to filter the chart and the colour ladder.',
               'Mọi nhà chưng cất trong bộ sưu tập, đúng vị trí. Chọn một để lọc biểu đồ và thang màu.')}
          </p>
        )}
        </div>
        {/* THE INDEX. Every distillery, in one legible column — which is also
            what makes it safe to take the labels off the map.
            A ROW IS A WAY IN (owner, 2026-09-25: "You should be able to click
            those then it takes you to the cask below"). Hovering lights its
            pin; clicking opens that distillery's cask in the list underneath,
            which is where the buyer was going anyway. Where a distillery has
            more than one cask it opens the first and the rest are beside it. */}
        <ul className="cm-list">
          {[...places].sort((a, b) => a.name.localeCompare(b.name)).map(pl => (
            <li key={pl.name}>
              <button
                className={`cm-row${hover === pl.name ? ' is-on' : ''}${region && region !== pl.region ? ' is-dim' : ''}`}
                onPointerEnter={() => setHover(pl.name)} onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(pl.name)} onBlur={() => setHover(null)}
                onClick={() => (onPick ? onPick(pl.casks[0].cask_ref) : onRegion(region === pl.region ? null : pl.region))}
                title={onPick ? t(`Open ${pl.casks[0].cask_ref} below`, `Mở ${pl.casks[0].cask_ref} bên dưới`) : undefined}>
                <span className="cm-row-name">{pl.name}{!pl.pinned && <span className="cm-row-q"> ?</span>}</span>
                <span className="cm-row-n">
                  {pl.casks.length} {t(pl.casks.length === 1 ? 'cask' : 'casks', 'thùng')} · {pl.bottles}
                  {onPick && <span className="cm-row-go" aria-hidden> →</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {region && (
          <button className="cm-clear" onClick={() => onRegion(null)}>{t('Show every region', 'Xem tất cả các vùng')}</button>
        )}
        {unplaced.length > 0 && (
          <p className="cm-dist" style={{ marginTop: 14 }}>{t('Also:', 'Ngoài ra:')} {unplaced.map(u => `${u} ${counts.get(u)!.all}`).join(' · ')}</p>
        )}
      </div>
    </div>
  )
}

const CSS = `
.cm { display: grid; grid-template-columns: minmax(0, 520px) minmax(0, 1fr); gap: clamp(24px, 5vw, 72px);
      align-items: center; margin-top: 64px; }
.cm-map { display: block; width: 100%; height: auto; overflow: visible; }
.cm-land { fill: rgba(229,212,194,.06); stroke: rgba(229,212,194,.35); stroke-width: 1.1; stroke-linejoin: round; }
.cm-pin { cursor: pointer; outline: none; }
.cm-hit { fill: transparent; }
.cm-dot { transform: scale(0); transform-box: fill-box; transform-origin: center;
          transition: transform .7s cubic-bezier(.34,1.6,.5,1), opacity .3s ease; transition-delay: calc(.3s + var(--i) * .15s); }
.tr.is-in .cm-dot { transform: scale(1); }
.cm-glow { fill: rgba(212,184,90,.22); stroke: ${GOLD}; stroke-width: 1.2; }
.cm-core { fill: ${GOLD}; }
.cm-label { font-family: 'Rampant Sans', Georgia, serif; font-size: 19px; fill: #E5D4C2; }
.cm-count { font-family: ${MONO}; font-size: 13px; fill: rgba(229,212,194,.5); }
.cm-pin:hover .cm-glow, .cm-pin.is-on .cm-glow, .cm-pin:focus-visible .cm-glow { fill: rgba(212,184,90,.45); }
.cm-pin.is-on .cm-label { fill: ${GOLD}; }
.cm-pin.is-dim { opacity: .35; }
/* Undisclosed: the pin is hollow, because the point is the region, not a
   distillery we are claiming to know. */
.cm-pin.is-vague .cm-glow { fill: none; stroke-dasharray: 3 3; }
.cm-pin, .cm-pin text { transition: opacity .3s ease, fill .3s ease; }
.cm-side { align-self: center; min-width: 0; }
/* IT USED TO FLICKER BETWEEN ROWS (owner, 2026-09-25). The card was keyed on
   whatever was under the pointer, so crossing the index remounted it and
   replayed a .45s entrance every time — and because its height follows its
   content, the list moved under the pointer while you were reading it, which
   moved the pointer onto another row. No key, so it updates in place; and a
   floor under its height, so the index below it does not walk about. */
.cm-card { animation: cm-in .45s cubic-bezier(.16,.84,.44,1); }
.cm-slot { min-height: 168px; }
/* Stacked on a phone the index is below the map rather than under the card,
   so there is nothing to hold still and the reserved height is just a gap. */
@media (max-width: 900px) { .cm-slot { min-height: 0; } }
@keyframes cm-in { from { opacity: 0; transform: translateY(8px); } }
.cm-name { font-family: 'Rampant Sans', Georgia, serif; font-size: clamp(26px, 3.2vw, 38px); margin-top: 12px; color: ${GOLD}; }
.cm-name span { color: rgba(229,212,194,.5); font-size: .6em; }
.cm-blurb { font-family: ${MONO}; font-size: 12.5px; line-height: 1.85; margin: 12px 0 0; max-width: 460px; color: rgba(229,212,194,.8); }
.cm-dist { font-family: ${MONO}; font-size: 10.5px; margin-top: 12px; color: rgba(229,212,194,.45); }
.cm-list { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 1px 28px;
           grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); min-width: 0; }
.cm-list li { min-width: 0; }
.cm-row { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; width: 100%;
          background: none; border: none; border-bottom: 1px solid rgba(229,212,194,.1); cursor: pointer;
          padding: 9px 2px; text-align: left; color: inherit; font-family: ${MONO}; font-size: 12.5px;
          min-height: 44px; box-sizing: border-box;
          transition: color .2s ease, border-color .2s ease; }
.cm-row-name { color: rgba(229,212,194,.85); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cm-row-q { color: ${GOLD}; opacity: .7; }
.cm-row-n { color: rgba(229,212,194,.45); white-space: nowrap; }
.cm-row-go { color: ${GOLD}; opacity: 0; transition: opacity .2s ease; }
.cm-row:hover .cm-row-go, .cm-row.is-on .cm-row-go { opacity: 1; }
.cm-row:hover, .cm-row.is-on { border-bottom-color: ${GOLD}; }
.cm-row:hover .cm-row-name, .cm-row.is-on .cm-row-name { color: ${GOLD}; }
.cm-row.is-dim { opacity: .35; }
.cm-clear { margin-top: 16px; background: none; border: none; padding: 0; cursor: pointer; font-family: ${MONO};
            font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: ${GOLD};
            border-bottom: 1px solid rgba(212,184,90,.5); }
@media (max-width: 720px) { .cm { grid-template-columns: 1fr; } .cm-map { max-width: 360px; } }
@media (prefers-reduced-motion: reduce) { .cm-dot { transition: none; transform: none; } .cm-card { animation: none; } }
`
```

## `components/tet/TetCaskChart.tsx`

192 lines · 10,814 bytes

```tsx
'use client'

import { useMemo, useState } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import { caskColourOf } from '@/lib/tet/colour'
import type { CaskBoardRow } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE SELECTION AT A GLANCE — every cask as a point: age across, strength up.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-22: "Is there any charts, cool designs … we can add in?"
//
// Fourteen rows of "Speyside · 15yo · 55%" are read one at a time; plotted,
// the same rows show what the list cannot — where the old casks are, which are
// still strong, which are gone. It is drawn entirely from the rows the list
// below is drawn from, so it can never show a cask the list does not have.
//
//   · each dot is filled with the cask's own colour (the swatch the list uses);
//   · a sold cask is an empty ring — still there, so the shape of the
//     selection stays honest, but plainly not choosable;
//   · the regions along the top filter it, and say how many each has;
//   · pointing at a dot names it; choosing one opens that cask in the list.
// ═══════════════════════════════════════════════════════════════════════════

const W = 1000, H = 380
const PAD = { l: 56, r: 24, t: 40, b: 50 }

export default function TetCaskChart({ casks, t, onPick, region, onRegion }: {
  casks: CaskBoardRow[]
  t: (en: string, vn: string) => string
  onPick: (ref: string) => void
  /** Shared with the map and the colour ladder: one choice filters all three. */
  region: string | null
  onRegion: (r: string | null) => void
}) {
  const setRegion = (v: string | null | ((p: string | null) => string | null)) =>
    onRegion(typeof v === 'function' ? v(region) : v)
  const [hover, setHover] = useState<string | null>(null)

  const regions = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of casks) m.set(c.region, (m.get(c.region) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [casks])

  const scale = useMemo(() => {
    const ages = casks.map(c => c.age_years), abvs = casks.map(c => c.cask_abv_pct)
    const a0 = Math.floor(Math.min(...ages) - 1), a1 = Math.ceil(Math.max(...ages) + 1)
    const v0 = Math.floor(Math.min(...abvs) - 1), v1 = Math.ceil(Math.max(...abvs) + 1)
    return {
      a0, a1, v0, v1,
      x: (a: number) => PAD.l + ((a - a0) / (a1 - a0 || 1)) * (W - PAD.l - PAD.r),
      y: (v: number) => H - PAD.b - ((v - v0) / (v1 - v0 || 1)) * (H - PAD.t - PAD.b),
    }
  }, [casks])

  if (casks.length < 2) return null
  const { x, y, a0, a1, v0, v1 } = scale
  const ageTicks = Array.from({ length: a1 - a0 + 1 }, (_, i) => a0 + i).filter(a => a % 2 === 0)
  const abvTicks = Array.from({ length: v1 - v0 + 1 }, (_, i) => v0 + i).filter(v => v % 2 === 0)
  const hov = casks.find(c => c.cask_ref === hover) ?? null
  const byAge = [...casks].sort((a, b) => a.age_years - b.age_years)

  return (
    <div className="cc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cc-filter" role="group" aria-label={t('Filter by region', 'Lọc theo vùng')}>
        <button className={region === null ? 'is-on' : ''} onClick={() => setRegion(null)}>
          {t('All', 'Tất cả')} <span>{casks.length}</span>
        </button>
        {regions.map(([r, n]) => (
          <button key={r} className={region === r ? 'is-on' : ''} onClick={() => setRegion(p => (p === r ? null : r))}>
            {r} <span>{n}</span>
          </button>
        ))}
      </div>

      <div className="cc-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img"
             aria-label={t('Every cask by age and strength', 'Mọi thùng theo tuổi và nồng độ')}>
          {abvTicks.map(v => (
            <g key={`v${v}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="cc-grid" />
              <text x={PAD.l - 12} y={y(v) + 4} textAnchor="end" className="cc-tick">{v}%</text>
            </g>
          ))}
          {ageTicks.map(a => (
            <text key={`a${a}`} x={x(a)} y={H - PAD.b + 22} textAnchor="middle" className="cc-tick">{a}</text>
          ))}
          <text x={W - PAD.r} y={H - 8} textAnchor="end" className="cc-axis">{t('years in the cask →', 'số năm trong thùng →')}</text>
          <text x={PAD.l} y={PAD.t - 10} textAnchor="start" className="cc-axis">↑ {t('strength', 'nồng độ')}</text>

          {byAge.map((c, i) => {
            const gone = c.status !== 'available'
            const dim = region !== null && c.region !== region
            // A measured cask draws itself in the colour that number means.
            const fill = c.colour_hex || caskColourOf(c)?.swatch || GOLD
            return (
              <g key={c.cask_ref}
                 className={`cc-dot${dim ? ' is-dim' : ''}${hover === c.cask_ref ? ' is-hot' : ''}`}
                 style={{ ['--i' as string]: i }}
                 transform={`translate(${x(c.age_years)} ${y(c.cask_abv_pct)})`}
                 tabIndex={dim ? -1 : 0} role="button"
                 aria-label={`${c.cask_ref} · ${c.distillery} · ${Math.floor(c.age_years)} · ${c.cask_abv_pct}%${gone ? ' · ' + t('sold', 'đã bán') : ''}`}
                 onPointerEnter={() => setHover(c.cask_ref)} onPointerLeave={() => setHover(null)}
                 onFocus={() => setHover(c.cask_ref)} onBlur={() => setHover(null)}
                 onClick={() => onPick(c.cask_ref)}
                 onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(c.cask_ref) } }}>
                <circle r="22" className="cc-hit" />
                <g className="cc-mark">
                  <circle r="11" className="cc-halo" />
                  <circle r="8" fill={gone ? 'none' : fill} stroke={gone ? 'rgba(229,212,194,.55)' : 'rgba(255,244,214,.55)'} strokeWidth={gone ? 1.4 : 1} />
                </g>
              </g>
            )
          })}
        </svg>

        {hov && (
          <div className="cc-tip" style={{
            left: `${(x(hov.age_years) / W) * 100}%`, top: `${(y(hov.cask_abv_pct) / H) * 100}%`,
            ['--tx' as string]: x(hov.age_years) > W * 0.75 ? '-92%' : x(hov.age_years) < W * 0.25 ? '-8%' : '-50%',
          }}>
            <div className="cc-tip-ref">{hov.cask_ref}{hov.status !== 'available' && <span> · {t('sold', 'đã bán')}</span>}</div>
            <div className="cc-tip-name">{hov.distillery}</div>
            <div className="cc-tip-meta">{hov.region} · {Math.floor(hov.age_years)}{t('yo', ' năm')} · {hov.cask_abv_pct}%</div>
            {hov.wood && <div className="cc-tip-meta">{hov.wood}</div>}
          </div>
        )}
      </div>

      <div className="cc-key">
        <span><i className="cc-k-full" /> {t('available', 'còn')}</span>
        <span><i className="cc-k-ring" /> {t('sold', 'đã bán')}</span>
        <span style={{ opacity: .7 }}>{t('Colour is the cask’s own · choose a dot to open it', 'Màu là màu của thùng · chọn một chấm để mở')}</span>
      </div>
    </div>
  )
}

const CSS = `
.cc { margin-top: 44px; }
.cc-filter { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-bottom: 18px; }
.cc-filter button { background: none; border: none; padding: 3px 0; cursor: pointer; font-family: ${MONO};
                    font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: rgba(229,212,194,.5);
                    border-bottom: 1px solid transparent; transition: color .2s ease, border-color .2s ease; }
.cc-filter button span { opacity: .6; margin-left: 4px; }
.cc-filter button:hover { color: #E5D4C2; }
.cc-filter button.is-on { color: ${GOLD}; border-bottom-color: ${GOLD}; }

.cc-plot { position: relative; }
.cc-plot svg { display: block; width: 100%; height: auto; overflow: visible; }
.cc-grid { stroke: rgba(229,212,194,.08); stroke-width: 1; }
.cc-tick { font-family: ${MONO}; font-size: 13px; fill: rgba(229,212,194,.42); }
.cc-axis { font-family: ${MONO}; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; fill: rgba(229,212,194,.35); }

.cc-dot { cursor: pointer; outline: none; }
.cc-hit { fill: transparent; }
.cc-mark { transform: scale(0); transform-box: fill-box; transform-origin: center;
           transition: transform .6s cubic-bezier(.34,1.7,.5,1), opacity .3s ease;
           transition-delay: calc(.2s + var(--i) * 70ms); }
.tr.is-in .cc-mark { transform: scale(1); }
.cc-halo { fill: none; stroke: ${GOLD}; stroke-width: 1.2; opacity: 0; transition: opacity .2s ease; }
.cc-dot.is-hot .cc-mark { transform: scale(1.35); transition-delay: 0s; }
.cc-dot.is-hot .cc-halo, .cc-dot:focus-visible .cc-halo { opacity: 1; }
.cc-dot.is-dim .cc-mark { opacity: .12; transition-delay: 0s; }
.cc-dot.is-dim { pointer-events: none; }

.cc-tip { position: absolute; transform: translate(var(--tx), calc(-100% - 20px)); pointer-events: none;
          min-width: 180px; padding: 12px 14px; border-radius: 3px; border-top: 2px solid ${GOLD};
          background: rgba(5,30,22,.95); box-shadow: 0 14px 34px rgba(0,0,0,.45); white-space: nowrap; }
.cc-tip-ref { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; color: rgba(229,212,194,.5); }
.cc-tip-name { font-family: 'Rampant Sans', Georgia, serif; font-size: 18px; margin-top: 4px; color: #E5D4C2; }
.cc-tip-meta { font-family: ${MONO}; font-size: 10.5px; margin-top: 4px; color: rgba(229,212,194,.65); }

.cc-key { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 14px; font-family: ${MONO}; font-size: 10.5px;
          color: rgba(229,212,194,.5); align-items: center; }
.cc-key i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; vertical-align: -1px; margin-right: 5px; }
.cc-k-full { background: ${GOLD}; }
.cc-k-ring { border: 1.3px solid rgba(229,212,194,.6); }

@media (max-width: 640px) {
  .cc-tick { font-size: 22px; } .cc-axis { font-size: 20px; }
  /* The plot is drawn at a third of its size here; the dots are not. */
  .tr.is-in .cc-mark { transform: scale(1.8); }
  .cc-dot.is-hot .cc-mark { transform: scale(2.2); }
  .cc-tip { white-space: normal; min-width: 150px; }
}
@media (prefers-reduced-motion: reduce) {
  .cc-mark { transition: none; transform: none; }
}
`
```

## `components/tet/TetColourLadder.tsx`

126 lines · 7,693 bytes

```tsx
'use client'

import { useState } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import { caskColourOf, SRM_LADDER } from '@/lib/tet/colour'
import type { CaskBoardRow } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE COLOUR LADDER — every cask placed on the SRM scale, pale to dark.
// ───────────────────────────────────────────────────────────────────────────
// The owner asked for "the spectrometer beer scale" on each cask; each row
// already prints its ≈ EBC. This is the same number for the whole selection
// at once: the published SRM ladder (lib/tet/colour, the same table the
// numbers come from) as one strip, and each cask a mark at its own rung.
//
// It inherits the number's honesty rule: the value is estimated from the
// cask's display swatch, not measured, and the strip says so while
// EBC_IS_ESTIMATED is true. Casks with no colour are left off rather than
// placed at 1.
// ═══════════════════════════════════════════════════════════════════════════

export default function TetColourLadder({ casks, t, onPick, region }: {
  casks: CaskBoardRow[]
  t: (en: string, vn: string) => string
  onPick: (ref: string) => void
  region: string | null
}) {
  const [hover, setHover] = useState<string | null>(null)
  const placed = casks
    .map(c => ({ c, col: caskColourOf(c) }))
    .filter((p): p is { c: CaskBoardRow; col: NonNullable<ReturnType<typeof caskColourOf>> } => !!p.col)
    .sort((a, b) => a.col.srm - b.col.srm)
  if (!placed.length) return null

  const at = (srm: number) => ((srm - 0.5) / SRM_LADDER.length) * 100
  // Casks on the same rung stack upward instead of hiding each other.
  const seen = new Map<number, number>()
  const marks = placed.map(p => {
    const n = seen.get(p.col.srm) ?? 0; seen.set(p.col.srm, n + 1)
    return { ...p, stack: n }
  })
  const hov = marks.find(m => m.c.cask_ref === hover)

  return (
    <div className="cl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cl-head">
        <span className="pk-eyebrow">{t('Colour, pale to dark', 'Màu, từ nhạt đến đậm')}</span>
        <span className="cl-note">
          {/* Says which it is, counted rather than assumed: the selection can
              hold measured casks and estimated ones at the same time. */}
          {placed.every(p => p.col.measured)
            ? t('SRM scale · measured at Huntly', 'Thang SRM · đo tại Huntly')
            : placed.some(p => p.col.measured)
              ? t(`SRM scale · ${placed.filter(p => p.col.measured).length} of ${placed.length} measured at Huntly, the rest estimated`,
                  `Thang SRM · ${placed.filter(p => p.col.measured).length}/${placed.length} thùng đo tại Huntly, còn lại ước tính`)
              : t('SRM scale · estimated from each cask’s swatch', 'Thang SRM · ước tính từ mẫu màu của từng thùng')}
        </span>
      </div>
      <div className="cl-track">
        {marks.map(({ c, col, stack }, i) => {
          const dim = region !== null && c.region !== region
          return (
            <button key={c.cask_ref} type="button"
                    className={`cl-mark${dim ? ' is-dim' : ''}${hover === c.cask_ref ? ' is-hot' : ''}${c.status !== 'available' ? ' is-gone' : ''}`}
                    style={{ left: `${at(col.srm)}%`, bottom: 30 + stack * 20, ['--i' as string]: i, ['--c' as string]: c.colour_hex || col.swatch }}
                    aria-label={`${c.cask_ref} · ≈ ${col.ebc} EBC · ${col.srm} SRM`}
                    onPointerEnter={() => setHover(c.cask_ref)} onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(c.cask_ref)} onBlur={() => setHover(null)}
                    onClick={() => onPick(c.cask_ref)} tabIndex={dim ? -1 : 0} />
          )
        })}
        <div className="cl-strip" style={{
          background: `linear-gradient(to right, ${SRM_LADDER.map((r, i) => `${r.hex} ${(i / (SRM_LADDER.length - 1)) * 100}%`).join(', ')})`,
        }} />
        <div className="cl-ticks">
          {[1, 5, 10, 15, 20, 25, 30, 35, 40].map(n => (
            <span key={n} style={{ left: `${at(n)}%` }}>{n}</span>
          ))}
        </div>
        {hov && (
          <div className="cl-tip" style={{ left: `${at(hov.col.srm)}%`, bottom: 58 + hov.stack * 20,
                                           ['--tx' as string]: at(hov.col.srm) > 75 ? '-90%' : at(hov.col.srm) < 25 ? '-10%' : '-50%' }}>
            <b>{hov.c.cask_ref}</b> · {hov.c.distillery}<br />
            {hov.col.measured ? '' : '≈ '}{hov.col.ebc} EBC · {hov.col.srm} SRM · {hov.c.wood ?? hov.c.cask_type}
          </div>
        )}
      </div>
    </div>
  )
}

const CSS = `
.cl { margin-top: 56px; }
.cl-head { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: baseline; }
.cl-note { font-family: ${MONO}; font-size: 10.5px; color: rgba(229,212,194,.4); }
.cl-track { position: relative; height: 150px; margin-top: 8px; }
.cl-strip { position: absolute; left: 0; right: 0; bottom: 22px; height: 10px; border-radius: 5px; }
.cl-ticks span { position: absolute; bottom: 0; transform: translateX(-50%); font-family: ${MONO}; font-size: 10px;
                 color: rgba(229,212,194,.38); }
.cl-mark { position: absolute; width: 16px; height: 16px; margin-left: -8px; padding: 0; border-radius: 50%;
           background: var(--c); border: 1.5px solid rgba(255,244,214,.7); cursor: pointer;
           opacity: 0; transform: translateY(12px) scale(.4);
           transition: transform .55s cubic-bezier(.34,1.6,.5,1), opacity .4s ease;
           transition-delay: calc(.1s + var(--i) * 55ms); }
.cl-mark::after { content: ''; position: absolute; left: 50%; top: 100%; width: 1px; height: 8px; background: rgba(229,212,194,.3); }
/* A bigger reach on a touch screen, but only a little: the marks STACK 20px
   apart when two casks share a rung, so an expander large enough to hit 44px
   would cover the cask above it. 34px is as far as it goes without one mark
   stealing another's tap. The cask list below is the reliable way in, and the
   map says the same of its pins. */
@media (pointer: coarse) {
  .cl-mark::before { content: ''; position: absolute; inset: -9px; border-radius: 50%; }
}
.tr.is-in .cl-mark { opacity: 1; transform: none; }
.cl-mark.is-gone { background: transparent; border-color: rgba(229,212,194,.5); }
.cl-mark.is-hot { transform: scale(1.35); transition-delay: 0s; box-shadow: 0 0 0 3px rgba(212,184,90,.5); }
.cl-mark.is-dim { opacity: .12 !important; pointer-events: none; transition-delay: 0s; }
.cl-mark:focus-visible { outline: none; box-shadow: 0 0 0 3px ${GOLD}; }
.cl-tip { position: absolute; transform: translateX(var(--tx)); pointer-events: none; white-space: nowrap;
          font-family: ${MONO}; font-size: 10.5px; line-height: 1.7; color: rgba(229,212,194,.8);
          padding: 9px 12px; border-radius: 3px; border-top: 2px solid ${GOLD}; background: rgba(5,30,22,.95);
          box-shadow: 0 12px 30px rgba(0,0,0,.45); }
.cl-tip b { color: #E5D4C2; font-weight: 500; }
@media (prefers-reduced-motion: reduce) { .cl-mark { transition: none; opacity: 1; transform: none; } }
`
```

## `components/tet/TetFlight.tsx`

213 lines · 11,239 bytes

```tsx
'use client'

import { useState } from 'react'
import TetPlate from '@/components/tet/TetPlate'
import { MONO, GOLD } from '@/components/public/kit'
import type { CaskBoardRow } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE FLIGHT — five sample bottles, each one a fact about a wood in the list.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-22: "little tooltips on the sample bottles. Fun facts about
// the casks we put in the options."
//
// ABOUT THE WOOD, NOT THE DISTILLERY. Every cask in tet_casks is still a
// placeholder ("Glen Placeholder", "Placeholder Isle") so there is no real
// distillery to tell a story about, and making one up would be printed on a
// page people spend money from. What IS real is the list's woods — Oloroso,
// Pedro Ximénez, first-fill bourbon, refill, and the octave itself — and
// those have facts that are true of every cask of that kind. Each tip also
// COUNTS how many casks in the selection carry that wood, from the same rows
// the list below is drawn from, so when the real casks arrive the numbers
// move and the facts still hold. A wood the selection no longer has loses its
// count line rather than claiming one.
//
// The facts follow the SELECTION. They began as Oloroso, refill, first-fill
// bourbon, the octave and PX — and when the real casks arrived in September
// 2026 not one of them was a refill or a bourbon cask, so two tips counted
// nothing. They are Palo Cortado and Madeira now, which the list does have.
// If the woods change again, change these: a tip that matches no cask is a
// fact about somebody else's whisky.
//
// The bottles are matched to the facts by what they look like: the darkest
// sample is the PX, the palest the Madeira. The rings sit on
// the caps, not the numbered labels, so the numbers stay visible.
//
// Hover, focus or tap. On a phone the photograph is too small to hold a card
// over a bottle, so the fact opens under the picture instead.
// ═══════════════════════════════════════════════════════════════════════════

interface Fact {
  /** The bottle's black cap, as a percentage of the photograph — the ring
   *  sits there so the sample's own number stays readable. */
  x: number; y: number
  title: [string, string]
  body: [string, string]
  /** Which casks count as this wood. */
  match: (c: CaskBoardRow) => boolean
}

const FACTS: Fact[] = [
  {
    x: 18.4, y: 43.4,
    title: ['Oloroso', 'Oloroso'],
    body: [
      'Oloroso is sherry aged in contact with the air — dry, nutty and dark. The cask that held it gives whisky dried fruit, walnut and spice.',
      'Oloroso là rượu sherry được ủ tiếp xúc với không khí — khô, bùi và sẫm màu. Thùng từng chứa nó mang lại cho whisky hương trái cây sấy, óc chó và gia vị.',
    ],
    match: c => /oloroso/i.test(c.wood ?? ''),
  },
  {
    x: 31.2, y: 40.1,
    title: ['Palo Cortado', 'Palo Cortado'],
    body: [
      'The rarest sherry: it starts under flor like a fino, loses that veil, and finishes in the open air. Nutty like an amontillado, bodied like an oloroso.',
      'Loại sherry hiếm nhất: khởi đầu dưới lớp men flor như fino, rồi mất lớp men ấy và hoàn thiện trong không khí. Vị hạt như amontillado, thân rượu dày như oloroso.',
    ],
    match: c => /palo cortado/i.test(c.wood ?? ''),
  },
  {
    x: 48, y: 38.9,
    title: ['Madeira', 'Madeira'],
    body: [
      'Madeira is wine that has been heated and deliberately left to the air — the one wine improved by both. The cask hands on baked stone fruit, brown sugar and a tang that cuts the sweetness.',
      'Madeira là loại rượu vang được gia nhiệt và cố ý để tiếp xúc không khí — loại rượu duy nhất tốt lên nhờ cả hai. Thùng để lại hương trái cây nướng, đường nâu và vị chua nhẹ cân bằng độ ngọt.',
    ],
    match: c => /madeira/i.test(c.wood ?? ''),
  },
  {
    x: 65.1, y: 39.3,
    title: ['The octave', 'Thùng octave'],
    body: [
      'An octave is a small cask — 40 to 50 litres, an eighth of a sherry butt, hence the name. More wood touches every litre, so it works faster than a big one.',
      'Octave là thùng nhỏ — 40 đến 50 lít, bằng một phần tám thùng butt sherry, nên có tên như vậy. Mỗi lít tiếp xúc với nhiều gỗ hơn, nên rượu chín nhanh hơn thùng lớn.',
    ],
    match: c => /octave/i.test(`${c.cask_type} ${c.wood ?? ''}`),
  },
  {
    x: 84.5, y: 41.7,
    title: ['Pedro Ximénez', 'Pedro Ximénez'],
    body: [
      'PX grapes are dried in the sun until they are nearly raisins before they are pressed. The sherry is almost black — and so is what it leaves in the wood.',
      'Nho PX được phơi nắng đến gần thành nho khô rồi mới ép. Rượu sherry gần như đen — và những gì nó để lại trong gỗ cũng vậy.',
    ],
    match: c => /\bPX\b|pedro/i.test(c.wood ?? ''),
  },
]

export default function TetFlight({ casks, t }: {
  casks: CaskBoardRow[]
  t: (en: string, vn: string) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const active = hover ?? pinned
  const L = (pair: [string, string]) => t(pair[0], pair[1])

  const count = (f: Fact) => casks.filter(f.match).length
  const countLine = (f: Fact) => {
    const n = count(f)
    if (!n) return null
    return n === casks.length
      ? t(`Every cask in this selection`, `Mọi thùng trong bộ sưu tập này`)
      : t(`${n} of ${casks.length} casks in this selection`, `${n} trên ${casks.length} thùng trong bộ sưu tập này`)
  }

  const card = (i: number) => {
    const f = FACTS[i]; const line = countLine(f)
    return (
      <>
        <div className="fl-kicker">{t('Sample', 'Mẫu')} {i + 1} · {t('the wood', 'loại gỗ')}</div>
        <div className="fl-title">{L(f.title)}</div>
        <p className="fl-body">{L(f.body)}</p>
        {line && <div className="fl-count">{line}</div>}
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <TetPlate
        src="/images/tet/flight.webp" sm="/images/tet/flight-sm.webp"
        width={1106} height={738} smWidth={820}
        alt={t('Five samples poured into Glencairn glasses', 'Năm mẫu rượu rót trong ly Glencairn')}
        caption={t('Tasted before it is chosen · touch a sample', 'Nếm thử trước khi chọn · chạm vào một mẫu')}
        layer={
          <div onPointerLeave={() => setHover(null)} style={{ position: 'absolute', inset: 0 }}>
            {FACTS.map((f, i) => (
              <button
                key={i}
                type="button"
                className={`fl-spot${active === i ? ' is-on' : ''}`}
                style={{ left: `${f.x}%`, top: `${f.y}%`, ['--i' as string]: i }}
                aria-label={`${t('Sample', 'Mẫu')} ${i + 1}: ${L(f.title)}`}
                aria-expanded={active === i}
                onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(i) }}
                onFocus={() => setPinned(i)}
                onBlur={() => setPinned(p => (p === i ? null : p))}
                onClick={() => setPinned(p => (p === i ? null : i))}
              >
                <span className="fl-ring" />
                {/* The card sits over the photograph on a wide screen, above
                    the bottle, flipped inward at the edges so it never leaves
                    the frame. */}
                <span
                  className="fl-tip"
                  role="tooltip"
                  style={{ ['--tx' as string]: f.x > 70 ? '-86%' : f.x < 30 ? '-14%' : '-50%' }}
                >
                  {card(i)}
                </span>
              </button>
            ))}
          </div>
        }
        after={
          <div className="fl-under" aria-live="polite">
            {active !== null ? card(active) : (
              <div className="fl-kicker">{t('Touch a sample for its wood', 'Chạm vào một mẫu để xem loại gỗ')}</div>
            )}
          </div>
        }
      />
    </>
  )
}

const CSS = `
.fl-spot { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; padding: 0;
           border: none; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.fl-ring { position: absolute; inset: 11px; border-radius: 50%; border: 1.5px solid rgba(255,244,214,.95);
           background: rgba(212,184,90,.28); box-shadow: 0 0 0 0 rgba(212,184,90,.55);
           transition: transform .35s cubic-bezier(.34,1.6,.5,1), background .3s ease;
           animation: fl-ping 3.2s ease-out infinite; animation-delay: calc(var(--i) * .45s); }
@keyframes fl-ping { 0% { box-shadow: 0 0 0 0 rgba(212,184,90,.55) } 70%, 100% { box-shadow: 0 0 0 14px rgba(212,184,90,0) } }
.fl-spot:hover .fl-ring, .fl-spot.is-on .fl-ring { transform: scale(1.35); background: ${GOLD}; animation: none; }
.fl-spot:focus-visible { outline: none; }
.fl-spot:focus-visible .fl-ring { box-shadow: 0 0 0 3px rgba(255,244,214,.8); }

.fl-tip { position: absolute; bottom: calc(100% + 6px); left: 50%; width: 290px; text-align: left;
          transform: translate(var(--tx), 8px); opacity: 0; pointer-events: none;
          transition: opacity .25s ease, transform .35s cubic-bezier(.16,.84,.44,1);
          padding: 16px 18px 15px; border-radius: 3px; border-top: 2px solid ${GOLD};
          background: rgba(5,30,22,.94); box-shadow: 0 18px 40px rgba(0,0,0,.45); color: #E5D4C2; }
.fl-spot.is-on .fl-tip { opacity: 1; transform: translate(var(--tx), 0); }
.fl-kicker { font-family: ${MONO}; font-size: 9.5px; letter-spacing: .18em; text-transform: uppercase; color: rgba(229,212,194,.5); }
.fl-title { font-family: 'Rampant Sans', Georgia, serif; font-size: 21px; line-height: 1.1; margin-top: 6px; color: ${GOLD}; }
.fl-body { font-family: ${MONO}; font-size: 11.5px; line-height: 1.75; margin: 9px 0 0; color: rgba(229,212,194,.85); }
.fl-count { font-family: ${MONO}; font-size: 10px; letter-spacing: .06em; margin-top: 10px; padding-top: 9px;
            border-top: 1px solid rgba(229,212,194,.14); color: rgba(229,212,194,.6); }

/* The phone's version: under the photograph, not on it. */
.fl-under { display: none; }
@media (max-width: 780px) {
  .fl-tip { display: none; }
  .fl-under { display: block; margin-top: 16px; min-height: 40px; }
  .fl-under .fl-body { max-width: 520px; }
}
@media (prefers-reduced-motion: reduce) {
  .fl-ring { animation: none; transition: none; }
  .fl-tip { transition: none; }
}
`
```

## `components/tet/SleeveStudio.tsx`

554 lines · 31,849 bytes

```tsx
'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent, type CSSProperties } from 'react'
import { useLang } from '@/lib/lang'
import SleeveBox from '@/components/tet/SleeveBox'
import FoldedBox from '@/components/tet/FoldedBox'
import { BOXES, boxArt, type TetBox } from '@/lib/tet/boxes'

// ═══════════════════════════════════════════════════════════════════════════
// THE SLEEVE — Duncan Taylor's own artwork, with your logo on its blank face.
// ───────────────────────────────────────────────────────────────────────────
// This replaced an invented rectangle (colour swatches, a hex field, "gold
// foil", a company line and a message) on 22 September 2026, when the real
// sleeve arrived: "DT Sleeve.png", the flat dieline, 6431 × 2387 px at 300 dpi
// — 54.4 × 20.2 cm printed, on a transparent ground. It is fixed artwork, so
// colour and foil no longer mean anything; what a buyer chooses is their logo
// and where it sits.
//
// THE FACE WAS MEASURED, NOT GUESSED. Five panels, left to right: an end flap,
// the back (warnings and barcode), the front (Chợ Bến Thành), the side, and a
// BLANK FACE — plain red with gold swirls — from the fold at x 4770 to the
// right-hand edge. There is no glue flap after it. Inside its thin gold frame
// (x 4792–6372, y 673–2306) the swirls cover the top right and the bottom;
// the clear red between them, found by scanning every row for gold, is
// x 4820–6015, y 998–1846. That region SIZES the logo; it does not place it.
// It was also the starting point until the owner said "Centre it is slightly
// off left of centre" — the clear red is 165 px left of the face's middle,
// because the swirl takes the top right. Centred means centred in the gold
// frame, and that is where a logo lands and where "Centre it" puts it back.
//
// There was an ACTUAL SIZE view (one artwork pixel to one CSS pixel). The owner
// removed it, 2026-09-22: "Just whole sleeve is good."
//
// FOLDED (2026-09-22, "a second clickable version"): the same design shown as
// the box it becomes, turned by dragging — see SleeveBox. The logo is placed
// in the flat view; the folded one only shows it.
//
// SHARE hands the same PNG to the phone's own share sheet (Zalo, WhatsApp,
// Messages — whatever is installed), because that is how a design actually
// reaches the person who signs it off here. Where a browser cannot share a
// file (most desktops) the button is not shown; Download does that job.
//
// DOWNLOAD AS PNG draws the finished sleeve in the browser — the 3200 px
// artwork with the logo composited at its box — so a buyer can send it to
// whoever signs it off. Nothing is uploaded to make it.
//
// The logo never leaves the browser until an enquiry is actually sent, and then
// only into a private bucket. Its position travels with it, in the artwork's
// own pixels, so whoever prepares the print file knows exactly where it goes.
// ═══════════════════════════════════════════════════════════════════════════

export const SLEEVE = { w: 6431, h: 2387 }

type Box = { x: number; y: number; w: number; h: number }

// ── TWO SLEEVES ────────────────────────────────────────────────────────────
// "DT Sleeve 2.png" arrived the same afternoon (owner: "add a second clickable
// version of the customisable … saved under DT Sleeve 2"): a gold dragon over
// the Sài Gòn skyline, on the same 6431 × 2387 canvas but NOT the same
// dieline — its outline is a symmetric house shape, tall from x 1730 to 4740,
// with panel lines at x ≈ 2223 and 4200. Its blank space is a gold-ruled
// rectangle on the right-hand panel, found by scanning for the rule: x 5100–
// 5104 and 6158–6163, y 752–759 and 1691–1694. Inside that rule the red is
// plain, so the whole interior is where a logo can go.
//
// Because its folds are not Sleeve 1's, the FOLDED view is offered for Sleeve 1
// only — folding the dragon along Sleeve 1's lines would show a box that does
// not exist. When its dieline is confirmed it gets its own fold table.
export type SleeveId = 'dt-tet-2027' | 'dt-tet-2027-dragon'
interface SleeveSpec {
  name: [string, string]
  small: string; large: string
  /** The blank face — what the enquiry thumbnail shows. */
  face: Box
  /** Inside its gold rule — the logo can be moved anywhere in here. */
  frame: Box
  /** The clear ground the logo is SIZED against. */
  clear: Box
  folds: boolean
}
export const SLEEVES: Record<SleeveId, SleeveSpec> = {
  'dt-tet-2027': {
    name: ['Sleeve 1 · Chợ Bến Thành', 'Hộp 1 · Chợ Bến Thành'],
    small: '/images/tet/sleeve-1600.webp', large: '/images/tet/sleeve-3200.webp',
    face: { x: 4770, y: 612, w: 1644, h: 1731 },
    frame: { x: 4792, y: 673, w: 1580, h: 1633 },
    // The clear red between the swirls.
    clear: { x: 4820, y: 998, w: 1195, h: 848 },
    folds: true,
  },
  'dt-tet-2027-dragon': {
    name: ['Sleeve 2 · The dragon', 'Hộp 2 · Rồng vàng'],
    small: '/images/tet/sleeve2-1600.webp', large: '/images/tet/sleeve2-3200.webp',
    face: { x: 5100, y: 752, w: 1064, h: 943 },
    frame: { x: 5105, y: 760, w: 1052, h: 930 },
    clear: { x: 5135, y: 790, w: 992, h: 870 },
    folds: false,
  },
}
const middle = (f: Box) => ({ cx: f.x + f.w / 2, cy: f.y + f.h / 2 })
/** Sleeve 1's, kept for anything that imported them before there were two. */
// ── ONE STUDIO, NOT TWO ────────────────────────────────────────────────────
// Owner, 2026-09-25: "why the studio and the other bits are seperate makes no
// sense. Should all be together, with the first one customisable. The rest
// just the standard. Customisation can be practiced on one."
//
// So every design a buyer can choose is in one strip: the two Duncan Taylor
// sleeves and the twelve covers from the design house. Exactly ONE of them
// takes a logo — the first — and the logo tools appear only when it is
// chosen, because a control that does nothing on thirteen of fourteen designs
// is worse than no control.
//
// A design is foldable when its own outline says so. The sleeve's folds were
// measured from its artwork; the covers' from theirs (lib/tet/boxes). Sleeve 2
// and the three-bottle wrap have no confirmed dieline and stay flat.
export interface Design {
  id: string
  kind: 'sleeve' | 'cover'
  name: [string, string]
  small: string
  large: string
  /** Only the first one. */
  customisable: boolean
  foldable: boolean
  subject?: [string, string]
  box?: TetBox
}

export const DESIGNS: Design[] = [
  ...(Object.keys(SLEEVES) as SleeveId[]).map((id, i): Design => ({
    id, kind: 'sleeve',
    name: SLEEVES[id].name,
    small: SLEEVES[id].small, large: SLEEVES[id].large,
    customisable: i === 0,
    foldable: SLEEVES[id].folds,
  })),
  ...BOXES.map((b): Design => ({
    id: b.slug, kind: 'cover',
    name: b.name,
    small: boxArt(b.slug, 640), large: boxArt(b.slug, 3200),
    customisable: false,
    foldable: !!b.folds,
    subject: b.subject,
    box: b,
  })),
]

export const FACE = SLEEVES['dt-tet-2027'].face
export const CLEAR = SLEEVES['dt-tet-2027'].clear

export interface SleeveDesign {
  sleeve: SleeveId
  /** The logo's rectangle on the flat artwork, in the artwork's own pixels. */
  logo_box: Box | null
  /** Object URL for the preview only — never sent anywhere. */
  logo_preview?: string
  /** The file itself, uploaded when the enquiry is sent. */
  logo_file?: File
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** A rectangle in artwork pixels as percentages of the artwork, so it scales with it. */
export const onArt = (r: Box): CSSProperties => ({
  left: `${(r.x / SLEEVE.w) * 100}%`, top: `${(r.y / SLEEVE.h) * 100}%`,
  width: `${(r.w / SLEEVE.w) * 100}%`, height: `${(r.h / SLEEVE.h) * 100}%`,
})

export default function SleeveStudio({ onUse, onAsk }: {
  onUse: (d: SleeveDesign) => void
  /** A cover has no logo to place, so its way into the enquiry is by name. */
  onAsk?: (box: TetBox) => void
}) {
  const { t } = useLang()
  const [logo, setLogo] = useState<{ url: string; file: File; ar: number } | null>(null)
  const [scale, setScale] = useState(0.8)
  const [designId, setDesignId] = useState<string>(DESIGNS[0].id)
  const design = DESIGNS.find(d => d.id === designId) ?? DESIGNS[0]
  // The logo tools only ever work on the one customisable design, so the
  // geometry below is always the first sleeve's — a cover has no blank face.
  const sleeveId: SleeveId = design.kind === 'sleeve' ? (design.id as SleeveId) : 'dt-tet-2027'
  const S = SLEEVES[sleeveId]
  const FRAME = S.frame, CLEAR = S.clear
  const MIDDLE = middle(FRAME)
  const [centre, setCentre] = useState(MIDDLE)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'flat' | 'folded'>('flat')
  // A new design puts the logo in the middle of ITS blank space where it has
  // one, and drops back to flat where that design cannot be folded.
  const pickDesign = (d: Design) => {
    setDesignId(d.id)
    if (d.kind === 'sleeve') setCentre(middle(SLEEVES[d.id as SleeveId].frame))
    if (!d.foldable) setView('flat')
  }
  const [canShare, setCanShare] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  // The logo's box: as big as `scale` of the clear area allows at its own
  // proportions, then kept inside the gold frame wherever it is dragged.
  const box: Box | null = logo ? (() => {
    let w = CLEAR.w * scale, h = w / logo.ar
    if (h > CLEAR.h * scale) { h = CLEAR.h * scale; w = h * logo.ar }
    const x = clamp(centre.cx - w / 2, FRAME.x, FRAME.x + FRAME.w - w)
    const y = clamp(centre.cy - h / 2, FRAME.y, FRAME.y + FRAME.h - h)
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
  })() : null

  const pickLogo = (f: File) => {
    setErr('')
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      setErr(t('PNG, JPEG or WebP, please.', 'Vui lòng dùng PNG, JPEG hoặc WebP.')); return
    }
    if (f.size > 25 * 1024 * 1024) {
      setErr(t(`That file is ${(f.size / 1048576).toFixed(1)}MB. The limit is 25MB.`,
               `Tệp ${(f.size / 1048576).toFixed(1)}MB. Giới hạn là 25MB.`)); return
    }
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      if (logo?.url) URL.revokeObjectURL(logo.url)
      setLogo({ url, file: f, ar: img.naturalWidth / img.naturalHeight || 1 })
      setScale(0.8); setCentre(MIDDLE)
    }
    img.onerror = () => { URL.revokeObjectURL(url); setErr(t('That image could not be read.', 'Không đọc được ảnh này.')) }
    img.src = url
  }
  useEffect(() => () => { if (logo?.url) URL.revokeObjectURL(logo.url) }, [logo?.url])

  // Dragging works in the artwork's pixels whatever size it is drawn at.
  const artPerPx = () => SLEEVE.w / (stageRef.current?.getBoundingClientRect().width || SLEEVE.w)
  const keepInFrame = (cx: number, cy: number) => {
    if (!box) return { cx, cy }
    return { cx: clamp(cx, FRAME.x + box.w / 2, FRAME.x + FRAME.w - box.w / 2), cy: clamp(cy, FRAME.y + box.h / 2, FRAME.y + FRAME.h - box.h / 2) }
  }
  const down = (e: ReactPointerEvent<HTMLImageElement>) => {
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, cx: centre.cx, cy: centre.cy }; setDragging(true)
  }
  const move = (e: ReactPointerEvent<HTMLImageElement>) => {
    const d = drag.current; if (!d) return
    const k = artPerPx()
    setCentre(keepInFrame(d.cx + (e.clientX - d.x) * k, d.cy + (e.clientY - d.y) * k))
  }
  const up = () => { drag.current = null; setDragging(false) }
  const nudge = (e: KeyboardEvent<HTMLImageElement>) => {
    const step = e.shiftKey ? 100 : 20
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const v = m[e.key]; if (!v) return
    e.preventDefault(); setCentre(c => keepInFrame(c.cx + v[0], c.cy + v[1]))
  }

  // The finished sleeve as a PNG. 3200 px wide, not the 6431 master: a PNG of
  // the master is tens of megabytes, far past what anyone can email, and this
  // is for looking at — the printer works from the logo file itself.
  const makePng = async (): Promise<Blob> => {
    const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src
    })
    const art = await load(S.large)
    const k = art.naturalWidth / SLEEVE.w
    const c = document.createElement('canvas')
    c.width = art.naturalWidth; c.height = art.naturalHeight
    const g = c.getContext('2d')!
    g.drawImage(art, 0, 0)
    if (logo && box) {
      const l = await load(logo.url)
      g.imageSmoothingQuality = 'high'
      g.drawImage(l, box.x * k, box.y * k, box.w * k, box.h * k)
    }
    const blob = await new Promise<Blob | null>(ok => c.toBlob(ok, 'image/png'))
    if (!blob) throw new Error('no blob')
    return blob
  }
  const FILE = `TRC-Tet-2027-sleeve-${sleeveId === 'dt-tet-2027' ? '1' : '2'}.png`
  const failed = () => setErr(t('The PNG could not be made. Try again, or send the design with an enquiry.',
                                'Không tạo được tệp PNG. Vui lòng thử lại, hoặc gửi thiết kế kèm yêu cầu.'))

  const download = async () => {
    setErr(''); setSaving(true)
    try {
      const blob = await makePng()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = FILE
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    } catch { failed() } finally { setSaving(false) }
  }

  // Only offered where the browser can actually share a FILE — asked with a
  // real one, because canShare({files}) is the only honest test.
  useEffect(() => {
    try {
      const probe = new File([new Blob(['x'], { type: 'image/png' })], FILE, { type: 'image/png' })
      setCanShare(typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] }))
    } catch { setCanShare(false) }
  }, [])
  const share = async () => {
    setErr(''); setSaving(true)
    try {
      const file = new File([await makePng()], FILE, { type: 'image/png' })
      await navigator.share({
        files: [file],
        title: t('Our Tết sleeve', 'Hộp Tết của chúng tôi'),
        text: t('Our logo on the Duncan Taylor Tết sleeve — therampantclub.com/tet',
                'Logo của chúng tôi trên hộp Tết Duncan Taylor — therampantclub.com/tet'),
      })
    } catch (e) {
      // Closing the share sheet is not an error.
      if ((e as Error)?.name !== 'AbortError') failed()
    } finally { setSaving(false) }
  }

  const use = () => onUse({ sleeve: sleeveId, logo_box: box, logo_preview: logo?.url, logo_file: logo?.file })

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ss-sleeves" role="radiogroup" aria-label={t('Choose a design', 'Chọn mẫu hộp')}>
        {DESIGNS.map(d => (
          <button key={d.id} role="radio" aria-checked={designId === d.id} data-design={d.id}
                  className={`ss-pick ${designId === d.id ? 'is-on' : ''}`} onClick={() => pickDesign(d)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.small} alt="" width={160} height={59} loading="lazy" />
            <span>{t(d.name[0], d.name[1])}</span>
            {d.customisable && <i className="ss-yours">{t('Your logo', 'Logo của quý vị')}</i>}
          </button>
        ))}
      </div>

      {/* THE SWITCH IS THE POINT (owner, 2026-09-25: "make the flat v 3D sign
          big and clear. I want people to see and test it"). It was two mono
          words the size of a caption; it is now the largest control on the
          section, and it says what each side is for. */}
      <div className="ss-views" role="tablist" aria-label={t('How to look at it', 'Cách xem')}>
        <button role="tab" aria-selected={view === 'flat'} className={`ss-toggle ${view === 'flat' ? 'is-on' : ''}`}
                onClick={() => setView('flat')}>
          <strong>{t('Flat', 'Trải phẳng')}</strong>
          <span>{t('as it prints', 'như khi in')}</span>
        </button>
        <button role="tab" aria-selected={view === 'folded'} className={`ss-toggle ${view === 'folded' ? 'is-on' : ''}`}
                onClick={() => setView('folded')} disabled={!design.foldable}
                title={design.foldable ? undefined : t('Its dieline has not been confirmed yet', 'Chưa xác nhận khuôn bế của mẫu này')}>
          <strong>{t('Folded · 3D', 'Đã gấp · 3D')}</strong>
          <span>{design.foldable ? t('turn it in your hand', 'xoay thử trong tay') : t('dieline not confirmed', 'chưa có khuôn bế')}</span>
        </button>
      </div>

      {view === 'folded' && (design.kind === 'sleeve'
        ? <SleeveBox logo={logo?.url ?? null} box={box} t={t} />
        : <FoldedBox
            url={design.large}
            folds={design.box!.folds!}
            settleAt={-32}
            label={t(`${design.name[0]}, folded into its box — drag to turn it`, `${design.name[1]}, đã gấp thành hộp — kéo để xoay`)}
            hint={t('or drag to turn it', 'hoặc kéo để xoay')}
            turns={[
              { label: t(design.name[0], design.name[1]), to: 0, gold: true },
              { label: t('Duncan Taylor', 'Duncan Taylor'), to: -90 },
              { label: t('The crest', 'Mặt huy hiệu'), to: 180 },
              { label: t('The small print', 'Mặt thông tin'), to: 90 },
            ]} />)}

      <div className="ss-view" hidden={view !== 'flat'}>
        <div ref={stageRef} className="ss-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ss-art" draggable={false} width={SLEEVE.w} height={SLEEVE.h}
               key={designId} src={design.small}
               srcSet={`${design.small} ${design.kind === 'cover' ? 640 : 1600}w, ${design.large} 3200w`}
               sizes="(max-width: 900px) 100vw, 1180px"
               alt={t(`${design.name[0]}: flat, before folding`, `${design.name[1]}: trải phẳng trước khi gấp`)} />
          {design.customisable && !logo && (
            <button type="button" className="ss-slot" style={onArt(CLEAR)} onClick={() => fileRef.current?.click()}>
              {t('Your logo here', 'Logo của quý vị')}
            </button>
          )}
          {design.customisable && logo && box && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo.url} alt={t('Your logo', 'Logo của quý vị')} draggable={false} tabIndex={0}
                 className={`ss-logo ${dragging ? 'is-drag' : ''}`} style={onArt(box)}
                 onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={nudge}
                 aria-label={t('Your logo — drag, or use the arrow keys, to move it', 'Logo của quý vị — kéo hoặc dùng phím mũi tên để di chuyển')} />
          )}
        </div>
      </div>
      <p className="pk-meta" style={{ marginTop: 12, opacity: .55, lineHeight: 1.8 }}>
        {view === 'folded'
          ? design.customisable
            ? t('The same design, folded into the box. Place and size your logo in the flat view.',
                'Cùng thiết kế, gấp thành hộp. Đặt và chỉnh cỡ logo ở chế độ trải phẳng.')
            : t('The same artwork, folded into the box it becomes. Every face is a slice of the print file, not a photograph.',
                'Cùng bản in, gấp thành chiếc hộp thật. Mỗi mặt là một phần của tệp in, không phải ảnh chụp.')
          : design.customisable
            ? t('Duncan Taylor’s printed sleeve, flat, before folding — your logo goes on the blank face. The printer works from your original file; this shows where it goes.',
                'Hộp in của Duncan Taylor, trải phẳng trước khi gấp — logo của quý vị đặt ở mặt trống. Nhà in làm việc với tệp gốc của quý vị; bản này cho thấy vị trí đặt logo.')
            : t(`${design.subject ? design.subject[0] + '. ' : ''}A standard cover, flat as it prints. The first design in the row is the one that takes your logo.`,
                `${design.subject ? design.subject[1] + '. ' : ''}Mẫu tiêu chuẩn, trải phẳng như khi in. Mẫu đầu tiên trong hàng là mẫu nhận logo của quý vị.`)}
      </p>

      {!design.customisable && onAsk && design.box && (
        <button className="ss-ask" onClick={() => onAsk(design.box!)}>
          {t(`Ask about ${design.name[0]}`, `Hỏi về mẫu ${design.name[1]}`)} <span className="pk-go">→</span>
        </button>
      )}

      {design.customisable && <>
      <div className="ss-controls">
        <div>
          <div className="pk-eyebrow">{t('Your logo', 'Logo của quý vị')}</div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
                 onChange={e => { const f = e.target.files?.[0]; if (f) pickLogo(f); e.target.value = '' }} />
          <div style={{ marginTop: 10, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {logo ? (
              <>
                <span className="pk-meta">{logo.file.name} · {(logo.file.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => fileRef.current?.click()} className="pk-cta" style={{ marginTop: 0 }}>{t('Replace', 'Thay')} <span className="pk-go">→</span></button>
                <button onClick={() => { URL.revokeObjectURL(logo.url); setLogo(null) }} className="pk-cta" style={{ marginTop: 0, opacity: .6 }}>{t('Remove', 'Xoá')}</button>
              </>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="ss-drop">
                {t('Add a PNG, JPEG or WebP — up to 25MB', 'Thêm tệp PNG, JPEG hoặc WebP — tối đa 25MB')}
              </button>
            )}
          </div>
          <p className="pk-meta" style={{ marginTop: 8, opacity: .5, fontSize: 11.5 }}>
            {t('A PNG with a transparent background sits on the red. A white background prints as a white box.',
               'PNG nền trong suốt sẽ nằm trên nền đỏ. Nền trắng sẽ in thành một ô trắng.')}
          </p>
          {err && <p className="pk-meta" style={{ color: '#C27070', marginTop: 8 }}>{err}</p>}
        </div>

        {logo && (
          <div>
            <div className="pk-eyebrow">{t('Size', 'Kích thước')} · {Math.round(scale * 100)}%</div>
            <input type="range" min={20} max={100} step={1} value={Math.round(scale * 100)} className="ss-range"
                   onChange={e => setScale(+e.target.value / 100)} aria-label={t('Logo size', 'Kích thước logo')} />
            <div style={{ marginTop: 8 }}>
              <button className="ss-link" onClick={() => setCentre(MIDDLE)}>{t('Centre it', 'Căn giữa')}</button>
              <span className="pk-meta" style={{ opacity: .5, marginLeft: 12, fontSize: 11.5 }}>{t('or drag it on the sleeve', 'hoặc kéo trên hộp')}</span>
            </div>
          </div>
        )}

      </div>

      <div className="ss-actions">
        <button onClick={use} className="pk-cta" style={{ marginTop: 0 }}>
          {t('Send this design with an enquiry', 'Gửi thiết kế này kèm yêu cầu')} <span className="pk-go">→</span>
        </button>
        <button onClick={download} className="pk-cta" style={{ marginTop: 0, opacity: saving ? .5 : .8 }} disabled={saving}>
          {saving ? t('Making the PNG…', 'Đang tạo PNG…') : t('Download as PNG', 'Tải về PNG')} <span className="pk-go">↓</span>
        </button>
        {canShare && (
          <button onClick={share} className="pk-cta" style={{ marginTop: 0, opacity: saving ? .5 : .8 }} disabled={saving}>
            {t('Share · Zalo, WhatsApp…', 'Chia sẻ · Zalo, WhatsApp…')} <span className="pk-go">↗</span>
          </button>
        )}
      </div>
      </>}
    </div>
  )
}

/** The blank face alone, with the logo on it, at `width` px — for the enquiry,
 *  so the buyer can see their design is going with them. Built from the same
 *  measurements as the studio, so the two can never disagree. */
export function SleeveFaceThumb({ design, width = 88 }: { design: SleeveDesign; width?: number }) {
  const spec = SLEEVES[design.sleeve] ?? SLEEVES['dt-tet-2027']
  const FACE = spec.face
  const k = width / FACE.w
  return (
    <div style={{ position: 'relative', width, height: Math.round(FACE.h * k), overflow: 'hidden', borderRadius: 2, flexShrink: 0,
                  boxShadow: '0 6px 16px rgba(0,0,0,.35)' }}>
      <div style={{ position: 'absolute', left: -FACE.x * k, top: -FACE.y * k, width: SLEEVE.w * k, height: SLEEVE.h * k }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spec.small} alt="" style={{ display: 'block', width: '100%', height: '100%' }} />
        {design.logo_preview && design.logo_box && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={design.logo_preview} alt="" style={{ position: 'absolute', objectFit: 'contain', ...onArt(design.logo_box) }} />
        )}
      </div>
    </div>
  )
}

const CSS = `
.ss-view { position: relative; width: 100%; border-radius: 3px; }
.ss-stage { position: relative; width: 100%; }
.ss-art { display: block; width: 100%; height: auto; user-select: none; -webkit-user-drag: none; pointer-events: none;
          filter: drop-shadow(0 18px 34px rgba(0,0,0,.4)); }
.ss-logo { position: absolute; object-fit: contain; cursor: grab; touch-action: none; user-select: none;
           outline: 1px dashed transparent; outline-offset: 3px; transition: outline-color .2s ease; }
.ss-logo:hover, .ss-logo:focus-visible, .ss-logo.is-drag { outline-color: rgba(212,184,90,.9); }
.ss-logo.is-drag { cursor: grabbing; }
.ss-slot { position: absolute; display: flex; align-items: center; justify-content: center; cursor: pointer;
           background: rgba(0,0,0,.08); border: 1px dashed rgba(229,212,194,.5); border-radius: 2px;
           font-family: 'Google Sans Code', monospace; font-size: clamp(8px, 1vw, 13px); letter-spacing: .16em;
           text-transform: uppercase; color: rgba(229,212,194,.8); }
.ss-slot:hover { border-color: #D4B85A; color: #E5D4C2; }
.ss-controls { display: flex; flex-wrap: wrap; gap: 26px 44px; align-items: flex-start; margin-top: 30px; }
.ss-drop { border: 1px dashed rgba(229,212,194,.28); border-radius: 8px; padding: 14px 18px; text-align: center; cursor: pointer;
           background: none; font-family: 'Google Sans Code', monospace; font-size: 12px; color: rgba(229,212,194,.7); }
.ss-drop:hover { border-color: #D4B85A; color: #E5D4C2; }
.ss-range { width: 200px; margin-top: 12px; accent-color: #D4B85A; }
.ss-link { background: none; border: none; padding: 0; cursor: pointer; font-family: 'Google Sans Code', monospace;
           font-size: 12px; color: #D4B85A; border-bottom: 1px solid rgba(212,184,90,.5); }
.ss-sleeves { display: flex; flex-wrap: wrap; gap: 14px 22px; margin-bottom: 26px; }
.ss-pick { display: grid; gap: 8px; justify-items: start; background: none; border: none; padding: 0; cursor: pointer;
           font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
           color: rgba(229,212,194,.55); }
.ss-pick img { width: 160px; height: auto; display: block; padding: 6px; border-radius: 3px;
               border: 1px solid rgba(229,212,194,.14); transition: border-color .2s ease, transform .3s ease; }
.ss-pick:hover img { border-color: rgba(229,212,194,.4); transform: translateY(-2px); }
.ss-pick.is-on { color: #D4B85A; }
.ss-pick.is-on img { border-color: #D4B85A; }
.ss-views { display: flex; gap: 22px; margin-bottom: 18px; }
.ss-toggle:disabled { opacity: .3; cursor: not-allowed; }
.ss-toggle { background: none; border: none; padding: 2px 0; cursor: pointer; font-family: 'Google Sans Code', monospace;
             font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: rgba(229,212,194,.55);
             border-bottom: 1px solid transparent; }
.ss-toggle.is-on { color: #D4B85A; border-bottom-color: #D4B85A; }
.ss-actions { display: flex; flex-wrap: wrap; gap: 14px 36px; align-items: center; margin-top: 36px; }

/* ── THE SWITCH ───────────────────────────────────────────────────────────
   It was two words in 11px mono and nobody pressed it. Now it is a pair of
   panels the width of a thumb, with the question under each one. */
.ss-views { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 520px;
            margin: 26px 0 8px; }
.ss-toggle { display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
             padding: 14px 18px; cursor: pointer; text-align: left;
             background: rgba(229,212,194,.04); border: 1px solid rgba(229,212,194,.16);
             border-radius: 8px; color: rgba(229,212,194,.7); transition: background .25s ease, border-color .25s ease, color .25s ease; }
.ss-toggle strong { font-family: 'Rampant Sans', serif; font-size: 19px; font-weight: 400; letter-spacing: .01em; }
.ss-toggle span { font-family: 'Google Sans Code', monospace; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; opacity: .7; }
.ss-toggle:hover:not(:disabled) { background: rgba(229,212,194,.07); color: #E5D4C2; }
.ss-toggle.is-on { background: rgba(212,184,90,.12); border-color: #D4B85A; color: #D4B85A; }
.ss-toggle:disabled { opacity: .35; cursor: not-allowed; }

/* The one design that takes a logo says so on its own thumbnail. */
.ss-pick { position: relative; }
.ss-yours { position: absolute; top: 4px; left: 4px; font-style: normal; font-family: 'Google Sans Code', monospace;
            font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #052E20;
            background: #D4B85A; padding: 2px 6px; border-radius: 3px; }
.ss-ask { margin-top: 24px; background: none; border: none; padding: 4px 0; cursor: pointer;
          font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
          color: #D4B85A; border-bottom: 1px solid rgba(212,184,90,.4); }
.ss-ask:hover { border-bottom-color: #D4B85A; }
@media (max-width: 640px) { .ss-views { grid-template-columns: 1fr; max-width: none; } }
@media (prefers-reduced-motion: reduce) { .ss-logo { transition: none; } }
`
```

## `components/tet/SleeveBox.tsx`

80 lines · 3,813 bytes

```tsx
'use client'

import FoldedBox from '@/components/tet/FoldedBox'
import type { BoxFolds } from '@/lib/tet/boxes'

// ═══════════════════════════════════════════════════════════════════════════
// THE SLEEVE, FOLDED — the same artwork, made into the box it becomes.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-22: "add a second clickable version of the customisable" —
// the flat dieline answers "where does my logo go"; this answers "what will
// they be holding".
//
// THE FOLDS WERE MEASURED FROM THE ARTWORK'S OUTLINE, column by column (the
// top edge of the opaque pixels in sleeve-3200.webp, scaled to the 6431 px
// master). It is a box with a sloping top:
//
//   x   32 – 490   a flap at the short height — it tucks inside, not shown
//   x  490 – 1780  END (warnings, barcode): top slopes UP from 613 to 16
//   x 1780 – 3453  FRONT (Chợ Bến Thành): full height, 16 – 2377
//   x 3453 – 4770  END (Duncan Taylor): top slopes DOWN from 16 to 611
//   x 4770 – 6415  THE BLANK FACE: 611 – 2343 — where the logo goes
//
// The two ends are the same depth (1290 and 1317) and the front and the blank
// face the same width (1673 and 1645), which is what says this reading of the
// folds is right: opposite faces of a box must match.
//
// THE FOLDING ITSELF NOW LIVES IN FoldedBox (2026-09-25), because twelve more
// covers arrived and every one of them has its own geometry. This file is what
// it always was — the sleeve's numbers and the sleeve's labels — and the
// checks in tests/tet/sleeve-ui.test.mjs are what say the move changed
// nothing a visitor can see.
// ═══════════════════════════════════════════════════════════════════════════

const SLEEVE_FOLDS: BoxFolds = {
  art: { w: 6431, h: 2387, top: 16, bottom: 2377 },
  faces: {
    endL:  { x: 490,  w: 1290 },
    front: { x: 1780, w: 1673 },
    endR:  { x: 3453, w: 1317 },
    back:  { x: 4770, w: 1645 },
  },
}
const BACK = SLEEVE_FOLDS.faces.back
const { top: TOP, bottom: BOTTOM } = SLEEVE_FOLDS.art

type Box = { x: number; y: number; w: number; h: number }

export default function SleeveBox({ logo, box, t }: {
  logo: string | null
  box: Box | null
  t: (en: string, vn: string) => string
}) {
  const logoOnBack = logo && box ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className="sb-logo" style={{
      left: `${((box.x - BACK.x) / BACK.w) * 100}%`,
      top: `${((box.y - TOP) / (BOTTOM - TOP)) * 100}%`,
      width: `${(box.w / BACK.w) * 100}%`,
      height: `${(box.h / (BOTTOM - TOP)) * 100}%`,
    }} />
  ) : null

  return (
    <FoldedBox
      url="/images/tet/sleeve-3200.webp"
      folds={SLEEVE_FOLDS}
      onBack={logoOnBack}
      // It arrives turning to the face with the logo — the point of the view.
      settleAt={200}
      label={t('The sleeve folded into its box — drag to turn it', 'Hộp đã gấp — kéo để xoay')}
      hint={t('or drag to turn it', 'hoặc kéo để xoay')}
      turns={[
        { label: t('Chợ Bến Thành', 'Chợ Bến Thành'), to: 0 },
        { label: t('Duncan Taylor end', 'Mặt Duncan Taylor'), to: -90 },
        { label: t('Your face', 'Mặt của quý vị'), to: 180, gold: true },
        { label: t('Back end', 'Mặt sau'), to: 90 },
      ]}
    />
  )
}
```

## `components/tet/FoldedBox.tsx`

157 lines · 8,180 bytes

```tsx
'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { MONO, GOLD } from '@/components/public/kit'
import type { BoxFolds } from '@/lib/tet/boxes'

// ═══════════════════════════════════════════════════════════════════════════
// A FLAT COVER, FOLDED — one box viewer, any artwork.
// ───────────────────────────────────────────────────────────────────────────
// This was SleeveBox, which folded exactly one sleeve because there was
// exactly one. The design company then sent twelve covers (owner, 2026-09-25),
// so the geometry moved into the caller and the folding stayed here. SleeveBox
// is now this component with the sleeve's own numbers; nothing about how the
// sleeve looks or behaves changed, and its fifteen checks in
// tests/tet/sleeve-ui.test.mjs are what says so.
//
// EVERY FACE IS A SLICE OF THE SAME ARTWORK, positioned by background-size and
// background-position, so a face is never a separate file and can never drift
// from the print. Opposite faces are drawn at their pair's average width: on a
// real box they are equal, and where a measurement is a pixel or two out it is
// the measurement that is wrong, not the box.
//
// All four faces share one vertical frame (art.top → art.bottom), which is why
// a gabled top works: the short faces keep their transparent upper corner and
// the slopes meet the tall face exactly. The shape comes out of the artwork,
// not out of this file.
//
// Drag to turn it, or use the buttons.
// ═══════════════════════════════════════════════════════════════════════════

export interface Turn { label: string; to: number; gold?: boolean }

export default function FoldedBox({ url, folds, turns = [], onBack, label, hint, settleAt = 0 }: {
  url: string
  folds: BoxFolds
  turns?: Turn[]
  /** Laid over the back face — the sleeve's logo. */
  onBack?: ReactNode
  label: string
  hint: string
  /** Where it turns to once it has arrived. */
  settleAt?: number
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [px, setPx] = useState(240)            // the box's width on screen
  const [turn, setTurn] = useState(settleAt - 228)
  const [drag, setDrag] = useState(false)
  const from = useRef<{ x: number; turn: number } | null>(null)

  const { art, faces } = folds
  const WIDE = (faces.front.w + faces.back.w) / 2
  const DEEP = (faces.endL.w + faces.endR.w) / 2
  const TALL = art.bottom - art.top

  // Sized to its container, so a phone gets a smaller box, not a clipped one.
  useEffect(() => {
    const el = wrap.current; if (!el) return
    const fit = () => setPx(Math.max(150, Math.min(260, el.clientWidth * 0.34)))
    fit()
    const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // It arrives turning, so the first thing it does is show it is a solid.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTurn(settleAt); return }
    const id = setTimeout(() => setTurn(settleAt), 350)
    return () => clearTimeout(id)
  }, [settleAt])

  const k = px / WIDE
  const W = WIDE * k, D = DEEP * k, H = TALL * k

  // One face: its slice of the artwork, stretched to the box's width for it.
  const face = (f: { x: number; w: number }, width: number, transform: string, shade: number, extra?: ReactNode) => {
    const sx = width / f.w
    const size = `${art.w * sx}px ${art.h * k}px`, pos = `${-f.x * sx}px ${-art.top * k}px`
    return (
      <div className="sb-face" style={{
        width, height: H, marginLeft: -width / 2, marginTop: -H / 2, transform,
        backgroundImage: `url(${url})`,
        backgroundSize: size, backgroundPosition: pos,
      }}>
        {shade > 0 && <span className="sb-shade" style={{
          opacity: shade,
          WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`,
          WebkitMaskSize: size, maskSize: size, WebkitMaskPosition: pos, maskPosition: pos,
          WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        }} />}
        {extra}
      </div>
    )
  }

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    from.current = { x: e.clientX, turn }; setDrag(true)
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const f = from.current; if (!f) return
    setTurn(f.turn + (e.clientX - f.x) * 0.5)
  }
  const up = () => { from.current = null; setDrag(false) }
  // Buttons go the short way round from wherever it is now.
  const go = (to: number) => setTurn(cur => cur + ((((to - cur) % 360) + 540) % 360) - 180)

  return (
    <div className="sb" ref={wrap}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`sb-stage${drag ? ' is-drag' : ''}`} onPointerDown={down} onPointerMove={move}
           onPointerUp={up} onPointerCancel={up}
           role="img" aria-label={label}
           style={{ height: H + 110 }}>
        <div className="sb-floor" style={{ width: W * 1.5, height: D * 0.9, marginLeft: -W * 0.75, top: `calc(50% + ${H / 2 - D * 0.45 + 10}px)` }} />
        <div className="sb-box" style={{ transform: `rotateX(-14deg) rotateY(${turn}deg)` }}>
          {face(faces.front, W, `translateZ(${D / 2}px)`, 0)}
          {face(faces.endR, D, `rotateY(90deg) translateZ(${W / 2}px)`, 0.22)}
          {face(faces.back, W, `rotateY(180deg) translateZ(${D / 2}px)`, 0.08, onBack)}
          {face(faces.endL, D, `rotateY(-90deg) translateZ(${W / 2}px)`, 0.3)}
        </div>
      </div>
      <div className="sb-turns">
        {turns.map(b => (
          <button key={b.label} onClick={() => go(b.to)} className={b.gold ? 'is-gold' : undefined}>{b.label}</button>
        ))}
        <span>{hint}</span>
      </div>
    </div>
  )
}

const CSS = `
.sb-stage { position: relative; perspective: 1400px; cursor: grab; touch-action: pan-y; user-select: none;
            background: radial-gradient(ellipse at 50% 60%, rgba(229,212,194,.07), rgba(229,212,194,0) 62%); }
.sb-stage.is-drag { cursor: grabbing; }
.sb-box { position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform-style: preserve-3d;
          transition: transform 1.3s cubic-bezier(.2,.8,.2,1); }
.sb-stage.is-drag .sb-box { transition: none; }
.sb-face { position: absolute; left: 0; top: 0; background-repeat: no-repeat; backface-visibility: hidden;
           -webkit-backface-visibility: hidden; }
/* Light from the front-left: the ends sit in a little shade, so the box reads
   as a solid and not as four pictures standing in a square. The shade is
   masked by the face's own artwork (set inline), so the sloping tops stay
   transparent instead of turning into black corners. */
.sb-shade { position: absolute; inset: 0; background: #000; pointer-events: none; }
.sb-logo { position: absolute; object-fit: contain; pointer-events: none; }
.sb-floor { position: absolute; left: 50%; border-radius: 50%; pointer-events: none;
            background: radial-gradient(ellipse, rgba(0,0,0,.55), rgba(0,0,0,0) 70%); }
.sb-turns { display: flex; flex-wrap: wrap; gap: 8px 22px; align-items: baseline; margin-top: 8px; }
.sb-turns button { background: none; border: none; padding: 2px 0; cursor: pointer; font-family: ${MONO};
                   font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: rgba(229,212,194,.6);
                   border-bottom: 1px solid transparent; }
.sb-turns button:hover { color: #E5D4C2; border-bottom-color: rgba(229,212,194,.4); }
.sb-turns button.is-gold { color: ${GOLD}; }
.sb-turns span { font-family: ${MONO}; font-size: 11px; color: rgba(229,212,194,.4); }
@media (prefers-reduced-motion: reduce) { .sb-box { transition: none; } }
`
```
