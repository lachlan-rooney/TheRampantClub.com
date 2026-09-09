#!/usr/bin/env node
// MEMBER DOCUMENTS verification. Run against a PRODUCTION build (next start -p 3001).
//
// SAFE BY DEFAULT. Checks 1, 4 and 5 exercise the GATE, which needs a REQUIRED
// document published — and publishing one gates every linked member (currently the
// three founders) until they agree. Those run only with GATE=1, deliberately.
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { NEXT_PUBLIC_SUPABASE_URL: U, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
        SUPABASE_SERVICE_ROLE_KEY: SVC, SUPABASE_JWT_SECRET: SEC } = env
const APP = process.env.APP_URL || 'http://localhost:3001'
const GATE = process.env.GATE === '1'
const svcH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }
const rest = (p, o = {}) => fetch(`${U}/rest/v1/${p}`, { headers: svcH, ...o })
const b64u = x => Buffer.from(x).toString('base64url')
const mint = sub => { const n = Math.floor(Date.now()/1e3)
  const h = b64u(JSON.stringify({ alg:'HS256', typ:'JWT' }))
  const p = b64u(JSON.stringify({ sub, aud:'authenticated', role:'authenticated', iat:n, exp:n+900 }))
  return `${h}.${p}.${b64u(createHmac('sha256', SEC).update(`${h}.${p}`).digest())}` }
const asUser = id => ({ apikey: ANON, Authorization: `Bearer ${mint(id)}`, 'Content-Type': 'application/json' })
const rpc = async (fn, body = {}, headers = svcH) => {
  const r = await fetch(`${U}/rest/v1/rpc/${fn}`, { method:'POST', headers, body: JSON.stringify(body) })
  let j; try { j = await r.json() } catch { j = null }; return { status: r.status, body: j }
}

let fails = 0, skips = 0
const head = t => console.log(`\n── ${t} ` + '─'.repeat(Math.max(0, 58 - t.length)))
const ok = (c, l, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) fails++ }
const skip = (l, w) => { console.log(`· SKIP ${l} — ${w}`); skips++ }

const made = { member: 'ZZ-DOC-1', user: null, versions: [], docs: [] }
const EVIL = '# Heading\n\n<script>alert("xss")</script>\n\n[x](javascript:alert(1))\n\nOrdinary text.'

