// ═══════════════════════════════════════════════════════════════════════════
// EDITING A MEMBER'S NAME — the route, the trimming, and the audit entry.
//   node scripts/verify-member-rename.mjs            (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Until 2026-10-26 there was no way to correct a member's name anywhere in the
// admin. /api/admin/mis/members/<no> accepted tier, status and join_date only;
// a name entered wrongly at signing stayed wrong across 81 files' worth of
// surfaces and the only fix was SQL.
//
// What this proves, because none of it is visible from reading the page:
//   · a name actually changes, and comes back trimmed and collapsed
//   · an empty name is REFUSED, not coerced — full_name is NOT NULL
//   · a nickname can be CLEARED to null, which is a legitimate edit
//   · the change lands on the activity spine with the OLD value, so the audit
//     trail says what it was rather than only that it moved
//   · the allow-list is still an allow-list: an unknown field is rejected
//
// ⚠ A THROWAWAY MEMBER, ZZ-NM. Never a real member_no — renaming a real member
//   as a test rewrites what every surface in the building calls them. Removed
//   afterwards in dependency order (profiles.member_no pins members), and
//   removed first in case a previous run died.
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

const OWNER = '3e1583db-b881-42ec-aadb-6f69a22fad80'
const ownerCookie = (() => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: OWNER, email: 'lachlanrooney55@gmail.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
  const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
  const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'lachlanrooney55@gmail.com', app_metadata: {}, user_metadata: {} } }
  const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
  if (v.length <= 3180) return `sb-${ref}-auth-token=${v}`
  const ps = []; for (let i = 0, n = 0; i < v.length; i += 3180, n++) ps.push(`sb-${ref}-auth-token.${n}=${v.slice(i, i + 3180)}`)
  return ps.join('; ')
})()

const M = 'ZZ-NM'
const wipe = async () => {
  // object_id is a uuid column, so a member rename is keyed by metadata.
  await rest(`activity_events?verb=eq.member.renamed&metadata->>member_no=eq.${M}`, { method: 'DELETE' }).catch(() => {})
  const profs = await (await rest(`profiles?member_no=eq.${M}&select=id`)).json()
  for (const p of (Array.isArray(profs) ? profs : [])) await rest(`profiles?id=eq.${p.id}`, { method: 'DELETE' })
  const d = await rest(`members?member_no=eq.${M}`, { method: 'DELETE' })
  return d.ok ? null : `members DELETE ${d.status}: ${(await d.text()).slice(0, 160)}`
}
await wipe()

