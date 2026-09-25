// ═══════════════════════════════════════════════════════════════════════════
// THE TWELVE COVERS — cut out, on the page, and folded.
//   node tests/tet/boxes.test.mjs                  (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: the design company's cover options, "background remove,
// then upload as foldable boxes into the tet page".
//
// It checks the three things that could quietly be wrong:
//   · THE CUTOUT — that the background really went and the artwork really
//     stayed. A flood fill that ran away takes the cream warning panel with
//     it, and a fill that never started leaves a white box on a green page.
//     Both are measured here from the pixels, not looked at.
//   · THE FOLDS — four faces, each showing ITS cover's artwork. The folding
//     used to be hard-coded to the sleeve; if it ever goes back to that, the
//     face on the Opera House box will be the Chợ Bến Thành sleeve and this
//     check goes red.
//   · WHAT IS NOT CLAIMED — the three-bottle wrap has no confirmed dieline,
//     so it cannot be folded and says so.
//
// It mints its own Tết pass and writes nothing.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import sharp from 'sharp'

const ORIGIN = 'http://localhost:3001'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const exp = String(Date.now() + 864e5)
const pass = `${exp}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')}`

let ok = 0, bad = 0
const t = (c, m, d = '') => { c ? ok++ : bad++; console.log(`${c ? '✓' : '✗'} ${m}${!c && d ? ' — ' + d : ''}`) }

// ── THE CUTOUTS, MEASURED ────────────────────────────────────────────────
{
  const f = 'public/images/tet/boxes/cover-hop-ruou-01-3200.webp'
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info
  const A = (x, y) => data[(y * W + x) * C + 3]
  t(A(4, 4) === 0 && A(W - 5, 4) === 0, 'the paper around the artwork is gone', `corners ${A(4, 4)}/${A(W - 5, 4)}`)
  // The gable: the top-left corner is outside the shape, the middle is inside.
  t(A(Math.round(W * 0.5), 20) === 255, 'and the gabled top is still there', String(A(Math.round(W * 0.5), 20)))
  // The cream warning panel — a naive "remove white" punches a hole here.
  let creamKept = 0, creamSeen = 0
  for (let y = 380; y < 820; y += 7) {
    for (let x = 180; x < 700; x += 7) {
      const p = (y * W + x) * C
      if (data[p] > 200 && data[p + 1] > 180) { creamSeen++; if (data[p + 3] > 200) creamKept++ }
    }
  }
  t(creamSeen > 50 && creamKept === creamSeen,
    'and every cream pixel inside the artwork survived the fill', `${creamKept} of ${creamSeen}`)
}

const b = await chromium.launch()
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } })
  await ctx.addCookies([{ name: 'trc_tet', value: pass, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message))
  p.on('response', r => { if (r.status() >= 400 && /boxes\//.test(r.url())) errs.push(`${r.status()} ${r.url().slice(-38)}`) })
  await p.goto(`${ORIGIN}/tet`, { waitUntil: 'networkidle', timeout: 180000 })
  await p.waitForTimeout(2800)
  await p.locator('.bg').first().scrollIntoViewIfNeeded()
  await p.waitForTimeout(700)

  const thumbs = await p.$$eval('.bg-thumb', els => els.map(e => e.textContent.trim()))
  t(thumbs.length === 12, 'twelve covers on the page', String(thumbs.length))
  t(/Chợ Bến Thành/.test(thumbs[0]), 'the first is named off its own artwork', thumbs[0])
  t(thumbs.filter(x => /3 bottles/.test(x)).length === 4, 'the three-bottle designs are marked as such',
    String(thumbs.filter(x => /3 bottles/.test(x)).length))

  // Every thumbnail must actually arrive — they are lazy, so walk the strip.
  await p.evaluate(async () => {
    const s = document.querySelector('.bg-strip')
    for (let x = 0; x <= s.scrollWidth; x += 200) { s.scrollLeft = x; await new Promise(r => setTimeout(r, 60)) }
    s.scrollLeft = 0
  })
  await p.waitForTimeout(1200)
  const broken = await p.$$eval('.bg-thumb img', els => els.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src.slice(-34)))
  t(broken.length === 0, 'and every one of them loads', broken.join(' '))

  // ── FOLDED ──────────────────────────────────────────────────────────────
  await p.locator('.bg-toggle', { hasText: /Folded/ }).click()
  await p.waitForTimeout(1800)
  t(await p.locator('.bg .sb-face').count() === 4, 'folding gives four faces')
  const shown = await p.$$eval('.bg .sb-face', els => els.map(e => Math.round(e.getBoundingClientRect().width)))
  t(shown.filter(w => w > 40).length >= 2, 'and it settles turned, so it reads as a solid', shown.join(','))
  const turns = await p.$$eval('.bg .sb-turns button', els => els.map(e => e.textContent.trim()))
  t(turns.length === 4, 'with a button for each face', turns.join(' / '))

  // ── EACH COVER FOLDS ITS OWN ARTWORK ────────────────────────────────────
  for (const slug of ['cover-hop-ruou-07', 'cover-hop-ruou-03']) {
    await p.locator(`.bg-thumb[data-slug="${slug}"]`).click()
    await p.waitForTimeout(500)
    if (await p.locator('.bg-toggle', { hasText: /Folded/ }).getAttribute('aria-selected') !== 'true') {
      await p.locator('.bg-toggle', { hasText: /Folded/ }).click()
    }
    await p.waitForTimeout(1200)
    const img = await p.locator('.bg .sb-face').first().evaluate(e => getComputedStyle(e).backgroundImage)
    t(img.includes(slug), `${slug} folds its own artwork`, img.slice(-56))
  }

  // ── AND THE ONE THAT IS NOT CLAIMED ─────────────────────────────────────
  await p.locator('.bg-thumb[data-slug="cover-combo-3-chai"]').click()
  await p.waitForTimeout(800)
  t(await p.locator('.bg-toggle', { hasText: /Folded/ }).isDisabled(), 'the three-bottle wrap cannot be folded')
  t(/dieline has not been confirmed/i.test(await p.locator('.bg-why').innerText().catch(() => '')),
    'and the page says why rather than leaving a dead button')

  t(errs.length === 0, 'no page errors and no missing art', errs.slice(0, 3).join(' | '))
} finally {
  await b.close()
}

console.log(`\n${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