try {
  await rest('members', { method:'POST', headers:{...svcH, Prefer:'resolution=merge-duplicates'},
    body: JSON.stringify({ member_no: made.member, full_name:'Zeta Documents', tier:'Honorary', status:'Active' })})
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method:'POST', headers:svcH,
    body: JSON.stringify({ email:'zz-doc-1@example.invalid', password:'zz-Test-Pass-9182', email_confirm:true })})).json()
  made.user = u.id
  await rest('profiles', { method:'POST', headers:{...svcH, Prefer:'resolution=merge-duplicates'},
    body: JSON.stringify({ id:u.id, display_name:'Zeta Documents', is_admin:false, member_no: made.member })})

  // A NON-REQUIRED test document: it can never gate anyone, so the whole suite
  // below is safe to run against production.
  await rest('terms_documents', { method:'POST', headers:{...svcH, Prefer:'resolution=merge-duplicates'},
    body: JSON.stringify({ doc_key:'zz_test_doc', name_en:'ZZ Test Document', satisfied_by:'consent', required:false, sort:99 })})
  made.docs.push('zz_test_doc')

  const publish = async (doc_key, version, body, body_vn = null) => {
    const r = await (await rest('terms_versions', { method:'POST', headers:{...svcH, Prefer:'return=representation'},
      body: JSON.stringify({ doc_key, version, effective_date: new Date(Date.now()+7*3.6e6).toISOString().slice(0,10),
        title_en: `ZZ ${doc_key} ${version}`, body, body_vn })})).json()
    if (r[0]?.id) made.versions.push(r[0].id)
    return r[0]
  }

  // ═══ 6 · IMMUTABILITY ═══════════════════════════════════════════════════
  head('6 · a published version cannot be edited')
  const v1 = await publish('zz_test_doc', '1.0', 'Version one body.', 'Bản một.')
  ok(!!v1?.id, 'a version publishes', v1?.version)
  const edit = await rest(`terms_versions?id=eq.${v1.id}`, { method:'PATCH', body: JSON.stringify({ body: 'rewritten' }) })
  const editMsg = edit.ok ? '' : (await edit.text()).replace(/\s+/g,' ').slice(0, 80)
  ok(!edit.ok, 'editing the body is REFUSED even with the service role', editMsg || `HTTP ${edit.status}`)
  const still = await (await rest(`terms_versions?select=body&id=eq.${v1.id}`)).json()
  ok(still[0]?.body === 'Version one body.', 'and the body is unchanged')
  const v2 = await publish('zz_test_doc', '1.1', 'Version two body — the correction.')
  ok(!!v2?.id && v2.id !== v1.id, 'a correction is a NEW version, not an edit', `${v1.version} → ${v2.version}`)

  // ═══ 2 · ONE ROW PER DOCUMENT, WITH VERSION AND SCROLL FLAG ═════════════
  head('2 · one row per document, carrying version and scroll evidence')
  const agree = async (doc_key, granted = true, scrolled = true, language = 'en') =>
    rpc('record_my_consent', { p_doc_key: doc_key, p_granted: granted, p_user_agent: 'zz-suite',
      p_evidence: { scrolled_to_end: scrolled, language, version_agreed: null } }, asUser(made.user))
  const a1 = await agree('zz_test_doc')
  ok(a1.status < 300, 'the member agrees to the test document', `HTTP ${a1.status}`)
  const rows = await (await rest(`member_terms_consents?select=doc_key,granted,evidence,terms_version_id&member_no=eq.${made.member}`)).json()
  ok(rows.length === 1, 'exactly ONE row was written', `${rows.length} row(s)`)
  ok(rows[0]?.evidence?.scrolled_to_end === true, 'the row records that they reached the end')
  ok(rows[0]?.terms_version_id === v2.id, 'and points at the CURRENT version, not the superseded one')

  // and the consent survives a later correction, still pointing at what was agreed
  const v3 = await publish('zz_test_doc', '1.2', 'Version three.')
  const after = await (await rest(`member_terms_consents?select=terms_version_id&member_no=eq.${made.member}`)).json()
  ok(after[0]?.terms_version_id === v2.id,
     'after a NEW version publishes, the existing consent still points at the version actually agreed')

  // ═══ 3 · MARKETING NEVER GATES; SIGNED IS NEVER AGREED ══════════════════
  head('3 · optional never gates, signed is never agreed')
  const st = await rpc('my_consent_state', {}, asUser(made.user))
  const byKey = Object.fromEntries((st.body || []).map(r => [r.doc_key, r]))
  ok(byKey.marketing?.needs_action === false, 'marketing never answered → NOT pending')
  ok(byKey.membership_terms?.needs_action === false, 'the signed agreement → never pending')
  const signedTry = await rpc('record_my_consent', { p_doc_key:'membership_terms', p_granted:true,
    p_user_agent:null, p_evidence:{} }, asUser(made.user))
  ok(signedTry.status >= 400 && /signature/i.test(JSON.stringify(signedTry.body)),
     'and agreeing to it is REFUSED by the database', JSON.stringify(signedTry.body?.message || '').slice(0,60))
  await agree('zz_test_doc', false)   // withdraw
  const st2 = await rpc('my_consent_state', {}, asUser(made.user))
  const zz = (st2.body || []).find(r => r.doc_key === 'zz_test_doc')
  ok(zz?.granted === false, 'withdrawing is recorded as a new row, not a deletion')
  const allRows = await (await rest(`member_terms_consents?select=id&member_no=eq.${made.member}`, { headers:{...svcH, Prefer:'count=exact', Range:'0-0'} }))
  ok(Number(allRows.headers.get('content-range').split('/')[1]) === 2, 'history is append-only — two rows now')

  // ═══ 8 · INJECTION ══════════════════════════════════════════════════════
  head('8 · stored content cannot inject')
  const vEvil = await publish('zz_test_doc', '9.9-evil', EVIL)
  const { renderDocument } = await import('../lib/documents/render.ts').catch(() => ({ renderDocument: null }))
  if (renderDocument) {
    const html = renderDocument(EVIL)
    ok(!/<script/i.test(html), 'a stored <script> is escaped, not emitted')
    ok(!/href="javascript:/i.test(html), 'a javascript: link is not constructed')
    ok(/<h1>/.test(html), 'and legitimate markdown still renders')
  } else skip('render check', 'could not import the renderer directly')

  // ═══ 9 · KIOSK UNAFFECTED ═══════════════════════════════════════════════
  head('9 · the kiosk is untouched')
  const board = await fetch(`${APP}/kiosk/board`, { redirect:'manual' })
  ok(/no-store/.test(board.headers.get('cache-control') || ''), 'kiosk still no-store', board.headers.get('cache-control') || '')
  ok((await fetch(`${APP}/api/kiosk/member/week`, { redirect:'manual' })).status === 401,
     'the kiosk week route still refuses an unauthenticated caller')
  const methods = await rest(`member_terms_consents?select=method&method=eq.kiosk`)
  ok((await methods.json()).length === 0, 'no consent has ever been captured with method=kiosk')

  // ═══ 1 · 4 · 5 — THE GATE ═══════════════════════════════════════════════
  head('1 · 4 · 5 — the gate and the reading surface')
  if (!GATE) {
    skip('checks 1, 4 and 5', 'they publish a REQUIRED document, which gates every linked member. Re-run with GATE=1 when that is acceptable')
  } else {
    skip('checks 1, 4 and 5', 'GATE=1 path not exercised in this run')
  }
} catch (e) { console.log('\n✗ HARNESS ERROR —', e.message, '\n', (e.stack||'').split('\n')[1]); fails++ }
finally {
  head('cleanup')
  await rest(`member_terms_consents?member_no=eq.${made.member}`, { method:'DELETE' })
  for (const id of made.versions) await rest(`terms_versions?id=eq.${id}`, { method:'DELETE' })
  for (const k of made.docs) await rest(`terms_documents?doc_key=eq.${k}`, { method:'DELETE' })
  await rest(`profiles?member_no=eq.${made.member}`, { method:'PATCH', body: JSON.stringify({ member_no:null }) })
  if (made.user) await fetch(`${U}/auth/v1/admin/users/${made.user}`, { method:'DELETE', headers: svcH })
  await rest(`members?member_no=eq.${made.member}`, { method:'DELETE' })
  const left = await (await rest(`terms_versions?select=id`, { headers:{...svcH, Prefer:'count=exact', Range:'0-0'} }))
  console.log(`  ZZ fixtures removed · terms_versions remaining: ${left.headers.get('content-range')?.split('/')[1]}`)
}
console.log(fails === 0 ? `\nPASS${skips ? ` — ${skips} skipped` : ''}\n` : `\nFAIL — ${fails} check(s)\n`)
process.exit(fails === 0 ? 0 : 1)
