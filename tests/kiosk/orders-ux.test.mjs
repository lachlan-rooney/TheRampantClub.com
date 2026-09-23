// ═══════════════════════════════════════════════════════════════════════════
// ROOM ORDERS, END TO END — the room tablet, the floor's board, the admin page.
//   node tests/kiosk/orders-ux.test.mjs            (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-23: "let's refine the ordering process, UX etc". What changed:
// a note the room can write, a ✕ on each line, and — the real gap — the order
// is now visible on the staff tablet, the door tablet and an admin page
// instead of only on the tablet it was written on.
//
// ⚠ IT USES A THROWAWAY TABLET, NOT A REAL ONE. kiosk_devices stores only a
// SHA-256 of a device token, so a test token can be enrolled without touching
// any of the four real tablets; the device and every order it makes are
// deleted at the end, including on failure. The room is Source & Origin Lab —
// a real space (the database refuses invented ones) that has NO tablet paired
// to it, so nothing appears in front of a member. The one cost, stated
// plainly: for a few seconds the order is on the floor's board, where it is
// labelled as a test.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHash, createHmac, randomBytes } from 'node:crypto'

const ORIGIN = 'http://localhost:3001'
// A REAL ROOM, because a trigger on menu_orders refuses any room that is not
// in space_tables — invented ones are rejected, which is correct. So the test
// uses the ONE club space with no tablet paired to it: an order here cannot
// appear in front of anybody in that room, and both it and the throwaway
// device are deleted at the end. Every order it writes says so in its note.
const ROOM = 'Source & Origin Lab'
const ADMIN = '3e1583db-b881-42ec-aadb-6f69a22fad80'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (path, init = {}) => fetch(`${U}/rest/v1/${path}`, { headers: svc, ...init })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }

// ── A tablet of our own ────────────────────────────────────────────────────
const token = 'test-' + randomBytes(24).toString('hex')
const tokenHash = createHash('sha256').update(token).digest('hex')
let deviceId = null

