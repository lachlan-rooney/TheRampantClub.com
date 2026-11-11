// ═══════════════════════════════════════════════════════════════════════════
// THE SILENT AUCTION — the things that would cost real money if wrong.
//   node scripts/verify-studio-auction.mjs        (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// ⚠ IT BUILDS ITS OWN EXHIBITION AND DELETES IT. Nothing here touches the real
//   show's lots, bids or reserves. The throwaway collaboration is created as a
//   DRAFT, which means it is invisible on /studio for the whole run — and the
//   fact that a draft returns nothing from the public function is itself one
//   of the assertions below.
//
// ⚠ IT SENDS NO REAL EMAIL. The bidder addresses are at a domain that cannot
//   receive, which exercises the path that matters more: a bid whose
//   confirmation fails must still STAND, and must be reported honestly.
//
// What it proves, in order:
//   A · the grants — anon and a signed-in non-admin can read nothing at all
//   B · one bid, end to end through the real HTTP route
//   C · two bids at once — the higher wins, an equal bid is refused as too low
//   D · the close is enforced by the server, not by the page
//   E · a voided bid drops out of the public current highest
//   F · the reserve is absent from the public shape, not filtered out of it
//   G · the rate limit actually stops somebody
//   H · every refusal, word for word, in BOTH languages, against the strings
//       the product actually ships — not against a copy typed in here
//   I · the leak sweep: every public endpoint AND the JavaScript bundle, for
//       the reserve, the sale price of a sold work, and the buyer's name
//   J · a priced work: an enquiry is taken, and is refused on a sold one
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'

const BASE = process.env.BASE || 'http://localhost:3001'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const SRV = env.SUPABASE_SERVICE_ROLE_KEY
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]

// ── THE WORDS THE PRODUCT SHIPS ───────────────────────────────────────────
// Read out of lib/studio/auction.ts rather than copied into this file. A test
// that compares the route's answer to a sentence typed in the test is a test
// that passes while the two drift apart; this one fails the moment the string
// table and the route disagree.
const STRINGS = readFileSync('lib/studio/auction.ts', 'utf8')
const say = (key, lang, vars = {}) => {
  const block = STRINGS.match(new RegExp('\\n  ' + key + ':\\s*\\{([\\s\\S]*?)\\n?  \\},'))
  if (!block) throw new Error('no string called ' + key + ' in lib/studio/auction.ts')
  const m = block[1].match(new RegExp(lang + ":\\s*'((?:[^'\\\\]|\\\\.)*)'"))
  if (!m) throw new Error('no ' + lang + ' for ' + key)
  return m[1].replace(/\\'/g, "'").replace(/\{(\w+)\}/g, (whole, k) => (k in vars ? String(vars[k]) : whole))
}
const usd = n => 'US$' + Math.round(n).toLocaleString('en-US')

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const rest = (path, opts = {}, key = SRV) => fetch(`${U}/rest/v1/${path}`, {
  ...opts,
  headers: {
    apikey: key, Authorization: `Bearer ${opts.jwt || key}`,
    'Content-Type': 'application/json',
    ...(opts.prefer ? { Prefer: opts.prefer } : {}),
    ...(opts.headers || {}),
  },
})
const rpc = (fn, body, key = SRV, jwt) => fetch(`${U}/rest/v1/rpc/${fn}`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${jwt || key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// A real member's token, not the anon key. The anon key proves one thing; a
// signed-in person who is not an admin proves the thing that actually bit this
// codebase before — policies that let "authenticated" through.
const mintMember = (sub) => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600,
    email: 'not-an-admin@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {},
  })}`
  return `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
}

// ── PRE-FLIGHT ────────────────────────────────────────────────────────────
{
  const r = await rest('studio_lots?select=id&limit=1')
  if (r.status === 404) {
    console.log('✗ The auction tables are not there.')
    console.log('  Run db/studio_auction.sql in the Supabase SQL editor, then run this again.')
    process.exit(1)
  }
}

