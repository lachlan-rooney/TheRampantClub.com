// ═══════════════════════════════════════════════════════════════════════════
// WHO WROTE THE NOTE? — tasting_notes.composed, end to end.
//   node scripts/verify-note-attribution.mjs          (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner's ruling, 2026-10-08: fix the attribution BEFORE the tap is used.
//
// tasting_notes.note is NOT NULL, so the kiosk's one-tap pour log — which
// collects no prose on purpose — had to store something, and stored a sentence
// of the club's own against author = the member. The member's journey then
// rendered it in quotation marks under "you noted it".
//
// composed = true now means THE CLUB WROTE THIS. This proves three things that
// a schema check alone cannot:
//
//   · a wordless kiosk tap writes composed = true
//   · a note the member actually types is composed = false
//   · a member editing a composed note takes ownership — the flag comes off
//
// ── IT HAS TO BE ABLE TO FAIL ─────────────────────────────────────────────
// A check that only asked "is there a composed column" would pass on a column
// that is false for everything, which is precisely the bug wearing a hat. So
// it asserts BOTH values are produced by the real routes, and that the flag
// TRACKS authorship rather than being decoration. Step 6 re-reads through the
// member's own API, because a flag the member-facing surface never receives
// changes nothing on the page.
//
// ⚠ A THROWAWAY MEMBER, ZZ-NA. Never a real member_no: a note or a card
//   balance written onto a real key is somebody's actual record. Everything is
//   removed afterwards, and removed first in case a previous run died.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac, randomUUID } from 'node:crypto'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, BASE = process.env.BASE || 'http://localhost:3001'
const ref = U.match(/https:\/\/([a-z0-9]+)\./)[1]
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svc, ...i })
const admin = (p, i) => fetch(`${U}/auth/v1/admin/${p}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, ...i })

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }

const cookieFor = (sub, email) => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const un = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, app_metadata: { provider: 'email' }, user_metadata: {} })}`
  const jwt = `${un}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(un).digest('base64url')}`
  const se = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'x', user: { id: sub, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {} } }
  const v = 'base64-' + Buffer.from(JSON.stringify(se)).toString('base64url')
  if (v.length <= 3180) return `sb-${ref}-auth-token=${v}`
  const ps = []; for (let i = 0, n = 0; i < v.length; i += 3180, n++) ps.push(`sb-${ref}-auth-token.${n}=${v.slice(i, i + 3180)}`)
  return ps.join('; ')
}
const ownerCookie = cookieFor('3e1583db-b881-42ec-aadb-6f69a22fad80', 'lachlanrooney55@gmail.com')

const M = 'ZZ-NA', FULL = 'Mr Attributon', PIN = '418263', LABEL = 'ZZ-NA-DEV'
let uid = null, email = null
// ── CLEANUP IS A DEPENDENCY ORDER, NOT A LIST ───────────────────────
// members is pinned by profiles.member_no, and profiles is pinned by whatever
// the member did. Deleting in the wrong order leaves a throwaway member on a
// SHARED database, which is the one outcome a verification script must never
// produce. So: dependents, then the profile, then the member — each verified,
// with one retry, and the reason reported if anything sticks.
const wipe = async () => {
  if (uid) {
    await rest(`tasting_notes?author=eq.${uid}`, { method: 'DELETE' })
    await rest(`activity_events?actor=eq.${uid}`, { method: 'DELETE' })
  }
  await rest(`member_terms_consents?member_no=eq.${M}`, { method: 'DELETE' })
  await rest(`member_kiosk_pins?member_no=eq.${M}`, { method: 'DELETE' })
  await rest(`member_taste_profiles?member_no=eq.${M}`, { method: 'DELETE' })
  await rest(`kiosk_member_sessions?member_no=eq.${M}`, { method: 'DELETE' }).catch(() => {})
  await rest(`kiosk_devices?label=eq.${LABEL}`, { method: 'DELETE' })

  // The PROFILE goes before the auth user. Deleting the auth user first and
  // relying on a cascade left the profile behind, and the profile is what pins
  // the member row — that is how an earlier run of this harness left ZZ-NA on
  // the database.
  let why = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const profs = await (await rest(`profiles?member_no=eq.${M}&select=id`)).json()
    for (const pr of (Array.isArray(profs) ? profs : [])) {
      await rest(`tasting_notes?author=eq.${pr.id}`, { method: 'DELETE' })
      await rest(`activity_events?actor=eq.${pr.id}`, { method: 'DELETE' })
      const d = await rest(`profiles?id=eq.${pr.id}`, { method: 'DELETE' })
      if (!d.ok) why = `profiles DELETE ${d.status}: ${(await d.text()).slice(0, 200)}`
    }
    const mem = await rest(`members?member_no=eq.${M}`, { method: 'DELETE' })
    if (mem.ok) { why = null; break }
    why = `members DELETE ${mem.status}: ${(await mem.text()).slice(0, 200)}`
  }
  if (uid) await admin(`users/${uid}`, { method: 'DELETE' })
  return why
}
// A previous run that died leaves rows behind; find and clear them first.
{
  const stale = await (await rest(`profiles?member_no=eq.${M}&select=id`)).json()
  if (Array.isArray(stale) && stale.length) { uid = stale[0].id; await wipe(); uid = null }
  else await wipe()
}

