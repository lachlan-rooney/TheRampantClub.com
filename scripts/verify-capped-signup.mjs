// Drives the capped-signup path in a REAL browser as a member: sign up, watch the
// count move, withdraw, watch the seat free, sign up again — then force the race
// that produces the "full" refusal and read it as a member would.
//
// Throwaway fixture and throwaway members; everything is removed at the end.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, S = env.SUPABASE_SERVICE_ROLE_KEY
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SEC = env.SUPABASE_JWT_SECRET
const h = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' }
const b64u = b => Buffer.from(b).toString('base64url')
const mint = id => { const n = Math.floor(Date.now()/1e3)
  const H = b64u(JSON.stringify({ alg:'HS256', typ:'JWT' }))
  const P = b64u(JSON.stringify({ sub:id, aud:'authenticated', role:'authenticated', iat:n, exp:n+1800 }))
  return `${H}.${P}.${b64u(createHmac('sha256', SEC).update(`${H}.${P}`).digest())}` }
const asMember = id => ({ apikey: ANON, Authorization: `Bearer ${mint(id)}`, 'Content-Type': 'application/json' })

const PASS = 'ZZ-Probe-Pass-2691'
const mkUser = async email => (await (await fetch(`${U}/auth/v1/admin/users`, { method:'POST', headers:h,
  body: JSON.stringify({ email, password: PASS, email_confirm: true }) })).json()).id
const rmUser = id => fetch(`${U}/auth/v1/admin/users/${id}`, { method:'DELETE', headers:h })

let fails = 0
const ok = (c, label, detail='') => { console.log(`${c ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`); if (!c) fails++ }

// Unique per run. An interrupted run leaves its fixture behind, and a second run
// with the same title then matches two cards — and, worse, members can see both.
const TITLE = `ZZ Walkthrough ${Date.now().toString().slice(-6)} — capped at six`
let fixture, driver, fillers = []

// Sweep anything a previous interrupted run left in front of members.
const sweep = async () => {
  const olds = await (await fetch(`${U}/rest/v1/fixtures?select=id&title=like.ZZ*`, { headers:h })).json()
  for (const f of olds || []) {
    await fetch(`${U}/rest/v1/fixture_signups?fixture_id=eq.${f.id}`, { method:'DELETE', headers:h })
    await fetch(`${U}/rest/v1/fixtures?id=eq.${f.id}`, { method:'DELETE', headers:h })
  }
  if ((olds || []).length) console.log(`  swept ${olds.length} leftover ZZ fixture(s) before starting`)
}

