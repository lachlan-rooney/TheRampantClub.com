// ═══════════════════════════════════════════════════════════════════════════
// EXTERNAL CATERING — priced per head, by the size of the party.
//   node tests/menus/set-ladder.test.mjs           (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-23: set menu prices for specific numbers, 5 to 12 guests,
// Hoa Túc and Lune; and "Lune is only for The Dining Room".
//
// ⚠ IT CREATES A THROWAWAY SET MENU on Lune, with prices that are plainly
// marked as a test, and deletes it (and its rungs) at the end whether the test
// passes or fails. It writes nothing to a real menu and invents no real price:
// the numbers here exist for about twenty seconds and say so in their name.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'

const ORIGIN = 'http://localhost:3001'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }

const token = 'test-' + randomBytes(16).toString('hex')
let deviceId = null, setId = null

async function cleanup() {
  if (setId) {
    await rest(`menu_set_prices?set_menu_id=eq.${setId}`, { method: 'DELETE' })
    await rest(`menu_set_menus?id=eq.${setId}`, { method: 'DELETE' })
  }
  if (deviceId) await rest(`kiosk_devices?id=eq.${deviceId}`, { method: 'DELETE' })
}

const b = await chromium.launch()
try {
  const lune = (await (await rest('menu_venues?select=id,name,dining_only&slug=eq.lune')).json())[0]
  t(!!lune?.dining_only, 'Lune is marked as The Dining Room only', JSON.stringify(lune))

  deviceId = (await (await rest('kiosk_devices', {
    method: 'POST',
    body: JSON.stringify({ label: 'Source & Origin Lab', room: 'Source & Origin Lab', purpose: 'room', token_hash: createHash('sha256').update(token).digest('hex'), enrolled_at: new Date().toISOString() }),
  })).json())[0].id

  // A menu for 5 to 12, and a price for every size in between.
  setId = (await (await rest('menu_set_menus', {
    method: 'POST',
    body: JSON.stringify({
      venue_id: lune.id, slug: 'automated-test-' + randomBytes(4).toString('hex'),
      name_en: 'AUTOMATED TEST — ignore', standfirst_en: 'A throwaway menu written by a test.',
      min_covers: 5, max_covers: 12, notice_hours: 48, is_active: true, is_placeholder: true,
    }),
  })).json())[0].id
  const rungs = [5, 6, 7, 8, 9, 10, 11, 12].map(covers => ({ set_menu_id: setId, covers, price_per_head_vnd: 1_500_000 - (covers - 5) * 50_000 }))
  const made = await (await rest('menu_set_prices', { method: 'POST', body: JSON.stringify(rungs) })).json()
  t(Array.isArray(made) && made.length === 8, 'a price for every party size from 5 to 12', `${made?.length} rungs`)

  // ── THE RULE THE DATABASE KEEPS ─────────────────────────────────────────
  const tooBig = await rest('menu_set_prices', { method: 'POST', body: JSON.stringify([{ set_menu_id: setId, covers: 15, price_per_head_vnd: 900_000 }]) })
  const tooBigMsg = await tooBig.text()
  t(tooBig.status >= 400 && /stops at 12 guests/i.test(tooBigMsg),
    'a price for 15 guests on a menu that stops at 12 is refused', `${tooBig.status} ${tooBigMsg.slice(0, 90)}`)
  const tooSmall = await rest('menu_set_prices', { method: 'POST', body: JSON.stringify([{ set_menu_id: setId, covers: 2, price_per_head_vnd: 900_000 }]) })
  t(tooSmall.status >= 400, 'and so is one for 2', `${tooSmall.status}`)

  // ── ON THE TABLET ───────────────────────────────────────────────────────
  const ctx = await b.newContext({ viewport: { width: 1024, height: 1366 }, hasTouch: true })
  await ctx.addCookies([{ name: 'trc_kiosk_device', value: token, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message))
  await p.goto(`${ORIGIN}/kiosk/menu`, { waitUntil: 'networkidle', timeout: 120000 })
  await p.waitForTimeout(2400)

  const onPlates = await p.locator('.mb-tile', { hasText: 'Lune' }).count()
  t(onPlates === 0, 'Lune is NOT on the Plates tab', `${onPlates} tiles`)

  await p.locator('.mb-tab', { hasText: /Dining|Phòng ăn/ }).tap()
  await p.waitForTimeout(1200)
  const tile = p.locator('.mb-tile', { hasText: 'Lune' })
  const solo = await p.locator('.mb-solo').count()
  t(await tile.count() === 1 || solo === 1, 'and IS on The Dining Room tab')
  if (await tile.count() === 1) { await tile.tap(); await p.waitForTimeout(800) }

  const ladder = await p.locator('.mb-ladder').first().evaluate(el => ({
    head: el.querySelector('.mb-ladder-head')?.textContent?.trim(),
    rows: [...el.querySelectorAll('li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
    foot: el.querySelector('.mb-ladder-foot')?.textContent?.trim(),
  })).catch(() => null)
  t(!!ladder && ladder.rows.length === 8, 'the ladder shows every size', JSON.stringify(ladder?.rows?.slice(0, 2)))
  t(/5 guests/.test(ladder?.rows?.[0] || '') && /12 guests/.test(ladder?.rows?.[7] || ''),
    'from 5 guests to 12', `${ladder?.rows?.[0]} … ${ladder?.rows?.[7]}`)
  t(/1\.500\.000|1,500,000|1500K/.test(ladder?.rows?.[0] || ''), 'with the price per head beside each', ladder?.rows?.[0])
  t(/10% service/i.test(ladder?.foot || '') && /10% VAT/i.test(ladder?.foot || ''),
    'and says the prices are before service and VAT', ladder?.foot)
  const meta = await p.locator('.mb-set .mb-meta').first().textContent().catch(() => '')
  t(/5 to 12 guests/i.test(meta), 'the menu states the party size it serves', meta?.replace(/\s+/g, ' ').slice(0, 60))
  t(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '))
} finally {
  await cleanup()
  const left = await (await rest(`menu_set_menus?select=id&name_en=like.*AUTOMATED TEST*`)).json().catch(() => [])
  t(Array.isArray(left) && left.length === 0, 'the throwaway menu and its prices are gone', JSON.stringify(left))
  await b.close()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