try {
  // ── 0 · THE COLUMN HAS TO BE THERE AT ALL ───────────────────────────────
  const probe = await rest('tasting_notes?select=id,composed&limit=1')
  if (!probe.ok) {
    console.log(`\n✗ tasting_notes.composed does not exist (${probe.status}).`)
    console.log('  Run db/tasting_note_attribution.sql first. Nothing else can be proved.\n')
    process.exit(1)
  }
  t(true, '0 · tasting_notes.composed exists')

  // ── 1 · THE HARNESS ─────────────────────────────────────────────────────
  await rest('members', { method: 'POST', body: JSON.stringify({ member_no: M, full_name: FULL, tier: 'Pioneer', status: 'Active' }) })
  email = `zz-na-${randomUUID().slice(0, 8)}@example.invalid`
  uid = (await (await admin('users', { method: 'POST', body: JSON.stringify({ email, password: `zz-${randomUUID()}`, email_confirm: true }) })).json()).id
  await rest('profiles', { method: 'POST', headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: uid, display_name: FULL, member_no: M, is_admin: false }) })
  const memberCookie = cookieFor(uid, email)

  // Two different bottles: one note per dram per sitting is enforced, so the
  // typed note has to be a different whisky from the tapped one.
  const whiskies = await (await rest('whiskies?select=id,name&order=name&limit=2')).json()
  t(Array.isArray(whiskies) && whiskies.length === 2, '1 · HARNESS: a throwaway member and two bottles to note',
    `${Array.isArray(whiskies) ? whiskies.length : '?'} whiskies, uid ${uid ? 'ok' : 'MISSING'}`)
  if (!uid || whiskies.length < 2) throw new Error('harness could not be built')

  // The member's PIN, set as them — there is no admin setter, by design.
  await fetch(`${BASE}/api/members/kiosk-pin`, { method: 'POST', headers: { cookie: memberCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: PIN }) })

  // A paired tablet, then a real kiosk sign-in.
  const made = await (await fetch(`${BASE}/api/admin/kiosk-devices`, { method: 'POST', headers: { cookie: ownerCookie, 'Content-Type': 'application/json' }, // The space STRING, not the display name: floor 1 shows as "The Library Bar"
    // but its bookable-space key is "Library Bar", and the device route joins on
    // the key. Passing the display name returns "That room is not a bookable
    // space." and the pairing silently yields no device cookie.
    body: JSON.stringify({ label: LABEL, room: 'Library Bar' }) })).json()
  if (!made.pair_code) throw new Error(`no pairing code: ${JSON.stringify(made).slice(0, 200)}`)
  const paired = await fetch(`${BASE}/api/kiosk/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: made.pair_code }) })
  const device = ((paired.headers.getSetCookie?.() || []).find(c => c.startsWith('trc_kiosk_device=')) || '').split(';')[0].split('=')[1]
  t(!!device, '1a · the tablet pairs and gets a device token',
    device ? `room ${made.room || 'Library Bar'}` : `pair said ${paired.status} ${JSON.stringify(await paired.json().catch(() => ({}))).slice(0, 160)}`)
  if (!device) throw new Error('the tablet did not pair')
  // The real route is /api/kiosk/member/login, and it takes a NAME (resolved
  // to exactly one member) or a member_no, plus the PIN. member_no is used
  // here so the test is not also a test of name resolution.
  const signIn = await fetch(`${BASE}/api/kiosk/member/login`, { method: 'POST',
    headers: { cookie: `trc_kiosk_device=${device}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_no: M, pin: PIN }) })
  const signInBody = await signIn.json().catch(() => ({}))
  const kioskCookies = (signIn.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ')
  t(signIn.ok, '1b · the member signs in on the tablet', signIn.ok ? 'ok' : `${signIn.status} ${JSON.stringify(signInBody).slice(0, 160)}`)
  if (!signIn.ok) throw new Error('could not sign the member in')
  const tabletCookie = `trc_kiosk_device=${device}; ${kioskCookies}`

  // ── 2 · A WORDLESS TAP IS THE CLUB'S SENTENCE, AND SAYS SO ──────────────
  const tap = await fetch(`${BASE}/api/kiosk/member/note`, { method: 'POST',
    headers: { cookie: tabletCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ whisky_id: whiskies[0].id, lang: 'en' }) })
  const tapBody = await tap.json().catch(() => ({}))
  t(tap.ok, '2 · the one-tap pour log accepts the tap', tap.ok ? whiskies[0].name : `${tap.status} ${JSON.stringify(tapBody).slice(0, 160)}`)

  const tapped = await (await rest(`tasting_notes?author=eq.${uid}&whisky_id=eq.${whiskies[0].id}&select=id,note,composed`)).json()
  t(tapped.length === 1, '2b · exactly one row was written', `${tapped.length} row(s)`)
  t(tapped[0]?.composed === true, '2c · and it is flagged as the CLUB\'s words, not the member\'s',
    `composed=${tapped[0]?.composed} · note ${JSON.stringify(tapped[0]?.note)}`)
  t(/^Poured (in|at) /.test(tapped[0]?.note || ''), '2d · the body is the club\'s honest record of the pour',
    JSON.stringify(tapped[0]?.note))

  // ── 3 · A NOTE THE MEMBER TYPES IS THEIRS ───────────────────────────────
  const MINE = 'Dried fig, a little woodsmoke, and it keeps going.'
  // THE PORTAL ROUTE TAKES FormData, not JSON — it accepts an optional photo.
  // Posting JSON gets "Nothing to save." and looks like a validation bug.
  const fd = new FormData()
  fd.set('whisky_id', whiskies[1].id)
  fd.set('note', MINE)
  fd.set('flavour_tags', '[]')
  fd.set('visibility', 'private')
  const typed = await fetch(`${BASE}/api/social/tasting-notes`, { method: 'POST',
    headers: { cookie: memberCookie }, body: fd })
  const typedBody = await typed.json().catch(() => ({}))
  t(typed.ok, '3 · the member writes their own note from the portal', typed.ok ? 'ok' : `${typed.status} ${JSON.stringify(typedBody).slice(0, 160)}`)
  const own = await (await rest(`tasting_notes?author=eq.${uid}&whisky_id=eq.${whiskies[1].id}&select=id,note,composed`)).json()
  t(own[0]?.composed === false, '3b · and it is NOT flagged as the club\'s', `composed=${own[0]?.composed}`)
  // A member must not be able to forge the flag onto their own prose.
  const forge = await fetch(`${BASE}/api/social/tasting-notes/${own[0]?.id}`, { method: 'PATCH',
    headers: { cookie: memberCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: MINE, composed: true }) })
  await forge.json().catch(() => ({}))
  const afterForge = await (await rest(`tasting_notes?id=eq.${own[0]?.id}&select=composed`)).json()
  t(afterForge[0]?.composed === false, '3c · and the flag cannot be forged from the request body',
    `composed=${afterForge[0]?.composed}`)

  // ── 4 · EDITING A COMPOSED NOTE TAKES OWNERSHIP ─────────────────────────
  const THEIRS = 'Actually: pear, then pepper. Better than I expected.'
  const edit = await fetch(`${BASE}/api/social/tasting-notes/${tapped[0].id}`, { method: 'PATCH',
    headers: { cookie: memberCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: THEIRS }) })
  const editBody = await edit.json().catch(() => ({}))
  t(edit.ok, '4 · the member adds their own words to the tapped note', edit.ok ? 'ok' : `${edit.status} ${JSON.stringify(editBody).slice(0, 160)}`)
  const owned = await (await rest(`tasting_notes?id=eq.${tapped[0].id}&select=note,composed`)).json()
  t(owned[0]?.composed === false && owned[0]?.note === THEIRS,
    '4b · the note is now THEIRS — the flag came off with the new words',
    `composed=${owned[0]?.composed}`)

  // ── 5 · PROVE THE HARNESS ───────────────────────────────────────────────
  // Both values were produced by the real routes. A column stuck at false —
  // which is exactly what the bug looked like — fails here.
  const all = await (await rest(`tasting_notes?author=eq.${uid}&select=composed`)).json()
  const values = [...new Set(all.map(r => r.composed))]
  t(all.length >= 2, '5 · the harness wrote more than one note', `${all.length} rows`)
  // Re-tap a third bottle so a true and a false coexist at the same moment,
  // rather than being inferred across time.
  const third = await (await rest('whiskies?select=id,name&order=name&offset=2&limit=1')).json()
  if (third[0]) {
    await fetch(`${BASE}/api/kiosk/member/note`, { method: 'POST',
      headers: { cookie: tabletCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ whisky_id: third[0].id, lang: 'vn' }) })
    const both = await (await rest(`tasting_notes?author=eq.${uid}&select=composed,note`)).json()
    const vals = [...new Set(both.map(r => r.composed))]
    t(vals.includes(true) && vals.includes(false),
      '5b · BOTH values exist at once, so the flag is not decoration',
      `composed values present: ${vals.join(', ')}`)
    const vn = both.find(r => r.composed && /^Đã uống tại /.test(r.note))
    t(!!vn, '5c · and a Vietnamese tap composes in Vietnamese',
      vn ? JSON.stringify(vn.note) : `no VN-composed row among ${both.length}`)
  } else {
    t(false, '5b · BOTH values exist at once', 'not enough whiskies to test')
  }

  // ── 6 · THE MEMBER'S OWN SURFACES RECEIVE IT ────────────────────────────
  // A flag the page never sees changes nothing on the page.
  const journal = await (await fetch(`${BASE}/api/social/tasting-notes`, { headers: { cookie: memberCookie } })).json()
  const jn = journal.notes || []
  t(jn.length > 0 && jn.every(n => 'composed' in n), '6 · the notes journal API carries composed',
    `${jn.filter(n => 'composed' in n).length}/${jn.length} rows carry it`)
  t(jn.some(n => n.composed === true), '6b · and the journal can tell a composed note from an own one',
    `${jn.filter(n => n.composed).length} composed of ${jn.length}`)
  const journey = await (await fetch(`${BASE}/api/members/journey`, { headers: { cookie: memberCookie } })).json()
  const entries = (journey.timeline || journey.entries || []).filter(e => e.kind === 'note')
  t(entries.length > 0 && entries.every(e => 'composed' in e), '6c · the journey timeline carries composed',
    `${entries.filter(e => 'composed' in e).length}/${entries.length} note entries carry it`)

  // ── 7 · THE PAGE MUST RENDER IT DIFFERENTLY ─────────────────────
  // A column nothing sets and a column something sets but nothing READS are
  // the same defect in two places. Steps 2-6 prove the write and the API; this
  // proves what a member actually sees. Without it, the club could still be
  // showing its own sentence as the member's words with a flag sitting
  // unused in the database.
  //
  // /members is gated — documents, then PIN — so the throwaway has to satisfy
  // the gate the same way a real member does, or the page under test is a
  // redirect.
  const needed = ['membership_terms', 'privacy', 'marketing']
  for (const doc of needed) {
    const vid = await (await rest(`rpc/current_terms_version`, { method: 'POST', body: JSON.stringify({ p_doc_key: doc }) })).json().catch(() => null)
    if (!vid || typeof vid !== 'string') continue
    await rest('member_terms_consents', { method: 'POST',
      body: JSON.stringify({ member_no: M, terms_version_id: vid, doc_key: doc, granted: true, method: 'portal' }) })
  }
  // Re-tap the FIRST bottle so a composed note exists again: step 4 took
  // ownership of the original one, which is the right outcome but leaves
  // nothing composed to render.
  await rest(`tasting_notes?author=eq.${uid}&whisky_id=eq.${whiskies[0].id}`, { method: 'DELETE' })
  const retap = await fetch(`${BASE}/api/kiosk/member/note`, { method: 'POST',
    headers: { cookie: tabletCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ whisky_id: whiskies[0].id, lang: 'en' }) })
  if (!retap.ok) console.log('   (re-tap said:', retap.status, ')')
  const toRender = await (await rest(`tasting_notes?author=eq.${uid}&select=note,composed&order=composed.desc`)).json()
  const composedBody = (toRender.find(r => r.composed) || {}).note
  t(!!composedBody && toRender.some(r => !r.composed),
    '7 · RENDER SETUP: one composed note and one of the member\'s own exist',
    `composed ${JSON.stringify(composedBody)} · own ${toRender.filter(r => !r.composed).length}`)

  const browser = await chromium.launch()
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
    const cookies = memberCookie.split('; ').map(c => {
      const i = c.indexOf('=')
      return { name: c.slice(0, i), value: c.slice(i + 1), domain: 'localhost', path: '/' }
    })
    await ctx.addCookies(cookies)
    const page = await ctx.newPage()
    // domcontentloaded, not networkidle: the palate page keeps fetching and
    // networkidle never settles, which times out and reads like a broken page.
    const resp = await page.goto(`${BASE}/members/taste`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    t(resp && resp.status() === 200 && new URL(page.url()).pathname === '/members/taste',
      '7b · the palate page loads for the member', `${resp?.status()} ${new URL(page.url()).pathname}`)
    await page.waitForTimeout(3500)

    const txt = (await page.innerText('body')).replace(/\s+/g, ' ')
    const low = txt.toLowerCase()

    // THE LABEL. Lower-cased before matching: these are uppercase via CSS, so
    // a case-sensitive check fails on the rendered text and tells you nothing.
    t(low.includes('logged at the bar') || low.includes('not your words yet'),
      '7c · the page SAYS the club logged it, not the member',
      low.includes('logged at the bar') ? '"logged at the bar" present' : low.includes('not your words yet') ? '"not your words yet" present' : 'NEITHER label rendered')

    // AND IT MUST NOT CLAIM THE MEMBER WROTE IT. The journey labels an own
    // note "you noted it"; the composed one must not carry that label, and the
    // club's sentence must not be wrapped in quotation marks.
    const quotedComposed = composedBody ? txt.includes(`\u201c${composedBody}\u201d`) : false
    t(!quotedComposed, '7d · the club\'s sentence is NOT in quotation marks',
      quotedComposed ? `found “${composedBody}” — still presented as the member\'s words` : 'unquoted, as the club\'s record')

    // The member's OWN note must still be quoted, or 7d passed by removing
    // quotation marks from everything.
    const ownBody = (toRender.find(r => !r.composed) || {}).note
    const quotedOwn = ownBody ? txt.includes(`\u201c${ownBody}\u201d`) : false
    t(quotedOwn, '7e · the member\'s OWN note IS still quoted (7d did not just delete quotes)',
      quotedOwn ? 'quoted' : `own note ${JSON.stringify(ownBody)} not found quoted`)

    // The invitation, which is the reason a composed note stays on the page.
    t(low.includes('add your words'), '7f · and it invites them to write their own',
      low.includes('add your words') ? '"Add your words" present' : 'the invitation is missing')
  } finally { await browser.close() }

} catch (e) {
  t(false, 'harness threw', String(e.message))
} finally {
  const delRes = await wipe()
  const left = await (await rest(`members?member_no=eq.${M}&select=member_no`)).json()
  t(Array.isArray(left) && left.length === 0, 'cleanup · the throwaway member is gone',
    (Array.isArray(left) && left.length === 0) ? 'nothing left behind'
      : `${Array.isArray(left) ? left.length : '?'} row(s) left — ${delRes || 'no error reported'}`)
}

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
