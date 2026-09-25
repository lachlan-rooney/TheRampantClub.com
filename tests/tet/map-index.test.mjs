// ═══════════════════════════════════════════════════════════════════════════
// THE MAP'S INDEX — it holds still, and a row is a way in.
//   node tests/tet/map-index.test.mjs              (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: "theres also a weird glitch when hovering between the
// distilleries on the scotland map description bit on the side. You should be
// able to click those then it takes you to the cask below."
//
// THE GLITCH WAS A FEEDBACK LOOP. Crossing the gap between two rows cleared
// the hover for an instant; the side card vanished; the index jumped 114px up
// to fill the space; the pointer was then over a DIFFERENT row, which brought
// the card back and pushed everything down again. The fix is a slot that
// keeps its height whether or not anything is in it, so the first check here
// hovers each row AND the gap above it, and insists nothing moves.
//
// It reads only, and mints its own Tết pass.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const ORIGIN = 'http://localhost:3001'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const exp = String(Date.now() + 864e5)
const pass = `${exp}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')}`

let ok = 0, bad = 0
const t = (c, m, d = '') => { c ? ok++ : bad++; console.log(`${c ? '✓' : '✗'} ${m}${!c && d ? ' — ' + d : ''}`) }

const b = await chromium.launch()
try {
  for (const w of [1440, 1280, 1024]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 1000 } })
    await ctx.addCookies([{ name: 'trc_tet', value: pass, domain: 'localhost', path: '/' }])
    const p = await ctx.newPage()
    await p.goto(`${ORIGIN}/tet`, { waitUntil: 'networkidle', timeout: 180000 })
    await p.waitForTimeout(2800)
    await p.locator('.cm').scrollIntoViewIfNeeded()
    await p.waitForTimeout(500)

    // Layout, not viewport: where the index sits inside its own column, which
    // does not care how far the page has been scrolled.
    const read = () => p.evaluate(() => {
      const l = document.querySelector('.cm-list'), s = document.querySelector('.cm-side')
      return Math.round(l.getBoundingClientRect().top - s.getBoundingClientRect().top)
    })
    const seen = new Set([await read()])
    const rows = p.locator('.cm-row')
    const n = Math.min(await rows.count(), 13)
    for (let i = 0; i < n; i++) {
      const box = await rows.nth(i).boundingBox(); if (!box) continue
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await p.waitForTimeout(160); seen.add(await read())
      await p.mouse.move(box.x + box.width / 2, box.y - 3)   // the gap that caused it
      await p.waitForTimeout(120); seen.add(await read())
    }
    t(seen.size === 1, `at ${w}px the index holds still, hovered or not`, [...seen].join(','))
    await ctx.close()
  }

  // ── A ROW TAKES YOU TO THE CASK ───────────────────────────────────────────
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } })
  await ctx.addCookies([{ name: 'trc_tet', value: pass, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message.slice(0, 90)))
  await p.goto(`${ORIGIN}/tet`, { waitUntil: 'networkidle', timeout: 180000 })
  await p.waitForTimeout(2800)
  await p.locator('.cm').scrollIntoViewIfNeeded()
  const row = p.locator('.cm-row').first()
  const title = (await row.getAttribute('title')) || ''
  const ref = title.match(/Q\d{4}/)?.[0]
  t(!!ref, 'a row says which cask it will open', title)
  await row.click()
  await p.waitForTimeout(1500)
  t(await p.locator(`#cask-${ref}.is-open`).count() === 1, `clicking it opens ${ref} in the list below`)
  const box = await p.locator(`#cask-${ref}`).boundingBox()
  t(!!box && box.y > -100 && box.y < 1100, 'and brings it into view', String(box && Math.round(box.y)))
  t(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '))
} finally {
  await b.close()
}

console.log(`\n${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
