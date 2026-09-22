// ═══════════════════════════════════════════════════════════════════════════
// TẾT PAGE — the sleeve studio, the PNG, the cask-end offer, the timeline, the
// header photograph and the foot, in a real
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
const MID = { cx: FRAME.x + FRAME.w / 2, cy: FRAME.y + FRAME.h / 2 }
const off = l => ({ dx: Math.round(l.x + l.w / 2 - MID.cx), dy: Math.round(l.y + l.h / 2 - MID.cy) })
// Tolerance: 6 artwork px is under one screen pixel at this width.
t(Math.abs(off(L).dx) <= 6 && Math.abs(off(L).dy) <= 6, 'the uploaded logo lands centred on the blank face', JSON.stringify(off(L)))
await p.screenshot({ path: '/tmp/s-fit.png', clip: { x: artBox.x, y: artBox.y - 10, width: artBox.width, height: artBox.height + 20 } })
// drag far to the right and down: must stay inside the gold frame
const lr = await p.locator('.ss-logo').boundingBox()
await p.mouse.move(lr.x + lr.width / 2, lr.y + lr.height / 2); await p.mouse.down(); await p.mouse.move(lr.x + 900, lr.y + 900, { steps: 12 }); await p.mouse.up(); await p.waitForTimeout(300)
L = await lb()
t(L.x + L.w <= FRAME.x + FRAME.w + 2 && L.y + L.h <= FRAME.y + FRAME.h + 2 && L.x > CLEAR.x, 'dragging moves it, and it cannot leave the blank face\'s gold frame', `right ${Math.round(L.x + L.w)} ≤ ${FRAME.x + FRAME.w}, bottom ${Math.round(L.y + L.h)} ≤ ${FRAME.y + FRAME.h}`)
await p.click('text=Centre it'); await p.waitForTimeout(200)
// the owner's report: "Centre it is slightly off left of centre" — it was 165 px left
L = await lb(); t(Math.abs(off(L).dx) <= 6 && Math.abs(off(L).dy) <= 6, '"Centre it" puts it in the middle of the face, not left of it', JSON.stringify(off(L)))
const w0 = (await lb()).w; await p.locator('.ss-range').fill('40'); await p.waitForTimeout(200); const w1 = (await lb()).w
t(w1 < w0 * 0.6, 'the size slider shrinks it', `${Math.round(w0)} → ${Math.round(w1)} artwork px`)
await p.locator('.ss-range').fill('80')
t(await p.locator('text=Actual size').count() === 0, 'the Actual size view is gone — whole sleeve only')
// download as PNG: the finished sleeve, logo composited where the page shows it
const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('text=Download as PNG')])
await dl.saveAs('/tmp/s-download.png')
const png = await sharp('/tmp/s-download.png').metadata()
t(png.format === 'png' && png.width === 3200 && Math.abs(png.width / png.height - SLEEVE.w / SLEEVE.h) < 0.01, 'the PNG is the whole sleeve at 3200 px', `${png.format} ${png.width}x${png.height} · ${dl.suggestedFilename()}`)
// Compare it with the bare artwork: the logo region must differ, the rest must not.
L = await lb(); const kk = 3200 / SLEEVE.w
const region = async (src, r) => (await sharp(src).extract(r).removeAlpha().raw().toBuffer())
const diff = async r => { const [x, y] = [await region('/tmp/s-download.png', r), await region('public/images/tet/sleeve-3200.webp', r)]; let d = 0; for (let i = 0; i < x.length; i++) d += Math.abs(x[i] - y[i]); return d / x.length }
const inLogo = await diff({ left: Math.round(L.x * kk), top: Math.round(L.y * kk), width: Math.round(L.w * kk), height: Math.round(L.h * kk) })
const onFront = await diff({ left: 1600, top: 400, width: 600, height: 400 })
t(inLogo > 8 && onFront < 1.5, 'the logo is in the PNG exactly where it sits on the page, and nothing else changed', `mean diff in logo box ${inLogo.toFixed(1)}, elsewhere ${onFront.toFixed(2)}`)
// send with an enquiry → the face preview carries the logo
await p.click('text=Send this design with an enquiry'); await p.waitForTimeout(1200)
t(await p.locator('text=Your sleeve comes with this enquiry').isVisible(), 'the enquiry opens with the sleeve attached')
const thumb = await p.evaluate(() => { const el = [...document.querySelectorAll('img')].filter(i => i.src.startsWith('blob:')); return el.length })
t(thumb >= 2, 'its preview shows the logo on the face', `${thumb} logo images`)
const sheet = await p.locator('text=Your sleeve comes with this enquiry').boundingBox(); await p.screenshot({ path: '/tmp/s-enquiry.png', clip: { x: Math.max(0, sheet.x - 130), y: sheet.y - 40, width: 620, height: 150 } })
await p.keyboard.press('Escape'); await p.goto('http://localhost:3001/tet', { waitUntil: 'networkidle' })
// TWO SLEEVES, AND THE FOLDED BOX
await p.reload({ waitUntil: 'networkidle' })
await p.locator('.ss-sleeves').scrollIntoViewIfNeeded(); await p.waitForTimeout(600)
t(await p.locator('.ss-pick').count() === 2, 'two sleeves to choose from')
await p.locator('.ss-pick').nth(1).click(); await p.waitForTimeout(700)
t((await p.locator('.ss-art').getAttribute('src')).includes('sleeve2'), 'choosing Sleeve 2 shows the dragon artwork')
t(await p.locator('.ss-toggle', { hasText: 'Folded' }).isDisabled(), 'Sleeve 2 cannot be folded until its folds are confirmed')
await p.setInputFiles('.ss-controls input[type=file]', '/tmp/test-logo.png'); await p.waitForTimeout(800)
const art2 = await p.locator('.ss-art').boundingBox(); const k2 = art2.width / SLEEVE.w
const l2 = await p.locator('.ss-logo').boundingBox()
const F2 = { x: 5105, y: 760, w: 1052, h: 930 }
const c2 = { dx: Math.round((l2.x - art2.x + l2.width / 2) / k2 - (F2.x + F2.w / 2)), dy: Math.round((l2.y - art2.y + l2.height / 2) / k2 - (F2.y + F2.h / 2)) }
t(Math.abs(c2.dx) <= 8 && Math.abs(c2.dy) <= 8, 'on Sleeve 2 the logo lands centred in its gold-ruled blank', JSON.stringify(c2))
const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('text=Download as PNG')])
t(/sleeve-2\.png$/.test(dl2.suggestedFilename()), 'Sleeve 2 downloads as its own file', dl2.suggestedFilename())
await p.locator('.ss-pick').nth(0).click(); await p.waitForTimeout(500)
await p.locator('.ss-toggle', { hasText: 'Folded' }).click(); await p.waitForTimeout(2200)
const faces = await p.$$eval('.sb-face', els => els.length)
const logoIn3d = await p.locator('.sb-face .sb-logo').count()
t(faces === 4 && logoIn3d === 1, 'Folded shows the four faces of the box, the logo on the blank one', `${faces} faces, ${logoIn3d} logo`)
const before = await p.locator('.sb-box').evaluate(e => e.style.transform)
await p.locator('.sb-turns button').nth(0).click(); await p.waitForTimeout(1500)
const after = await p.locator('.sb-box').evaluate(e => e.style.transform)
const sb = await p.locator('.sb-stage').boundingBox()
await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await p.mouse.down(); await p.mouse.move(sb.x + sb.width / 2 + 200, sb.y + sb.height / 2, { steps: 8 }); await p.mouse.up()
const dragged = await p.locator('.sb-box').evaluate(e => e.style.transform)
t(before !== after && after !== dragged, 'the buttons and a drag both turn it', `${before} → ${after} → ${dragged}`)
const canShare = await p.evaluate(() => { try { return !!navigator.canShare?.({ files: [new File(['x'], 'a.png', { type: 'image/png' })] }) } catch { return false } })
t((await p.locator('text=Share · Zalo').count() === 1) === canShare, 'Share appears exactly where the browser can share a file', `canShare ${canShare}`)
await p.locator('.ss-toggle', { hasText: 'Flat' }).click()

