// THE SPIRITS EMBASSY — the only place its brand is defined.
//
// Built 2026-10-27 for an event the same night. The TSE brand toolkit does not
// exist yet (project_spirits_embassy: "brand toolkit is the critical path"),
// and there is no Spirits Embassy logo file anywhere in public/. So the page
// ships with a typographic wordmark, and every brand decision it makes lives
// here as one constant.
//
// ── TO DROP IN THE REAL LOGO ───────────────────────────────────────────────
// Put the file in public/images/brand/ and set LOGO_SRC to its path, e.g.
//   export const LOGO_SRC = '/images/brand/tse-embassy-1080.webp'
// The masthead swaps from the wordmark to the image with no other change. A
// wide landscape lockup works best; it renders at 44px tall on a tablet.
export const LOGO_SRC: string | null = null

// ── THE BLUE ───────────────────────────────────────────────────────────────
// Chosen, not specified: no toolkit exists to take it from. Deep diplomatic
// navy for the ground, a pale crisp blue as the accent, so the page reads as
// an embassy rather than a bar. Replace these three values when the toolkit
// lands and the whole page follows.
export const NAVY   = '#0B2239'   // ground
export const BLUE   = '#7FB2D9'   // accent — headings, figures, rules
export const INK    = '#E8EEF4'   // body text on navy
export const MUTED  = '#8FA5BC'   // labels, meta
export const LINE   = 'rgba(127,178,217,0.22)'

export const SERIF = "'Rampant Sans', Georgia, serif"
export const MONO  = "'Google Sans Code', 'DM Mono', monospace"

// ── THE TEN ────────────────────────────────────────────────────────────────
// Only ten of the twenty casks are offered through the Embassy. Owner's list,
// 2026-10-27. Order is HIS order, not the board's display_order — the page
// shows them as he wrote them.
//
// Verified against the live tet_cask_board the same day: all ten present, all
// status 'available'.
export const EMBASSY_CASKS = [
  'Q5364', // Auchentoshan      Lowland  14yo  55.7%
  'Q5088', // Burnside          Speyside 27yo  49.9%
  'Q5134', // Teaninich         Highland  8yo  55.9%
  'Q5423', // Invergordon       Highland 15yo  55%
  'Q5177', // Aultmore          Speyside 11yo  55.1%
  'Q5430', // Miltonduff        Speyside 15yo  56%
  'Q5057', // Tullibardine      Highland 13yo  55.3%
  'Q5113', // Craigellachie     Speyside 15yo  55.5%
  'Q5439', // Islay Single Malt  Islay   16yo  54.9%
  'Q5358', // North British     Lowland  15yo  55.5%
] as const
