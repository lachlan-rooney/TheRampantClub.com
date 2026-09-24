// ═══════════════════════════════════════════════════════════════════════════
// THE STRENGTH TOGGLE — the cask is one price; the strength moves the bottles.
//   node tests/tet/cask-strength.test.mjs          (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-24: "why can i no longer change ABV and show more bottles?"
//
// It had been hidden on purpose and on a wrong premise. When Duncan Taylor's
// list prices landed, the row froze at DT's own outturn, the toggle could not
// move it, so the toggle and the bottle bars were hidden rather than left
// doing nothing. The premise was wrong: what is bought is the CASK, at DT's
// price across DT's outturn — a fixed number. Filling at a lower strength
// draws more bottles out of the same whisky, so the bottle price is that
// fixed cask divided by the bottling chosen.
//
// PROVEN AGAINST THE BROKEN VERSION: with the old `{!casks.every(quoted) && }`
// wrapper restored, the first check here fails outright (no toggle on the
// page at all), and with `bottles = num('bottles_cask_strength')` restored the
// next three fail (the counts and prices never move).
//
// It reads and writes nothing. Everything below is measured off the page.
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
const pass = exp + '.' + createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')

let ok = 0, bad = 0
const t = (c, m, d = '') => { c ? ok++ : bad++; console.log(`${c ? '✓' : '✗'} ${m}${!c && d ? ' — ' + d : ''}`) }

const b = await chromium.launch()
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } })
  await ctx.addCookies([{ name: 'trc_tet', value: pass, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message))
  await p.goto(`${ORIGIN}/tet`, { waitUntil: 'networkidle', timeout: 120000 })
  await p.waitForTimeout(2600)

  const bar = p.locator('.pk-eyebrow', { hasText: /Bottled at|Đóng chai/ }).first()
  await bar.scrollIntoViewIfNeeded()
  const labels = await bar.locator('xpath=following-sibling::button').allInnerTexts()
  t(labels.length >= 4, 'the strength toggle is on the page', JSON.stringify(labels))

  const row = p.locator('.ck').first().locator('.ck-figs')
  const at = async label => {
    await bar.locator(`xpath=following-sibling::button[normalize-space()="${label}"]`).click()
    await p.waitForTimeout(450)
    return (await row.innerText()).replace(/\s+/g, ' ')
  }
  const bottles = s => Number((s.match(/(\d+)\s*(bottles|chai)/) || [])[1] || 0)
  const money = s => [...s.matchAll(/([\d.]{7,})\s*₫/g)].map(x => Number(x[1].replace(/\./g, '')))
  const cask = s => money(s)[0] || 0          // the cask leads the row
  const unit = s => money(s).slice(-1)[0] || 0 // the bottle price is under it

  const csk = await at('cask strength'), fifty = await at('50%'), forty = await at('40%')
  t(bottles(forty) > bottles(fifty) && bottles(fifty) > bottles(csk),
    'a lower strength fills more bottles', `${bottles(csk)} → ${bottles(fifty)} → ${bottles(forty)}`)
  t(unit(forty) < unit(fifty) && unit(fifty) < unit(csk),
    'and the bottle price comes down with it', `${unit(csk)} → ${unit(fifty)} → ${unit(forty)}`)
  t(cask(csk) === cask(forty) && cask(csk) > 0,
    'while the CASK price does not move — it is the thing being bought', `${cask(csk)} vs ${cask(forty)}`)
  t(/at 40%|ở 40%/.test(forty), 'the bottle price says which strength it is quoting', forty.slice(0, 80))
  t(/\+\d/.test(forty), 'the extra bottles are counted beside it', forty.slice(0, 80))

  // THE BARS ARE THE SAME ARGUMENT, DRAWN. They were hidden with the toggle.
  // The bars animate over .7s, so a measurement taken straight after the
  // click reads a width on its way somewhere — 5px of green at cask strength,
  // where the answer is none.
  const widths = async () => {
    await p.waitForTimeout(900)
    return p.locator('.ck-bar').first()
      .evaluate(e => [...e.children].map(c => Math.round(c.getBoundingClientRect().width)))
  }
  const w40 = await widths()
  await at('cask strength')
  const wCask = await widths()
  t(wCask[1] === 0 && w40[1] > 0 && w40[0] === wCask[0],
    'the bar grows green as the strength comes down, on the same cream base', `cask ${wCask} → 40% ${w40}`)

  // AND THE CAVEAT THE DIVISION REQUIRES.
  await at('40%')
  const foot = await p.locator('footer.pk-wrap').first().innerText()
  t(/not quoted in it|chưa nằm trong giá/.test(foot),
    'the page says the extra bottles’ bottling is not in the cask price', foot.replace(/\s+/g, ' ').slice(-120))
  await at('cask strength')
  t(!/not quoted in it/.test(await p.locator('footer.pk-wrap').first().innerText()),
    'and drops the caveat at cask strength, where nothing is divided')

  // A CASK ALREADY BELOW THE STRENGTH ASKED FOR SAYS SO.
  await at('55%')
  const weak = await p.$$eval('.ck-figs', els => els.map(e => e.innerText).filter(s => /already below|đã dưới/.test(s)))
  t(weak.every(s => !/\d+\s*(bottles|chai)/.test(s)),
    'a cask already below the strength asked for quotes no bottling at it', `${weak.length} such rows`)

  t(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '))
} finally {
  await b.close()
}

console.log(`\n${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
