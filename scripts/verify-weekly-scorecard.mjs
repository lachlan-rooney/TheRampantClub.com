// ═══════════════════════════════════════════════════════════════════════════
// THE WEEKLY OPS SCORECARD — the render path, the bands, and the prescriptions
//   node scripts/verify-weekly-scorecard.mjs          (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// The point of this harness is not "the page loads". It is that the number on
// the card is the number the API computed. The tasting-note bug was exactly
// this shape: the API SELECTED `composed` and then dropped it before the
// response, and every page looked fine. So every figure is compared against
// the API value, digit for digit.
//
// What it proves:
//   · the API returns real inputs, not an empty shell (a zero-row harness
//     passes everything — assert the inputs arrived FIRST)
//   · each of the six cards renders the API's own figure
//   · banding is the thresholds module's verdict, not a colour somebody liked
//   · at warn or worse a prescription appears WITH an owner; at ok it does NOT
//     (a red number with no instruction is decoration)
//   · the VN switch moves the measured card text, not just a t() call
//   · the existing dashboard is untouched: git says so, and /admin still 200s
//
// ⚠ NEGATIVE CONTROL (step 7). The figure comparison is re-run with every API
//   value shifted by one. If the harness still passes, it is not reading the
//   page and nothing above it means anything.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, BASE = process.env.BASE || 'http://localhost:3001'
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const OWNER = '3e1583db-b881-42ec-aadb-6f69a22fad80'
const ownerCookie = (() => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: OWNER, email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
  const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
  const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'lachlanrooney55@gmail.com', app_metadata: {}, user_metadata: {} } }
  const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
  const out = []
  if (v.length <= 3180) out.push({ name: `sb-${ref}-auth-token`, value: v })
  else for (let i = 0, n = 0; i < v.length; i += 3180, n++) out.push({ name: `sb-${ref}-auth-token.${n}`, value: v.slice(i, i + 3180) })
  return out.map(c => ({ ...c, domain: 'localhost', path: '/' }))
})()
const cookieHeader = ownerCookie.map(c => `${c.name}=${c.value}`).join('; ')

// ── 1 · THE API, AND THAT ITS INPUTS ACTUALLY LOADED ──────────────────────
const res = await fetch(`${BASE}/api/admin/analytics/weekly`, { headers: { cookie: cookieHeader } })
t(res.ok, `the API answers the owner`, `HTTP ${res.status}`)
if (!res.ok) { console.log('\nCannot continue without the API.'); process.exit(1) }
const d = await res.json()
const g = d.gap

t(!!d.period?.start && !!d.period?.end, 'a week was chosen', `${d.period?.start} → ${d.period?.end}`)
// Inputs, not outputs. Every one of these being zero is the shape of a harness
// that proves nothing, so each is asserted to have LOADED something.
t(g.reach.members > 0, 'the member roll loaded', `${g.reach.members} members`)
t(g.board.open > 0, 'the ops boards loaded', `${g.board.open} open tasks`)
t(g.rota.target > 0, 'a rota coverage target exists', `target ${g.rota.target}`)
t(Array.isArray(g.pipeline.stalled), 'the pipeline answered', `${g.pipeline.stalled.length} stalled`)
t(d.shared !== null, 'the shared gatherer ran (the existing report\'s own numbers)',
  d.shared ? Object.keys(d.shared).join(', ') : 'NULL')

// ── 2 · NO DRIFT AGAINST THE EXISTING REPORT ──────────────────────────────
// Both the scorecard and the weekly report count open complaints. If they ever
// disagree, one of them is lying and nobody will know which.
if (d.shared?.ops?.complaints) {
  t(d.shared.ops.complaints.open_now === g.grievances.open_now,
    'open grievances agree with the weekly report',
    `report ${d.shared.ops.complaints.open_now} vs scorecard ${g.grievances.open_now}`)
}

// ── the six figures, as the API computed them ──
const expected = {
  overdueTasks:    g.board.overdue,
  pipelineStalled: g.pipeline.stalled.length,
  coveragePct:     g.rota.coverage_pct,
  grievanceOpen:   g.grievances.open_now,
  resolutionDays:  g.grievances.median_days_to_resolve,
  memberReach:     g.reach.pct,
}

