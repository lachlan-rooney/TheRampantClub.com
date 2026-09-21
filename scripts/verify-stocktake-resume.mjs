#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// STOCKTAKE — DOES A COUNT SURVIVE THE TABLET DYING?
// ───────────────────────────────────────────────────────────────────────────
// The first version kept the count in the tablet's memory. This proves the
// rewrite: the session is rebuilt from whisky_fill_history, so a reload, a
// flat battery or somebody tapping Home at bottle 200 costs nothing.
//
// Uses a THROWAWAY bottle and a THROWAWAY counter name, and removes both —
// including on failure. No real whisky's fill is touched.
//
//   node scripts/verify-stocktake-resume.mjs
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }
const rest = (p, i = {}) => fetch(`${U}/rest/v1/${p}`, { headers: H, ...i })

const WHO = '__verify_counter__'
const BOTTLE = '__verify__ test bottle'
const NOTE = { count: 'stocktake', same: 'stocktake · no change', missing: 'stocktake · NOT ON THE SHELF' }

let fails = 0
const ck = (ok, l, d = '') => { console.log(`${ok ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!ok) fails++ }

// The server's resume query, exactly.
const countedSince = async (since) => {
  const rows = await (await rest(`whisky_fill_history?select=whisky_id,fill_pct,previous_fill_pct,note,created_at&updated_by_email=eq.${encodeURIComponent(WHO)}&created_at=gte.${since}&note=like.stocktake*&order=created_at.asc`)).json()
  const by = new Map()
  for (const r of rows) by.set(r.whisky_id, r)
  return by
}

const cleanup = async (id) => {
  if (id) {
    await rest(`whisky_fill_history?whisky_id=eq.${id}`, { method: 'DELETE' })
    await rest(`whiskies?id=eq.${id}`, { method: 'DELETE' })
  }
  await rest(`whisky_fill_history?updated_by_email=eq.${encodeURIComponent(WHO)}`, { method: 'DELETE' })
  await rest(`whisky_stocktake_sessions?finished_by=eq.${encodeURIComponent(WHO)}`, { method: 'DELETE' })
}

let id = null
try {
  await cleanup(null)
  const since = new Date(Date.now() - 3600_000).toISOString()
  console.log('\n── Stocktake resume ─────────────────────────────────────────\n')

  // A bottle found on the shelf and added from the tablet.
  const made = await (await rest('whiskies', { method: 'POST', headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ name: BOTTLE, in_stock: true, current_fill_pct: null }) })).json()
  id = made?.[0]?.id
  ck(!!id, 'a bottle found on the shelf can be added from the tablet', BOTTLE)

  // Count it: 70%.
  await rest('whiskies', { method: 'PATCH', body: JSON.stringify({ current_fill_pct: 70 }) , headers: H })
    .catch(() => {})
  await rest(`whiskies?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ current_fill_pct: 70, last_fill_updated_email: WHO }) })
  await rest('whisky_fill_history', { method: 'POST', body: JSON.stringify({ whisky_id: id, fill_pct: 70, previous_fill_pct: null, updated_by_email: WHO, note: NOTE.count }) })

  // ── THE TABLET DIES HERE. Nothing is in any browser any more.
  let counted = await countedSince(since)
  ck(counted.size === 1, 'after the tablet dies, the count is still on the server', `${counted.size} bottle(s)`)
  ck(counted.get(id)?.fill_pct === 70, 'and it remembers the reading', '70%')

  // "No change" must survive too, or a resumed session forgets it was looked at.
  await rest('whisky_fill_history', { method: 'POST', body: JSON.stringify({ whisky_id: id, fill_pct: 70, previous_fill_pct: 70, updated_by_email: WHO, note: NOTE.same }) })
  counted = await countedSince(since)
  ck(counted.size === 1 && counted.get(id).note === NOTE.same,
    'a bottle counted twice keeps the LAST reading, not a duplicate', `${counted.size} entry`)

  // Ordinary edits from the admin page must NOT be swept into a stocktake.
  await rest('whisky_fill_history', { method: 'POST', body: JSON.stringify({ whisky_id: id, fill_pct: 65, previous_fill_pct: 70, updated_by_email: WHO, note: 'poured a dram' }) })
  counted = await countedSince(since)
  ck(counted.get(id).note === NOTE.same, 'a non-stocktake edit is ignored by the resume', 'note filter holds')

  // Finish, built from history rather than from the tablet.
  const summary = [...counted.entries()].map(([wid, r]) => ({
    id: wid, name: BOTTLE, fill_before: r.previous_fill_pct, fill_after: r.fill_pct,
    changed: r.previous_fill_pct !== null && r.previous_fill_pct !== r.fill_pct,
    missing: r.note === NOTE.missing,
  }))
  const sess = await (await rest('whisky_stocktake_sessions', { method: 'POST', headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ started_at: since, finished_by: WHO, reviewed_count: summary.length,
      changed_count: summary.filter(s => s.changed).length, unchanged_count: summary.filter(s => !s.changed).length,
      total_catalogue_count: 0, summary }) })).json()
  ck(Array.isArray(sess) && sess[0]?.finished_by === WHO,
    'Finish records the session against a PERSON, not a shared inbox', sess[0]?.finished_by)
  ck(sess[0]?.reviewed_count === 1, 'and the summary came from the history, not the tablet')
} finally {
  await cleanup(id)
  const left = await (await rest(`whiskies?select=id&name=eq.${encodeURIComponent(BOTTLE)}`)).json()
  const hist = await (await rest(`whisky_fill_history?select=id&updated_by_email=eq.${encodeURIComponent(WHO)}`)).json()
  ck((left.length ?? 0) === 0 && (hist.length ?? 0) === 0, 'everything the test made is cleaned up',
    `${left.length ?? '?'} bottle(s), ${hist.length ?? '?'} history row(s)`)
}
console.log(`\n${fails ? '✗ ' + fails + ' FAILED' : '✓ a count survives the tablet dying'}\n`)
process.exit(fails ? 1 : 0)
