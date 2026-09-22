// ═══════════════════════════════════════════════════════════════════════════
// ROTA PAGE — driven in a real browser, signed in as the owner.
//   (dev server on :3001)  node tests/rota/rota-ui.test.mjs
// Moves are tested on THROWAWAY shifts on Monday 9 November 2026, a week with
// nothing rostered, and removed afterwards with their activity entries.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
const env = {}; for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '') }
const U = env.NEXT_PUBLIC_SUPABASE_URL, REF = U.match(/https:\/\/([^.]+)/)[1], ADMIN = '3e1583db-b881-42ec-aadb-6f69a22fad80'
const SVC = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const db = async (m, p, b) => { const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: SVC, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : [] }
let pass = 0, fail = 0; const bugs = []
const t = (ok, label, detail = '') => { ok ? pass++ : (fail++, bugs.push(`${label}${detail ? ' — ' + detail : ''}`)); console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ' — ' + detail : ''}`) }

// ── a session for the owner, in the cookie @supabase/ssr reads ──
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000)
const head = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: ADMIN, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, aal: 'aal1', email: 'lachlanrooney55@gmail.com' })
const jwt = head + '.' + createHmac('sha256', env.SUPABASE_JWT_SECRET).update(head).digest('base64url')
const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'ui-test',
  user: { id: ADMIN, aud: 'authenticated', role: 'authenticated', email: 'lachlanrooney55@gmail.com', app_metadata: {}, user_metadata: {} } }
const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
const name = `sb-${REF}-auth-token`
const chunks = value.length <= 3180 ? [[name, value]] : value.match(/.{1,3180}/g).map((c, i) => [`${name}.${i}`, c])

// ── throwaway shifts ──
const team = await db('GET', 'team_members?select=id,display_name')
const id = n => team.find(m => m.display_name === n).id
const MON = '2026-11-09', TUE = '2026-11-10'
await db('DELETE', `rota_shifts?shift_date=gte.${MON}&shift_date=lte.2026-11-15&notes=eq.uitest`)
const seeded = await db('POST', 'rota_shifts', [
  { member: id('New'), shift_date: MON, shift_name: 'S1', start_time: '14:00', end_time: '22:00', notes: 'uitest' },
  { member: id('Hiếu'), shift_date: MON, shift_name: 'S2', start_time: '15:30', end_time: '23:30', notes: 'uitest' },
])
const row = async who => (await db('GET', `rota_shifts?select=shift_date,shift_name,start_time,end_time&notes=eq.uitest&member=eq.${id(who)}`))[0]
const hhmm = r => `${r.shift_name} ${r.shift_date} ${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } })
await ctx.addCookies(chunks.map(([n, v]) => ({ name: n, value: v, domain: 'localhost', path: '/' })))
const p = await ctx.newPage()
const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
try {
  await p.goto('http://localhost:3001/admin/ops/rota', { waitUntil: 'networkidle', timeout: 90000 })
  t(p.url().includes('/admin/ops/rota'), 'the owner reaches the rota page, not the login', p.url())
  await p.waitForSelector('text=This week against the rules', { timeout: 30000 })

  // ── layout ──
  const headers = await p.$$eval('th', els => els.map(e => e.textContent.trim().slice(0, 3)))
  const dayHeads = headers.filter(h => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(h))
  t(dayHeads[0] === 'Mon' && dayHeads[6] === 'Sun', 'the week runs Monday to Sunday', dayHeads.slice(0, 7).join(' '))
  const labels = await p.$$eval('tr', trs => trs.map(tr => (tr.querySelector('td')?.textContent ?? '').trim()).filter(Boolean))
  const at = s => labels.findIndex(l => l.startsWith(s))
  t(at('S1') >= 0 && at('S1') < at('Office') && at('Office') < at('Clean Early'), 'floor, then office, then cleaning', labels.slice(0, 14).map(l => l.slice(0, 12)).join(' | '))
  t(labels.some(l => /^Office$/i.test(l)) && labels.some(l => /^Cleaning$/i.test(l)), 'labelled gaps before office and cleaning')

  // ── a clean week says so ──
  for (let i = 0; i < 2; i++) await p.click('text=Next ›')
  await p.waitForTimeout(1500)
  const summary = await p.locator('text=This week against the rules').locator('..').innerText()
  t(/all rules kept/i.test(summary) && !/to note/i.test(summary), 'week of 5 Oct: "all rules kept", nothing to note', summary.replace(/\s+/g, ' ').slice(0, 120))
  const chipText = await p.$$eval('tr', trs => { const r = trs.find(tr => (tr.querySelector('td')?.textContent ?? '').startsWith('S3')); return r ? [...r.querySelectorAll('button')].map(b => b.textContent).join(' | ') : '' })
  t(chipText.length > 0 && !/\d\d:\d\d/.test(chipText), 'standard shifts show no hours under the name', chipText.slice(0, 120))

  // ── moves, on the throwaway week ──
  for (let i = 0; i < 5; i++) await p.click('text=Next ›')
  await p.waitForTimeout(2000)
  const cell = (shift, dayIdx) => p.locator(`xpath=//tr[td[1][starts-with(normalize-space(.),'${shift}')]]/td[${dayIdx + 2}]`)
  const chip = (shift, dayIdx, who) => cell(shift, dayIdx).locator('button', { hasText: who }).first()
  t(await chip('S1', 0, 'New').isVisible(), 'the throwaway week shows New on S1, Monday 9 Nov')

  // 1. move to a different shift → takes its hours
  await chip('S1', 0, 'New').dragTo(cell('S3', 0)); await p.waitForTimeout(2500)
  const r1 = await row('New'); t(r1.shift_name === 'S3' && r1.start_time === '16:30:00' && r1.end_time === '00:30:00', 'drag New S1 → S3: stored with S3\'s hours', hhmm(r1))
  t(await chip('S3', 0, 'New').isVisible() && !/\d\d:\d\d/.test(await chip('S3', 0, 'New').innerText()), 'New now shows on S3, with no hours printed')

  // 2. swap two people → each takes the hours of where they land
  await chip('S2', 0, 'Hiếu').dragTo(chip('S3', 0, 'New')); await p.waitForTimeout(3000)
  const [h2, n2] = [await row('Hiếu'), await row('New')]
  t(h2.shift_name === 'S3' && h2.start_time === '16:30:00' && n2.shift_name === 'S2' && n2.start_time === '15:30:00', 'swap Hiếu ↔ New: each takes the hours of the shift they land on', `${hhmm(h2)} · ${hhmm(n2)}`)

  // 3. same shift, another day → keeps hand-set hours, and shows them because they are unusual
  await db('PATCH', `rota_shifts?notes=eq.uitest&member=eq.${id('Hiếu')}`, { start_time: '17:00' })
  await p.click('text=Next ›'); await p.click('text=‹ Prev').catch(async () => { await p.reload({ waitUntil: 'networkidle' }) })
  await p.waitForTimeout(2000)
  if (!(await chip('S3', 0, 'Hiếu').isVisible().catch(() => false))) { await p.reload({ waitUntil: 'networkidle' }); for (let i = 0; i < 7; i++) await p.click('text=Next ›'); await p.waitForTimeout(2000) }
  const shown = await chip('S3', 0, 'Hiếu').innerText().catch(() => '')
  t(/17:00/.test(shown), 'hand-set hours (17:00) are shown under the name, because they are unusual', shown)
  await chip('S3', 0, 'Hiếu').dragTo(cell('S3', 1)); await p.waitForTimeout(2500)
  const h3 = await row('Hiếu'); t(h3.shift_date === TUE && h3.start_time === '17:00:00', 'drag to Tuesday on the same shift: hand-set hours kept', hhmm(h3))

  // ── the rules panel lost the retired controls ──
  await p.click('text=Rota rules per person'); await p.waitForTimeout(800)
  const rulesText = await p.locator('body').innerText()
  t(!/Office day|Always works|Day off together with/.test(rulesText), 'retired controls are gone from the rules panel')
  // Case-insensitive: the label is CSS-uppercased, and innerText returns what
  // is displayed — "HOURS / WEEK". The first run failed on exactly that.
  t(/hours \/ week/i.test(rulesText), '"Hours / week" is shown in the rules panel')
  t(!/contract/i.test(rulesText), '"contracted" appears nowhere on the page')

  // Equal day columns — the one layout bug the first screenshot showed.
  const widths = await p.$$eval('tr', trs => { const r = trs.find(tr => (tr.querySelector('td')?.textContent ?? '').startsWith('S3')); return r ? [...r.querySelectorAll('td')].slice(1).map(td => Math.round(td.getBoundingClientRect().width)) : [] })
  t(widths.length === 7 && Math.max(...widths) - Math.min(...widths) <= 2, 'the seven day columns are equal width, even with unusual hours on one', widths.join(' '))
  await p.screenshot({ path: '/tmp/rota-ui.png', fullPage: false })
  t(errors.filter(e => !/favicon|Download the React DevTools|hydrat/i.test(e)).length === 0, 'no page errors', errors.slice(0, 3).join(' | '))
} catch (e) { fail++; bugs.push('test crashed: ' + e.message.split('\n')[0]); console.log('✗ crashed —', e.message.split('\n')[0]) }
finally {
  const ids = (await db('GET', 'rota_shifts?select=id&notes=eq.uitest')).map(r => r.id)
  for (const i of ids) await db('DELETE', `activity_events?object_id=eq.${i}`)
  await db('DELETE', 'rota_shifts?notes=eq.uitest')
  const left = await db('GET', 'rota_shifts?select=id&notes=eq.uitest'), evLeft = ids.length ? await db('GET', `activity_events?select=id&object_id=in.(${ids.join(',')})`) : []
  console.log(`cleanup: ${left.length} test shifts and ${evLeft.length} activity entries left`)
  await b.close()
}
console.log(`\n${pass} passed, ${fail} failed`); if (bugs.length) { console.log('BUGS:'); bugs.forEach(x => console.log('  · ' + x)) }
process.exit(fail ? 1 : 0)
