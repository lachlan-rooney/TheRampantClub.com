// Whisky duplicate-row cleanup — DESTRUCTIVE, so: archive + re-point + reviewed.
//
// True duplicates are keyed on NAME + AGE (not name alone — that would wrongly
// merge same-name/different-age expressions like Hazelburn Oloroso 8/12/15).
// Keeper per set = the RICHER row (more flavour spokes), tiebreak oldest added_at.
//
// FK safety: whisky_flavour_intensities / whisky_flavour_tags / whisky_fill_history
// all CASCADE (a loser's redundant children vanish — intended). journal_entries
// .related_whisky_id is SET NULL — so we RE-POINT any journal entry from a loser
// to its keeper BEFORE deleting (never let it null).
//
//   node scripts/whisky-dedup-rows.mjs report  # before-list + archive, NO writes
//   node scripts/whisky-dedup-rows.mjs apply    # re-point journal → (archive) → delete losers

import { writeFileSync } from 'node:fs'

const B = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }
const get = async (u) => { const r = await fetch(`${B}/rest/v1/${u}`, { headers: H }); if (!r.ok) throw new Error(`${u} → ${r.status} ${await r.text()}`); return r.json() }

const norm = (s) => (s || '').trim().toLowerCase()

async function loadSets() {
  const [whiskies, ints, tags, fills, journal] = await Promise.all([
    get('whiskies?select=*'),
    get('whisky_flavour_intensities?select=*'),
    get('whisky_flavour_tags?select=*'),
    get('whisky_fill_history?select=*'),
    get('journal_entries?select=id,related_whisky_id&related_whisky_id=not.is.null'),
  ])
  const spokeCount = {}; for (const r of ints) spokeCount[r.whisky_id] = (spokeCount[r.whisky_id] || 0) + 1
  const journalByWhisky = {}; for (const j of journal) (journalByWhisky[j.related_whisky_id] = journalByWhisky[j.related_whisky_id] || []).push(j.id)
  const intsByW = {}, tagsByW = {}, fillsByW = {}
  for (const r of ints) (intsByW[r.whisky_id] = intsByW[r.whisky_id] || []).push(r)
  for (const r of tags) (tagsByW[r.whisky_id] = tagsByW[r.whisky_id] || []).push(r)
  for (const r of fills) (fillsByW[r.whisky_id] = fillsByW[r.whisky_id] || []).push(r)

  // group by NAME + AGE
  const groups = {}
  for (const w of whiskies) {
    const key = `${norm(w.name)}||${norm(w.age)}`
    ;(groups[key] = groups[key] || []).push(w)
  }
  const sets = Object.values(groups).filter(g => g.length > 1).map(rows => {
    // keeper = most spokes, tiebreak oldest added_at, then lowest id (stable)
    const ranked = [...rows].sort((a, b) =>
      (spokeCount[b.id] || 0) - (spokeCount[a.id] || 0) ||
      String(a.added_at || '').localeCompare(String(b.added_at || '')) ||
      a.id.localeCompare(b.id))
    const keeper = ranked[0], losers = ranked.slice(1)
    return { name: rows[0].name, age: rows[0].age, keeper, losers, spokeCount }
  })
  return { sets, spokeCount, journalByWhisky, intsByW, tagsByW, fillsByW, whiskies }
}