// THE OFFER
const offer = p.locator('.ck-offer'); await offer.scrollIntoViewIfNeeded(); await p.waitForTimeout(2800)
const of = await offer.evaluate(el => ({ text: el.textContent, dash: getComputedStyle(el.querySelector('.ck-end circle')).strokeDashoffset }))
t(/Every Octave bought this Tết is shipped with its cask end/.test(of.text), 'the cask-end offer is on the page', of.text.slice(0, 90))
t(parseFloat(of.dash) === 0, 'and its cask end has drawn itself', `dashoffset ${of.dash}`)
await p.screenshot({ path: '/tmp/s-offer.png', clip: await offer.boundingBox() })

// THE TIMELINE — plays in order, counts up, answers the pointer and the keys
const tl = p.locator('.tl'); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300)
await tl.scrollIntoViewIfNeeded(); await p.waitForTimeout(450)
const mid = await p.$$eval('.tl-stop', els => els.map(e => ({ n: (e.querySelector('.tl-date').textContent.match(/· (\d+)/) || [])[1], op: +getComputedStyle(e.querySelector('.tl-label')).opacity })))
await p.waitForTimeout(3600)
const end = await p.$$eval('.tl-stop', els => els.map(e => ({ n: (e.querySelector('.tl-date').textContent.match(/· (\d+)/) || [])[1], op: +getComputedStyle(e.querySelector('.tl-label')).opacity })))
t(end.length >= 4 && end.every(s => s.op > 0.95), 'every gate is shown once it has played', JSON.stringify(end))
t(mid.some((s, i) => s.n !== undefined && +s.n < +end[i].n), 'the day counts run up rather than appearing', `early ${mid.map(s => s.n).join(',')} → ${end.map(s => s.n).join(',')}`)
t(mid[mid.length - 1].op < end[end.length - 1].op, 'the far gate (Tết) arrives after the near ones', `Tết opacity early ${mid[mid.length - 1].op.toFixed(2)}`)
const box = await tl.boundingBox(), y0 = box.y + box.height / 2
const s1 = await p.locator('.tl-stop').nth(1).boundingBox()
await p.mouse.move(s1.x + s1.width / 2, s1.y + s1.height / 2); await p.waitForTimeout(600)
const hov = await p.evaluate(() => ({ act: [...document.querySelectorAll('.tl-stop')].findIndex(e => e.classList.contains('is-active')), more: document.querySelector('.tl-stop.is-active .tl-more')?.getBoundingClientRect().height, text: document.querySelector('.tl-stop.is-active .tl-more')?.textContent, reach: document.querySelector('.tl-reach').getBoundingClientRect().width, dim: +getComputedStyle(document.querySelector('.tl-stop:not(.is-active) .tl-label')).opacity }))
const days = end[1].n
t(hov.act === 1 && hov.more > 8 && new RegExp(`${days} days from today · \\d+ before Tết`).test(hov.text), 'hovering a gate opens its figures', JSON.stringify(hov))
t(hov.reach > 50 && hov.dim < 0.5, 'and fills the rail to it while the others step back', `reach ${Math.round(hov.reach)}px, others at ${hov.dim}`)
await p.screenshot({ path: '/tmp/s-tl-hover.png', clip: { x: box.x - 20, y: box.y, width: box.width + 40, height: box.height } })
// between gates: a date follows the pointer
const g0 = await p.locator('.tl-stop').nth(0).boundingBox(), g1 = await p.locator('.tl-stop').nth(1).boundingBox()
await p.mouse.move((g0.x + g1.x) / 2 + 6, y0); await p.waitForTimeout(300)
const cur = await p.evaluate(() => document.querySelector('.tl-cursor-cap')?.textContent)
t(!!cur && /\d+ days/.test(cur), 'between gates, the date under the pointer is shown', cur)
await p.screenshot({ path: '/tmp/s-tl-scrub.png', clip: { x: box.x - 20, y: box.y, width: box.width + 40, height: box.height } })
await p.mouse.move(box.x + 10, box.y - 200); await p.waitForTimeout(300)
t(await p.locator('.tl-stop.is-active').count() === 0 && await p.locator('.tl-cursor').count() === 0, 'moving away clears it')
// keys
await p.locator('.tl-stop').first().focus(); await p.keyboard.press('Enter'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300)
t(await p.locator('.tl-stop').nth(1).evaluate(e => e.classList.contains('is-active') && document.activeElement === e), 'Enter opens a gate and the arrow keys walk the rail')

