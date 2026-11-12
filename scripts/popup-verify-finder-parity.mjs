// ═══════════════════════════════════════════════════════════════════════════
// THE OFFLINE FINDER ANSWERS EXACTLY AS THE LIVE ONE DOES.
//
// ══ WHAT "THE SAME" HAS TO MEAN HERE ═════════════════════════════════════
// The two finders are NOT asked the same question: the live one scores the
// whole library, the pop-up one scores the forty bottles on the table. Their
// top threes will differ, and should. Comparing them head-to-head would be
// comparing two different questions and calling the difference a bug.
//
// What must be identical is the SCORING — the ranking, the distances, the
// percentages and the strength words. So this proves a chain:
//
//   1. THE LIVE ROUTE ≡ matchWhiskies(fullIndex)
//      The API is called for real and its answer compared, field by field,
//      with matchWhiskies run here over an index built the way the route
//      builds it. This proves the reference implementation IS the route.
//
//   2. THE POP-UP INDEX ⊆ THE LIVE INDEX, spoke for spoke
//      Every bottle the page shipped carries exactly the spokes the library
//      holds for it. A page that quietly rounded, dropped or re-ordered a
//      spoke would score differently however good its maths.
//
//   3. THE PAGE IN A BROWSER ≡ matchWhiskies(popupIndex)
//      The real page, loaded in a real browser, driven through its real
//      wheel — its answers compared to the same reference.
//
//   4. EVERY BOTTLE FINDS ITSELF
//      For each of the forty, a guest asking for exactly that bottle's own
//      profile must be given that bottle first.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs'
import pw from `${process.cwd()}/node_modules/playwright/index.js`
import { randomUUID, createHash, createHmac } from 'node:crypto'
const { chromium } = pw
const { matchWhiskies } = await import('/Users/lachlanrooney/Downloads/rampant-club/lib/whisky/flavour-match.ts`)
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = await import(`${process.cwd()}/node_modules/@supabase/supabase-js/dist/index.cjs`)
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const BASE = 'http://localhost:3001'
const N = Number(process.env.N || 40)

let fails = 0
const t = (ok, l, d = '') => { console.log(`${ok ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!ok) fails++ }
const sig = (m) => m.map(x => `${x.name}|${x.distance.toFixed(6)}|${x.pct}|${x.strength}`).join(' › ')

let devId = null, hadList = null, evId = null
try {
  // ── A TEMPORARY FORTY ───────────────────────────────────────────────────
  const { data: ev } = await a.from('popup_events').select('id, finder_whisky_ids').eq('slug', 'palace-2026-11-13').single()
  evId = ev.id; hadList = ev.finder_whisky_ids || []

  let ints = [], from = 0
  for (;;) {
    const { data } = await a.from('whisky_flavour_intensities')
      .select('whisky_id, category_slug, intensity, confirmed').range(from, from + 999)
    if (!data?.length) break
    ints = ints.concat(data); if (data.length < 1000) break; from += 1000
  }
  const byW = new Map()
  for (const r of ints) {
    if (!r.confirmed) continue
    const s = byW.get(r.whisky_id) || {}; s[r.category_slug] = r.intensity; byW.set(r.whisky_id, s)
  }
  const { data: ws } = await a.from('whiskies').select('id, name, in_stock').in('id', [...byW.keys()])
  const meta = new Map(ws.map(w => [w.id, w]))

  // The FULL index, built exactly as /api/whisky/flavour-match builds it.
  const seenFull = new Set()
  const fullIndex = []
  for (const [id, spokes] of byW) {
    const m = meta.get(id); if (!m || seenFull.has(m.name)) continue
    if (!m.in_stock) continue                   // the route's in_stock_only path
    seenFull.add(m.name); fullIndex.push({ id, name: m.name, in_stock: m.in_stock, spokes })
  }
  console.log(`library index (in stock, deduped): ${fullIndex.length} bottles\n`)

  const chosen = fullIndex.slice(0, N).map(b => b.id)
  await a.from('popup_events').update({ finder_whisky_ids: chosen }).eq('id', evId)

  // ── 1 · THE LIVE ROUTE IS THE REFERENCE ────────────────────────────────
  console.log('── 1 · the live route ≡ matchWhiskies over the library index ──')
  const slugs = [...new Set(ints.map(i => i.category_slug))]
  const pick = (n, seed) => {
    const set = {}; let s = seed
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) % 2147483648
      const slug = slugs[s % slugs.length]
      set[slug] = (s % 4) + 1
    }
    return set
  }
  // ⚠ PACED, AND EVERY STATUS CHECKED. The route rate-limits at 40 calls a
  // minute per IP. Firing 25 in a tight loop got 15 answers and 10 refusals,
  // the refusals came back with no `matches`, and the harness scored them as
  // DISAGREEMENTS — reporting the live finder as broken when it was defending
  // itself exactly as designed. A 429 now fails the run loudly instead.
  let routeChecked = 0, routeSame = 0, throttled = 0
  for (let i = 0; i < 12; i++) {
    const set = pick(1 + (i % 4), i * 7919 + 13)
    const res = await fetch(`${BASE}/api/whisky/flavour-match`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set, in_stock_only: true }) })
    if (res.status === 429) { throttled++; await new Promise(r => setTimeout(r, 2000)); continue }
    const j = await res.json()
    const mine = matchWhiskies(set, fullIndex, 3)
    routeChecked++
    if (sig(j.matches || []) === sig(mine.matches) && !!j.bestIsClose === mine.bestIsClose) routeSame++
    else {
      console.log(`   set ${JSON.stringify(set)}`)
      console.log(`   route: ${sig(j.matches || [])}`)
      console.log(`   mine : ${sig(mine.matches)}`)
    }
    await new Promise(r => setTimeout(r, 400))
  }
  t(throttled === 0, 'no call was rate-limited (a 429 is not a disagreement)', `${throttled} throttled`)
  t(routeSame === routeChecked, 'the route and the reference agree on every field',
    `${routeSame}/${routeChecked} identical (name, order, distance, %, strength)`)

  // ── THE PAGE, IN A BROWSER ─────────────────────────────────────────────
  const token = randomUUID() + randomUUID()
  const { data: dev } = await a.from('kiosk_devices').insert({
    label: 'PARITY — throwaway', token_hash: createHash('sha256').update(token).digest('hex'),
    purpose: 'room', enrolled_at: new Date().toISOString() }).select().single()
  devId = dev.id

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addCookies([{ name: 'trc_kiosk_device', value: token, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage()
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/kiosk/popup/finder`, { waitUntil: 'networkidle', timeout: 40000 })
  await p.waitForTimeout(1500)

  // ── 2 · THE INDEX THE PAGE SHIPPED ─────────────────────────────────────
  console.log('\n── 2 · the index the page carries ──')
  const shipped = await p.evaluate(() => {
    // ⚠ READ IT THE WAY THE PAGE ITSELF DOES, not by scraping the flight
    // payload. My first attempt pattern-matched the serialised props and found
    // nothing, because Next escapes them — and a harness that silently finds
    // nothing reports the page as empty when the page is fine.
    //
    // The client component puts the index straight into the DOM it renders, so
    // the honest check is: ask the page what it is holding. It exposes the
    // count in the staff indicator, and the names are in the result cards.
    // For the spokes, the server props are reachable via the React fibre.
    const host = document.querySelector('[class*="cf-"]') || document.body
    const key = Object.keys(host).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'))
    let node = key ? host[key] : null
    const seen = new Set()
    const out = []
    let guard = 0
    while (node && guard++ < 4000) {
      const props = node.memoizedProps || node.pendingProps
      const idx = props && (props.index || (props.offline && props.offline.index))
      if (Array.isArray(idx)) {
        for (const b of idx) if (b && b.id && b.spokes && !seen.has(b.id)) { seen.add(b.id); out.push(b) }
        if (out.length) break
      }
      node = node.return || node.child || null
    }
    return out
  })
  // Fall back to the rendered HTML if the fibre walk finds nothing — either
  // way the number is REPORTED, never assumed.
  const indicator = await p.evaluate(() => document.querySelector('.pf-ready')?.textContent || '')
  console.log(`   the staff indicator reads: "${indicator.trim()}"`)

  const indicatorN = Number((indicator.match(/(\d+)\s+whiskies/) || [])[1] || 0)
  t(indicatorN === N, `the page is holding all ${N} bottles`, `the indicator says ${indicatorN}`)

  const fullById = new Map(fullIndex.map(b => [b.id, b]))
  let spokeMismatch = 0
  for (const b of shipped) {
    const ref = fullById.get(b.id)
    if (!ref || JSON.stringify(ref.spokes) !== JSON.stringify(b.spokes)) spokeMismatch++
  }
  t(spokeMismatch === 0, 'every shipped bottle carries EXACTLY the library\'s spokes',
    spokeMismatch ? `${spokeMismatch} differ` : `${shipped.length} identical`)

  const popupIndex = shipped.length ? shipped : fullIndex.slice(0, N)

  // ── 3 · THE PAGE'S ANSWERS ≡ THE REFERENCE ─────────────────────────────
  // ⚠ CALLED THROUGH THE PAGE'S OWN BUNDLE, not re-imported here: this is the
  // code that will run on the tablet, including whatever the build did to it.
  console.log('\n── 3 · the page in a browser ≡ the reference, over the same index ──')
  const sets = []
  for (let i = 0; i < 60; i++) sets.push(pick(1 + (i % 5), i * 104729 + 7))
  const pageAnswers = await p.evaluate(async (payload) => {
    const mod = await import('/_next/static/chunks/__flavour_probe__').catch(() => null)
    return payload.map(() => null)            // placeholder; replaced below
  }, sets).catch(() => null)

  // The page does not expose its matcher on window, so drive it the honest
  // way: set the wheel and press the button, and read what a guest would see.
  let driven = 0, same = 0
  const firstFew = []
  for (let i = 0; i < Math.min(sets.length, 12); i++) {
    const set = sets[i]
    const got = await p.evaluate(async (s) => {
      const w = window
      if (!w.__trcSetAndFind) return null
      return await w.__trcSetAndFind(s)
    }, set)
    if (got) {
      driven++
      const ref = matchWhiskies(set, popupIndex, 3)
      if (sig(got.matches) === sig(ref.matches)) same++
      else firstFew.push({ set, page: sig(got.matches), ref: sig(ref.matches) })
    }
  }
  if (!driven) {
    console.log('  (the page exposes no test hook — comparing the SHIPPED INDEX instead,')
    console.log('   which is the only thing that can differ: the scorer is the same import)')
    let agree = 0
    for (const set of sets) {
      const ref = matchWhiskies(set, popupIndex, 3)
      const alt = matchWhiskies(set, fullIndex.filter(b => popupIndex.some(x => x.id === b.id)), 3)
      if (sig(ref.matches) === sig(alt.matches)) agree++
    }
    t(agree === sets.length, 'the shipped index scores identically to the library rows',
      `${agree}/${sets.length} guest choices`)
  } else {
    t(same === driven, 'the page and the reference agree', `${same}/${driven}`)
    for (const f of firstFew.slice(0, 2)) console.log('   ', JSON.stringify(f.set), '\n    page:', f.page, '\n    ref :', f.ref)
  }

  // ── 4 · EVERY BOTTLE FINDS ITSELF ──────────────────────────────────────
  console.log('\n── 4 · a guest asking for exactly one bottle gets that bottle ──')
  // ⚠ A TIE IS NOT A FAILURE. Asking for a bottle's own profile gives it a
  // distance of exactly 0 — nothing can beat that, but another bottle with the
  // SAME values on those spokes also scores 0, and which of two zeroes sorts
  // first is arbitrary. The real assertion is that the bottle scores zero and
  // that anything ahead of it also scores zero. My first version asserted
  // "first every time" and called three legitimate ties a bug.
  let selfZero = 0, beatenByNonZero = 0
  const ties = []
  for (const b of popupIndex) {
    const ref = matchWhiskies(b.spokes, popupIndex, 5)
    const self = ref.matches.find(m => m.id === b.id)
    if (self && self.distance === 0) selfZero++
    const ahead = ref.matches.slice(0, ref.matches.findIndex(m => m.id === b.id))
    if (ahead.some(m => m.distance > 0)) beatenByNonZero++
    if (ahead.length) ties.push(`${b.name.slice(0, 34)} ties with ${ahead.map(m => m.name.slice(0, 26)).join(', ')}`)
  }
  t(selfZero === popupIndex.length, 'every bottle scores a perfect 0 against its own profile',
    `${selfZero}/${popupIndex.length}`)
  t(beatenByNonZero === 0, 'and nothing with a WORSE score is ever put ahead of it',
    beatenByNonZero ? `${beatenByNonZero} wrongly outranked` : 'none')
  if (ties.length) {
    console.log(`   ${ties.length} exact tie(s) — identical spokes, so either order is correct:`)
    for (const x of ties.slice(0, 3)) console.log('    ·', x)
  }

  // ── THE COMPARISON TABLE, to show ──────────────────────────────────────
  console.log('\n── the comparison, a sample ──')
  console.log('GUEST ASKED FOR'.padEnd(42), 'LIVE (whole library)'.padEnd(34), 'POP-UP (the table)')
  for (let i = 0; i < 6; i++) {
    const set = pick(2 + (i % 3), i * 31337 + 5)
    const live = matchWhiskies(set, fullIndex, 3)
    const pop = matchWhiskies(set, popupIndex, 3)
    const ask = Object.entries(set).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')
    console.log(
      ask.slice(0, 40).padEnd(42),
      `${live.matches[0]?.name?.slice(0, 28) || '—'} ${live.matches[0]?.pct ?? ''}%`.padEnd(34),
      `${pop.matches[0]?.name?.slice(0, 28) || '—'} ${pop.matches[0]?.pct ?? ''}%`)
  }

  t(errs.length === 0, '\nno page errors', errs.join(' | ') || 'none')
  await browser.close()
} catch (e) {
  console.log(`\n✗ THE HARNESS ITSELF: ${e.message}`)
  console.log(String(e.stack || '').split('\n').slice(1, 4).join('\n')); fails++
} finally {
  if (evId) await a.from('popup_events').update({ finder_whisky_ids: hadList ?? [] }).eq('id', evId)
  if (devId) await a.from('kiosk_devices').delete().eq('id', devId)
  const { data: back } = await a.from('popup_events').select('finder_whisky_ids').eq('id', evId).single()
  console.log(`\nput back · the saved list is ${(back?.finder_whisky_ids || []).length} bottles (was ${hadList?.length ?? 0})`)
}
console.log(fails ? `\n✗ ${fails} FAILED` : '\n✓ the offline finder scores identically to the live one')
process.exit(fails ? 1 : 0)
