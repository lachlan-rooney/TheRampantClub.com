#!/usr/bin/env node
/**
 * THE STUDIO GALLERY GUIDE — the QR code for the printed booklet.
 *
 *   node scripts/studio-qr.mjs                            → the current-exhibition code
 *   node scripts/studio-qr.mjs rizal-fathoni              → that exhibition's permalink too
 *   node scripts/studio-qr.mjs rizal-fathoni --colour=#7a3e3d
 *                                                         → the same codes in a brand colour
 *
 * Writes into public/images/studio/:
 *   qr-studio-guide.svg          vector, for the booklet layout — scales to any size
 *   qr-studio-guide.png          2048px, for anything that will not take an SVG
 *   qr-studio-guide-<hex>.svg    the coloured cut, white ground  }  only with
 *   qr-studio-guide-<hex>.png    the coloured cut, white ground  }  --colour
 *   qr-studio-guide-<hex>-clear.svg  coloured modules, NO ground — for placing
 *                                    on a pale brand panel in a layout tool
 *
 * ⚠ THE COLOURED FILES ARE WRITTEN UNDER THEIR OWN NAMES, never over the
 *   near-black pair. verify-studio-guide.mjs compares the booklet asset's
 *   modules byte for byte against a fresh #111111 encode; overwriting it with
 *   a coloured file would fail that harness for the wrong reason, and the
 *   plain pair is still the right thing for an unbranded print.
 *
 * ── IT POINTS AT /studio/guide, NOT AT A SLUG ─────────────────────────────
 * The booklet is printed once; the exhibition changes every quarter.
 * /studio/guide resolves to whichever show is live, so the printed code
 * survives the next hang. Pass a slug only if you want a dated code for one
 * exhibition — a catalogue, say, rather than the room's booklet.
 *
 * ── COLOUR, AND THE ONE NUMBER THAT DECIDES IT ────────────────────────────
 * A scanner does not read hue, it reads the step between light and dark. The
 * threshold everyone quotes is about 3:1; print wants more headroom than that
 * because paper reflects whatever light is in the room and a gallery is lit for
 * paintings. So this script REFUSES a colour under 4.5:1 against its ground and
 * prints the measured ratio for the ones it accepts, rather than leaving it to
 * look right on a backlit screen. #7a3e3d on white measures 8.1:1.
 *
 * ⚠ `fill` PAINTS NOTHING HERE. The qrcode SVG renderer draws the modules as a
 *   single STROKED path, which is how a code once shipped perfectly sized and
 *   perfectly invisible. The colour therefore goes in through the library's
 *   own `color.dark`, and the checker below asserts the stroke attribute.
 *
 * ── THE SETTINGS, AND WHY EACH ONE ────────────────────────────────────────
 * errorCorrectionLevel 'H'  ~30% recoverable: a thumbprint, a fold through the
 *                           booklet's gutter, or a scuff from a side table.
 * margin 2                  THE QUIET ZONE. Printed codes fail more often from
 *                           a missing margin than from size — a scanner cannot
 *                           find the code's edge if the layout butts type
 *                           against it. Two modules is the spec minimum; the
 *                           SVG carries it so the layout cannot crop it off.
 * width 2048                ~2.5cm at 2048dpi, far beyond need, so the PNG is
 *                           never the limiting factor if the SVG is refused.
 *
 * ⚠ VERIFY BY PRINTING IT AND SCANNING THE PAPER. scripts/verify-studio-guide
 *   reads the modules back and proves the code decodes to the exact URL, which
 *   is necessary and NOT sufficient: it proves the encoding, not that ink on
 *   that stock under that light scans. Print the booklet page and scan it.
 *
 * Size it at 2.5–4cm in the layout. Vector scales freely; below about 2cm the
 * modules of a version-3 code get close to the resolution of cheap printing.
 */
import { mkdir, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import QRCode from 'qrcode'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public/images/studio')
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'

const BASE = { errorCorrectionLevel: 'H', margin: 2 }
const INK = '#111111'
const GROUND = '#FFFFFF'

// ── CONTRAST, MEASURED ────────────────────────────────────────────────────
// WCAG relative luminance. Not because a QR code has to pass WCAG, but because
// it is the one contrast formula with an agreed definition, so "8.1:1" means
// the same thing to me, to the printer and to the next person reading this.
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

async function write(name, url, ink, ground) {
  const colour = { dark: ink, light: ground }
  const svg = await QRCode.toString(url, { ...BASE, type: 'svg', color: colour })
  // The assertion, not the assumption: the modules must have come out as a
  // stroke in the colour asked for, or the file is a blank square.
  if (!svg.includes(`stroke="${ink}"`)) throw new Error(`${name}: modules are not stroked in ${ink}`)
  await writeFile(resolve(OUT, `${name}.svg`), svg)
  await QRCode.toFile(resolve(OUT, `${name}.png`), url, { ...BASE, width: 2048, color: colour })
  console.log(`  ${name}.svg + ${name}.png   ${ink} on ${ground}  ${ratio(ink, ground).toFixed(2)}:1  →  ${url}`)
}

// The same modules with the white ground removed, for dropping onto a pale
// brand panel in a layout tool. SVG only: a transparent PNG laid over a dark
// panel is an unscannable code that still looks like one.
async function writeClear(name, url, ink) {
  const svg = await QRCode.toString(url, { ...BASE, type: 'svg', color: { dark: ink, light: '#0000' } })
  const stripped = svg.replace(/<path fill="#0000"[^/]*\/>/, '')
  if (stripped.includes('fill="#0000"')) throw new Error(`${name}: could not remove the ground`)
  await writeFile(resolve(OUT, `${name}.svg`), stripped)
  console.log(`  ${name}.svg                 ${ink}, no ground — place it on a PALE panel only`)
}

await mkdir(OUT, { recursive: true })
const args = process.argv.slice(2)
const colourArg = args.find((a) => a.startsWith('--colour=') || a.startsWith('--color='))
const slug = args.find((a) => !a.startsWith('--'))
const ink = colourArg ? colourArg.split('=')[1].trim().toLowerCase() : null

if (ink) {
  if (!/^#[0-9a-f]{6}$/.test(ink)) throw new Error(`--colour needs a 6-digit hex, got "${ink}"`)
  const r = ratio(ink, GROUND)
  if (r < 4.5) throw new Error(
    `${ink} measures only ${r.toFixed(2)}:1 against white. Too pale to scan off paper reliably — ` +
    `darken it, or keep the near-black code and frame it in the brand colour instead.`)
}

console.log('The Studio — gallery guide QR:')
await write('qr-studio-guide', `${SITE}/studio/guide`, INK, GROUND)
if (slug) await write(`qr-studio-${slug}`, `${SITE}/studio/${slug}/guide`, INK, GROUND)

if (ink) {
  const tag = ink.slice(1)
  console.log(`\n  in ${ink}:`)
  await write(`qr-studio-guide-${tag}`, `${SITE}/studio/guide`, ink, GROUND)
  await writeClear(`qr-studio-guide-${tag}-clear`, `${SITE}/studio/guide`, ink)
  if (slug) {
    await write(`qr-studio-${slug}-${tag}`, `${SITE}/studio/${slug}/guide`, ink, GROUND)
    await writeClear(`qr-studio-${slug}-${tag}-clear`, `${SITE}/studio/${slug}/guide`, ink)
  }
}

console.log('\n  Place the SVG in the booklet at 2.5–4cm. Keep the white margin — do not crop to the modules.')
console.log('  Then PRINT IT AND SCAN THE PAPER. A screen test proves nothing about ink.')