// THE BLEND LABELS
const lbr = p.locator('.lb-row'); await lbr.scrollIntoViewIfNeeded(); await p.waitForTimeout(1800)
const labs = await p.$$eval('.lb', els => els.map(e => ({ name: e.querySelector('.lb-name').textContent, nat: e.querySelector('img').naturalWidth, op: +getComputedStyle(e).opacity, src: e.querySelector('img').currentSrc.split('/').pop() })))
t(labs.length === 3 && labs.every(l => l.nat > 0 && l.op > 0.95), 'the 5 Star, 12 and 18 labels are shown', JSON.stringify(labs))
const card = p.locator('.lb-card').nth(1), cbx = await card.boundingBox()
await p.mouse.move(cbx.x + cbx.width * .85, cbx.y + cbx.height * .2); await p.waitForTimeout(400)
const tr = await card.evaluate(e => ({ t: getComputedStyle(e).transform, foil: +getComputedStyle(e.querySelector('.lb-foil')).opacity }))
t(tr.t !== 'none' && tr.foil > 0.9, 'a label tilts toward the pointer and the foil catches the light', JSON.stringify(tr))
await p.mouse.move(10, 10)

// THE TIER STAIRCASE
const st = p.locator('.tt-stair'); await st.scrollIntoViewIfNeeded(); await p.waitForTimeout(500)
const sbx = await st.boundingBox()
await p.mouse.click(sbx.x + sbx.width * 0.7, sbx.y + sbx.height / 2); await p.waitForTimeout(500)
const bottlesNow = +(await p.locator('.tt-range').inputValue())
t(bottlesNow >= 500, 'pointing high on the staircase moves the bottle count up the ladder', `${bottlesNow} bottles`)
t(/12%/.test(await p.locator('.tt-stair text[fill="#D4B85A"]').first().textContent()), 'and lights the step it lands on')

