// ═══════════════════════════════════════════════════════════════════════════
// THE AUCTION, PHOTOGRAPHED — 390 and 1280, every state.
//   node scripts/shoot-studio-auction.mjs        (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// ⚠ IT BUILDS ITS OWN EXHIBITION AND DELETES IT. The real show is not
//   published, not bid on and not touched: this stands up a throwaway
//   collaboration with four works shaped like the real four, publishes THAT,
//   photographs every state, and takes it down again. So the pictures can be
//   looked at before anything of Rizal's goes live.
//
// ⚠ IT SENDS NO REAL EMAIL. Every bidder address is at a domain that cannot
//   receive — which is also why one frame is captured twice: once honestly
//   (the confirmation email failed, and the page says so) and once with that
//   response stubbed to `emailed: true`, which is what a guest will actually
//   see. Both are saved, labelled.
//
// States: the page · a work with bids · the open form · the busy state ·
//         the success moment · bidding closed · a sold work · a priced work
//         and its enquiry form · the whole page under reduced motion.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3001'
const OUT = 'docs/auction-shots'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const SRV = env.SUPABASE_SERVICE_ROLE_KEY

const rest = (path, opts = {}) => fetch(`${U}/rest/v1/${path}`, {
  ...opts,
  headers: {
    apikey: SRV, Authorization: `Bearer ${SRV}`, 'Content-Type': 'application/json',
    ...(opts.prefer ? { Prefer: opts.prefer } : {}),
  },
})
const insert = async (table, row) => {
  const r = await rest(table, { method: 'POST', prefer: 'return=representation', body: JSON.stringify(row) })
  const j = await r.json()
  if (!r.ok) throw new Error(`${table}: ${JSON.stringify(j).slice(0, 300)}`)
  return j[0]
}

mkdirSync(OUT, { recursive: true })
const tag = `shoot-auction-${randomUUID().slice(0, 8)}`
let collabId
const shots = []

// ── THE FOUR WORKS, shaped like the real ones ────────────────────────────
// EIGHT WORKS, exactly as the exhibition publishes them ───────────
// ⚠ THIS LIST IS THE POINT OF THE SHOOT. The screenshots are shown to the
// owner to approve what guests will see, so a fixture that is merely
// "shaped like" the real thing is worth very little — it was four works when
// the exhibition had eight, and the banner in those images said "Two of the
// works are in a silent auction" over an auction of four. Figures, kinds and
// statuses here mirror the owner's table of 11 Nov 2026 line for line.
//
// ⚠ NOTHING IS PRICED. All four non-auction works sold before the guide went
// up, so there is no work in this exhibition carrying a price, and no Enquire
// control anywhere. The enquiry path still exists in the product and is still
// covered by section J of verify-studio-auction.mjs on its own fixture — it
// simply has nothing to point at here, which is the truth and should look
// like the truth.
const WORKS = [
  { title: 'Reminds Me Of', dims: '41 × 45 × 4 cm', kind: 'auction', status: 'live',
    start: 350, step: 50, reserve: 575, bids: [350, 400] },
  { title: 'Rainforest', dims: '110 × 130 × 4 cm', kind: 'auction', status: 'live',
    start: 1000, step: 100, reserve: 1650, bids: [],
    donation_pct: 30, donation_org: 'Borneo Nature Foundation' },
  { title: 'Black Swan', dims: '130 × 155 × 4 cm', kind: 'auction', status: 'live',
    start: 1400, step: 100, reserve: 2300, bids: [1400] },
  { title: 'Punch Punch', dims: '130 × 155 × 4 cm', kind: 'auction', status: 'live',
    start: 1400, step: 100, reserve: 2300, bids: [] },
  { title: 'Fresh Air', dims: '130 × 155 × 4 cm', kind: 'sale', status: 'sold',
    price: 3200, sold_price: 3200, sold_to: 'Fixture Buyer' },
  { title: 'Sawit', dims: '66 × 48 × 4 cm (Diptych)', kind: 'sale', status: 'sold',
    price: 1425, note: 'Sold as a pair', sold_price: 1425, sold_to: 'Fixture Buyer' },
  { title: 'Political Chair', dims: '120 × 100 × 4 cm', kind: 'sale', status: 'sold',
    price: 1950, sold_price: 1950, sold_to: 'Fixture Buyer' },
  { title: 'Titit Collection', dims: '120 × 100 × 4 cm', kind: 'sale', status: 'sold',
    price: 1950, sold_price: 1950, sold_to: 'Fixture Buyer' },
]

const PHONE = { width: 390, height: 844 }
const DESK = { width: 1280, height: 900 }

