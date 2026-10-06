// ═══════════════════════════════════════════════════════════════════════════
// CAN A CARD BE DRAGGED TO DONE ON THE MASTER BOARD?
//   node scripts/verify-master-board-drag.mjs        (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-10-06: "On the master knaban board, i cannot drag items between
// columns to done." He could not: the view was deliberately read-only — the
// code said "a card is moved on its own board, where the rest of its column is
// visible" — and the cards were plain links.
//
// THE HARD PART IS NOT THE GESTURE, IT IS THE DESTINATION. This board merges
// four column NAMES across every project; each project has its own four column
// IDS. A drop on "Done" has to resolve to THAT CARD'S OWN board's Done, so the
// check below reads the row afterwards and asserts the new column belongs to
// the same project.
//
// It drags a THROWAWAY card on a throwaway board, then deletes both.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, BASE = process.env.BASE || 'http://localhost:3001'
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const OWNER = '3e1583db-b881-42ec-aadb-6f69a22fad80'
const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: OWNER, email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
const asOwner = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
const rpc = async (fn, body) => {
  const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers: asOwner, body: JSON.stringify(body) })
  const txt = await r.text(); if (!r.ok) throw new Error(`${fn} ${r.status} ${txt.slice(0, 200)}`)
  try { return JSON.parse(txt) } catch { return txt }
}
const cookies = (() => {
  const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'lachlanrooney55@gmail.com', app_metadata: {}, user_metadata: {} } }
  const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
  const out = []
  if (v.length <= 3180) out.push({ name: `sb-${ref}-auth-token`, value: v, domain: 'localhost', path: '/' })
  else for (let i = 0, n = 0; i < v.length; i += 3180, n++) out.push({ name: `sb-${ref}-auth-token.${n}`, value: v.slice(i, i + 3180), domain: 'localhost', path: '/' })
  return out
})()

const BOARD = 'ZZ Drag Test'
let pid
const wipe = async () => {
  const ps = await (await rest(`projects?name=eq.${encodeURIComponent(BOARD)}&select=id`)).json()
  for (const p of ps || []) {
    const ts = await (await rest(`tasks?project_id=eq.${p.id}&select=id`)).json()
    for (const x of ts || []) await rest(`activity_events?object_id=eq.${x.id}`, { method: 'DELETE' })
    await rest(`activity_events?project_id=eq.${p.id}`, { method: 'DELETE' })
    await rest(`tasks?project_id=eq.${p.id}`, { method: 'DELETE' })
    await rest(`board_columns?project_id=eq.${p.id}`, { method: 'DELETE' })
    await rest(`project_members?project_id=eq.${p.id}`, { method: 'DELETE' })
    await rest(`projects?id=eq.${p.id}`, { method: 'DELETE' })
  }
}
await wipe()

