// ═══════════════════════════════════════════════════════════════════════════
// TẾT PAGE — the sleeve studio, the header photograph and the foot, in a real
// browser past the password.   (dev server on :3001)
//   node tests/tet/sleeve-ui.test.mjs
// Uses /tmp/test-logo.png if present, else makes one with a transparent ground.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import sharp from 'sharp'
const env = {}; for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const exp = String(Date.now() + 864e5); process.env.TETPASS = exp + '.' + createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')
if (!existsSync('/tmp/test-logo.png')) await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="360"><text x="450" y="230" font-family="Georgia" font-size="190" font-weight="bold" fill="#F4E3B0" text-anchor="middle">ACME</text></svg>')).png().toFile('/tmp/test-logo.png')
const SLEEVE = { w: 6431, h: 2387 }, CLEAR = { x: 4820, y: 998, w: 1195, h: 848 }, FRAME = { x: 4792, y: 673, w: 1580, h: 1633 }
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } })
await ctx.addCookies([{ name: 'trc_tet', value: process.env.TETPASS, domain: 'localhost', path: '/' }])
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })
let pass = 0, fail = 0; const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }
await p.goto('http://localhost:3001/tet', { waitUntil: 'networkidle', timeout: 90000 })

const head = await p.evaluate(() => { const i = document.querySelector('img[src*="octave-fire"]'); if (!i) return null; const r = i.getBoundingClientRect(); return { nat: i.naturalWidth + 'x' + i.naturalHeight, ratio: +(r.width / r.height).toFixed(3) } })
t(!!head && Math.abs(head.ratio - 800 / 1201) < 0.01, 'header shows the portrait Octave at its own 2:3', JSON.stringify(head))
t(await p.locator('img[src*="dt-crest"]').first().evaluate(i => i.closest('.tp-over') !== null).catch(() => false), 'the crest is no longer in the header — it is in the overlay')

// the studio
const art = p.locator('.ss-art'); await art.scrollIntoViewIfNeeded(); await p.waitForTimeout(800)
const artBox = await art.boundingBox()
t(Math.abs(artBox.width / artBox.height - SLEEVE.w / SLEEVE.h) < 0.01, 'the sleeve is drawn at its true proportions', (artBox.width / artBox.height).toFixed(3))
t(await p.locator('.ss-slot').isVisible(), '"Your logo here" sits on the blank face before a logo is added')
await p.setInputFiles('.ss-controls input[type=file]', '/tmp/test-logo.png'); await p.waitForTimeout(800)
const k = artBox.width / SLEEVE.w
const lb = async () => { const r = await p.locator('.ss-logo').boundingBox(); return { x: (r.x - artBox.x) / k, y: (r.y - artBox.y) / k, w: r.width / k, h: r.height / k } }
let L = await lb()
t(L.x >= CLEAR.x - 2 && L.x + L.w <= CLEAR.x + CLEAR.w + 2 && L.y >= CLEAR.y - 2 && L.y + L.h <= CLEAR.y + CLEAR.h + 2, 'the uploaded logo lands inside the clear red between the swirls', JSON.stringify(Object.fromEntries(Object.entries(L).map(([a, v]) => [a, Math.round(v)]))))
await p.screenshot({ path: '/tmp/s-fit.png', clip: { x: artBox.x, y: artBox.y - 10, width: artBox.width, height: artBox.height + 20 } })
// drag far to the right and down: must stay inside the gold frame
const lr = await p.locator('.ss-logo').boundingBox()
await p.mouse.move(lr.x + lr.width / 2, lr.y + lr.height / 2); await p.mouse.down(); await p.mouse.move(lr.x + 900, lr.y + 900, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(300)
L = await lb()
t(L.x + L.w <= FRAME.x + FRAME.w + 2 && L.y + L.h <= FRAME.y + FRAME.h + 2 && L.x > CLEAR.x, 'dragging moves it, and it cannot leave the blank face\'s gold frame', `right ${Math.round(L.x + L.w)} ≤ ${FRAME.x + FRAME.w}, bottom ${Math.round(L.y + L.h)} ≤ ${FRAME.y + FRAME.h}`)
await p.click('text=Centre it'); await p.waitForTimeout(200)
const w0 = (await lb()).w; await p.locator('.ss-range').fill('40'); await p.waitForTimeout(200); const w1 = (await lb()).w
t(w1 < w0 * 0.6, 'the size slider shrinks it', `${Math.round(w0)} → ${Math.round(w1)} artwork px`)
await p.locator('.ss-range').fill('80')
// actual size
await p.click('text=Actual size'); await p.waitForTimeout(2500)
const act = await p.evaluate(() => { const v = document.querySelector('.ss-view'), i = document.querySelector('.ss-art'); return { nat: i.naturalWidth, drawn: Math.round(i.getBoundingClientRect().width), left: Math.round(v.scrollLeft), vw: v.clientWidth } })
t(act.nat === 6431 && act.drawn === 6431, 'Actual size draws the full 6431 px artwork one-to-one', JSON.stringify(act))
t(act.left > 4000, 'and opens scrolled to the blank face, not the end flap', `scrollLeft ${act.left}`)
const vb = await p.locator('.ss-view').boundingBox(); await p.screenshot({ path: '/tmp/s-actual.png', clip: { x: vb.x, y: vb.y, width: vb.width, height: Math.min(vb.height, 800) } })
await p.click('text=Whole sleeve'); await p.waitForTimeout(600)
// send with an enquiry → the face preview carries the logo
await p.click('text=Send this design with an enquiry'); await p.waitForTimeout(1200)
t(await p.locator('text=Your sleeve comes with this enquiry').isVisible(), 'the enquiry opens with the sleeve attached')
const thumb = await p.evaluate(() => { const el = [...document.querySelectorAll('img')].filter(i => i.src.startsWith('blob:')); return el.length })
t(thumb >= 2, 'its preview shows the logo on the face', `${thumb} logo images`)
const sheet = await p.locator('text=Your sleeve comes with this enquiry').boundingBox(); await p.screenshot({ path: '/tmp/s-enquiry.png', clip: { x: Math.max(0, sheet.x - 130), y: sheet.y - 40, width: 620, height: 150 } })
await p.keyboard.press('Escape'); await p.goto('http://localhost:3001/tet', { waitUntil: 'networkidle' })
// the foot of the page
const over = p.locator('.tp-over'); await over.scrollIntoViewIfNeeded(); await p.waitForTimeout(1600)
const ov = await over.evaluate(el => ({ text: el.textContent.trim(), crest: Math.round(el.querySelector('img').getBoundingClientRect().width), font: getComputedStyle(el.querySelector('span')).fontFamily }))
t(/brought to you by/i.test(ov.text) && /Rampant Sans/.test(ov.font), '"brought to you by" in Rampant Sans over the last photograph', JSON.stringify(ov))
t(ov.crest > 40 && ov.crest < 110, 'the crest beside it is small, not stretched to the photo', `${ov.crest}px wide`)
const pr = await p.locator('.tp', { has: over }).boundingBox(); await p.screenshot({ path: '/tmp/s-foot.png', clip: { x: pr.x, y: pr.y, width: pr.width, height: pr.height } })
t(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '))
console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0)
