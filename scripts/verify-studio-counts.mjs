#!/usr/bin/env node
/**
 * DOES EVERY COUNT ON THE GUIDE READ THE DATA — IN BOTH LANGUAGES?
 *
 *   node scripts/verify-studio-counts.mjs
 *   BASE=https://therampantclub.com node scripts/verify-studio-counts.mjs
 *
 * ── WHY A BROWSER AND NOT A FETCH ────────────────────────────────────────
 * The language switch is client-side: LangProvider reads trc_lang and the
 * whole page re-renders. Fetching the HTML only ever shows English, so a
 * fetch-based check would declare the Vietnamese correct without having seen
 * it — and "the Vietnamese is fine" has been wrong here before.
 *
 * ⚠ trc_lang WITH AN UNDERSCORE, and the event is trc-lang with a HYPHEN
 * whose listener reads e.detail. A bare Event is a no-op that looks exactly
 * like a page which translates nothing. This drives the real control instead.
 *
 * ── WHAT IS BEING PROVEN ─────────────────────────────────────────────────
 * Not "the page says eight". That would pass on a hardcoded eight, which is
 * precisely the fault this is guarding against — the line used to be written
 * out by hand. So the count is read FROM THE DATABASE first, and the page is
 * asked to agree with it, in both languages, in every place it counts.
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const BASE = process.env.BASE || 'http://localhost:3001'
const SLUG = process.env.SLUG || 'rizal-fathoni'
let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

// ── THE TRUTH, from the database ─────────────────────────────────────────
const { createClient } = await import(`${process.cwd()}/node_modules/@supabase/supabase-js/dist/index.cjs`)
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: c } = await a.from('collaborations').select('id').eq('slug', SLUG).single()
const { data: rows } = await a.from('collaboration_pieces').select('sort,title_en').eq('collaboration_id', c.id).order('sort')
const N = rows.length
console.log(`against ${BASE}\nthe database says ${N} pieces: ${rows.map(r => r.title_en).join(', ')}\n`)
t(N === 8, 'the exhibition holds eight works', `${N}`)
t(!rows.some(r => /A Series Of Body/i.test(r.title_en)), 'and A Series Of Body is not one of them')
t(rows.every((r, i) => r.sort === i + 1), 'the walking order has no gaps', rows.map(r => r.sort).join(','))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => {
  const add = () => {
    if (document.getElementById('__no_overlay')) return
    const s = document.createElement('style'); s.id = '__no_overlay'
    s.textContent = 'nextjs-portal{display:none!important}'
    ;(document.head || document.documentElement).appendChild(s)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add()
  window.addEventListener('load', add)
})
const page = await ctx.newPage()

try {
  for (const lang of ['en', 'vn']) {
    console.log(`\n── ${lang.toUpperCase()} ──`)
    await page.goto(`${BASE}/studio/${SLUG}/guide`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.waitForSelector('.sg-piece', { timeout: 60_000 })
    if (lang === 'vn') {
      // The real switch the guest presses, not a localStorage poke — trc_lang
      // written by hand would prove the storage key and nothing about whether
      // pressing the button works.
      //
      // ⚠ CLICKED THROUGH THE ELEMENT, NOT THROUGH THE MOUSE. The switch lives
      // in the sticky progress bar, inside a transformed container, and
      // Playwright's actionability check reports it "outside of the viewport"
      // forever however far you scroll — the same transform trap that catches
      // fixed-position elements elsewhere in this codebase. el.click() runs
      // the real React handler, which is the thing under test.
      const vnBtn = page.locator('button[title="Tiếng Việt"]').first()
      await vnBtn.waitFor({ state: 'attached', timeout: 30_000 })
      await vnBtn.evaluate(el => el.click())
      await page.waitForTimeout(700)
    }
    // ⚠ textContent includes <style>. Strip script and style before reading.
    const text = await page.evaluate(() => {
      const d = document.body.cloneNode(true)
      d.querySelectorAll('script,style').forEach(e => e.remove())
      return d.innerText.replace(/\s+/g, ' ')
    })

    // CONTROL: the switch actually moved the page. Without this, every
    // assertion below could be measuring the English page twice.
    const vietnamese = /Hãy thong thả|tác phẩm|Đấu giá|Trang chủ/.test(text)
    t(lang === 'vn' ? vietnamese : !/Hãy thong thả/.test(text),
      lang === 'vn' ? 'CONTROL: the page really switched to Vietnamese'
                    : 'CONTROL: the page is in English to begin with')

    // 1 · The walking-order line.
    const expect = lang === 'en' ? `${N} pieces` : `${N} tác phẩm`
    t(text.includes(expect), `the walking-order line reads "${expect}"`,
      (text.match(/\d+ (pieces|tác phẩm)/) || ['not found'])[0])

    // 2 · Every per-piece number, "01 / 08".
    const numbers = await page.$$eval('.sg-no', els => els.map(e => e.textContent.trim()))
    t(numbers.length === N, `there are ${N} numbered works on the page`, `${numbers.length}`)
    const want = Array.from({ length: N }, (_, i) =>
      `${String(i + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`)
    t(JSON.stringify(numbers) === JSON.stringify(want),
      `they number 01/${String(N).padStart(2, '0')} through ${String(N).padStart(2, '0')}/${String(N).padStart(2, '0')}`,
      numbers.join(' · '))

    // 3 · Nothing anywhere still says nine.
    t(!/\b9 (pieces|tác phẩm)\b/.test(text), 'nothing says nine')
    t(!/\/ 09\b/.test(text), 'no number ends in / 09')
    t(!/A Series Of Body/i.test(text), 'A Series Of Body appears nowhere on the page')
  }
} finally {
  await browser.close()
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed — ${fail ? 'the counts disagree' : 'every count reads the data, in both languages'}`)
process.exit(fail ? 1 : 0)