// The thresholds module is the single source of the verdict — imported, not
// re-implemented here, because a verifier that re-derives the rule tests
// nothing but itself.
const { RULES, band, prescription } = await import('../lib/analytics/thresholds.ts').catch(async () => {
  // tsx is not guaranteed; fall back to parsing the module's literal.
  const src = readFileSync('lib/analytics/thresholds.ts', 'utf8')
  const rules = {}
  for (const m of src.matchAll(/^  (\w+): \{([\s\S]*?)^  \},$/gm)) {
    const body = m[2]
    const num = k => { const r = body.match(new RegExp(`${k}: (-?[\\d.]+)`)); return r ? Number(r[1]) : undefined }
    rules[m[1]] = { watch: num('watch'), warn: num('warn'), act: num('act'),
                    higherIsWorse: /higherIsWorse: true/.test(body),
                    owner: (body.match(/owner: '([^']+)'/) || [])[1] }
  }
  const band = (k, v) => {
    if (v == null) return 'ok'
    const r = rules[k]
    const worse = (a, b) => r.higherIsWorse ? a >= b : a <= b
    return worse(v, r.act) ? 'act' : worse(v, r.warn) ? 'warn' : worse(v, r.watch) ? 'watch' : 'ok'
  }
  return { RULES: rules, band, prescription: (k, v) => ['warn', 'act'].includes(band(k, v)) ? { owner: rules[k].owner } : null }
})

// ── 3 · THE RENDER PATH ───────────────────────────────────────────────────
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
await ctx.addCookies(ownerCookie)
const page = await ctx.newPage()
const problems = []
page.on('console', m => { if (m.type() === 'error') problems.push(m.text().slice(0, 120)) })

await page.goto(`${BASE}/admin/analytics/weekly`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

// Read the cards back out of the DOM. Each card is keyed by its rule label so
// a reordered grid cannot quietly compare the wrong pair.
const cards = await page.evaluate(() => [...document.querySelectorAll('section')].map(s => {
  const kids = [...s.children]
  return {
    bandTag: (kids.find(k => k.style.textTransform === 'uppercase' && k.style.position === 'absolute')?.textContent || '').trim(),
    label: (kids.find(k => k.style.letterSpacing === '0.14em')?.textContent || '').trim(),
    figure: (kids.find(k => k.style.fontVariantNumeric === 'tabular-nums')?.textContent || '').trim(),
    rx: (s.querySelector('div[style*="border-top"]')?.textContent || '').trim(),
  }
}).filter(c => c.label))

t(cards.length === 6, 'six cards rendered', `${cards.length}`)

// ── 4 · EVERY FIGURE IS THE API'S FIGURE ──────────────────────────────────
// This is the comparison the negative control at step 7 tries to break.
const compare = (shift = 0) => {
  const out = []
  for (const [key, value] of Object.entries(expected)) {
    const r = RULES[key]
    const labelEn = readFileSync('lib/analytics/thresholds.ts', 'utf8')
      .match(new RegExp(`${key}: \\{[\\s\\S]*?label_en: '([^']+)'`))[1]
    const card = cards.find(c => c.label.toLowerCase() === labelEn.toLowerCase())
    if (!card) { out.push([false, key, 'no card with that label']); continue }
    const want = value == null ? '—' : String(value + shift)
    const digits = card.figure.replace(/[^\d.\-—]/g, '')
    out.push([digits === want, key, `page "${card.figure}" (digits ${digits || '∅'}) vs API ${want}`])
  }
  return out
}
for (const [ok, key, detail] of compare(0)) t(ok, `the card shows the API's own figure: ${key}`, detail)

// ── 5 · BANDS AND PRESCRIPTIONS ───────────────────────────────────────────
const BANDW = { ok: 'STEADY', watch: 'WATCH', warn: 'WARNING', act: 'ACT NOW' }
let actOrWarn = 0, okCards = 0
for (const [key, value] of Object.entries(expected)) {
  const b = band(key, value)
  const labelEn = readFileSync('lib/analytics/thresholds.ts', 'utf8')
    .match(new RegExp(`${key}: \\{[\\s\\S]*?label_en: '([^']+)'`))[1]
  const card = cards.find(c => c.label.toLowerCase() === labelEn.toLowerCase())
  if (!card) continue
  const rx = prescription(key, value)
  if (rx) {
    actOrWarn++
    t(card.rx.length > 10, `${key}: a ${b} figure carries an instruction`, card.rx.slice(0, 64))
    t(card.rx.toLowerCase().includes(String(rx.owner).toLowerCase()),
      `${key}: the instruction names its owner`, `expected ${rx.owner}`)
  } else {
    okCards++
    t(card.rx.length === 0, `${key}: a ${b} figure is left alone (no instruction)`, card.rx ? `found "${card.rx.slice(0,40)}"` : 'clean')
  }
}
t(actOrWarn > 0, 'at least one metric is genuinely in warning (otherwise the prescription path is untested)', `${actOrWarn} warn/act, ${okCards} calmer`)

// ── 6 · THE VN SWITCH ACTUALLY MOVES THE PAGE ─────────────────────────────
// "Act exactly like admin" means the page TRANSLATES, not that it owns t()
// calls. So: measure one specific card's label, switch, measure the same spot.
const labelSel = 'section div[style*="0.14em"]'
const enLabels = (await page.locator(labelSel).allTextContents()).map(s => s.trim())
const sw = page.locator('button', { hasText: /^(VN|VI|Tiếng Việt)$/i }).first()
if (await sw.count()) {
  await sw.click(); await page.waitForTimeout(450)
} else {
  await page.evaluate(() => { try { localStorage.setItem('trc_lang', 'vn') } catch {}
    window.dispatchEvent(new Event('trc-lang')) })
  await page.waitForTimeout(450)
}
const vnLabels = (await page.locator(labelSel).allTextContents()).map(s => s.trim())
const moved = enLabels.filter((v, i) => vnLabels[i] && vnLabels[i] !== v).length
t(moved >= 5, 'the same measured labels change under VN', `${moved} of ${enLabels.length} moved`)
t(vnLabels.some(v => /[ăâêôơưđạảấầếệốớụ]/i.test(v)), 'and the VN text is really Vietnamese', vnLabels[0] || '')

// ── the index page, and the way in ──
await page.goto(`${BASE}/admin/analytics`, { waitUntil: 'networkidle' })
const idx = await page.textContent('body')
t(/Weekly Ops Scorecard|Bảng điểm/.test(idx), 'the index page offers the scorecard')
t(/not measured|chưa đo được/i.test(idx), 'and says what it cannot measure (so a gap is not read as a zero)')
const navHref = await page.evaluate(() =>
  !!document.querySelector('a[href="/admin/analytics"]'))
t(navHref, 'the admin nav links to it (not an orphaned surface)')

// ── 8 · THE EXISTING DASHBOARD IS UNTOUCHED ───────────────────────────────
const touched = execSync('git status --porcelain', { encoding: 'utf8' })
  .split('\n').map(l => l.slice(3).trim()).filter(Boolean)
const forbidden = touched.filter(f => /^app\/admin\/page\.tsx|^app\/api\/admin\/dashboard|^app\/admin\/reports|^lib\/reports\//.test(f))
t(forbidden.length === 0, 'no existing dashboard or weekly-report file is in the change set',
  forbidden.length ? forbidden.join(', ') : 'clean')
const navDiff = execSync('git diff --numstat -- app/admin/_nav/AdminNav.tsx', { encoding: 'utf8' }).trim()
t(/^1\t0\t/.test(navDiff) || navDiff === '', 'the only edit to existing code is one added nav line', navDiff || 'none')
const adm = await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
t(adm.status() === 200, 'the existing dashboard still answers', `HTTP ${adm.status()}`)

t(problems.length === 0, 'no console errors on the scorecard', problems.slice(0, 2).join(' | '))

// ── 7 · NEGATIVE CONTROL — the harness must FAIL on a wrong expectation ───
console.log('\n── negative control: every figure shifted by one, step 4 must now fail ──')
const shifted = compare(1)
const stillPassing = shifted.filter(([ok]) => ok)
const nowFailing = shifted.filter(([ok]) => !ok)
console.log(`   ${nowFailing.length} of ${shifted.length} comparisons now fail (as they must)`)
// A null figure renders "—" and cannot shift, so it is exempt.
const shiftable = Object.values(expected).filter(v => v != null).length
t(nowFailing.length >= shiftable,
  'THE HARNESS IS REAL: it rejects the shifted numbers',
  `${stillPassing.length} comparison(s) survived a deliberate +1`)

await browser.close()
console.log(`\n${fail === 0 ? '✓ ALL' : '✗'} ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
