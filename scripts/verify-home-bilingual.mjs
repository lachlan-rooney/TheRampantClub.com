// ═══════════════════════════════════════════════════════════════════════════
// THE HOME PAGE'S EN/VN SWITCH — does pressing it change the page?
//   node scripts/verify-home-bilingual.mjs            (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Reported as "the EN/VN button on the menu of the home page doesn't do
// anything", and it didn't, for two unrelated reasons:
//
//   1 · THE MENU IT SITS IN IGNORED IT. The public nav rows hard-coded English
//       above Vietnamese, from a time when the public menu had no switch. One
//       was later added at the top of that same menu and the rows were never
//       revisited — so the one control a visitor is looking straight at while
//       they press it could not move.
//   2 · THE PAGE BEHIND IT HAD NO VIETNAMESE. Of the home sections only
//       EthosLetter called useLang. The hero, the benefits, the clubhouse, the
//       Studio invitation, the reciprocal clocks and every heading in page.tsx
//       were English-only, so there was nothing for the switch to switch.
//
// ⚠ HOW NOT TO MEASURE THIS. The first diagnostic set trc_lang and dispatched
//   a bare Event('trc-lang'). The provider's listener reads e.detail, so the
//   dispatch did nothing and the script reported "the switch moves nothing" on
//   every page — including pages that translate perfectly. It would have
//   "confirmed" the bug after a correct fix. Two honest paths only: click the
//   real button, or set the key and RELOAD (the provider's mount-time read).
//
// ⚠ AND A LENGTH DELTA IS NOT A MEASUREMENT. Vietnamese runs about as long as
//   English, so "the page got 200 characters longer" says nothing about what
//   changed. Every assertion below names a STRING and demands it be present in
//   one language and absent in the other.
//
// The two-sided control is /sports: a public page nobody has translated. The
// same check must report it UNTRANSLATED. If it passes there, it is not
// reading the page.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3001'
let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)) })

// ⚠ textContent on <body> INCLUDES <style> and <script>. This page's inline
// stylesheets carry commentary that names its own sections ("The Rampant Cup",
// "By Invitation"), which read as untranslated English that was never on
// screen. Walk the text nodes and skip the non-rendered ones.
const visibleText = (extraSkip = []) => page.evaluate(skip => {
  const SKIP = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE'])
  const parts = []
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      for (let el = n.parentElement; el; el = el.parentElement) {
        if (SKIP.has(el.tagName)) return NodeFilter.FILTER_REJECT
        if (skip.some(sel => el.matches(sel))) return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let n; while ((n = w.nextNode())) parts.push(n.textContent)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}, extraSkip)

const load = async (route, lang) => {
  await page.goto(BASE + route, { waitUntil: 'networkidle' })
  await page.evaluate(v => { try { localStorage.setItem('trc_lang', v) } catch {} }, lang)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  // Open every floor of the Clubhouse so its descriptions are in the DOM.
  const strips = page.locator('button.ch-strip')
  for (let i = 0; i < await strips.count(); i++) { await strips.nth(i).click(); await page.waitForTimeout(90) }
  return await visibleText()
}

// ── 1 · THE CONTROL, CLICKED ───────────────────────────────────────────────
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(() => { try { localStorage.setItem('trc_lang', 'en') } catch {} })
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600)
const burger = page.locator('button[aria-label="Open menu"]').first()
t(await burger.count() === 1, 'the home page has a menu button')
await burger.click(); await page.waitForTimeout(400)
const vnBtn = page.locator('button[title="Tiếng Việt"]').first()
t(await vnBtn.count() > 0, 'the VN control is inside that menu')
const menuEn = (await page.locator('a.nav-link').allTextContents()).join(' | ')
await vnBtn.click(); await page.waitForTimeout(500)
const menuVn = (await page.locator('a.nav-link').allTextContents()).join(' | ')
t(await page.evaluate(() => { try { return localStorage.getItem('trc_lang') } catch { return null } }) === 'vn',
  'the click records the choice')
t(menuEn !== menuVn, 'THE MENU THE BUTTON SITS IN MOVES (fault 1)', menuEn === menuVn ? 'still identical' : 'rows swapped')
t(menuVn.startsWith('Trang chủ'), 'and Vietnamese is now the top line of each row', menuVn.slice(0, 40))
t(/Home/.test(menuVn), 'with English kept beneath it, so a walk-in is still served')
t(await vnBtn.getAttribute('aria-pressed') === 'true', 'the control shows its own state')

