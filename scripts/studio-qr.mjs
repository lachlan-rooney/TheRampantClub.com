#!/usr/bin/env node
/**
 * THE STUDIO GALLERY GUIDE — the QR code for the printed booklet.
 *
 *   node scripts/studio-qr.mjs                 → the current-exhibition code
 *   node scripts/studio-qr.mjs rizal-fathoni   → that exhibition's permalink too
 *
 * Writes into public/images/studio/:
 *   qr-studio-guide.svg   vector, for the booklet layout — scales to any size
 *   qr-studio-guide.png   2048px, for anything that will not take an SVG
 *
 * ── IT POINTS AT /studio/guide, NOT AT A SLUG ─────────────────────────────
 * The booklet is printed once; the exhibition changes every quarter.
 * /studio/guide resolves to whichever show is live, so the printed code
 * survives the next hang. Pass a slug only if you want a dated code for one
 * exhibition — a catalogue, say, rather than the room's booklet.
 *
 * ── DARK ON LIGHT, AND WHY IT IS NOT THE STUDIO'S SAGE ────────────────────
 * The guide page is sage #B0C18E on ink #052E20 and the booklet can be too.
 * The CODE is not. The embassy's gold-on-dark code measured 8.46:1 and scanned
 * reliably — on a BACKLIT SCREEN, which supplies its own light. Paper does not:
 * it reflects whatever is in the room, and The Studio is a gallery lit for
 * paintings, not for reading. So the modules are near-black on white, the one
 * combination no ink, no paper stock and no ambient light can undermine.
 * Frame it in the Studio's colours by all means — just not the code itself.
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

const OPTS = {
  errorCorrectionLevel: 'H',
  margin: 2,
  color: { dark: '#111111', light: '#FFFFFF' },
}

async function write(name, url) {
  const svg = await QRCode.toString(url, { ...OPTS, type: 'svg' })
  await writeFile(resolve(OUT, `${name}.svg`), svg)
  await QRCode.toFile(resolve(OUT, `${name}.png`), url, { ...OPTS, width: 2048 })
  console.log(`  ${name}.svg + ${name}.png  →  ${url}`)
}

await mkdir(OUT, { recursive: true })
const slug = process.argv[2]
console.log('The Studio — gallery guide QR:')
await write('qr-studio-guide', `${SITE}/studio/guide`)
if (slug) await write(`qr-studio-${slug}`, `${SITE}/studio/${slug}/guide`)
console.log('\n  Place the SVG in the booklet at 2.5–4cm. Keep the white margin — do not crop to the modules.')
console.log('  Then PRINT IT AND SCAN THE PAPER. A screen test proves nothing about ink.')