// THE BOTTLE BARS
const bar0 = async () => p.locator('.ck-bar').first().evaluate(e => [...e.children].map(c => Math.round(c.getBoundingClientRect().width)))
await p.locator('button', { hasText: /^cask strength$/ }).first().click(); await p.waitForTimeout(900)
const atCask = await bar0()
await p.locator('button', { hasText: /^40%$/ }).first().click(); await p.waitForTimeout(900)
const at40 = await bar0()
t(atCask[1] === 0 && at40[1] > 0 && at40[0] === atCask[0], 'bars grow green when the strength comes down, on the same cream base', `cask ${atCask} → 40% ${at40}`)

// THE MAP, AND THE REGION IT SHARES
const mp = p.locator('.cm'); await mp.scrollIntoViewIfNeeded(); await p.waitForTimeout(1800)
const pins = await p.$$eval('.cm-pin', els => els.map(e => e.getAttribute('aria-label')))
t(pins.length >= 3 && pins.every(l => /\d+ casks?/.test(l)), 'the map lights each region with its cask count', pins.join(' | '))
await p.locator('.cm-pin', { has: p.locator('text=Islay') }).first().click(); await p.waitForTimeout(600)
const islayChart = await p.$$eval('.cc-dot:not(.is-dim)', els => els.length)
const islayLadder = await p.$$eval('.cl-mark:not(.is-dim)', els => els.length)
t(islayChart === 3 && islayLadder === 3 && await p.locator('.cc-filter button.is-on', { hasText: 'Islay' }).count() === 1,
  'choosing Islay on the map filters the chart and the colour ladder too', `chart ${islayChart}, ladder ${islayLadder}`)
t(/Hebridean/.test(await p.locator('.cm-card').textContent()), 'and tells you about Islay')
await p.locator('.cm-clear').click(); await p.waitForTimeout(300)

// THE COLOUR LADDER
const marks = await p.$$eval('.cl-mark', els => els.length)
t(marks === 14, 'every cask with a colour sits on the SRM ladder', `${marks} marks`)
const firstLeft = await p.$$eval('.cl-mark', els => els.map(e => parseFloat(e.style.left)))
t(firstLeft.every((v, i) => i === 0 || v >= firstLeft[i - 1]), 'in order, pale to dark')

// THE COMPASS — no radar until a cask is linked to a confirmed-tagged whisky
t(await p.locator('.ck-compass').count() === 0, 'no Flavour Compass is shown for an unlinked placeholder cask')

