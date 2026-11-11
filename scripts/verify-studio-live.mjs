// A last look at the live guide, the way a guest meets it: two widths, two
// languages, reduced motion, and the console.
import { chromium } from 'playwright'
const URL = process.env.URL || 'https://therampantclub.com/studio/rizal-fathoni/guide'
let bad = 0
const t = (ok, m, d = '') => { if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const browser = await chromium.launch()

for (const [w, h, label, reduce] of [[390, 844, '390', false], [1280, 900, '1280', false], [390, 844, '390 reduced-motion', true]]) {
  console.log(`\n── ${label} ──`)
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2,
    reducedMotion: reduce ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 100)) })
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 100)))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6500)

  t((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1,
    'no sideways scroll')

  const panels = await page.evaluate(() => document.querySelectorAll('.sga-panel').length)
  t(panels === 8, 'all eight works carry a panel', `${panels}`)
  t((await page.evaluate(() => document.querySelectorAll('.sga-flaps .fl-cell').length)) > 0,
    'the flap board is rendering')
  t((await page.evaluate(() => document.querySelectorAll('.sga-bar').length)) === 4,
    'four bid bars, one per auction work',
    String(await page.evaluate(() => document.querySelectorAll('.sga-bar').length)))
  t((await page.evaluate(() => document.querySelectorAll('.sga-panel.is-sold').length)) === 4,
    'four sold panels')

  // The quiet note must not rival the headline.
  const sizes = await page.evaluate(() => {
    const n = document.querySelector('.sga-soldnote'), l = document.querySelector('.sga-lead')
    return { note: n ? parseFloat(getComputedStyle(n).fontSize) : null, lead: l ? parseFloat(getComputedStyle(l).fontSize) : null }
  })
  t(sizes.note !== null && sizes.lead !== null && sizes.note < sizes.lead * 0.7,
    'the sold note is a quiet aside, not a second headline', `${sizes.note}px vs ${sizes.lead}px`)

  // The supplier credit.
  const img = await page.evaluate(() => {
    const i = document.querySelector('.sga-credit img')
    return i ? { ok: i.naturalWidth > 0, h: Math.round(i.getBoundingClientRect().height) } : null
  })
  t(img?.ok === true, 'the Lactone mark loaded', img ? `${img.h}px tall` : 'missing')
  t((img?.h ?? 0) >= 24, 'and is big enough to read', `${img?.h}px`)

  // The disclosure.
  const bio = await page.evaluate(() => {
    const s = document.querySelector('.sg-bio summary')
    return s ? Math.round(s.getBoundingClientRect().height) : 0
  })
  t(bio >= 44, 'the About control is a real target', `${bio}px`)
  await page.evaluate(() => document.querySelector('.sg-bio summary').click())
  await page.waitForTimeout(300)
  t(await page.evaluate(() => document.querySelector('.sg-bio').open), 'and it opens')

  // Nothing private, ever.
  const html = await page.content()
  for (const s of ['reserve_usd', 'sold_to', 'bidder_email', 'US$918', 'US$2,300', 'US$1,650', 'US$575'])
    t(!html.includes(s), `no "${s}" in the page`)

  if (reduce) {
    const hidden = await page.evaluate(() => {
      const out = []
      for (const sel of ['.sga-panel', '.sga-flaps', '.sga-bar', '.sga-p-meta', '.sg-piece', '.sga-banner']) {
        const els = [...document.querySelectorAll(sel)]
        if (!els.length) { out.push(`${sel}: MATCHED NOTHING`); continue }
        for (const e of els.slice(0, 3)) {
          const c = getComputedStyle(e), r = e.getBoundingClientRect()
          if (!(r.width > 0 && r.height > 0 && Number(c.opacity) > 0.3)) out.push(`${sel}: opacity ${c.opacity}`)
        }
      }
      return out
    })
    t(hidden.length === 0, 'reduced motion leaves everything readable', hidden.join('; ') || 'all visible')
  }

  // Vietnamese.
  const vn = page.locator('button[title="Tiếng Việt"]').first()
  await vn.waitFor({ state: 'attached' })
  await vn.evaluate(e => e.click())
  await page.waitForTimeout(900)
  const txt = await page.evaluate(() => document.body.innerText)
  // ⚠ CASE-INSENSITIVE, because innerText applies text-transform. The eyebrow
  // is uppercased in CSS, so the DOM text reads "ĐẤU GIÁ KÍN" and a
  // case-sensitive match for "Đấu giá kín" fails against a page that is
  // perfectly correct.
  t(/đấu giá kín/i.test(txt), 'the auction block speaks Vietnamese')
  t(/tác phẩm/i.test(txt), 'and so does the walking order')
  t(!/silent auction/i.test(txt), 'with no English auction label left behind')

  t(errors.length === 0, 'no console errors', errors.join(' | ') || 'clean')
  await ctx.close()
}

await browser.close()
console.log(`\n${bad ? '✗ ' + bad + ' problems' : '✓ no problems found on the live guide'}`)
process.exit(bad ? 1 : 0)
