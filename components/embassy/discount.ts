// VU LE & BUDDIES — 10% off, shown on the Tết cask board.
//
// Owner, 2026-11-06: it must appear automatically and be unmistakable, so a
// buyer can see what they will actually pay without asking anybody.
//
// ── IT IS DISPLAY ONLY ────────────────────────────────────────────────────
// Nothing here changes a quote, a reservation or anything the database holds.
// tet_quote_cask still prices from Duncan Taylor's list and the versioned cost
// model; this is the same figure with a named discount shown beside it, so the
// page and the eventual invoice agree about what the list price was.
//
// ⚠ ONE PLACE. The rate, the name and the maths live here so a change is one
//   line and cannot leave the page quoting two different numbers.

export const VU_LE = {
  /** 10%. A fraction, never a percentage — the arithmetic below is the only
   *  place it is applied. */
  rate: 0.10,
  name_en: 'Vu Le & Buddies',
  name_vn: 'Vu Le & Buddies',
} as const

export const vuLePct = Math.round(VU_LE.rate * 100)

/** The discounted figure, rounded to whole dong. Null in, null out — a cask
 *  with no quoted price must not acquire one here. */
export function vuLePrice(listVnd: number | null | undefined): number | null {
  if (typeof listVnd !== 'number' || !Number.isFinite(listVnd)) return null
  return Math.round(listVnd * (1 - VU_LE.rate))
}

/** What they save. Shown because a saving is more persuasive than a price. */
export function vuLeSaving(listVnd: number | null | undefined): number | null {
  if (typeof listVnd !== 'number' || !Number.isFinite(listVnd)) return null
  return Math.round(listVnd * VU_LE.rate)
}