// THE CASK CHART
const cc = p.locator('.cc'); await cc.scrollIntoViewIfNeeded(); await p.waitForTimeout(2200)
const dots = await p.$$eval('.cc-dot', els => els.length), rows = await p.$$eval('.ck', els => els.length)
t(dots === rows && dots > 0, 'the chart has one dot per cask in the list', `${dots} dots, ${rows} rows`)
const rings = await p.$$eval('.cc-dot circle[r="8"]', els => els.filter(e => e.getAttribute('fill') === 'none').length)
const soldRows = await p.$$eval('.ck', els => els.filter(e => +e.style.opacity < 1).length)
t(rings === soldRows, 'sold casks are empty rings, the rest filled', `${rings} rings, ${soldRows} sold rows`)
const d3 = await p.locator('.cc-dot').nth(3).boundingBox(); await p.mouse.move(d3.x + d3.width / 2, d3.y + d3.height / 2); await p.waitForTimeout(300)
const tip = await p.locator('.cc-tip').textContent().catch(() => '')
t(/OCT-\d{4}-\d+/.test(tip), 'pointing at a dot names the cask', tip.slice(0, 80))
const ref = tip.match(/OCT-\d{4}-\d+/)?.[0]
await p.locator('.cc-dot').nth(3).click(); await p.waitForTimeout(1200)
t(await p.locator(`#cask-${ref}.is-open`).count() === 1 && await p.locator(`#cask-${ref}`).isVisible(), 'choosing a dot opens that cask in the list', ref)
await cc.scrollIntoViewIfNeeded(); const regBtn = p.locator('.cc-filter button').nth(1); const regName = (await regBtn.textContent()).replace(/\d+/g, '').trim()
await regBtn.click(); await p.waitForTimeout(500)
const lit = await p.$$eval('.cc-dot:not(.is-dim)', els => els.length), want = +(await regBtn.locator('span').textContent())
t(lit === want && lit < dots, `the region filter leaves only ${regName} lit`, `${lit} lit, button says ${want}`)
await regBtn.click()

// THE FLIGHT — five sample bottles, five woods
const fl = p.locator('.tp-layer'); await fl.scrollIntoViewIfNeeded(); await p.waitForTimeout(2200)
t(await p.locator('.fl-spot').count() === 5, 'five samples carry a fact each')
const woods = []
for (let i = 0; i < 5; i++) {
  const sb = await p.locator('.fl-spot').nth(i).boundingBox(); await p.mouse.move(sb.x + 22, sb.y + 22); await p.waitForTimeout(350)
  woods.push(await p.locator('.fl-spot').nth(i).evaluate(e => ({ on: e.classList.contains('is-on'), op: +getComputedStyle(e.querySelector('.fl-tip')).opacity, title: e.querySelector('.fl-title').textContent, count: e.querySelector('.fl-count')?.textContent || '' })))
}
t(woods.every(w => w.on && w.op > 0.95), 'each opens its card on hover', JSON.stringify(woods.map(w => w.title)))
// the counts must be the list's own: recount from the rows' visible wood lines
t(woods.every(w => /of \d+ casks|Every cask/.test(w.count)), 'each card counts that wood in the selection', woods.map(w => w.count).join(' | '))
// a phone: the card goes under the photograph
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500); await fl.scrollIntoViewIfNeeded()
await p.locator('.fl-spot').nth(4).tap().catch(async () => { await p.locator('.fl-spot').nth(4).click() }); await p.waitForTimeout(400)
const under = await p.locator('.fl-under').evaluate(e => ({ shown: getComputedStyle(e).display !== 'none', text: e.textContent }))
t(under.shown && /Pedro Xim/.test(under.text), 'on a phone the fact opens under the photograph', under.text.slice(0, 60))
await p.setViewportSize({ width: 1440, height: 950 }); await p.waitForTimeout(400)

// the foot of the page
const over = p.locator('.tp-over'); await over.scrollIntoViewIfNeeded(); await p.waitForTimeout(1600)
const ov = await over.evaluate(el => ({ text: el.textContent.trim(), crest: Math.round(el.querySelector('img').getBoundingClientRect().width), font: getComputedStyle(el.querySelector('span')).fontFamily }))
t(/brought to you by/i.test(ov.text) && /Rampant Sans/.test(ov.font), '"brought to you by" in Rampant Sans over the last photograph', JSON.stringify(ov))
t(ov.crest > 40 && ov.crest < 110, 'the crest beside it is small, not stretched to the photo', `${ov.crest}px wide`)
const pr = await p.locator('.tp', { has: over }).boundingBox(); await p.screenshot({ path: '/tmp/s-foot.png', clip: { x: pr.x, y: pr.y, width: pr.width, height: pr.height } })
t(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '))
console.log(`\n${pass} passed, ${fail} failed`); await b.close(); process.exit(fail ? 1 : 0)