let browser
try {
  // A throwaway board with its own four columns, and one card due today so the
  // 60-day horizon shows it.
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
  pid = String(await rpc('ops_create_project', { p_name: BOARD, p_description: 'throwaway — drag check', p_colour: '#64748B', p_start_date: today, p_target_date: today })).replace(/"/g, '')
  const cols = await (await rest(`board_columns?project_id=eq.${pid}&select=id,name,is_done_column&order=sort_order`)).json()
  const backlog = cols.find(c => c.name === 'Backlog'), doneCol = cols.find(c => c.is_done_column)
  const title = 'ZZ drag me to Done'
  const tid = String(await rpc('ops_create_task', { p_project_id: pid, p_column_id: backlog.id, p_title: title, p_description: '[Test]\nthrowaway', p_assignee: null, p_priority: 'normal', p_due_date: today })).replace(/"/g, '')
  t(!!pid && !!tid && cols.length === 4, '1 · HARNESS: a throwaway board, four columns, one card in Backlog', `${cols.length} cols`)

  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await ctx.addCookies(cookies)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e).slice(0, 140)))
  await p.goto(`${BASE}/admin/ops/timeline`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[data-col-name="Done"]', { timeout: 30000 })
  await p.waitForTimeout(3000)

  // PROVE THE HARNESS: the columns must be drop targets at all.
  const targets = await p.$$eval('[data-col-name]', ns => ns.map(n => n.dataset.colName))
  t(targets.length === 4 && targets.includes('Done'), '2 · PROVE THE HARNESS: all four columns are drop targets', targets.join(' → '))

  const card = p.locator(`a:has-text("${title}")`).first()
  t(await card.count() > 0, '3 · the throwaway card is on the master board')

  // ⚠ SCROLL IT INTO VIEW FIRST. Backlog is ~22,000px tall with 238 cards from
  // every board, so boundingBox() hands back a y far below a 1,000px viewport.
  // Moving the mouse there lands on nothing, no pointerdown reaches the card,
  // and a working drag reports as broken — which is what the first three runs
  // of this file were actually measuring.
  await card.scrollIntoViewIfNeeded()
  await p.waitForTimeout(400)
  const grab = await card.boundingBox()
  const drop = await p.locator('[data-col-name="Done"]').boundingBox()
  const inView = grab.y >= 0 && grab.y <= 1000 - 20
  t(inView, '3b · HARNESS: and it is on screen, where a pointer can reach it', `card y=${Math.round(grab.y)}, viewport 1000`)

  // A real mouse drag, past the 6px threshold, with moves in between so the
  // handlers see it as a drag rather than a click.
  await p.mouse.move(grab.x + grab.width / 2, grab.y + 14)
  await p.mouse.down()
  await p.mouse.move(grab.x + grab.width / 2 + 30, grab.y + 20, { steps: 4 })
  // A FRAME, BEFORE ASSERTING. setDragId is React state: without this the check
  // reads the DOM before the ghost has been painted and reports a working drag
  // as broken — which is exactly what it did the first time.
  await p.waitForTimeout(300)
  const ghost = await p.$$eval('div', ns => ns.filter(n => /rotate\(-1.5deg\)/.test(n.style.transform)).length)
  t(ghost > 0, '4 · a ghost follows the pointer')
  const dropY = Math.max(drop.y + 24, 60)
  await p.mouse.move(drop.x + drop.width / 2, Math.min(dropY, 940), { steps: 10 })
  await p.waitForTimeout(250)
  const lit = await p.$eval('[data-col-name="Done"]', n => getComputedStyle(n).outlineStyle !== 'none')
  t(lit, '5 · the Done column lights up under the pointer')
  await p.mouse.up()
  await p.waitForTimeout(2500)

  // ── THE ROW ITSELF ─────────────────────────────────────────────────────
  const [after] = await (await rest(`tasks?id=eq.${tid}&select=column_id,status,completed_at,project_id`)).json()
  t(after.column_id === doneCol.id, '6 · the card moved to ITS OWN board\'s Done column',
    after.column_id === doneCol.id ? 'correct column' : `landed in ${after.column_id}`)
  t(after.project_id === pid, '6b · and did not change board')
  t(after.status === 'done' && !!after.completed_at, '7 · and is stamped done, with a completion time',
    `${after.status} · ${String(after.completed_at).slice(0, 19)}`)

  // The spine recorded a move, as it would from a single board.
  const ev = await (await rest(`activity_events?object_id=eq.${tid}&select=verb&order=created_at.desc`)).json()
  t((ev || []).some(e => e.verb === 'moved' || e.verb === 'completed'), '8 · the activity spine recorded it',
    (ev || []).map(e => e.verb).join(', '))

  // And it did not navigate away — the whole point of suppressing the click.
  t(/\/admin\/ops\/timeline/.test(p.url()), '9 · PROVE THE HARNESS: the drag did not follow the card\'s link', p.url().replace(BASE, ''))
  t(errs.length === 0, '10 · no page errors', errs.slice(0, 2).join(' | '))
} catch (e) {
  console.log('✗ THREW:', e?.message || e); fail++
} finally {
  if (browser) await browser.close()
  await wipe()
  const left = await (await rest(`projects?name=eq.${encodeURIComponent(BOARD)}&select=id`)).json()
  t(Array.isArray(left) && left.length === 0, 'it cleaned up after itself', left.length ? 'LEFT A BOARD' : 'nothing left')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
