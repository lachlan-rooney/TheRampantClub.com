// ═══════════════════════════════════════════════════════════════════════════
// THE QR FLOW — scan, sign up, casks.
//   node scripts/verify-embassy-qr-flow.mjs        (BASE=... for production)
// ───────────────────────────────────────────────────────────────────────────
// Built for the Tết event, 2026-11-06. A guest scans the code on the tablet,
// leaves a name and an email on their own phone, and the cask board opens.
//
// The thing this must prove is not "a page renders". It is that NOBODY CAN BE
// LOCKED OUT. The shop launch was lost to a password door that would not
// accept a correct password, so this gate has no password: the form is the
// key, the welcome page is open to everyone, and the tablet is exempt
// entirely.
//
// It runs as an ANDROID PHONE, because that is what the crowd will hold, and
// the tablet on the floor is a Samsung.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { chromium, devices } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const SVC = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
const B = process.env.BASE || 'http://localhost:3001'
const WANT = ['Q5364','Q5088','Q5134','Q5423','Q5177','Q5430','Q5057','Q5113','Q5439','Q5358']

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }
const cleanup = []

const br = await chromium.launch()
try {
  const ctx = await br.newContext({ ...devices['Pixel 7'] })
  const pg = await ctx.newPage()

  console.log('\n1 · a cold phone is sent to the form, not to a password')
  await pg.goto(`${B}/embassy/tet`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await pg.waitForTimeout(1200)
  t(new URL(pg.url()).pathname === '/embassy/welcome', '1 · the casks redirect to welcome', new URL(pg.url()).pathname)
  const b1 = await pg.innerText('body')
  t(!WANT.some(r => b1.includes(r)), '1b · no cask leaks on the way')
  t(/password|mật khẩu/i.test(b1) === false, '1c · nothing asks for a password')
  t(await pg.locator('#es-name').count() === 1 && await pg.locator('#es-email').count() === 1,
    '1d · the name and email fields are there')
  // The phone has already scanned; showing it the QR again would be absurd.
  t(await pg.locator('svg[role="img"]').count() === 0, '1e · and the QR is NOT shown on the phone')

  console.log('\n2 · the form is the key')
  const EMAIL = `zz-qr-${randomUUID().slice(0, 8)}@example.invalid`
  cleanup.push(EMAIL.toLowerCase())
  await pg.fill('#es-name', 'Zz QR Guest')
  await pg.fill('#es-email', EMAIL)
  await pg.locator('.es-chip').first().tap()
  // It must refuse without consent even here.
  await pg.locator('.es-go').tap(); await pg.waitForTimeout(600)
  t((await pg.innerText('body')).toLowerCase().includes('tick the box'), '2 · still refuses without consent')
  await pg.locator('.es-consent').tap()
  await pg.locator('.es-go').tap()
  await pg.waitForURL(/\/embassy\/tet/, { timeout: 25000 }).catch(() => {})
  await pg.waitForTimeout(2500)
  t(new URL(pg.url()).pathname === '/embassy/tet', '2b · and then opens the casks', new URL(pg.url()).pathname)
  const b2 = await pg.innerText('body')
  t(WANT.every(r => b2.includes(r)), '2c · all ten are there', `${WANT.filter(r => b2.includes(r)).length}/10`)

  console.log('\n3 · the lead was captured')
  const row = await (await fetch(`${U}/rest/v1/embassy_signups?email_key=eq.${EMAIL.toLowerCase()}&select=*`, { headers: SVC })).json()
  t(row.length === 1, '3 · one row', `${row.length}`)
  t(row[0]?.marketing_consent === true && !!row[0]?.consent_text, '3b · with consent and its wording')
  t(row[0]?.source === 'web_embassy_tet', '3c · marked as coming from the web, not the kiosk', row[0]?.source)

  console.log('\n4 · they are not asked twice')
  await pg.goto(`${B}/embassy/tet`, { waitUntil: 'domcontentloaded' })
  await pg.waitForTimeout(1500)
  t(new URL(pg.url()).pathname === '/embassy/tet', '4 · a later visit goes straight in')

  console.log('\n5 · a DIFFERENT phone still has to sign up')
  const ctx2 = await br.newContext({ ...devices['Pixel 7'] })
  const pg2 = await ctx2.newPage()
  await pg2.goto(`${B}/embassy/tet`, { waitUntil: 'domcontentloaded' })
  await pg2.waitForTimeout(1200)
  t(new URL(pg2.url()).pathname === '/embassy/welcome', '5 · the pass does not leak between devices')
  await ctx2.close()

  console.log('\n6 · the QR itself')
  const comp = readFileSync('components/embassy/EmbassyQR.tsx', 'utf8')
  t(comp.includes('/embassy/welcome'), '6 · points at the welcome page')
  const vb = (comp.match(/viewBox="0 0 (\d+) (\d+)"/) || [])
  t(vb[1] === vb[2] && vb[1] === '29', '6b · viewBox matches the 29x29 module grid', `${vb[1]}x${vb[2]}`)
  const d = (comp.match(/d="(M[^"]+)"/) || [])[1] || ''
  const maxCoord = Math.max(...[...d.matchAll(/[Mm]\s*([\d.]+)\s+([\d.]+)/g)].flatMap(m => [+m[1], +m[2]]))
  t(maxCoord < 29, '6c · the path fits inside it (a mismatch would not scan)', `max ${maxCoord}`)
} finally {
  await br.close()
  for (const e of cleanup) await fetch(`${U}/rest/v1/embassy_signups?email_key=eq.${e}`, { method: 'DELETE', headers: SVC })
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