// ── BUILD A THROWAWAY SHOW ────────────────────────────────────────────────
const tag = `verify-auction-${randomUUID().slice(0, 8)}`
let collabId, pieceId, pieceId2, pieceId3, auctionId, lotId, soldLotId, priceLotId
const cleanup = async () => {
  if (auctionId) await rest(`studio_auctions?id=eq.${auctionId}`, { method: 'DELETE' })
  for (const pid of [pieceId, pieceId2, pieceId3]) {
    if (pid) await rest(`collaboration_pieces?id=eq.${pid}`, { method: 'DELETE' })
  }
  if (collabId) await rest(`collaborations?id=eq.${collabId}`, { method: 'DELETE' })
}
process.on('exit', () => { /* best effort below; see the explicit call at the end */ })

try {
  // DRAFT, so it is invisible on /studio for the whole run.
  const c = await rest('collaborations', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({ slug: tag, artist_name: 'Verification Fixture', status: 'draft', sort: 9999 }),
  })
  const cj = await c.json()
  if (!c.ok) { console.log('✗ could not create the fixture exhibition —', JSON.stringify(cj).slice(0, 200)); process.exit(1) }
  collabId = cj[0].id

  const p = await rest('collaboration_pieces', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({ collaboration_id: collabId, sort: 0, title_en: 'Fixture Work' }),
  })
  pieceId = (await p.json())[0].id

  const closes = new Date(Date.now() + 3600_000).toISOString()
  const a = await rest('studio_auctions', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({
      collaboration_id: collabId, closes_at: closes,
      announce_at: new Date(Date.now() + 7200_000).toISOString(),
      published: true,
      // ⚠ DELIBERATELY WRONG, so that a lot falling back to it would be
      // obvious: every step assertion below is against the LOT's 50.
      min_step_usd: 999,
      confirm_multiple: 5,
    }),
  })
  auctionId = (await a.json())[0].id

  const l = await rest('studio_lots', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({
      auction_id: auctionId, piece_id: pieceId, sort: 0,
      kind: 'auction', status: 'live', starting_bid_usd: 500,
      step_usd: 50,
      // A RESERVE NOBODY WOULD WRITE BY ACCIDENT. The leak sweep greps whole
      // JavaScript bundles; "900" would match a dozen innocent numbers in
      // minified code, and a false alarm teaches people to ignore the test.
      reserve_usd: 918273,
    }),
  })
  lotId = (await l.json())[0].id

  // A SECOND WORK: priced, and sold, with a buyer and a sale price. Both are
  // things the public must never see, and the sweep looks for both.
  const p2 = await rest('collaboration_pieces', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({ collaboration_id: collabId, sort: 1, title_en: 'Fixture Sold Work' }),
  })
  pieceId2 = (await p2.json())[0].id
  const l2 = await rest('studio_lots', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({
      auction_id: auctionId, piece_id: pieceId2, sort: 1,
      kind: 'sale', status: 'sold', price_usd: 374219,
      sold_price_usd: 374219, sold_to: 'Fixture Buyer Nine Nine', sold_on: '2026-11-11',
    }),
  })
  soldLotId = (await l2.json())[0].id

  // A third: priced and still for sale, which is what an enquiry needs.
  const p3 = await rest('collaboration_pieces', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({ collaboration_id: collabId, sort: 2, title_en: 'Fixture Priced Work' }),
  })
  pieceId3 = (await p3.json())[0].id
  const l3 = await rest('studio_lots', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({
      auction_id: auctionId, piece_id: pieceId3, sort: 2,
      kind: 'sale', status: 'live', price_usd: 1425, price_note_en: 'Sold as a pair',
    }),
  })
  priceLotId = (await l3.json())[0].id

  console.log(`fixture up — auction lot ${lotId.slice(0, 8)}: start US$500, step US$50 (auction-wide is 999), reserve US$918,273 (secret)`)
  console.log(`              sold lot ${soldLotId.slice(0, 8)}: US$374,219 to "Fixture Buyer Nine Nine" (both private)\n`)

  // ══ A · THE GRANTS ══════════════════════════════════════════════════════
  console.log('── A · what a browser can read ──')
  for (const [who, key, jwt] of [
    ['anon', ANON, null],
    ['a signed-in non-admin', ANON, mintMember(randomUUID())],
  ]) {
    for (const table of ['studio_bids', 'studio_lots', 'studio_auctions', 'studio_enquiries']) {
      const r = await rest(`${table}?select=*`, { jwt }, key)
      const body = await r.json().catch(() => null)
      const rows = Array.isArray(body) ? body.length : -1
      t(rows === 0, `${who} reads NOTHING from ${table}`, `HTTP ${r.status}, ${rows} rows`)
    }
  }
  // CONTROL: the service role sees the rows that the two above could not.
  {
    const r = await rest('studio_lots?select=id,reserve_usd')
    const rows = await r.json()
    t(Array.isArray(rows) && rows.length > 0 && rows.some(x => x.reserve_usd != null),
      'CONTROL: the service role DOES see lots and reserves — the check can fail', `${rows.length} row(s)`)
  }
  // And the bid function itself is closed to a browser.
  //
  // ⚠ THE AMOUNT IS 1 ON PURPOSE. This probe once carried US$10,000, and when
  // the grant turned out to be open the probe SUCCEEDED — inserting a
  // US$10,000 bid into the fixture and making the next five sections measure a
  // poisoned lot. Eleven assertions failed for a reason none of them named. A
  // probe for a hole must not be able to fall through it: US$1 is below the
  // starting bid, so even with execute granted the function refuses it as
  // too_low and writes nothing. The grant is judged by the HTTP status alone.
  //
  // ⚠ 401 FOR anon, 403 FOR A SIGNED-IN MEMBER. PostgREST answers an absent
  // identity differently from a known one; what matters in both is the
  // POSTGRES code, 42501. The status says who asked, the code says it was the
  // grant that stopped them.
  //
  // ⚠ AND IT MUST BE REFUSED FOR THE RIGHT REASON. `!r.ok` alone would also be
  // satisfied by a 404, a typo'd function name, or a signature that no longer
  // matches — all of which would leave the hole open while the test went
  // green. So the refusal has to be a PERMISSION refusal: HTTP 403 carrying
  // Postgres' 42501, insufficient_privilege. That is the one answer that can
  // only come from the grant actually being gone.
  for (const [who, key, jwt] of [['anon', ANON, null], ['a signed-in member', ANON, mintMember(randomUUID())]]) {
    const r = await rpc('studio_place_bid', {
      p_lot_id: lotId, p_amount: 1, p_name: 'Sneak', p_email: 'delivered+sneak@resend.dev',
      p_phone: null, p_lang: 'en', p_share_price: false, p_news: false, p_terms: 'x', p_device: null,
    }, key, jwt)
    const body = await r.json().catch(() => ({}))
    t((r.status === 403 || r.status === 401) && body.code === '42501',
      `${who} cannot call studio_place_bid — permission denied, not merely unsuccessful`,
      `HTTP ${r.status} ${body.code || ''} ${String(body.message || '').slice(0, 60)}`)
    // Belt and braces: whatever the status said, nothing may have been written.
    const after = await rest(`studio_bids?lot_id=eq.${lotId}&select=id`)
    t((await after.json()).length === 0, `and ${who}'s probe left no bid behind, whatever it was told`)
  }
  // CONTROL: the service role — the key the route holds — CAN still call it.
  // Without this, revoking it from everybody would also pass.
  {
    const r = await rpc('studio_place_bid', {
      p_lot_id: lotId, p_amount: 1, p_name: 'Control', p_email: 'delivered+control@resend.dev',
      p_phone: null, p_lang: 'en', p_share_price: false, p_news: false, p_terms: 'x', p_device: null,
    })
    const body = await r.json().catch(() => ({}))
    // US$1 is below the starting bid, so the right answer is a refusal from the
    // FUNCTION (too_low) rather than from the grant — it ran.
    t(r.status === 200 && Array.isArray(body) && body[0]?.reason === 'too_low',
      'CONTROL: the service role still can — the lock-down did not break the product',
      `HTTP ${r.status}, reason ${body[0]?.reason}`)
  }

  // ══ B · ONE BID, THROUGH THE REAL ROUTE ═════════════════════════════════
  console.log('\n── B · a bid, end to end ──')
  const terms = 'A bid is a commitment to buy at that price if it wins and meets the reserve.'

  // ── THE ADDRESSES, AND WHY THEY ARE THESE ───────────────────────────────
  // Fixture bids used to go to @example.invalid. Resend ACCEPTS those — the
  // syntax is valid — and then hard-bounces, so a run that placed ~40 bids put
  // ~40 bounces against therampantclub.com, the same domain the newsletter and
  // the weekly report go out from. Bounce rate is reputation.
  //
  //   delivered+<label>@resend.dev  Resend's simulator. Accepted, never
  //                                 delivered anywhere, no reputation effect.
  //                                 Labels keep addresses distinct so the
  //                                 per-email ceiling can still be reached.
  //   @example.com                  Resend REFUSES this with a 422. That is
  //                                 what makes the next two assertions real
  //                                 tests rather than hopeful ones: a send
  //                                 that genuinely fails, on demand.
  //
  // ⚠ Accepted bids still cost sending quota — roughly 40 per full run.
  const FAIL_EMAIL = 'trc-verify@example.com'
  // `cookie` matters: without one every request looks like a NEW device, so
  // the per-device ceiling could never be reached — and a limit that cannot be
  // reached in a test is a limit nobody has tested.
  const bid = async (amount, email, extra = {}, cookie = null, lot = null) => {
    const r = await fetch(`${BASE}/api/studio/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: `trc_bidder=${cookie}` } : {}) },
      body: JSON.stringify({
        lot_id: lot || lotId, name: 'Fixture Bidder', email, phone: '',
        amount, lang: 'en', share_price: false, news: false, terms_text: terms, ...extra,
      }),
    })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }

  const under = await bid(499, FAIL_EMAIL)
  t(under.status === 409 && under.body.error === say('err_low', 'en', { min: usd(500) }),
    'a bid under the starting bid is refused in the exact words the product ships', under.body.error)

  const first = await bid(500, FAIL_EMAIL)
  t(first.status === 200 && first.body.ok, 'the first bid at the starting bid is accepted', `US$${first.body.amount}`)
  // THE EMAIL FAILED ON PURPOSE (the domain cannot receive) AND THE BID STANDS.
  t(first.body.emailed === false, 'and when its confirmation email fails, the bid still stands and says so',
    `emailed: ${first.body.emailed}`)
  {
    const r = await rest(`studio_bids?lot_id=eq.${lotId}&select=id,amount_usd,confirmation_sent_at`)
    const rows = await r.json()
    t(rows.length === 1 && rows[0].confirmation_sent_at === null,
      'the row is in the database with its confirmation marked unsent', `${rows.length} row(s)`)
  }

  // ══ C · TWO AT ONCE ═════════════════════════════════════════════════════
  console.log('\n── C · two bids in the same instant ──')
  // Fired together, deliberately not awaited in turn. Without the row lock in
  // studio_place_bid both of these read US$500 and both are accepted.
  const [hi, lo] = await Promise.all([
    bid(700, 'delivered+hi@resend.dev'),
    bid(650, 'delivered+lo@resend.dev'),
  ])
  const accepted = [hi, lo].filter(x => x.status === 200)
  const refused = [hi, lo].filter(x => x.status === 409)
  t(accepted.length >= 1, 'at least one of two simultaneous bids is accepted', `${accepted.length} accepted`)
  {
    const r = await rest(`studio_bids?lot_id=eq.${lotId}&void=eq.false&select=amount_usd&order=amount_usd.desc`)
    const rows = await r.json()
    const high = rows[0]?.amount_usd
    t(high === 700, 'and the HIGHER one is the current highest', `US$${high}`)
    // Whichever lost, it lost because it did not clear the step — not because
    // it arrived second.
    t(refused.length === 0 || /at least/i.test(refused[0].body.error || ''),
      'a loser is told it is too low, with the figure it must beat',
      refused[0]?.body?.error || 'both accepted (both cleared the step in turn)')
  }

  // AN EQUAL BID IS TOO LOW. This is the tie rule, stated as an assertion.
  {
    const r = await rest(`studio_bids?lot_id=eq.${lotId}&void=eq.false&select=amount_usd&order=amount_usd.desc&limit=1`)
    const high = (await r.json())[0].amount_usd
    const equal = await bid(high, 'delivered+equal@resend.dev')
    t(equal.status === 409, `an EQUAL bid (US$${high}) is refused as too low — the earlier bid keeps the lead`,
      equal.body.error)
    const over = await bid(high + 49, 'delivered+short@resend.dev')
    t(over.status === 409 && over.body.error === say('err_low', 'en', { min: usd(high + 50) }),
      'and so is a raise that does not clear the full step', over.body.error)
    // ⚠ THE WHOLE POINT OF step_usd. The auction-wide step is 999; if the lot's
    // own 50 were not being read, this bid would be refused.
    const exact = await bid(high + 50, 'delivered+step@resend.dev')
    t(exact.status === 200,
      "the LOT's step is what is enforced, not the auction-wide one",
      `US$${high} + US$50 accepted while the auction-wide step is US$999`)
  }

  // ══ D · THE CLOSE ═══════════════════════════════════════════════════════
  console.log('\n── D · the close is the server’s, not the page’s ──')
  await rest(`studio_auctions?id=eq.${auctionId}`, {
    method: 'PATCH', body: JSON.stringify({ closes_at: new Date(Date.now() - 60_000).toISOString() }),
  })
  const late = await bid(5000, 'delivered+late@resend.dev')
  t(late.status === 409 && late.body.closed === true,
    'a bid after the close is refused even though the page would still show a form', late.body.error)
  await rest(`studio_auctions?id=eq.${auctionId}`, {
    method: 'PATCH', body: JSON.stringify({ closes_at: new Date(Date.now() + 3600_000).toISOString() }),
  })

  // ══ E · VOIDING ═════════════════════════════════════════════════════════
  console.log('\n── E · a voided bid drops out of the public figure ──')
  {
    const r = await rest(`studio_bids?lot_id=eq.${lotId}&void=eq.false&select=id,amount_usd&order=amount_usd.desc&limit=1`)
    const top = (await r.json())[0]
    await rest(`studio_bids?id=eq.${top.id}`, {
      method: 'PATCH', body: JSON.stringify({ void: true, void_reason: 'verification', voided_at: new Date().toISOString() }),
    })
    const after = await rest(`studio_bids?lot_id=eq.${lotId}&void=eq.false&select=amount_usd&order=amount_usd.desc&limit=1`)
    const now = (await after.json())[0]?.amount_usd ?? null
    t(now !== top.amount_usd, 'voiding the leader lowers the current highest', `US$${top.amount_usd} → US$${now}`)
    // And it is not gone.
    const still = await rest(`studio_bids?id=eq.${top.id}&select=void,void_reason`)
    const row = (await still.json())[0]
    t(row.void === true && row.void_reason === 'verification',
      'and the bid is still on the record, with the reason', row.void_reason)
    await rest(`studio_bids?id=eq.${top.id}`, { method: 'PATCH', body: JSON.stringify({ void: false, void_reason: null }) })
  }

  // ══ F · THE PUBLIC SHAPE ════════════════════════════════════════════════
  console.log('\n── F · what the public function will and will not say ──')
  {
    // The fixture show is a DRAFT, so it must return nothing at all.
    const r = await rpc('studio_auction_public', { p_slug: tag }, ANON)
    const rows = await r.json()
    t(Array.isArray(rows) && rows.length === 0,
      'a draft exhibition returns no auction, even published and with live lots', `${rows.length} row(s)`)
  }
  {
    // Flip it to past for one read, to see the shape, then straight back.
    await rest(`collaborations?id=eq.${collabId}`, { method: 'PATCH', body: JSON.stringify({ status: 'past' }) })
    const r = await rpc('studio_auction_public', { p_slug: tag }, ANON)
    const rows = await r.json()
    await rest(`collaborations?id=eq.${collabId}`, { method: 'PATCH', body: JSON.stringify({ status: 'draft' }) })

    // THREE: the auction lot, the sold one and the priced one. The draft lot
    // H adds later is not in this set yet. Counting them is the point — a
    // function that returned only the first would hide two whole works.
    t(rows.length === 3, 'every non-draft lot on a published show comes back', `${rows.length} row(s)`)
    // ⚠ BY KIND, NOT BY POSITION. This block used to read rows[0] and assert
    // against "the" lot; the moment the fixture grew a second and third work
    // that was a sort order, not a statement about anything.
    const auctionRow = rows.find(x => x.kind === 'auction') || {}
    const keys = Object.keys(auctionRow)
    const blob = JSON.stringify(rows)
    // ABSENT, NOT FILTERED. The column is not in the function's return type.
    t(!keys.some(k => /reserve_usd|reserve_amount/.test(k)),
      'the reserve AMOUNT is not a field in the public shape', keys.join(', '))
    // ⚠ THE NUMBER HERE MUST BE THE FIXTURE'S ACTUAL RESERVE. It read '900'
    // for a while after the reserve became 918273 — a search for a string that
    // was no longer in the data, passing because it could not fail.
    t(!blob.includes('918273'), "and the reserve's value appears nowhere in the payload",
      'searched all three rows for 918273')
    t(auctionRow.reserve_met === false,
      'only met-or-not is published, and it reads not-met at US$700 against US$918,273',
      `reserve_met: ${auctionRow.reserve_met}`)
    t(!/bidder|email|name|phone/i.test(keys.join(' ')), 'no bidder field of any kind', keys.join(', '))
    // ⚠ READ, NOT REMEMBERED. This asserted a hardcoded US$700 and broke the
    // day section E started restoring the bid it voids: the figure was right,
    // the constant was a snapshot of another section's middle. The question
    // worth asking is not "is it 700" but "does the public figure equal the
    // real highest", so it is now asked that way.
    const live = await rest(`studio_bids?lot_id=eq.${lotId}&void=eq.false&select=amount_usd&order=amount_usd.desc`)
    const liveRows = await live.json()
    t(auctionRow.highest_usd === liveRows[0].amount_usd && auctionRow.bid_count === liveRows.length,
      'the public figure and count are exactly the real ones',
      `public US$${auctionRow.highest_usd}/${auctionRow.bid_count} vs actual US$${liveRows[0].amount_usd}/${liveRows.length}`)
  }

  // ══ H · EVERY REFUSAL, IN BOTH LANGUAGES ════════════════════════════════
  // On a lot of its own, so the arithmetic is exact and nothing above has
  // moved the figures. Each refusal is compared to the sentence in
  // lib/studio/auction.ts — the one the guest will actually read.
  console.log('\n── H · the refusals, word for word, EN and VN ──')
  {
    const pw = await rest('collaboration_pieces', {
      method: 'POST', prefer: 'return=representation',
      body: JSON.stringify({ collaboration_id: collabId, sort: 3, title_en: 'Fixture Words Work' }),
    })
    const pieceW = (await pw.json())[0].id
    const lw = await rest('studio_lots', {
      method: 'POST', prefer: 'return=representation',
      body: JSON.stringify({
        auction_id: auctionId, piece_id: pieceW, sort: 3,
        kind: 'auction', status: 'live', starting_bid_usd: 500, step_usd: 50, reserve_usd: 918273,
      }),
    })
    const wordsLot = (await lw.json())[0].id
    let n = 0
    const w = (amount, lang, extra = {}) =>
      bid(amount, `delivered+words-${++n}@resend.dev`, { lang, ...extra }, null, wordsLot)

    for (const lang of ['en', 'vn']) {
      const r = await w(499, lang)
      t(r.status === 409 && r.body.error === say('err_low', lang, { min: usd(500) }),
        `below the starting bid, in ${lang.toUpperCase()}`, r.body.error)
    }
    const opened = await w(500, 'en')
    t(opened.status === 200, 'the lot opens at its starting bid', usd(500))

    for (const lang of ['en', 'vn']) {
      const r = await w(549, lang)
      t(r.status === 409 && r.body.error === say('err_low', lang, { min: usd(550) }),
        `below the step, in ${lang.toUpperCase()}`, r.body.error)
    }
    for (const lang of ['en', 'vn']) {
      const r = await w(2501, lang)
      t(r.status === 409 && r.body.needs_confirm === true
        && r.body.error === say('err_confirm_big', lang, { amount: usd(2501) }),
        `an absurd amount is QUESTIONED, in ${lang.toUpperCase()}`, r.body.error)
    }
    // A PER-LOT CLOSE, which also proves closes_at on the lot overrides the
    // auction's — the auction itself is still open throughout this block.
    await rest(`studio_lots?id=eq.${wordsLot}`, {
      method: 'PATCH', body: JSON.stringify({ closes_at: new Date(Date.now() - 60_000).toISOString() }),
    })
    for (const lang of ['en', 'vn']) {
      const r = await w(5000, lang)
      t(r.status === 409 && r.body.closed === true && r.body.error === say('err_closed', lang),
        `after this lot's own close, in ${lang.toUpperCase()}`, r.body.error)
    }
  }

  // ══ I · THE LEAK SWEEP ══════════════════════════════════════════════════
  // Every public surface: both JSON routes, the rendered guide, and every
  // JavaScript file that page loads. Looking for the reserve, the price a sold
  // work went for, and the buyer's name.
  console.log('\n── I · the leak sweep ──')
  {
    await rest(`collaborations?id=eq.${collabId}`, { method: 'PATCH', body: JSON.stringify({ status: 'past' }) })
    const pages = []
    const grab = async (url) => {
      try {
        const r = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } })
        pages.push({ url, text: await r.text() })
      } catch (e) { pages.push({ url, text: '', err: String(e) }) }
    }
    await grab(`${BASE}/api/studio/auction/state?slug=${tag}`)
    await grab(`${BASE}/api/studio/auction/mine?slug=${tag}`)
    await grab(`${BASE}/studio/${tag}/guide`)

    // Every script the guide pulls in — the bundle, not just the HTML.
    const html = pages.find(p => p.url.endsWith('/guide'))?.text || ''
    const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1])
    for (const src of srcs.slice(0, 40)) await grab(src.startsWith('http') ? src : `${BASE}${src}`)
    t(srcs.length > 0, 'the guide page loads JavaScript that can be searched', `${srcs.length} script(s)`)

    // CONTROL FIRST: the sweep can find something that IS public. Without this
    // a sweep that fetched nothing at all would pass every secret below.
    const all = pages.map(p => p.text).join('\n')
    t(all.includes('1425'), 'CONTROL: the sweep DOES find the public price of the priced work',
      `US$1,425 found across ${pages.length} response(s)`)

    for (const [what, needle] of [
      ['the reserve', '918273'],
      ['the price a sold work went for', '374219'],
      ["the buyer's name", 'Fixture Buyer Nine Nine'],
      ['the column name reserve_usd', 'reserve_usd'],
      ['the column name sold_to', 'sold_to'],
    ]) {
      const hits = pages.filter(p => p.text.includes(needle)).map(p => p.url)
      t(hits.length === 0, `${what} appears in NO public response`,
        hits.length ? `LEAKED IN: ${hits.join(', ')}` : `${pages.length} responses searched`)
    }

    // And the sold work really is published as Sold with no figure.
    const state = JSON.parse(pages[0].text || '{}')
    const sold = (state.lots || []).find(l => l.lot_id === soldLotId)
    t(!!sold && sold.status === 'sold' && sold.price_usd === null,
      'a sold work is published as Sold with a null price', JSON.stringify(sold || {}).slice(0, 120))

    await rest(`collaborations?id=eq.${collabId}`, { method: 'PATCH', body: JSON.stringify({ status: 'draft' }) })
  }

  // ══ J · THE PRICED WORKS ════════════════════════════════════════════════
  console.log('\n── J · enquiries ──')
  {
    const enquire = (lot, extra = {}) => fetch(`${BASE}/api/studio/auction/enquire`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lot_id: lot, name: 'VERIFICATION FIXTURE — ignore',
        email: 'delivered+enquiry@resend.dev', phone: '', message: 'Automated check.', lang: 'en', ...extra,
      }),
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }))

    const ok = await enquire(priceLotId)
    t(ok.status === 200 && ok.body.ok === true, 'an enquiry on a priced work is taken', `HTTP ${ok.status}`)
    {
      const r = await rest(`studio_enquiries?lot_id=eq.${priceLotId}&select=id,name,email`)
      const rows = await r.json()
      t(rows.length === 1, 'and the row is in the database before the guest is told anything', `${rows.length} row(s)`)
    }
    const onSold = await enquire(soldLotId)
    t(onSold.status === 409, 'an enquiry on a SOLD work is refused by the server, not just hidden by the page',
      onSold.body.error)
    const onAuction = await enquire(lotId)
    t(onAuction.status === 409, 'and so is one on an auction work, which takes bids instead', onAuction.body.error)
  }

  // ══ G · THE RATE LIMIT ══════════════════════════════════════════════════
  console.log('\n── G · the ceilings ──')
  // ⚠ D CLOSED THIS AUCTION AND H CLOSED ITS OWN LOT. Run as-is, every bid
  // below is refused with "bidding has closed", no row is written, and the
  // ceiling — which counts RECORDED BIDS — is never approached. The section
  // then reports "after 30 bids" and looks like a broken rate limiter. So:
  // reopen, explicitly, and say why.
  await rest(`studio_auctions?id=eq.${auctionId}`, {
    method: 'PATCH', body: JSON.stringify({ closes_at: new Date(Date.now() + 3600_000).toISOString() }),
  })
  {
    // Per EMAIL, 25/hour.
    //
    // ⚠ WHAT THIS LIMIT ACTUALLY COUNTS: rows in studio_bids, i.e. bids that
    // were ACCEPTED. An attempt refused as too-low or closed writes nothing
    // and so costs nothing against the ceiling. A flood of refused attempts is
    // NOT rate-limited by this; see the note at the end of the run.
    //
    // ⚠ WHICH IS WHY THE AMOUNTS RISE BY THE LOT'S STEP. They used to rise by
    // US$1 against a step of US$50: the first bid was accepted and the other
    // twenty-nine were refused as too low, so one row was written, the ceiling
    // was never approached, and the section reported "after 30 bids" as though
    // the limiter were broken. It was the test that was broken.
    let got429 = false, tries = 0
    for (let i = 0; i < 30 && !got429; i++) {
      tries++
      const r = await bid(1_000_000 + i * 50, 'delivered+flood@resend.dev', { confirmed: true })
      if (r.status === 429) got429 = true
    }
    t(got429, 'one email address is eventually told to wait', `after ${tries} bids`)
  }
  {
    // PER DEVICE, 12 per ten minutes — carrying one cookie, as a phone does.
    // Every address is different, so only the device ceiling can stop this.
    const cookie = randomUUID()
    let got429 = false, tries = 0
    for (let i = 0; i < 20 && !got429; i++) {
      tries++
      const r = await bid(2_000_000 + i * 50, `delivered+device-${i}@resend.dev`, { confirmed: true }, cookie)
      if (r.status === 429) got429 = true
    }
    t(got429, 'one DEVICE is eventually told to wait, whatever address it uses', `after ${tries} bids`)
  }
  {
    // The absurd-amount question, on a fresh address.
    //
    // ⚠ MEASURED AGAINST THE CURRENT HIGHEST, not a constant. A fixed
    // US$10,000,000 was absurd when this was written and stopped being absurd
    // the moment the two floods above pushed the leader past US$2,000,000 —
    // the test then failed while the product was behaving perfectly. "Absurd"
    // is a MULTIPLE, so the test has to ask the same question the product does.
    const topNow = await rest(`studio_bids?lot_id=eq.${lotId}&void=eq.false&select=amount_usd&order=amount_usd.desc&limit=1`)
    const highNow = (await topNow.json())[0]?.amount_usd ?? 500
    // ⚠ ONE DOLLAR OVER THE LINE, not a hundred times it. confirm_multiple is
    // 5 on this fixture, so high×5+1 is the smallest absurd amount there is —
    // which tests the boundary rather than a number miles past it. high×100
    // used to be used and cleared the route's US$100,000,000 hard cap, so it
    // was refused as a malformed amount and never reached the question at all.
    const silly = await bid(highNow * 5 + 1, 'delivered+typo@resend.dev')
    t(silly.status === 409 && silly.body.needs_confirm === true,
      'one dollar past the multiple is QUESTIONED rather than refused or accepted',
      `${usd(highNow * 5 + 1)} against a highest of ${usd(highNow)} — ${silly.body.error || silly.status}`)
  }

} finally {
  await cleanup()
  const left = await rest(`collaborations?slug=eq.${tag}&select=id`)
  const rows = await left.json().catch(() => [])
  t(Array.isArray(rows) && rows.length === 0, 'the fixture exhibition is gone again', `${rows.length} left`)
}

console.log(`\n${fail === 0 ? '✓ ALL' : '✗'} ${pass} passed, ${fail} failed`)
console.log('⚠ Not proven here: that a BIDDER\'s confirmation email arrives — every fixture address is')
console.log('  at a domain that cannot receive, on purpose. Place one real bid with a real address.')
console.log('⚠ One real email DOES go out per run: the staff alert for the fixture enquiry, subject')
console.log('  "Enquiry — Fixture Priced Work". It goes to DEV_ALERT_ONLY_TO and NOWHERE ELSE.')
console.log('  Unset that variable and this run emails every admin — which it did four times')
console.log('  on 11 Nov 2026 before the gate existed. Check it is set before running.')
console.log('⚠ Not covered by any ceiling: REFUSED attempts. All three limits count rows in')
console.log('  studio_bids, so a script firing bids below the step writes nothing and is never')
console.log('  told to wait. It cannot distort the auction — it just costs requests.')
process.exit(fail === 0 ? 0 : 1)
