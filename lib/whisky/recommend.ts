// The recommendation engine — member-delight-FIRST. Rank the mapped whiskies by
// flavour-match (RMS) to a target taste vector; among NEAR-EQUAL matches, and
// ONLY where stock is genuinely known, prefer the higher-stocked bottle. Stock
// never overrides match quality, and never tie-breaks on fictional (unmeasured)
// stock. Pure math — no runtime LLM, no per-rec cost.

import { matchWhiskies, type IndexRow, type SetSpokes, type Match } from './flavour-match'

export interface StockInfo { current_fill_pct: number | null; known: boolean }  // known = a real fill reading exists
export interface Rec extends Match { fill_pct: number | null; stock_known: boolean }

const NEAR_EQUAL = 0.15   // RMS distances within this are "equally good" → stock may tie-break

export function recommend(
  target: SetSpokes,
  index: IndexRow[],
  stockById: Map<string, StockInfo>,
  opts: { limit?: number } = {},
): { recs: Rec[]; bestIsClose: boolean } {
  const limit = opts.limit ?? 5
  // Rank ALL mapped whiskies by match (reuse the Finder's primitive), then re-order.
  const { matches, bestIsClose } = matchWhiskies(target, index, index.length)
  const withStock: Rec[] = matches.map(m => {
    const s = stockById.get(m.id)
    return { ...m, fill_pct: s?.current_fill_pct ?? null, stock_known: !!s?.known }
  })
  withStock.sort((a, b) => {
    const ba = Math.round(a.distance / NEAR_EQUAL), bb = Math.round(b.distance / NEAR_EQUAL)
    if (ba !== bb) return ba - bb                                   // better match bucket ALWAYS first (delight-first)
    const sa = a.stock_known ? (a.fill_pct ?? 0) : -1               // within near-equal: prefer KNOWN higher stock
    const sb = b.stock_known ? (b.fill_pct ?? 0) : -1               // unknown stock = neutral (never tie-break on fiction)
    if (sa !== sb) return sb - sa
    return a.distance - b.distance                                  // final: exact match order
  })
  return { recs: withStock.slice(0, limit), bestIsClose }
}
