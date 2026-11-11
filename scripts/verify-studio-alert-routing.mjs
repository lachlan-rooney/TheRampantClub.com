#!/usr/bin/env node
/**
 * WHO ACTUALLY GETS TOLD ABOUT THE AUCTION?
 *
 *   node scripts/verify-studio-alert-routing.mjs
 *   BASE=https://therampantclub.com EXPECT=lachlanrooney55@gmail.com node scripts/verify-studio-alert-routing.mjs
 *
 * Files ONE real enquiry through the real route and then looks at who was
 * told. Nothing about the routing is read from code: the answer comes from
 * the notifications table, which is what the alert actually did.
 *
 * ── WHY THE EXPECTED LIST IS AN INPUT ────────────────────────────────────
 * Against production the recipients are decided by AUCTION_ALERT_TO on
 * VERCEL, which cannot be read from here. So the list is passed in and the
 * run proves the live site agrees with it. Locally it defaults to the value
 * in .env.local.
 *
 * ⚠ THIS SENDS REAL EMAIL — one per expected recipient. That is the point:
 * a routing check that does not send has not checked the routing.
 *
 * ⚠ AND IT IS WRITTEN FOR A LIST OF ANY LENGTH. It began life asserting
 * "exactly two addresses", which was true for about an hour: the list was
 * cut to the owner alone on 11 Nov 2026 and the check started failing for a
 * change it was supposed to be verifying. A test that hardcodes today's
 * answer has to be edited every time the answer is right.
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const BASE = process.env.BASE || 'http://localhost:3001'
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY
const EXPECT = (process.env.EXPECT || env.DEV_ALERT_ONLY_TO || env.AUCTION_ALERT_TO || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean).sort()

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const { createClient } = await import(`${process.cwd()}/node_modules/@supabase/supabase-js/dist/index.cjs`)
const a = createClient(U, K, { auth: { persistSession: false } })

console.log(`against ${BASE}`)
console.log(`expecting: ${EXPECT.join(', ') || '(nothing — pass EXPECT=)'}\n`)
t(EXPECT.length > 0, 'an expected list was given')

// ── THE CONTROLS. Without these, "only one person was told" could mean the
//    routing works, or that there is only one admin, or that nobody was told.
const admins = []
for (const p of (await a.from('profiles').select('id').eq('is_admin', true)).data || []) {
  const { data: u } = await a.auth.admin.getUserById(p.id)
  if (u?.user?.email) admins.push(u.user.email.toLowerCase())
}
t(admins.length > EXPECT.length,
  'CONTROL: there are MORE admins than the expected list — somebody is being excluded',
  `${admins.length} admins: ${admins.join(', ')}`)
const excluded = admins.filter(e => !EXPECT.includes(e))
t(excluded.length > 0, 'CONTROL: and here they are', excluded.join(', '))

// ── ONE REAL ENQUIRY ─────────────────────────────────────────────────────
const tag = 'alert-routing-' + randomUUID().slice(0, 8)
const rest = (p, o = {}) => fetch(`${U}/rest/v1/${p}`, {
  ...o, headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', Prefer: 'return=representation' },
})
let collabId
try {
  collabId = (await (await rest('collaborations', { method: 'POST', body: JSON.stringify({ slug: tag, artist_name: 'Routing', status: 'draft', sort: 9999 }) })).json())[0].id
  const pieceId = (await (await rest('collaboration_pieces', { method: 'POST', body: JSON.stringify({ collaboration_id: collabId, sort: 0, title_en: 'Routing Check Work' }) })).json())[0].id
  const auctionId = (await (await rest('studio_auctions', { method: 'POST', body: JSON.stringify({ collaboration_id: collabId, closes_at: new Date(Date.now() + 3600e3).toISOString(), announce_at: new Date(Date.now() + 7200e3).toISOString(), published: true }) })).json())[0].id
  const lotId = (await (await rest('studio_lots', { method: 'POST', body: JSON.stringify({ auction_id: auctionId, piece_id: pieceId, sort: 0, kind: 'sale', status: 'live', price_usd: 1 }) })).json())[0].id

  const before = new Date().toISOString()
  const r = await fetch(`${BASE}/api/studio/auction/enquire`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lot_id: lotId, name: 'ALERT ROUTING CHECK — please ignore',
      email: 'delivered+routing@resend.dev', phone: '',
      message: 'Automated routing check. No action needed.', lang: 'en',
    }),
  })
  t(r.status === 200, 'the enquiry was accepted, so a real alert was raised', `HTTP ${r.status}`)

  const { data: notes } = await a.from('notifications').select('id,recipient')
    .eq('type', 'auction_problem').gte('created_at', before)
  const told = []
  for (const n of notes || []) {
    const { data: u } = await a.auth.admin.getUserById(n.recipient)
    told.push((u?.user?.email || n.recipient).toLowerCase())
  }
  told.sort()
  t(told.length === EXPECT.length && told.every((e, i) => e === EXPECT[i]),
    `told EXACTLY the expected ${EXPECT.length === 1 ? 'person' : `${EXPECT.length} people`}`,
    told.length ? told.join(', ') : 'nobody was told at all')
  for (const e of excluded) t(!told.includes(e), `${e} was NOT told`)

  if (notes?.length) {
    await a.from('notifications').delete().in('id', notes.map(n => n.id))
    console.log('\n  (the check cleared its own bells)')
  }
} finally {
  if (collabId) await rest(`collaborations?id=eq.${collabId}`, { method: 'DELETE' })
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`)
console.log(`⚠ ${EXPECT.length} real email(s) were sent by this check, to the expected recipient(s) only.`)
process.exit(fail ? 1 : 0)
