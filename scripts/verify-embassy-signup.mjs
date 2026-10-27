// ═══════════════════════════════════════════════════════════════════════════
// THE EMBASSY MAILING LIST — the kiosk's second tab.
//   node scripts/verify-embassy-signup.mjs          (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// This form takes personal data and a marketing permission from strangers, on
// a shared tablet, at an event. The things that matter are therefore not
// "does it save":
//
//   · the consent box starts UNTICKED and the form refuses without it
//   · the consent WORDING is stored with the row, or it proves nothing
//   · the fields CLEAR after a save — the next guest must never see the last
//     guest's name and email on the screen
//   · the list is not readable by anon, and not writable from the browser
//   · the same person twice is one row, with their interests merged
//
// It runs without the table and says so, rather than reporting a hollow pass.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const BASE = process.env.BASE || 'http://localhost:3001'
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const anon = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const tetPass = (() => {
  const exp = String(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return `${exp}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')}`
})()
const EMAIL = `zz-embassy-${randomUUID().slice(0, 8)}@example.invalid`
const post = (body, cookie = `trc_tet=${tetPass}`) => fetch(`${BASE}/api/embassy/signup`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
})
const CONSENT = 'I agree to receive marketing emails from The Spirits Embassy about products, offers and events. I can unsubscribe at any time.'
const good = { full_name: 'Zz Testerson', email: EMAIL, interests: ['events', 'tastings'], marketing_consent: true, consent_text: CONSENT }

console.log('\n0 · is the table there?')
const probe = await rest('embassy_signups?select=id&limit=1')
const HAVE_TABLE = probe.status === 200
t(HAVE_TABLE, '0 · embassy_signups exists',
  HAVE_TABLE ? 'yes' : `NO (${probe.status}) — run db/embassy_signups.sql; the write checks below are skipped`)

console.log('\n1 · the door and the refusals (these need no table)')
const noCookie = await post(good, '')
t(noCookie.status === 403, '1 · without the Tết pass → 403', `${noCookie.status}`)
for (const [label, body, want] of [
  ['no name', { ...good, full_name: '   ' }, 400],
  ['a bad email', { ...good, email: 'not-an-email' }, 400],
  ['consent not given', { ...good, marketing_consent: false }, 400],
  ['consent with no wording', { ...good, consent_text: '' }, 400],
]) {
  const r = await post(body)
  t(r.status === want, `1 · ${label} → ${want}`, `${r.status}`)
}

if (HAVE_TABLE) {
  console.log('\n2 · it saves, with the evidence')
  const r = await post(good)
  const j = await r.json().catch(() => ({}))
  t(r.ok, '2 · a complete sign-up is accepted', r.ok ? '' : `${r.status} ${JSON.stringify(j).slice(0, 160)}`)
  const rows = await (await rest(`embassy_signups?email_key=eq.${EMAIL.toLowerCase()}&select=*`)).json()
  t(rows.length === 1, '2b · exactly one row', `${rows.length}`)
  const row = rows[0] || {}
  t(row.marketing_consent === true, '2c · consent recorded as true')
  t(row.consent_text === CONSENT, '2d · with the EXACT wording that was on the screen',
    row.consent_text === CONSENT ? 'verbatim' : JSON.stringify(String(row.consent_text).slice(0, 60)))
  t(!!row.consented_at, '2e · and when they agreed', row.consented_at)
  t(JSON.stringify((row.interests || []).sort()) === JSON.stringify(['events', 'tastings']),
    '2f · the ticked interests, and only those', JSON.stringify(row.interests))

  console.log('\n3 · the same person twice is one row')
  const again = await post({ ...good, interests: ['b2b'], full_name: 'Zz Testerson' })
  const j2 = await again.json().catch(() => ({}))
  t(again.ok && j2.returning === true, '3 · a repeat sign-up is recognised', `returning=${j2.returning}`)
  const rows2 = await (await rest(`embassy_signups?email_key=eq.${EMAIL.toLowerCase()}&select=interests`)).json()
  t(rows2.length === 1, '3b · still one row, not two', `${rows2.length}`)
  t(JSON.stringify((rows2[0]?.interests || []).sort()) === JSON.stringify(['b2b', 'events', 'tastings']),
    '3c · and their interests MERGED rather than being replaced', JSON.stringify(rows2[0]?.interests))

  console.log('\n4 · an unknown interest cannot get in')
  const junkEmail = `zz-junk-${randomUUID().slice(0, 8)}@example.invalid`
  const r4 = await post({ ...good, email: junkEmail, interests: ['events', 'free_beer'] })
  t(r4.ok, '4 · the row still saves', `${r4.status}`)
  const j4 = await (await rest(`embassy_signups?email_key=eq.${junkEmail.toLowerCase()}&select=interests`)).json()
  t(JSON.stringify(j4[0]?.interests || []) === JSON.stringify(['events']),
    '4b · and the unknown value is dropped, not stored', JSON.stringify(j4[0]?.interests))
  await rest(`embassy_signups?email_key=eq.${junkEmail.toLowerCase()}`, { method: 'DELETE' })

  console.log('\n5 · the list is not public')
  const anonRead = await fetch(`${U}/rest/v1/embassy_signups?select=email&limit=5`, { headers: anon })
  const anonRows = await anonRead.json().catch(() => null)
  t(!Array.isArray(anonRows) || anonRows.length === 0,
    '5 · anon cannot read the list', Array.isArray(anonRows) ? `${anonRows.length} rows visible` : `blocked (${anonRead.status})`)
  const anonWrite = await fetch(`${U}/rest/v1/embassy_signups`, {
    method: 'POST', headers: { ...anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'x', email: 'x@y.zz', email_key: 'x@y.zz', marketing_consent: false }) })
  t(anonWrite.status >= 400, '5b · and cannot write to it', `${anonWrite.status}`)
}

