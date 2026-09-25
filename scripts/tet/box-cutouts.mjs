// ═══════════════════════════════════════════════════════════════════════════
// THE DESIGN COMPANY'S BOX COVERS → cut out, measured, and put in the repo.
//   node scripts/tet/box-cutouts.mjs [--dir "<folder>"]
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: twelve new cover designs from the design company, to be
// background-removed and shown on the Tết page as foldable boxes.
//
// THE BACKGROUND IS REMOVED BY FLOOD FILL FROM THE EDGES, never by "delete
// everything white". Half of what is inside these covers IS white or cream —
// the warning panel, the text, the lettering in the illustrations — and a
// whiteness threshold applied to the whole image punches holes through all of
// it. The fill starts at the border, so it only ever reaches white that the
// artwork does not enclose.
//
// EDGES ARE FEATHERED, not cut square. A JPEG's edge pixels are a blend of red
// and white; keeping them opaque leaves a white halo, and cutting them out
// leaves a jagged line. Each removed pixel's neighbours get an alpha taken
// from how white they are, which is what the eye reads as a clean edge.
//
// IT MEASURES WHAT IT CUT. The folds of a sleeve are its own geometry, and
// guessing them would draw a box that does not exist — so for every cover this
// records the outline's shoulders (where the house-shaped top steps down) and
// the vertical rules inside the artwork, and writes them to
// lib/tet/box-measurements.json for the page to fold along.
//
// It reads the source folder and writes ONLY inside this project.
// ═══════════════════════════════════════════════════════════════════════════
import sharp from 'sharp'
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1]
  : '/Users/lachlanrooney/Downloads/HÌNH COVER HỘP RƯỢU cty thiet ke'
const OUT = 'public/images/tet/boxes'
const DATA = 'lib/tet/box-measurements.json'

/** Near-white enough to be the paper behind the artwork. */
const isPaper = (r, g, b) => r > 236 && g > 236 && b > 236

/** A slug that survives Vietnamese filenames and a URL. */
const slugOf = name => name
  .replace(/\.jpe?g$/i, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function cutout(file) {
  const src = join(SRC, file)
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info
  const at = (x, y) => (y * W + x) * C

  // ── FLOOD FILL FROM THE BORDER ─────────────────────────────────────────
  const outside = new Uint8Array(W * H)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = y * W + x
    if (outside[i]) return
    const p = at(x, y)
    if (!isPaper(data[p], data[p + 1], data[p + 2])) return
    outside[i] = 1
    stack.push(x, y)
  }
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1) }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y) }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop()
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }

  // ── ALPHA, WITH A FEATHERED EDGE ───────────────────────────────────────
  // Anything the fill reached goes. A pixel the fill did NOT reach but which
  // touches one it did is a blend: how far it is from paper becomes its alpha.
  let kept = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = at(x, y)
      if (outside[i]) { data[p + 3] = 0; continue }
      kept++
      const touchesOutside =
        (x > 0 && outside[i - 1]) || (x < W - 1 && outside[i + 1]) ||
        (y > 0 && outside[i - W]) || (y < H - 1 && outside[i + W])
      if (!touchesOutside) continue
      const light = Math.min(data[p], data[p + 1], data[p + 2])
      // 236 is paper, 200 and below is artwork: in between, fade.
      data[p + 3] = light >= 236 ? 0 : light <= 200 ? 255 : Math.round(255 * (236 - light) / 36)
    }
  }

  // ── WHAT SHAPE IS IT? ──────────────────────────────────────────────────
  // The top edge of the artwork, column by column — the house shape's
  // shoulders are the columns where it steps, and they are fold lines.
  const topOf = []
  for (let x = 0; x < W; x++) {
    let y = 0
    while (y < H && outside[y * W + x]) y++
    topOf.push(y >= H ? null : y)
  }
  const shoulders = []
  for (let x = 1; x < W; x++) {
    const a = topOf[x - 1], b = topOf[x]
    if (a == null || b == null) continue
    if (Math.abs(b - a) >= 6) shoulders.push({ x, from: a, to: b })   // a step, not a slope
  }
  // Where the outline stops sloping and runs flat is also a fold: the peak.
  const solid = topOf.map((t, x) => (t == null ? null : { x, t })).filter(Boolean)
  const left = solid[0]?.x ?? 0, right = solid[solid.length - 1]?.x ?? W - 1
  const peakY = Math.min(...solid.map(s => s.t))
  const peakRun = solid.filter(s => s.t <= peakY + 2)
  const bbox = { x: left, y: peakY, w: right - left + 1, h: H }

  return { data, W, H, C, kept, shoulders, bbox, peak: { y: peakY, from: peakRun[0]?.x, to: peakRun[peakRun.length - 1]?.x } }
}

mkdirSync(OUT, { recursive: true })
const files = readdirSync(SRC).filter(f => /\.jpe?g$/i.test(f)).sort()
const measured = []

for (const file of files) {
  const r = await cutout(file)
  const slug = slugOf(file)
  const png = await sharp(Buffer.from(r.data), { raw: { width: r.W, height: r.H, channels: r.C } }).png().toBuffer()
  for (const w of [3200, 1600, 640]) {
    await sharp(png).resize({ width: w }).webp({ quality: w > 2000 ? 88 : 90, alphaQuality: 100 })
      .toFile(join(OUT, `${slug}-${w}.webp`))
  }
  measured.push({
    slug, file, w: r.W, h: r.H,
    transparent_pct: Math.round((1 - r.kept / (r.W * r.H)) * 100),
    bbox: r.bbox, peak: r.peak,
    shoulders: r.shoulders.map(s => s.x),
  })
  console.log(`${slug.padEnd(22)} ${r.W}x${r.H}  background ${measured.at(-1).transparent_pct}%  shoulders ${r.shoulders.map(s => s.x).join(',') || '—'}  peak ${r.peak.from}–${r.peak.to}`)
}

writeFileSync(DATA, JSON.stringify(measured, null, 2) + '\n')
console.log(`\n${measured.length} covers → ${OUT}, measurements → ${DATA}`)