async function main() {
  // ── THE FIXTURE ────────────────────────────────────────────────────────
  // 'past', not 'live': the guide renders for live and past alike, and a
  // second LIVE exhibition would change what /studio shows the public while
  // this runs.
  const collab = await insert('collaborations', {
    slug: tag, artist_name: 'Rizal Fathoni', status: 'past', sort: 9998,
    accent: '#052E20', opens_on: '2026-11-10', closes_on: '2027-02-11',
  })
  collabId = collab.id

  const auction = await insert('studio_auctions', {
    collaboration_id: collabId,
    closes_at: '2026-11-14T15:00:00+07:00',
    announce_at: '2026-11-14T16:00:00+07:00',
    published: true, min_step_usd: 50, confirm_multiple: 5,
  })

  const lots = {}
  for (const [i, w] of WORKS.entries()) {
    const piece = await insert('collaboration_pieces', {
      collaboration_id: collabId, sort: i, title_en: w.title, year: '2026',
      medium_en: 'Acrylic & Oil on Canvas', dimensions: w.dims,
    })
    lots[w.title] = await insert('studio_lots', {
      auction_id: auction.id, piece_id: piece.id, sort: i,
      kind: w.kind, status: w.status,
      price_usd: w.price ?? null, price_note_en: w.note ?? null,
      starting_bid_usd: w.start ?? null, step_usd: w.step ?? null, reserve_usd: w.reserve ?? null,
      donation_pct: w.donation_pct ?? null, donation_org: w.donation_org ?? null,
      sold_price_usd: w.sold_price ?? null, sold_to: w.sold_to ?? null,
      sold_on: w.status === 'sold' ? '2026-11-11' : null,
    })
    lots[w.title].index = i + 1
  }

  // ── A COUPLE OF REAL BIDS, through the real route ──────────────────────
  const terms = 'A bid is a commitment to buy at that price if it wins and meets the reserve.'
  for (const w of WORKS.filter(x => x.bids?.length)) {
    for (const [j, amount] of w.bids.entries()) {
      const r = await fetch(`${BASE}/api/studio/auction/bid`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: lots[w.title].id, name: `Fixture Bidder ${j + 1}`,
          email: `delivered+shoot-${j}@resend.dev`, phone: '', amount, lang: 'en',
          share_price: false, news: false, terms_text: terms,
        }),
      })
      if (!r.ok) console.log('  bid refused:', amount, (await r.json()).error)
    }
  }
  console.log(`fixture up — /studio/${tag}/guide\n`)

  const browser = await chromium.launch()

  // ── THE SHOOT ──────────────────────────────────────────────────────────
  // ── HIDING NEXT'S DEV INDICATOR ─────────────────────────────────────────
  // The black circle bottom-left is Next's dev-mode badge, not the product,
  // and it sat in every delivered screenshot.
  //
  // ⚠ WHY THE OBVIOUS VERSION DID NOTHING. This used to append the <style>
  // to document.documentElement straight from the init script. An init script
  // runs against the EMPTY document, before the real one is parsed — so the
  // style was appended and then thrown away by the page it was meant to
  // affect, and `getComputedStyle(portal).display` stayed "block" while the
  // code read as though it were handled. The style has to be added once the
  // document exists, and again on load because the overlay mounts late.
  const hideOverlay = () => {
    const add = () => {
      if (document.getElementById('__no_overlay')) return
      const s = document.createElement('style')
      s.id = '__no_overlay'
      s.textContent = 'nextjs-portal{display:none!important}'
      ;(document.head || document.documentElement).appendChild(s)
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add)
    else add()
    window.addEventListener('load', add)
  }

  for (const [label, viewport] of [['390', PHONE], ['1280', DESK]]) {
    const ctx = await browser.newContext({
      viewport, deviceScaleFactor: 2, locale: 'en-GB',
      timezoneId: 'Asia/Ho_Chi_Minh',
    })
    // The Next dev overlay is not part of the design.
    await ctx.addInitScript(hideOverlay)
    const page = await ctx.newPage()
    const shot = async (name, target) => {
      // ⚠ ASSERT THE OVERLAY IS GONE, EVERY TIME. Hiding it used to be a line
      // of code that ran and did nothing, and the only evidence was a black
      // circle in the corner of twenty-nine delivered images. An absent
      // portal is fine; a visible one is not, and it stops the run rather
      // than quietly spoiling the set.
      const overlay = await page.evaluate(() => {
        const e = document.querySelector('nextjs-portal')
        return e ? getComputedStyle(e).display : 'absent'
      })
      if (overlay !== 'none' && overlay !== 'absent') {
        throw new Error(`the Next dev overlay is showing (display: ${overlay}) — ${name} would carry it`)
      }
      const file = `${OUT}/${name}-${label}.png`
      await (target || page).screenshot({ path: file })
      shots.push(file)
      console.log('  ', file)
    }
    const go = async () => {
      await page.goto(`${BASE}/studio/${tag}/guide`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      // Wait for the live figures, not for the network to go quiet: the state
      // route is polled, so networkidle never arrives.
      await page.waitForSelector('.sga-banner', { timeout: 60_000 })
      await page.waitForTimeout(1200)
    }
    const piece = n => page.locator(`#piece-${n}`)

    console.log(`── ${label} ──`)
    await go()

    // 01 · THE PAGE, with the banner above the works.
    await page.evaluate(() => window.scrollTo(0, 0))
    await shot('01-page')

    // 02 · A WORK WITH BIDS.
    const withBids = piece(lots['Reminds Me Of'].index)
    await withBids.scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)
    await shot('02-work-with-bids', withBids)

    // 03 · THE FORM, open in place.
    await withBids.locator('.sga-cta').first().click()
    await page.waitForSelector('.sga-form', { timeout: 10_000 })
    await page.waitForTimeout(800)
    await withBids.scrollIntoViewIfNeeded()
    await shot('03-form-open', withBids)

    // 04 · THE BUSY STATE — the real submit, held in flight.
    await withBids.locator('.sga-field input').nth(0).fill('Fixture Guest')
    await withBids.locator('.sga-field input').nth(1).fill('delivered+busy@resend.dev')
    await page.route('**/api/studio/auction/bid', async route => {
      await new Promise(r => setTimeout(r, 6000))
      // ⚠ THE SHOT IS TAKEN AND THE ROUTE UNROUTED LONG BEFORE THIS WAKES.
      // Aborting a route that is no longer ours throws, and an uncaught throw
      // here killed the run and orphaned the fixture exhibition. The request
      // is going nowhere either way; failing to abort it is not a failure.
      await route.abort().catch(() => {})
    })
    await withBids.locator('.sga-cta').first().click()
    await page.waitForTimeout(900)
    await shot('04-busy', withBids)
    await page.unroute('**/api/studio/auction/bid')
    await page.waitForTimeout(1500)

    // 05 · THE SUCCESS MOMENT — a real bid, really written.
    await go()
    const live = piece(lots['Reminds Me Of'].index)
    await live.scrollIntoViewIfNeeded()
    await live.locator('.sga-cta').first().click()
    await page.waitForSelector('.sga-form')
    await live.locator('.sga-field input').nth(0).fill('Fixture Guest')
    await live.locator('.sga-field input').nth(1).fill(`delivered+ok-${label}@resend.dev`)
    await live.locator('.sga-cta').first().click()
    await page.waitForSelector('.sga-ok', { timeout: 20_000 })
    await page.waitForTimeout(1600)
    await live.scrollIntoViewIfNeeded()
    await shot('05-success-real', live)

    // 05b · THE SAME MOMENT as a guest will see it. Only the transport is
    // stubbed: the component, the figures and the layout are the real ones.
    await go()
    await page.route('**/api/studio/auction/bid', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, amount: 1200, placed_at: new Date().toISOString(), emailed: true }),
    }))
    const live2 = piece(lots['Reminds Me Of'].index)
    await live2.scrollIntoViewIfNeeded()
    await live2.locator('.sga-cta').first().click()
    await page.waitForSelector('.sga-form')
    await live2.locator('.sga-field input').nth(0).fill('Fixture Guest')
    await live2.locator('.sga-field input').nth(1).fill('delivered+stub@resend.dev')
    await live2.locator('.sga-cta').first().click()
    await page.waitForSelector('.sga-ok', { timeout: 20_000 })
    await page.waitForTimeout(1600)
    await live2.scrollIntoViewIfNeeded()
    await shot('05b-success-emailed', live2)
    await page.unroute('**/api/studio/auction/bid')

    // 06 · A PRICED WORK and its enquiry form.
    await go()
    // ── 06/07 · NOT SHOT, AND ASSERTED INSTEAD ─────────────────────
    // There used to be a priced work and an enquiry form here. All four
    // non-auction works have sold, so neither state exists in this
    // exhibition. Photographing them would show the owner a page that is not
    // the page. What matters now is the negative, so it is asserted: no price
    // and no Enquire control is offered anywhere on the guide.
    {
      const offers = await page.evaluate(() => {
        const txt = document.body.innerText
        return {
          enquire: (txt.match(/Enquire/gi) || []).length,
          available: (txt.match(/available/gi) || []).length,
          controls: document.querySelectorAll('.sga-enquire, .sga-enquire-form').length,
        }
      })
      if (offers.enquire || offers.controls || offers.available) {
        throw new Error(`the guide offers something for sale: ${JSON.stringify(offers)}`)
      }
      console.log('  ✓ nothing is offered for sale: no Enquire control, no "available" anywhere')
    }

    const sold = piece(lots['Fresh Air'].index)
    await sold.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await shot('08-sold', sold)

    // 09 · BIDDING CLOSED — the server's close, not a stub.
    await rest(`studio_auctions?id=eq.${auction.id}`, {
      method: 'PATCH', body: JSON.stringify({ closes_at: new Date(Date.now() - 60_000).toISOString() }),
    })
    await go()
    const closed = piece(lots['Rainforest'].index)
    await closed.scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    await shot('09-closed', closed)
    await page.evaluate(() => window.scrollTo(0, 0))
    await shot('10-closed-banner')
    await rest(`studio_auctions?id=eq.${auction.id}`, {
      method: 'PATCH', body: JSON.stringify({ closes_at: '2026-11-14T15:00:00+07:00' }),
    })

    await ctx.close()
  }

  // ── REDUCED MOTION — reachable AND readable ──────────────────────────────
  {
    const ctx = await browser.newContext({
      viewport: PHONE, deviceScaleFactor: 2, reducedMotion: 'reduce',
      locale: 'en-GB', timezoneId: 'Asia/Ho_Chi_Minh',
    })
    await ctx.addInitScript(hideOverlay)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/studio/${tag}/guide`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.waitForSelector('.sga-banner', { timeout: 60_000 })
    await page.waitForTimeout(1200)

    // ⚠ THE ASSERTION, NOT THE PICTURE. An entrance animation that starts at
    // opacity 0 leaves its element INVISIBLE FOREVER if it is merely switched
    // off for reduced motion. Every animated thing is measured here.
    const checks = await page.evaluate(() => {
      const out = []
      for (const sel of ['.sga-banner', '.sga-lot', '.sga-facts dd', '.sg-piece', '.sga-reserve']) {
        for (const el of [...document.querySelectorAll(sel)].slice(0, 3)) {
          const cs = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          out.push({
            sel, opacity: Number(cs.opacity), transform: cs.transform,
            visible: r.width > 0 && r.height > 0,
            text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
          })
        }
      }
      return out
    })
    let bad = 0
    for (const c of checks) {
      const ok = c.visible && c.opacity > 0.3 && (c.transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(c.transform))
      if (!ok) { bad++; console.log('  ✗ reduced motion leaves it hidden:', JSON.stringify(c)) }
    }
    console.log(bad === 0
      ? `  ✓ reduced motion: ${checks.length} animated elements all visible, opaque and un-offset`
      : `  ✗ reduced motion: ${bad} of ${checks.length} are not readable`)
    await page.screenshot({ path: `${OUT}/11-reduced-motion-390.png`, fullPage: true })
    shots.push(`${OUT}/11-reduced-motion-390.png`)
    await ctx.close()
  }

  // ── THE SUCCESS MOMENT, FRAME BY FRAME ─────────────────────────────────
  {
    const ctx = await browser.newContext({
      viewport: PHONE, deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'Asia/Ho_Chi_Minh',
    })
    await ctx.addInitScript(hideOverlay)
    const page = await ctx.newPage()
    await page.route('**/api/studio/auction/bid', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, amount: 1200, placed_at: new Date().toISOString(), emailed: true }),
    }))
    await page.goto(`${BASE}/studio/${tag}/guide`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.waitForSelector('.sga-banner', { timeout: 60_000 })
    const live = page.locator(`#piece-${lots['Reminds Me Of'].index}`)
    await live.scrollIntoViewIfNeeded()
    await live.locator('.sga-cta').first().click()
    await page.waitForSelector('.sga-form')
    await live.locator('.sga-field input').nth(0).fill('Fixture Guest')
    await live.locator('.sga-field input').nth(1).fill('delivered+frames@resend.dev')
    await live.locator('.sga-cta').first().click()
    const t0 = Date.now()
    for (const at of [0, 150, 400, 700, 1100, 1600]) {
      const wait = at - (Date.now() - t0)
      if (wait > 0) await page.waitForTimeout(wait)
      const f = `${OUT}/frames-success-${String(at).padStart(4, '0')}ms.png`
      await live.screenshot({ path: f })
      shots.push(f)
    }
    console.log('   frame sequence: 0, 150, 400, 700, 1100, 1600 ms')
    await ctx.close()
  }

  await browser.close()
}

try {
  await main()
} catch (e) {
  console.error('\n✗', e.message)
  process.exitCode = 1
} finally {
  if (collabId) {
    await rest(`studio_auctions?collaboration_id=eq.${collabId}`, { method: 'DELETE' })
    await rest(`collaboration_pieces?collaboration_id=eq.${collabId}`, { method: 'DELETE' })
    await rest(`collaborations?id=eq.${collabId}`, { method: 'DELETE' })
    const left = await rest(`collaborations?slug=eq.${tag}&select=id`)
    const rows = await left.json().catch(() => [])
    console.log(rows.length === 0 ? '\n✓ fixture exhibition deleted' : `\n✗ ${rows.length} fixture row(s) left`)
  }
  console.log(`${shots.length} images in ${OUT}/`)
}
