#!/usr/bin/env node
/**
 * Tết 2027 — the QR codes for the leaflet.
 *
 *   node scripts/tet-qr.mjs                      → the plain door, /tet
 *   node scripts/tet-qr.mjs "the phrase"         → that, plus an invite QR
 *                                                  which fills the password in
 *
 * Writes SVG (for the printer — it scales to any size without going soft) and
 * PNG at 2048px (for slides, Zalo and anything that will not take an SVG) into
 * public/images/tet/.
 *
 * THE INVITE QR CARRIES THE PASSWORD. That is the point of it — one scan and
 * the buyer only has to confirm their age — but it means the image is the
 * password. Treat a printed invite QR the way you would treat the phrase
 * itself: fine on a leaflet you hand to a client, not fine on a public poster.
 * The plain QR has no password in it and is safe anywhere.
 *
 * Run it again whenever the phrase changes; the files are overwritten.
 */
import { mkdir, writeFile } from 'fs/promises'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import QRCode from 'qrcode'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public/images/tet')
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'

// The club's own colours. Contrast is what a scanner needs, and cream on deep
// green clears the threshold comfortably — checked with a phone, not assumed.
const OPTS = {
  errorCorrectionLevel: 'H',   // survives a logo, a fold, a thumbprint
  margin: 2,
  color: { dark: '#052E20', light: '#E5D4C2' },
}

async function write(name, url) {
  const svg = await QRCode.toString(url, { ...OPTS, type: 'svg' })
  await writeFile(resolve(OUT, `${name}.svg`), svg)
  await QRCode.toFile(resolve(OUT, `${name}.png`), url, { ...OPTS, width: 2048 })
  console.log(`  ${name}.svg + ${name}.png  →  ${url}`)
}

const phrase = process.argv[2]
await mkdir(OUT, { recursive: true })
console.log('Tết 2027 QR codes:')
await write('qr-tet', `${SITE}/tet`)
if (phrase) {
  await write('qr-tet-invite', `${SITE}/tet?k=${encodeURIComponent(phrase)}`)
  console.log('\n  The invite QR contains the password. Hand it to a client; do not poster it.')
} else {
  console.log('\n  No phrase given, so no invite QR. Pass one as an argument to make it:')
  console.log('    node scripts/tet-qr.mjs "your phrase"')
}
