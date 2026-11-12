// ═══════════════════════════════════════════════════════════════════════════
// THE ACCEPTANCE TEST, AS ASKED:
//   load it · switch to aeroplane mode · RELOAD · run ten searches.
//
// ⚠ THE RELOAD IS THE WHOLE TEST. A page that keeps working offline because it
// is already in memory proves nothing — that is just JavaScript that has
// already loaded. Surviving a reload with the network gone is the thing the
// tablets actually need, and it only works if the service worker stored the
// page and its files.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'
import pw from `${process.cwd()}/node_modules/playwright/index.js`
const { chromium } = pw
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = await import(`${process.cwd()}/node_modules/@supabase/supabase-js/dist/index.cjs`)
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const OUT = '/private/tmp/claude-501/-Users-lachlanrooney-Downloads-rampant-club/7c80ed44-dfe0-4d44-9d67-7c6fbe63e6ce/scratchpad'
const BASE = process.env.BASE || 'http://localhost:3001'
const N = 40
let fails = 0
const t = (ok, l, d = '') => { console.log(`${ok ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!ok) fails++ }

let devId = null, hadList = null, evId = null
try {
  const { data: ev } = await a.from('popup_events').select('id, finder_whisky_ids').eq('slug', 'palace-2026-11-13').single()
  evId = ev.id; hadList = ev.finder_whisky_ids || []

  let ints = [], from = 0
  for (;;) {
    const { data } = await a.from('whisky_flavour_intensities').select('whisky_id, confirmed').range(from, from + 999)
    if (!data?.length) break; ints = ints.concat(data); if (data.length < 1000) break; from += 1000
  }
  const ids = [...new Set(ints.filter(r => r.confirmed).map(r => r.whisky_id))]
  const { data: ws } = await a.from('whiskies').select('id, in_stock').in('id', ids)
  const chosen = ws.filter(w => w.in_stock).slice(0, N).map(w => w.id)
  await a.from('popup_events').update({ finder_whisky_ids: chosen }).eq('id', evId)

  const token = randomUUID() + randomUUID()
  const { data: dev } = await a.from('kiosk_devices').insert({
    label: 'OFFLINE TEST — throwaway', token_hash: createHash('sha256').update(token).digest('hex'),
    purpose: 'room', enrolled_at: new Date().toISOString() }).select().single()
  devId = dev.id

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'allow' })
  await ctx.addCookies([{ name: 'trc_kiosk_device', value: token, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage()
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 140)))

  // ── 1 · LOAD IT, ON THE WIFI ───────────────────────────────────────────
  console.log('── on the wifi ──')
  await p.goto(`${BASE}/kiosk/popup/finder`, { waitUntil: 'networkidle', timeout: 45000 })
  await p.waitForSelector('.pf-ready', { timeout: 20000 })
  t(true, 'the page loads')

  // wait for the service worker to take control and store its files
  const became = await p.waitForFunction(
    () => document.querySelector('.pf-ready')?.className?.includes('is-ready'),
    null, { timeout: 45000 }).then(() => true, () => false)
  const label = await p.evaluate(() => document.querySelector('.pf-ready')?.textContent?.trim())
  t(became, 'and reports itself ready offline', label)
  t(/40 whiskies/.test(label || ''), 'naming how many bottles it is holding', label)
  await p.screenshot({ path: `${OUT}/finder-ready.png` })

  const beforeNames = await p.evaluate(() => document.body.innerText.length)

  // ── 2 · AEROPLANE MODE ────────────────────────────────────────────────
  console.log('\n── aeroplane mode ──')
  await ctx.setOffline(true)
  const stillOnline = await p.evaluate(() => navigator.onLine)
  t(stillOnline === false, 'the browser reports itself offline')

  // ── 3 · RELOAD ────────────────────────────────────────────────────────
  const reloaded = await p.reload({ waitUntil: 'domcontentloaded', timeout: 25000 })
    .then(r => r?.status() ?? 0, e => 'FAILED: ' + String(e.message).split('\n')[0].slice(0, 70))
  t(typeof reloaded === 'number', 'IT RELOADS WITH NO SIGNAL', String(reloaded))
  if (typeof reloaded === 'number') {
    // ⚠ WAIT FOR THE COMPASS, NOT THE INDICATOR. The indicator renders first;
    // screenshotting on it caught the page a second too early and reported a
    // blank screen that was simply not finished.
    const drew = await p.waitForSelector('.cf-compass', { timeout: 20000 }).then(() => true, () => false)
    t(drew, 'the compass is drawn again, from the cache')
    await p.waitForTimeout(800)
    const after = await p.evaluate(() => document.body.innerText.length)
    t(after > beforeNames * 0.5, 'and comes back with its contents, not a shell',
      `${after} characters on screen`)
    const n = await p.evaluate(() => document.querySelector('.pf-ready')?.textContent || '')
    t(/40 whiskies/.test(n), 'still holding all 40 bottles after the reload', n.trim())
  }
  await p.screenshot({ path: `${OUT}/finder-offline.png` })

  // ── 4 · TEN SEARCHES, STILL OFFLINE ───────────────────────────────────
  console.log('\n── ten searches, with the network still gone ──')
  // ⚠ "A REQUEST WAS MADE" IS NOT "THE NETWORK WAS USED". page.on('request')
  // fires for anything the page asks for, including what the service worker
  // then answers out of the cache without a packet leaving the device. The
  // honest measure is what FAILED (nothing can reach the network here) and
  // what came back NOT from the worker.
  let requests = 0, fromNetwork = 0, failed = 0
  const reqUrls = [], failUrls = []
  p.on('request', r => { requests++; reqUrls.push(r.url().replace(BASE, '')) })
  p.on('requestfailed', r => { failed++; failUrls.push(r.url().replace(BASE, '')) })
  p.on('response', async r => { try { if (!r.fromServiceWorker()) fromNetwork++ } catch {} })
  let ran = 0, answered = 0
  const names = new Set()
  for (let i = 0; i < 10; i++) {
    // ⚠ DRIVEN THROUGH THE REAL CONTROLS, by their real class names, read out
    // of the component rather than guessed: .cf-sw is a spoke on the compass,
    // .cf-btn-go is "Find my dram", .cf-pour-name is the whisky it names.
    // My first attempt invented selectors, found none, and reported ten
    // failures against a page that was working.
    // ⚠ THE SPOKES ARE SVG WEDGES INSIDE THE COMPASS — `path` elements with an
    // onClick, not anything called .cf-sw. Clicking a class that does not
    // exist set nothing, which left "Find my dram" DISABLED, which meant a
    // dispatched click on it did nothing at all. Ten real failures, all mine.
    await p.evaluate((round) => {
      const wedges = [...document.querySelectorAll('.cf-compass svg path[style*="cursor"]')]
      for (let k = 0; k <= round % 3; k++) {
        const el = wedges[(round * 5 + k * 3) % wedges.length]
        el?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }
    }, i)
    await p.waitForTimeout(120)
    const armed = await p.evaluate(() => {
      const go = document.querySelector('.cf-btn-go')
      return go && !go.disabled
    })
    if (armed) await p.click('.cf-btn-go')
    ran++
    const got = await p.waitForFunction(
      () => document.querySelector('.cf-pour-name')?.textContent?.trim() || null,
      null, { timeout: 6000 }).then(h => h.jsonValue(), () => null)
    if (got) { answered++; names.add(got.slice(0, 44)) }
    await p.evaluate(() => {
      const reset = document.querySelector('.cf-btn-ghost')
      reset?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await p.waitForTimeout(250)
  }
  console.log(`   answers: ${[...names].slice(0, 5).join(' · ')}`)
  t(answered === 10, 'ALL TEN SEARCHES ANSWERED, offline', `${answered}/${ran}`)
  t(names.size > 1, 'and they are not all the same answer', `${names.size} different recommendations`)
  t(failed === 0, '⚠ NOTHING FAILED — every request was answered from the device',
    failed ? failUrls.slice(0, 4).join(' | ') : `${requests} asked for, all served`)
  t(fromNetwork === 0, 'and not one response came from anywhere but the cache',
    `${fromNetwork} off-worker responses of ${requests}`)
  // ⚠ ONE LAST SEARCH FIRST. The loop ends on a reset, which clears the
  // results — so checking for the result's illustration straight afterwards
  // looked for a picture the page had just correctly removed.
  await p.evaluate(() => {
    const w = [...document.querySelectorAll('.cf-compass svg path[style*="cursor"]')]
    w[3]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await p.waitForTimeout(150)
  await p.click('.cf-btn-go')
  await p.waitForSelector('.cf-pour-name', { timeout: 6000 })
  await p.waitForTimeout(500)
  await p.screenshot({ path: `${OUT}/finder-offline-answer.png` })

  // and the picture the guest sees actually drew
  const drew = await p.evaluate(() => {
    const img = [...document.querySelectorAll('img')].find(i => /glass/.test(i.src))
    return img ? { src: img.src.split('/').pop(), ok: img.naturalWidth > 0 } : 'no glass image'
  })
  t(typeof drew === 'object' && drew.ok, 'including the illustration beside the result, from cache', JSON.stringify(drew))
  t(errs.length === 0, 'no page errors throughout', errs.join(' | ') || 'none')
  await ctx.setOffline(false)
  await browser.close()
} catch (e) {
  console.log(`\n✗ THE HARNESS ITSELF: ${e.message}`)
  console.log(String(e.stack || '').split('\n').slice(1, 4).join('\n')); fails++
} finally {
  if (evId) await a.from('popup_events').update({ finder_whisky_ids: hadList ?? [] }).eq('id', evId)
  if (devId) await a.from('kiosk_devices').delete().eq('id', devId)
  console.log(`\nput back · saved list restored to ${hadList?.length ?? 0} bottles · device removed`)
}
console.log(fails ? `\n✗ ${fails} FAILED` : '\n✓ the finder works with no connection')
process.exit(fails ? 1 : 0)
