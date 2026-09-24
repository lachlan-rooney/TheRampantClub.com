// ═══════════════════════════════════════════════════════════════════════════
// WHERE EACH DISTILLERY IS — for the map on the Tết page.
// ───────────────────────────────────────────────────────────────────────────
// The map used to carry one pin per REGION, at the centroid the club's whisky
// atlas uses. That answers "how many Speyside casks" and not "where is this
// whisky from", which is the question a buyer looking at a named distillery
// actually has.
//
// EVERY COORDINATE HERE CAME OFF WIKIDATA (P625, coordinate location), not
// out of my head, and each row says where it came from. Two of the twenty
// casks cannot be placed at a distillery at all, and they say so rather than
// being quietly dropped on a plausible spot:
//
//   Burnside            a Speyside blended malt sold under a trade name. Which
//                       distillery it comes from is not disclosed on Duncan
//                       Taylor's paperwork, so it is not guessed here.
//   Islay Single Malt   an undisclosed Islay, by definition.
//
// Those two fall back to their region, and the map labels them as undisclosed.
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
  'Aultmore':      { lat: 57.5681, lng: -3.0011, source: 'Wikidata Q4821838' },
  'Craigellachie': { lat: 57.4885, lng: -3.1846, source: 'Wikidata Q1138727' },
  'Girvan':        { lat: 55.2609, lng: -4.8336, source: 'Wikidata Q1527141' },
  'Invergordon':   { lat: 57.6972, lng: -4.1587, source: 'Wikidata Q1671709' },
  'Miltonduff':    { lat: 57.6237, lng: -3.3702, source: 'Wikidata Q1526981' },
  'North British': { lat: 55.9404, lng: -3.2350, source: 'Wikidata Q1432194' },
  'Tamnavulin':    { lat: 57.3175, lng: -3.3081, source: 'Wikidata Q1474840' },
  'Teaninich':     { lat: 57.6917, lng: -4.2605, source: 'Wikidata (Teaninich distillery)' },
  'Tullibardine':  { lat: 56.2578, lng: -3.7856, source: 'Wikidata (Tullibardine distillery)' },
  // The distillery has no coordinate on Wikidata; this is the village it is in.
  'Glenrothes':    { lat: 57.5298, lng: -3.2140, source: 'Rothes, Moray (Wikidata) — the village, not the distillery', approximate: true },
}

/** The two that cannot honestly be pinned, and why. */
export const UNDISCLOSED: Record<string, [string, string]> = {
  'Burnside': ['a Speyside blended malt — the distillery is not disclosed',
               'rượu blended malt vùng Speyside — nhà chưng cất không được công bố'],
  'Islay Single Malt': ['an undisclosed Islay distillery',
                        'một nhà chưng cất Islay không được công bố'],
}
