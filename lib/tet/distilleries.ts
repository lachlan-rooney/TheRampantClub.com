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
