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

/** True while the number comes from the swatch rather than from a lab. */
export const EBC_IS_ESTIMATED = true

/** The published SRM ladder, 1–40, as the reference charts print it. The index
 *  is the SRM value, so SRM_SWATCH[17] is SRM 17. */
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
  /** SRM, 1–40. */
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
  const rungs = Object.keys(SRM_SWATCH)
    .map(k => ({ srm: Number(k), L: lab(rgb(SRM_SWATCH[Number(k)])!)[0] }))
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
  srm = Math.min(40, Math.max(1, Math.round(srm)))
  return { srm, ebc: Math.round(srm * 1.97), swatch: SRM_SWATCH[srm] }
}
