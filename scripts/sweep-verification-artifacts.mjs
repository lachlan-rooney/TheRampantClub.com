// SWEEP EVERY VERIFICATION ARTEFACT, ACROSS EVERY TABLE.
//
// Why this exists rather than each script cleaning up after itself: three
// throwaways survived their own cleanup, and the third was an ADMIN. The pattern
// is always the same — a script deletes the auth user and assumes the profile
// follows, but a foreign key pins one or the other and the delete fails quietly.
//
// TWO RULES, in this order:
//   1. REVOKE PRIVILEGE FIRST. It works regardless of foreign keys, and it is
//      the half that matters. A pinned row that cannot be deleted is untidy; a
//      pinned row that is an admin is a live account nobody is looking at.
//   2. NEVER invent history to satisfy a constraint. Where a reference must be
//      cleared to allow a delete, it is set NULL — not reassigned to a real
//      person, which would falsify provenance to win an argument with the
//      database.
//
// Run with --check to assert only (exit 1 on a finding), or with no flag to fix.
import { readFileSync } from 'node:fs'
const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, S = env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' }
const CHECK = process.argv.includes('--check')

// The admin roster is a FACT, not a guess. If this list stops matching, either
// someone was added deliberately (update it, in a commit) or something is wrong.
const EXPECTED_ADMINS = ['Staff (shared)', 'Membership Team', 'Mr Rooney', 'Shawn Smith', null]

// Rows that are pinned by an APPEND-ONLY audit spine are meant to survive. They
// are neutralised (non-admin, banned), never deleted — excepting them once stops
// the spine being append-only.
const KEEP_BANNED = ['6f158fb0-b907-40b3-9316-01b9b5f985f7']

let problems = 0
const say = (ok, l, d = '') => { console.log(`${ok ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!ok) problems++ }
const get = async q => { const r = await fetch(`${U}/rest/v1/${q}`, { headers: h }); return r.ok ? r.json() : [] }
const del = (q) => fetch(`${U}/rest/v1/${q}`, { method: 'DELETE', headers: h })

console.log(`── ${CHECK ? 'CHECKING' : 'SWEEPING'} verification artefacts ──\n`)

// ── 1 · PRIVILEGE FIRST ───────────────────────────────────────────────────
const admins = await get('profiles?select=id,display_name,is_admin&is_admin=eq.true')
const strayAdmins = admins.filter(a => /^ZZ/i.test(a.display_name || ''))
for (const a of strayAdmins) {
  say(false, `STRAY ADMIN: ${a.display_name}`, a.id)
  if (!CHECK) {
    await fetch(`${U}/rest/v1/profiles?id=eq.${a.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ is_admin: false }) })
    console.log('    → admin revoked')
  }
}
const names = admins.map(a => a.display_name).sort()
const expect = [...EXPECTED_ADMINS].sort()
say(admins.length === EXPECTED_ADMINS.length && JSON.stringify(names) === JSON.stringify(expect),
    `admin roster is exactly ${EXPECTED_ADMINS.length}`, names.map(n => n ?? '(null)').join(', '))

// ── 2 · THE ARTEFACTS, in dependency order ────────────────────────────────
const sweeps = [
  ['fixture_signups',  'fixture_signups?fixture_id=in.(select)',      null], // handled with fixtures
  ['fixtures',         'fixtures?select=id,title&title=like.ZZ*',      f => `fixtures?id=eq.${f.id}`],
  ['calendar_entries', 'calendar_entries?select=id,title&title=like.ZZ*', f => `calendar_entries?id=eq.${f.id}`],
  ['members',          'members?select=member_no&member_no=like.ZZ*',  f => `members?member_no=eq.${f.member_no}`],
  ['whisky_weekly_sales', 'whisky_weekly_sales?select=week_start&note=like.ZZ*', f => `whisky_weekly_sales?week_start=eq.${f.week_start}`],
]
for (const [label, q, toDel] of sweeps) {
  if (!toDel) continue
  const rows = await get(q)
  if (!rows.length) { say(true, `${label}: clean`); continue }
  say(false, `${label}: ${rows.length} leftover`, rows.map(r => r.title || r.member_no || r.week_start).join(', '))
  if (!CHECK) for (const r of rows) {
    if (label === 'fixtures') await del(`fixture_signups?fixture_id=eq.${r.id}`)
    const res = await del(toDel(r))
    if (!res.ok) console.log(`    → pinned: ${(await res.text()).slice(0, 120)}`)
  }
}

// ── 3 · PROFILES AND AUTH USERS, the pair that keeps going wrong ──────────
const zzProfiles = await get('profiles?select=id,display_name,is_admin&display_name=like.ZZ*')
const users = (await (await fetch(`${U}/auth/v1/admin/users?per_page=200`, { headers: h })).json()).users || []
const zzUsers = users.filter(u => /^zz-/i.test(u.email || ''))
const ids = [...new Set([...zzProfiles.map(p => p.id), ...zzUsers.map(u => u.id)])]

for (const id of ids) {
  const p = zzProfiles.find(x => x.id === id), u = zzUsers.find(x => x.id === id)
  const label = p?.display_name || u?.email || id
  if (KEEP_BANNED.includes(id)) {
    const banned = !!u?.banned_until
    say(banned, `${label}: pinned by the audit spine — kept, must be banned`, banned ? 'banned' : 'NOT BANNED')
    if (!banned && !CHECK) {
      await fetch(`${U}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: h, body: JSON.stringify({ ban_duration: '876000h' }) })
      console.log('    → banned')
    }
    continue
  }
  say(false, `leftover account: ${label}`)
  if (CHECK) continue
  // Clear references that would pin the delete. NULL, never reassigned.
  await fetch(`${U}/rest/v1/entry_attachments?uploaded_by=eq.${id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ uploaded_by: null }) })
  await fetch(`${U}/rest/v1/whisky_weekly_sales?entered_by=eq.${id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ entered_by: null }) })
  await fetch(`${U}/rest/v1/finance_settings?updated_by=eq.${id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ updated_by: null }) })
  const pr = await del(`profiles?id=eq.${id}`)
  const ur = await fetch(`${U}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: h })
  if (pr.ok && ur.ok) console.log('    → removed')
  else {
    // Could not be deleted. Neutralise rather than leave it live.
    await fetch(`${U}/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ is_admin: false }) })
    await fetch(`${U}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: h, body: JSON.stringify({ ban_duration: '876000h' }) })
    console.log(`    → PINNED, so revoked + banned instead. Add to KEEP_BANNED if permanent.`)
  }
}

// ── 4 · STORAGE ───────────────────────────────────────────────────────────
for (const bucket of ['entry-attachments', 'event-media']) {
  const r = await fetch(`${U}/storage/v1/object/list/${bucket}`, {
    method: 'POST', headers: h, body: JSON.stringify({ prefix: 'zz-probe', limit: 100 }) })
  const objs = r.ok ? await r.json() : []
  say(objs.length === 0, `${bucket}: no probe objects`, objs.length ? `${objs.length} found` : '')
  if (!CHECK) for (const o of objs) await del(`../storage/v1/object/${bucket}/zz-probe/${o.name}`)
}

console.log(problems === 0 ? '\nCLEAN\n' : `\n${problems} finding(s)${CHECK ? ' — run without --check to fix' : ''}\n`)
process.exit(problems && CHECK ? 1 : 0)