async function report() {
  const { sets, spokeCount, journalByWhisky, intsByW, tagsByW, fillsByW } = await loadSets()
  // Guard: never overwrite the archive/review with an empty result (e.g. if run
  // AFTER apply, when 0 dups remain) — that would clobber the pre-delete snapshot.
  if (sets.length === 0) { console.log('No duplicate sets remain — leaving existing archive/review untouched.'); return }
  const losersTotal = sets.reduce((n, s) => n + s.losers.length, 0)
  const hard = sets.filter(s => s.losers.some(l => (spokeCount[l.id] || 0) > 0))

  // archive: full loser rows + their children
  const archive = []
  for (const s of sets) for (const l of s.losers) {
    archive.push({
      set: { name: s.name, age: s.age }, keeper_id: s.keeper.id, deleted_at_keeper_reason: keeperReason(s, spokeCount),
      row: l, intensities: intsByW[l.id] || [], tags: tagsByW[l.id] || [], fill_history: fillsByW[l.id] || [],
      journal_entries_repointed: journalByWhisky[l.id] || [],
    })
  }
  writeFileSync('data/whisky_duplicate_archive.json', JSON.stringify(archive, null, 2) + '\n')

  const L = [`# Whisky duplicate-row cleanup — review BEFORE delete`, ``,
    `${sets.length} true-duplicate sets (keyed name+age) · ${losersTotal} rows to delete · keeper = richer (more spokes), tiebreak oldest.`,
    `Archive (full rows + children) written to data/whisky_duplicate_archive.json — delete is reversible.`,
    `journal_entries pointing at a loser get re-pointed to the keeper first (none nulled).`, ``,
    `## The ${hard.length} "hard" sets (both rows tagged — keeping the fuller radar):`]
  for (const s of hard) {
    L.push(`- **${s.name}** (age ${s.age})`)
    L.push(`    KEEP  ${s.keeper.id}  — ${spokeCount[s.keeper.id] || 0} spokes`)
    for (const l of s.losers) L.push(`    drop  ${l.id}  — ${spokeCount[l.id] || 0} spokes${(journalByWhisky[l.id] || []).length ? ` · re-point ${journalByWhisky[l.id].length} journal` : ''}`)
  }
  L.push(``, `## All ${sets.length} sets:`)
  for (const s of sets) {
    L.push(`- ${s.name} · age ${s.age}`)
    L.push(`    KEEP ${s.keeper.id} (${spokeCount[s.keeper.id] || 0} spokes, added ${(s.keeper.added_at || '').slice(0,10)})`)
    for (const l of s.losers) L.push(`    DROP ${l.id} (${spokeCount[l.id] || 0} spokes)${(journalByWhisky[l.id] || []).length ? ` ⟲journal×${journalByWhisky[l.id].length}` : ''}`)
  }
  writeFileSync('docs/whisky_duplicate_review.md', L.join('\n') + '\n')

  console.log(`sets: ${sets.length} | losers to delete: ${losersTotal} | hard (both-tagged): ${hard.length}`)
  console.log(`journal entries to re-point: ${sets.flatMap(s => s.losers).reduce((n, l) => n + (journalByWhisky[l.id] || []).length, 0)}`)
  console.log('wrote docs/whisky_duplicate_review.md + data/whisky_duplicate_archive.json')
  // sanity: confirm Hazelburn (3 ages) is NOT in any set
  const haz = sets.filter(s => norm(s.name).includes('hazelburn'))
  console.log(`Hazelburn sets captured (expect 0 — different ages): ${haz.length}`)
}

function keeperReason(s, spokeCount) {
  return `${spokeCount[s.keeper.id] || 0} spokes (richer), added ${(s.keeper.added_at || '').slice(0,10)}`
}

async function apply() {
  const { sets, journalByWhisky } = await loadSets()
  let repointed = 0, deleted = 0
  for (const s of sets) for (const l of s.losers) {
    // 1. re-point journal entries loser → keeper (before delete, so none null)
    if ((journalByWhisky[l.id] || []).length) {
      const r = await fetch(`${B}/rest/v1/journal_entries?related_whisky_id=eq.${l.id}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ related_whisky_id: s.keeper.id }),
      })
      if (!r.ok) { console.error(`  ✗ re-point ${l.id}: ${r.status} ${await r.text()}`); continue }
      repointed += journalByWhisky[l.id].length
    }
    // 2. delete loser (cascades its redundant intensities/tags/fill_history)
    const d = await fetch(`${B}/rest/v1/whiskies?id=eq.${l.id}`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } })
    if (!d.ok) { console.error(`  ✗ delete ${l.id}: ${d.status} ${await d.text()}`); continue }
    deleted++
  }
  console.log(`re-pointed ${repointed} journal entries · deleted ${deleted} loser rows`)
}

const cmd = process.argv[2]
if (cmd === 'report') report().catch(e => { console.error(e); process.exit(1) })
else if (cmd === 'apply') apply().catch(e => { console.error(e); process.exit(1) })
else { console.error('usage: node scripts/whisky-dedup-rows.mjs [report|apply]'); process.exit(1) }