// ── 2 · THE PAGE, SECTION BY SECTION ──────────────────────────────────────
// Each pair: a Vietnamese string that must appear, and the English it replaced,
// which must now be gone. Absence of the old is as much the point as presence
// of the new — a page that shows both has not switched, it has doubled.
const SECTIONS = [
  ['hero',        'Dành cho những tâm hồn đồng điệu',          'For kindred spirits'],
  ['hero lede',   'Di sản Scotland hoà cùng tâm hồn Việt',     'Scottish heritage meets Vietnamese soul'],
  ['ethos cta',   'Tinh Thần Câu Lạc Bộ',                      'Club Ethos'],
  ['benefits',    'Hàng trăm chai đã khui',                    'Hundreds of open bottles'],
  ['benefits',    'Quyền Vào Các Câu Lạc Bộ Đối Ứng',          'Reciprocal Club Access'],
  ['clubhouse',   'Toà Nhà Hai Bà Trưng',                      'Hai Bà Trưng Clubhouse'],
  ['clubhouse',   'Chạm vào một tầng để xem bên trong.',       'Tap a floor to look inside.'],
  ['clubhouse',   'Quầy cocktail riêng của bạn',               'Your private cocktail bar'],
  ['studio',      'Không gian nghệ thuật thay mới mỗi quý',    'A quarterly rotating art space'],
  ['reciprocal',  'Một Thế Giới Ngoài Sài Gòn',                'A World Beyond Sài Gòn'],
  ['cup',         'Cúp Rampant',                               'The Rampant Cup'],
  ['tet',         'Whisky để tri ân đối tác dịp Tết',          'Whisky for the companies you thank'],
  ['tiers',       'Theo Lời Mời',                              'By Invitation'],
  ['tiers',       'Hội viên chỉ nhận theo lời mời',            'Membership is by invitation'],
  ['tiers',       'Ba suất đại diện được chỉ định',            'Three nominated representative seats'],
  ['tiers',       'mỗi năm',                                   'a year'],
]

const bodyVn = await load('/', 'vn')
const bodyEn = await load('/', 'en')
// 4,700-odd characters of VISIBLE copy. The old number here was 20,000, left
// over from when this read the stylesheets too — a threshold calibrated against
// a wrong measurement passes for the wrong reason, so it is restated, not nudged.
t(bodyEn.length > 3000 && bodyVn.length > 3000, 'the home page actually loaded in both languages',
  `${bodyEn.length} / ${bodyVn.length} chars of visible copy`)

let arrived = 0, lingering = []
for (const [where, vn, en] of SECTIONS) {
  const here = bodyVn.includes(vn)
  if (here) arrived++
  t(here, `${where}: the Vietnamese arrived`, here ? vn.slice(0, 34) : `MISSING "${vn}"`)
  if (bodyVn.includes(en)) lingering.push(en)
}
t(lingering.length === 0, 'and the English it replaced is gone in VN (switched, not doubled)',
  lingering.length ? lingering.map(s => s.slice(0, 28)).join(' | ') : 'clean')
// The same strings must be the other way round in English — otherwise the page
// is simply Vietnamese now, which is a different bug wearing this one's clothes.
const enOk = SECTIONS.filter(([, , en]) => bodyEn.includes(en)).length
t(enOk === SECTIONS.length, 'English is intact when English is chosen', `${enOk} of ${SECTIONS.length}`)
const vnLeak = SECTIONS.filter(([, vn]) => bodyEn.includes(vn)).map(([, vn]) => vn)
t(vnLeak.length === 0, 'and no Vietnamese leaks into the English page',
  vnLeak.length ? vnLeak.slice(0, 2).join(' | ') : 'clean')

// ── 3 · THE TWO-SIDED CONTROL ─────────────────────────────────────────────
// /sports is a public page nobody has translated. The identical method must
// find it untranslated, or the method is measuring itself.
// The nav rows now swap on EVERY public page, which is the point of fault 1 —
// so the control must look past the shared menu at /sports' own content.
const sportsVn = await load('/sports', 'vn').then(() => visibleText(['.nav-link', '.nav-lang-top']))
const sportsEn = await load('/sports', 'en').then(() => visibleText(['.nav-link', '.nav-lang-top']))
t(sportsVn === sportsEn, 'CONTROL: /sports is still untranslated, by the same check',
  sportsVn === sportsEn ? 'identical, as expected — the check can fail' : 'it moved, so this check proves nothing')

t(errors.length === 0, 'no console errors on the home page', errors.slice(0, 2).join(' | '))

await browser.close()
console.log(`\n${arrived} of ${SECTIONS.length} sections translate`)
console.log(`${fail === 0 ? '✓ ALL' : '✗'} ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