const patch = (body) => fetch(`${BASE}/api/admin/mis/members/${M}`, {
  method: 'PATCH', headers: { cookie: ownerCookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const row = async () => (await (await rest(`members?member_no=eq.${M}&select=full_name,nickname,tier,status`)).json())[0]

try {
  await rest('members', { method: 'POST', body: JSON.stringify({ member_no: M, full_name: 'Mr Wrongname', nickname: 'Wrongy', tier: 'Pioneer', status: 'Active' }) })
  const seeded = await row()
  t(seeded?.full_name === 'Mr Wrongname', '1 · HARNESS: a throwaway member with a name to correct', `${seeded?.full_name} / "${seeded?.nickname}"`)
  if (!seeded) throw new Error('could not seed the throwaway member')

  console.log('\n2 · the gate still holds')
  const anon = await fetch(`${BASE}/api/admin/mis/members/${M}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: 'Hacker' }) })
  t(anon.status === 401, '2 · no cookie → 401', `${anon.status}`)
  t((await row())?.full_name === 'Mr Wrongname', '2b · and the name did not move')

  console.log('\n3 · the name changes, and comes back tidy')
  // Pasted out of a spreadsheet: leading space, double space, trailing space.
  // db/mis_pass1.sql exists partly because of exactly this.
  const r3 = await patch({ full_name: '  Nguyễn   Thị  Hương  ', nickname: '  Huong  ' })
  const j3 = await r3.json().catch(() => ({}))
  t(r3.ok, '3 · a rename is accepted', r3.ok ? '' : `${r3.status} ${JSON.stringify(j3).slice(0, 140)}`)
  const a3 = await row()
  t(a3?.full_name === 'Nguyễn Thị Hương', '3b · whitespace trimmed AND internal runs collapsed', JSON.stringify(a3?.full_name))
  t(a3?.nickname === 'Huong', '3c · the nickname too', JSON.stringify(a3?.nickname))
  t(j3.member?.full_name === 'Nguyễn Thị Hương', '3d · and the route returns the stored value, not the input')

  console.log('\n4 · what it refuses')
  for (const [label, body, expect] of [
    ['an empty name', { full_name: '   ' }, 400],
    ['a name of only whitespace-collapsing junk', { full_name: '\t\n ' }, 400],
    ['an over-long name', { full_name: 'x'.repeat(121) }, 400],
    ['an over-long nickname', { nickname: 'y'.repeat(61) }, 400],
    ['an unknown field alone', { favourite_colour: 'gold' }, 400],
  ]) {
    const r = await patch(body)
    t(r.status === expect, `4 · ${label} → ${expect}`, `${r.status}`)
  }
  const a4 = await row()
  t(a4?.full_name === 'Nguyễn Thị Hương' && a4?.nickname === 'Huong',
    '4b · and after five refusals the record is untouched', `${a4?.full_name} / "${a4?.nickname}"`)

  console.log('\n5 · a nickname can be cleared — not every member has one')
  const r5 = await patch({ nickname: '' })
  t(r5.ok, '5 · clearing it is accepted', `${r5.status}`)
  t((await row())?.nickname === null, '5b · and it is stored as NULL, not an empty string',
    JSON.stringify((await row())?.nickname))

  console.log('\n6 · the audit trail says what it WAS')
  const ev = await (await rest(`activity_events?verb=eq.member.renamed&metadata->>member_no=eq.${M}&select=verb,actor,metadata,created_at&order=created_at.desc`)).json()
  const renames = (Array.isArray(ev) ? ev : []).filter(e => e.verb === 'member.renamed')
  t(renames.length >= 1, '6 · the rename is on the spine', `${renames.length} member.renamed event(s)`)
  const first = renames[renames.length - 1]
  t(first?.metadata?.full_name_from === 'Mr Wrongname',
    '6b · with the OLD name, not just the new one', `from ${JSON.stringify(first?.metadata?.full_name_from)}`)
  t(first?.metadata?.full_name_to === 'Nguyễn Thị Hương', '6c · and the new one')
  t(first?.actor === OWNER, '6d · stamped with the admin who did it, not a null service-role actor',
    first?.actor === OWNER ? 'owner' : `actor=${first?.actor}`)

  console.log('\n7 · PROVE THE HARNESS — the old route must FAIL this')
  // Before today the route's allow-list was tier/status/join_date only, so a
  // name-only PATCH fell through to "Nothing to update." and 400'd. That is
  // the known-broken behaviour, and step 3 is what distinguishes it: if the
  // name support were reverted, step 3 would 400 and this check would too.
  const r7 = await patch({ full_name: 'Probe Name' })
  t(r7.ok, '7 · a name-only PATCH succeeds (it used to 400 "Nothing to update.")', `${r7.status}`)
  const tierOnly = await patch({ tier: 'Legacy' })
  t(tierOnly.ok && (await row())?.tier === 'Legacy',
    '7b · and the fields that always worked still work', 'tier → Legacy')
  // The name must not be writable through a path that skips validation.
  const sneaky = await patch({ full_name: '  ', tier: 'Pioneer' })
  t(sneaky.status === 400 && (await row())?.tier === 'Legacy',
    '7c · a bad name rejects the WHOLE patch — tier did not slip through', `${sneaky.status}, tier still Legacy`)

  console.log('\n8 · THE CONTROL IS ON THE PAGE')
  // The API passing proves nothing about whether a human can reach it. And a
  // curl cannot see this page: it is a client component that fetches the
  // member in useEffect, so the server renders only a loading shell — the
  // name heading and its Edit button do not exist until hydration. Checked in
  // a browser, against the THROWAWAY member's own record page, so no real
  // member's page is opened or edited.
  const browser = await chromium.launch()
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
    await ctx.addCookies(ownerCookie.split('; ').map(c => {
      const i = c.indexOf('=')
      return { name: c.slice(0, i), value: c.slice(i + 1), domain: 'localhost', path: '/' }
    }))
    const page = await ctx.newPage()
    const resp = await page.goto(`${BASE}/admin/mis/${M}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    t(resp && resp.status() === 200, '8 · the record page loads', `${resp?.status()}`)
    await page.waitForSelector('h1', { timeout: 20000 })
    await page.waitForTimeout(1200)

    const heading = (await page.innerText('h1')).trim()
    t(heading.length > 0, '8b · it renders the member\'s name', JSON.stringify(heading))

    const btn = page.locator('h1 button')
    const n = await btn.count()
    t(n === 1, '8c · there is exactly one Edit control on the name', `${n} found`)
    // Lower-cased before matching: the label is uppercased by CSS, so a
    // case-sensitive check fails on the rendered text.
    t(n === 1 && (await btn.first().innerText()).trim().toLowerCase() === 'edit',
      '8d · and it reads "Edit"')

    if (n === 1) {
      await btn.first().click()
      await page.waitForTimeout(400)
      const low = (await page.innerText('body')).replace(/\s+/g, ' ').toLowerCase()
      t(low.includes('full name'), '8e · clicking it reveals a Full name field')
      t(low.includes('nickname'), '8f · and a Nickname field')
      t(low.includes('save name'), '8g · with a Save control')
      t(low.includes('receipts already issued keep the name'),
        '8h · and it says issued receipts keep the old name BEFORE they save')

      // Prefilled, not blank: an empty box invites retyping a name from memory.
      const boxes = await page.locator('input[maxlength="120"], input[maxlength="60"]').all()
      t(boxes.length === 2, '8i · both name boxes are present', `${boxes.length}`)
      if (boxes.length === 2) {
        const v = await boxes[0].inputValue()
        t(v.length > 0, '8j · the full-name box is PREFILLED with the current name', JSON.stringify(v))
      }

      // Escape must abandon, not save.
      const before8 = (await row())?.full_name
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      const stillOpen = (await page.innerText('body')).toLowerCase().includes('save name')
      t(!stillOpen, '8k · Escape closes the editor')
      t((await row())?.full_name === before8, '8l · and saved nothing', JSON.stringify(before8))
    }
  } finally { await browser.close() }
} catch (e) {
  t(false, 'harness threw', String(e.message))
} finally {
  const why = await wipe()
  const left = await (await rest(`members?member_no=eq.${M}&select=member_no`)).json()
  t(Array.isArray(left) && left.length === 0, 'cleanup · the throwaway member is gone',
    (Array.isArray(left) && left.length === 0) ? 'nothing left behind' : `${left.length} left — ${why || 'no error'}`)
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