// ── An admin session, for the manager's page ───────────────────────────────
function adminCookies() {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = { sub: ADMIN, email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} }
  const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`
  const jwt = `${unsigned}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(unsigned).digest('base64url')}`
  const session = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: ADMIN, aud: 'authenticated', role: 'authenticated', email: payload.email, app_metadata: {}, user_metadata: {} } }
  const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
  const out = []
  if (value.length > 3180) for (let i = 0, n = 0; i < value.length; i += 3180, n++) out.push({ name: `sb-${ref}-auth-token.${n}`, value: value.slice(i, i + 3180), domain: 'localhost', path: '/' })
  else out.push({ name: `sb-${ref}-auth-token`, value, domain: 'localhost', path: '/' })
  return out
}

async function cleanup() {
  const r = await rest(`menu_orders?room=eq.${encodeURIComponent(ROOM)}&select=id`)
  const orders = await r.json().catch(() => [])
  for (const o of orders ?? []) {
    await rest(`menu_order_lines?order_id=eq.${o.id}`, { method: 'DELETE' })
    await rest(`menu_orders?id=eq.${o.id}`, { method: 'DELETE' })
  }
  if (deviceId) await rest(`kiosk_devices?id=eq.${deviceId}`, { method: 'DELETE' })
}

const b = await chromium.launch()
try {
  await cleanup()
  const made = await (await rest('kiosk_devices', {
    method: 'POST',
    body: JSON.stringify({ label: ROOM, room: ROOM, purpose: 'room', token_hash: tokenHash, enrolled_at: new Date().toISOString() }),
  })).json()
  deviceId = made?.[0]?.id
  t(!!deviceId, 'a throwaway tablet is enrolled for the test', JSON.stringify(made).slice(0, 120))

  // ── THE ROOM TABLET ──────────────────────────────────────────────────────
  const ctx = await b.newContext({ viewport: { width: 1024, height: 1366 }, hasTouch: true })
  await ctx.addCookies([{ name: 'trc_kiosk_device', value: token, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message))
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)) })
  await p.goto(`${ORIGIN}/kiosk/menu`, { waitUntil: 'networkidle', timeout: 120000 })
  await p.waitForTimeout(1500)

  const plus = p.locator('.mb-step-btn', { hasText: '+' })
  t(await plus.count() > 1, 'the menu offers dishes to order', `${await plus.count()} steppers`)
  const btnH = await p.locator('.mb-step-btn').first().evaluate(e => Math.round(e.getBoundingClientRect().height)).catch(() => 0)
  t(btnH >= 44, 'the +/− buttons are a fingertip tall on the tablet', `${btnH}px`)

  await plus.nth(0).tap(); await p.waitForTimeout(250)
  await plus.nth(0).tap(); await p.waitForTimeout(250)   // two of the first
  await plus.nth(1).tap(); await p.waitForTimeout(400)   // one of the second

  // The note — the owner's choice: one for the whole order.
  await p.locator('.mb-tray-addnote').tap(); await p.waitForTimeout(300)
  const NOTE = 'AUTOMATED TEST — ignore · no ice please'
  await p.locator('#mb-note').fill(NOTE)
  t(await p.locator('.mb-tray-left').textContent() === String(240 - NOTE.length), 'the note counts down from 240')

  await p.locator('.mb-tray-go').tap()
  // Wait for the panel to BE there rather than for a guessed number of
  // milliseconds — a fixed wait is a test that fails on a slow afternoon.
  const panel = p.locator('.km-order')
  await panel.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
  t(await panel.isVisible(), 'confirming writes the order down on the tablet')
  t(/press the button on your table/i.test(await panel.textContent()),
    'and still says the table button is what calls a server')
  const lines = await p.locator('.km-lines li').count()
  t(lines === 2, 'both dishes are on it', `${lines} lines`)
  t((await p.locator('.km-note').textContent()).includes(NOTE), 'the note is on the order')

  // The row from the database — the note must be stored, not only displayed.
  const stored = await (await rest(`menu_orders?room=eq.${encodeURIComponent(ROOM)}&cleared_at=is.null&select=id,status,note,total_vnd`)).json()
  t(stored[0]?.note === NOTE && stored[0]?.status === 'pending', 'and stored with it', JSON.stringify(stored[0]))

  // ── ✕ ON A LINE ──────────────────────────────────────────────────────────
  await p.locator('.km-x').first().tap()
  // The order is re-sent and re-read, which on a cold dev server takes longer
  // than any number worth guessing: wait for the line to be gone.
  await p.waitForFunction(() => document.querySelectorAll('.km-lines li').length === 1, null, { timeout: 20000 }).catch(() => {})
  const after = await p.locator('.km-lines li').count()
  const kept = await (await rest(`menu_orders?room=eq.${encodeURIComponent(ROOM)}&cleared_at=is.null&select=note`)).json()
  t(after === 1, 'taking one line off leaves the rest of the order', `${lines} → ${after}`)
  t(kept[0]?.note === NOTE, 'and keeps the note')

  // ── EDITING THE NOTE AFTERWARDS ─────────────────────────────────────────
  await p.locator('.km-note-edit').tap(); await p.waitForTimeout(300)
  await p.locator('.km-note textarea').fill('AUTOMATED TEST — ignore · together, please')
  await p.locator('.km-note-acts .is-go').tap(); await p.waitForTimeout(2000)
  const edited = await (await rest(`menu_orders?room=eq.${encodeURIComponent(ROOM)}&cleared_at=is.null&select=note,status`)).json()
  t(edited[0]?.note === 'AUTOMATED TEST — ignore · together, please' && edited[0]?.status === 'pending',
    'the note can be changed after confirming, and that does not place the order', JSON.stringify(edited[0]))

  // ── THE FLOOR'S BOARD (device-gated: staff tablet and door tablet) ───────
  const board = await p.evaluate(async () => (await fetch('/api/kiosk/orders/open', { cache: 'no-store' })).json())
  const mine = (board.orders ?? []).find(o => o.room === 'Source & Origin Lab')
  t(!!mine, 'the order appears on the floor board, which no screen could see before', `${board.orders?.length} open`)
  t(mine?.note === 'AUTOMATED TEST — ignore · together, please' && mine?.lines?.length === 1, 'with its note and its dishes', JSON.stringify(mine?.lines?.length))

  // ── THE MANAGER'S PAGE ───────────────────────────────────────────────────
  const actx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  await actx.addCookies(adminCookies())
  const ap = await actx.newPage()
  await ap.goto(`${ORIGIN}/admin/orders`, { waitUntil: 'networkidle', timeout: 120000 })
  await ap.waitForTimeout(2000)
  const card = ap.locator('.oo-card', { hasText: ROOM })
  t(await card.count() === 1, 'the same order is on the admin page')
  t(/Waiting/i.test(await card.textContent()), 'marked as waiting, with how long it has waited')

  // A manager places it from the office; the room's tablet must agree.
  await card.locator('.oo-act.is-go').click()
  await ap.waitForTimeout(1500)
  t(/Ordered/i.test(await card.textContent()), 'a manager can place it without walking to the room')

  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1800)
  t(/with the kitchen/i.test(await p.locator('.km-order').textContent()),
    'and the room tablet then says it is with the kitchen')
  t(await p.locator('.km-x').count() === 0, 'a placed order can no longer be edited from the room')

  const who = await (await rest(`menu_orders?room=eq.${encodeURIComponent(ROOM)}&cleared_at=is.null&select=status,ordered_by,ordered_at`)).json()
  t(who[0]?.status === 'ordered' && !!who[0]?.ordered_by && !!who[0]?.ordered_at,
    'who placed it and when is written down', JSON.stringify(who[0]))

  // ── CLEARING ─────────────────────────────────────────────────────────────
  // The list re-renders on its own poll, so the button can be replaced under
  // the pointer. Click, then wait for the card to GO — and only then ask the
  // database, instead of asking 1500ms later and hoping.
  await card.locator('.oo-act', { hasText: /Clear|Xoá/ }).click()
  await ap.locator('.oo-card', { hasText: ROOM }).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
  t(await ap.locator('.oo-card', { hasText: ROOM }).count() === 0, 'clearing takes it off the board')
  const archived = await (await rest(`menu_orders?room=eq.${encodeURIComponent(ROOM)}&select=cleared_at`)).json()
  t(archived.length > 0 && archived.every(o => !!o.cleared_at),
    'and archives it rather than deleting it', JSON.stringify(archived))

  t(errs.length === 0, 'no page errors on the tablet', errs.slice(0, 2).join(' | '))
} finally {
  await cleanup()
  const left = await (await rest(`menu_orders?room=eq.${encodeURIComponent(ROOM)}&select=id`)).json().catch(() => [])
  const dev = await (await rest(`kiosk_devices?room=eq.${encodeURIComponent(ROOM)}&select=id`)).json().catch(() => [])
  t(left.length === 0 && dev.length === 0, 'the throwaway tablet and its orders are gone', `${left.length} orders, ${dev.length} devices`)
  await b.close()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