console.log('\n6 · the form on the tablet')
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true })
  await ctx.addCookies([{ name: 'trc_tet', value: tetPass, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage()
  await p.goto(`${BASE}/embassy/tet`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await p.waitForTimeout(2500)

  const tabs = p.locator('.et-tab')
  t(await tabs.count() === 2, '6 · there are two tabs on the kiosk', `${await tabs.count()}`)
  await tabs.nth(1).click()
  await p.waitForTimeout(600)
  const low = (await p.innerText('body')).toLowerCase()
  t(low.includes('keep in touch'), '6b · the second tab opens the list')
  for (const s of ['shop discount', 'events', 'whisky club', 'tasting', 'trade']) {
    t(low.includes(s), `6c · "${s}" is offered`)
  }
  const box = p.locator('.es-consent input[type="checkbox"]')
  t(await box.count() === 1, '6d · there is a consent box')
  t(await box.isChecked() === false, '6e · and it starts UNTICKED')

  // It must refuse without the tick, even with everything else filled in.
  await p.fill('#es-name', 'Zz Screen')
  await p.fill('#es-email', `zz-screen-${randomUUID().slice(0, 6)}@example.invalid`)
  await p.locator('.es-chip').first().click()
  await p.locator('.es-go').click()
  await p.waitForTimeout(700)
  const afterNoTick = (await p.innerText('body')).toLowerCase()
  t(afterNoTick.includes('tick the box'), '6f · it refuses to save without the tick')

  if (HAVE_TABLE) {
    const screenEmail = `zz-screen-${randomUUID().slice(0, 8)}@example.invalid`
    await p.fill('#es-email', screenEmail)
    await box.check()
    await p.locator('.es-go').click()
    await p.waitForTimeout(1800)
    t((await p.innerText('body')).toLowerCase().includes('thank you'), '6g · a complete form saves')
    // THE NEXT GUEST MUST NOT SEE THE LAST GUEST'S DETAILS.
    await p.locator('.es-again').click()
    await p.waitForTimeout(500)
    t(await p.inputValue('#es-name') === '', '6h · the name box is empty for the next guest')
    t(await p.inputValue('#es-email') === '', '6i · and the email box')
    t(await p.locator('.es-consent input').isChecked() === false, '6j · and consent is unticked again')
    t(await p.locator('.es-chip.is-on').count() === 0, '6k · and no interest is still selected')
    await rest(`embassy_signups?email_key=eq.${screenEmail.toLowerCase()}`, { method: 'DELETE' })
  }
} finally { await browser.close() }

if (HAVE_TABLE) await rest(`embassy_signups?email_key=eq.${EMAIL.toLowerCase()}`, { method: 'DELETE' })

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed`)
if (!HAVE_TABLE) console.log('⚠ The write checks were SKIPPED — run db/embassy_signups.sql and run this again.')
console.log('')
process.exit(fail === 0 ? 0 : 1)