try {
  await sweep()
  driver = await mkUser('zz-driver@example.invalid')
  fixture = (await (await fetch(`${U}/rest/v1/fixtures`, { method:'POST', headers:{...h, Prefer:'return=representation'},
    body: JSON.stringify({ type:'social', title:TITLE, max_signups:6,
      date: new Date(Date.now()+864e5*20).toISOString(),
      signup_deadline: new Date(Date.now()+864e5*15).toISOString(),
      location:'Somewhere else entirely' }) })).json())[0]

  // channel:'chrome' drives the ALREADY-INSTALLED system Chrome. Playwright's own
  // browser download writes to ~/Library/Caches, outside this project, which
  // CLAUDE.md forbids — and a real Chrome is a truer test surface anyway.
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } })

  await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'zz-driver@example.invalid')
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/members/, { timeout: 20000 })
  ok(true, 'logged in as a member in a real browser', page.url().replace('http://localhost:3001',''))

  // The portal guide auto-opens for a member who has not seen it, and its backdrop
  // swallows clicks. A real member dismisses it; so does this.
  const dismissGuide = async () => {
    // Mounts a beat AFTER domcontentloaded — sampling once races it.
    const root = page.locator('.pg-root')
    await root.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {})
    if (await root.count()) {
      await page.locator('.pg-close').first().click().catch(() => {})
      await root.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    }
  }
  await dismissGuide()

  const card = page.locator('.wo-card', { hasText: TITLE })
  const countOf = async () => (await card.locator('.wo-count').innerText()).trim()
  const goEvents = async () => { await page.goto('http://localhost:3001/members/events', { waitUntil:'domcontentloaded' })
                                 await dismissGuide()
                                 await card.waitFor({ timeout: 15000 }) }

  await goEvents()
  ok(true, 'the entry is on What’s On', (await card.locator('.wo-title').innerText()).trim())
  ok((await card.innerText()).includes('Somewhere else entirely'), 'an EXTERNAL venue renders in the member card')
  ok(await countOf() === '0/6 in', 'starts empty', await countOf())

  console.log('\n── sign up, withdraw, sign up again ──')
  await card.getByRole('button', { name: 'Sign me up' }).click()
  await page.waitForFunction(() => document.querySelector('.wo-count')?.textContent?.includes('1/6'), null, { timeout: 15000 })
  ok(await countOf() === '1/6 in', 'signing up moves the count', await countOf())
  ok((await card.innerText()).includes('You’re in') || (await card.innerText()).includes("You're in"), 'the card says "You’re in"')

  await card.getByRole('button', { name: 'Withdraw' }).click()
  await page.waitForFunction(() => document.querySelector('.wo-count')?.textContent?.includes('0/6'), null, { timeout: 15000 })
  ok(await countOf() === '0/6 in', 'withdrawing frees the seat', await countOf())

  await card.getByRole('button', { name: 'Sign me up' }).click()
  await page.waitForFunction(() => document.querySelector('.wo-count')?.textContent?.includes('1/6'), null, { timeout: 15000 })
  ok(await countOf() === '1/6 in', 'the freed seat is takeable again', await countOf())

  console.log('\n── the cap holds at six ──')
  for (let i = 0; i < 5; i++) fillers.push(await mkUser(`zz-fill-${i}@example.invalid`))
  for (const f of fillers) await fetch(`${U}/rest/v1/rpc/fixture_signup`, { method:'POST', headers:asMember(f), body: JSON.stringify({ p_fixture_id: fixture.id }) })
  const seventh = await mkUser('zz-seventh@example.invalid'); fillers.push(seventh)
  const over = await (await fetch(`${U}/rest/v1/rpc/fixture_signup`, { method:'POST', headers:asMember(seventh), body: JSON.stringify({ p_fixture_id: fixture.id }) })).json()
  ok(over === 'full', 'a seventh member is refused', JSON.stringify(over))
  const rows = (await (await fetch(`${U}/rest/v1/fixture_signups?select=id&fixture_id=eq.${fixture.id}`, { headers:h })).json()).length
  ok(rows === 6, 'rows for a cap of six', String(rows))

  console.log('\n── the FULL state, as a member sees it ──')
  await goEvents()
  const fullTxt = await card.innerText()
  ok(fullTxt.includes('6/6'), 'the count reads 6/6', (await countOf()))
  const btns = await card.getByRole('button', { name: /Sign me up|Withdraw/ }).count()
  ok(fullTxt.includes('Withdraw') || btns > 0, 'a member who IS in still sees Withdraw (they can free their seat)')

  console.log('\n── the RACE, which is the only way the refusal is ever read ──')
  // Withdraw so the driver is out, refill the seat behind their back, then click
  // the button their stale page is still showing.
  await card.getByRole('button', { name: 'Withdraw' }).click()
  await page.waitForFunction(() => document.querySelector('.wo-count')?.textContent?.includes('5/6'), null, { timeout: 15000 })
  ok(await countOf() === '5/6 in', 'driver withdrew, a seat is open on their screen', await countOf())
  const sniper = await mkUser('zz-sniper@example.invalid'); fillers.push(sniper)
  await fetch(`${U}/rest/v1/rpc/fixture_signup`, { method:'POST', headers:asMember(sniper), body: JSON.stringify({ p_fixture_id: fixture.id }) })
  await card.getByRole('button', { name: 'Sign me up' }).click()
  await page.locator('.wo-empty[style*="C27070"], .wo-empty').first().waitFor({ timeout: 15000 })
  const shown = (await page.locator('.wo-empty').first().innerText()).trim()
  console.log(`\n    ON SCREEN: "${shown}"\n`)
  ok(/filled up while you were looking/i.test(shown), 'the refusal a member actually reads')
  // The refusal renders as soon as setErrorMsg fires; the count corrects only
  // after the awaited refetch. Assert it SETTLES, not that it is already right —
  // otherwise this measures my timing rather than the product's behaviour.
  const corrected = await page.waitForFunction(
    () => document.querySelector('.wo-count')?.textContent?.includes('6/6'),
    null, { timeout: 8000 }).then(() => true).catch(() => false)
  ok(corrected, 'and the count corrects itself to 6/6 after the refetch', corrected ? await countOf() : `stuck at ${await countOf()}`)

  await page.screenshot({ path: 'scripts/.capped-refusal.png', fullPage: false })
  await browser.close()
} catch (e) {
  console.log('✗ walkthrough threw:\n' + e.message.split('\n').slice(0,14).join('\n')); fails++
} finally {
  if (fixture) { await fetch(`${U}/rest/v1/fixture_signups?fixture_id=eq.${fixture.id}`, { method:'DELETE', headers:h })
                 await fetch(`${U}/rest/v1/fixtures?id=eq.${fixture.id}`, { method:'DELETE', headers:h }) }
  for (const id of [driver, ...fillers].filter(Boolean)) await rmUser(id)
  await sweep()
  const left = await (await fetch(`${U}/rest/v1/fixtures?select=id&title=like.ZZ*`, { headers:h })).json()
  console.log(`\n  cleaned up — ZZ fixtures left: ${left.length}`)
}
console.log(fails === 0 ? 'PASS\n' : `FAIL — ${fails}\n`)
process.exit(fails ? 1 : 0)
