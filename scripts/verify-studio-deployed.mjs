#!/usr/bin/env node
/**
 * HAS THE AUCTION CODE ACTUALLY REACHED PRODUCTION?
 *
 *   node scripts/verify-studio-deployed.mjs
 *   SITE=https://therampantclub.com node scripts/verify-studio-deployed.mjs
 *
 * ── WHY NOT ASK GITHUB, OR VERCEL ────────────────────────────────────────
 * A commit on origin/main is not a deployment, and a Vercel API that says
 * "ready" is describing a build, not the bytes a guest is served from the edge
 * right now. The only answer that cannot be wrong is the one the page gives:
 * fetch the live guide, read the content-named chunks it actually loads, and
 * look for something that exists ONLY in the new code.
 *
 * ⚠ THE MARKER HAS TO BE NEW. Looking for "Rizal Fathoni" would pass against
 * the old deployment too and report a deploy that never happened. Every marker
 * below was added by the auction commits and appears nowhere before them.
 *
 * ⚠ AND THE AUCTION MUST STILL BE INVISIBLE. These markers live in the
 * JavaScript because the component ships with the page; they are labels, not
 * data. Nothing may be RENDERED, which is what verify-studio-silent.mjs
 * proves — run that straight after this one.
 */
const SITE = process.env.SITE || 'https://therampantclub.com'
const SLUG = process.env.SLUG || 'rizal-fathoni'
let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

console.log(`against ${SITE}\n`)

const page = await fetch(`${SITE}/studio/${SLUG}/guide`, { cache: 'no-store' })
t(page.status === 200, 'the live guide loads', `HTTP ${page.status}`)
const html = await page.text()

// The content-named chunks this page really loads, now.
const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1])
t(srcs.length > 0, 'it loads content-named JavaScript chunks', `${srcs.length}`)
const bodies = [html]
for (const s of srcs) {
  const u = s.startsWith('http') ? s : new URL(s, SITE).href
  try { bodies.push(await (await fetch(u, { cache: 'no-store' })).text()) } catch { /* unreadable chunk proves nothing */ }
}

// CONTROL FIRST: the search must be able to find something at all.
t(bodies.some(b => b.includes('Rizal Fathoni')),
  'CONTROL: the sweep can read the deployed bundle — it finds the artist')

// ── THE MARKERS. Each one shipped with the auction commits. ──────────────
const MARKERS = [
  ['sga-banner', 'the auction component is in the bundle'],
  ['Silent auction', 'its English labels are there'],
  ['Đấu giá kín', 'and its Vietnamese ones'],
  ['have sold', 'the new "four works have sold" line is there'],
  ['Bidding has closed', 'the closed state is there'],
]
for (const [needle, what] of MARKERS) {
  t(bodies.some(b => b.includes(needle)), `${what}`, `"${needle}"`)
}

// ── THE ROUTES THE OWNER NEEDS ───────────────────────────────────────────
// ⚠ AN /admin/* PATH IS USELESS AS A DEPLOY SIGNAL. A dry run against the OLD
// deployment returned 307 for /admin/studio/auction — the sign-in redirect
// fires in middleware, before routing, so EVERY /admin path answers 307
// whether the page exists or not. It read as a pass and meant nothing. It is
// reported now, not asserted.
for (const path of ['/admin/studio/auction', '/admin/studio/auction/vn']) {
  const r = await fetch(`${SITE}${path}`, { redirect: 'manual', cache: 'no-store' })
  console.log(`  · ${path} → HTTP ${r.status} (sign-in redirect; not evidence either way)`)
}
// The API routes ARE evidence: no middleware in front of them, and a route
// that does not exist is a 404.
{
  const r = await fetch(`${SITE}/api/studio/auction/state?slug=${SLUG}`, { cache: 'no-store' })
  const deployed = r.status !== 404
  t(deployed, '/api/studio/auction/state is deployed', `HTTP ${r.status}`)
  const j = deployed ? await r.json().catch(() => null) : null
  t(Array.isArray(j?.lots), 'and it answers with a lot list', `${j?.lots?.length ?? 'no answer'} lots`)
  // ⚠ ONLY MEANINGFUL IF IT ANSWERED. This used to accept `undefined` as
  // "empty" and passed against a 404 — an absent route reported as proof that
  // nothing was published.
  //
  // ⚠ AND THE RIGHT ANSWER DEPENDS ON THE SWITCH. This asserted the list was
  // EMPTY, which was true until the owner pressed Publish and then reported a
  // correctly working auction as "NOT fully deployed". What this file is for
  // is whether the CODE arrived; whether lots come back is the auction's
  // state, so it is reported and checked against that state, not assumed.
  t(Array.isArray(j?.lots), 'the route answered with a list',
    Array.isArray(j?.lots) ? `${j.lots.length} lots` : 'the route did not answer')
  if (Array.isArray(j?.lots)) {
    console.log(j.lots.length === 0
      ? '  · the list is empty — the auction is not published yet'
      : `  · ${j.lots.length} lots are public — the auction is PUBLISHED`)
  }
}
{
  const r = await fetch(`${SITE}/api/studio/auction/mine`, { cache: 'no-store' })
  t(r.status !== 404, '/api/studio/auction/mine is deployed', `HTTP ${r.status}`)
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed — ${fail ? 'NOT fully deployed' : 'the auction code is live (and still unpublished)'}`)
if (!fail) console.log('Next: node scripts/verify-studio-silent.mjs with BASE set to the live site.')
process.exit(fail ? 1 : 0)
