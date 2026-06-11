// Derive + (optionally) persist per-member taste profiles. Mirrors
// lib/whisky/taste-profile.ts (kept identical; the .ts is the app's source).
//
//   node scripts/derive-taste-profiles.mjs          # DRY RUN — report vectors, no writes (Stage-1 gate)
//   node scripts/derive-taste-profiles.mjs --persist # upsert into member_taste_profiles (after schema applied)

const B = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }
const get = async (u) => { const r = await fetch(`${B}/rest/v1/${u}`, { headers: H }); if (!r.ok) throw new Error(`${u} ${r.status} ${await r.text()}`); return r.json() }

const STOP = new Set(['single','malt','scotch','whisky','whiskey','blended','grain','cask','casks','finish','finished','bourbon','sherry','oloroso','port','wine','reserve','batch','strength','vintage','edition','release','years','year','distillers','matured','double','peated','peaty','smoky','maritime','classic','comfort','preference','preferred','default','current','always','often','never','occasional','exploration','exploratory','black','white','green','red','coffee','water','sparkling','still','negroni','martini','americano','espresso','brandy','cognac','rum','burgundy','unique','flavours','flavour','bold','delicate','japanese','global','devotee','unusual','origins','finishes','interest','islands','islay','speyside','highland','lowland','campbeltown','fashioned','kingston','passion','learning','elements','morning'])
const toks = (s) => (s || '').toLowerCase().match(/[a-z0-9]+/g) || []
const distinctive = (t) => t.length >= 5 && !STOP.has(t)

// notes = [{ whisky_id, flavour_tags }] — the flywheel: a self-tagged note is a
// contributor at weight 2 (vs 1 for loved/consumption); tagged families floored at
// 2. Blended, never an overwrite. Mirrors lib/whisky/derive-taste.ts (live path).
const NOTE_WEIGHT = 2, TAG_FLOOR = 2
function deriveTasteVector(prefNames, mapped, categories, consumption = [], notes = []) {
  const prefToks = new Set()
  for (const p of prefNames) for (const t of toks(p)) if (distinctive(t)) prefToks.add(t)
  const loved = mapped.filter(w => toks(w.distillery).some(t => prefToks.has(t)))
  const byId = new Map(mapped.map(w => [w.id, w]))
  const notedFamilies = new Set()
  const noteContribs = []
  for (const n of notes) {
    const base = byId.get(n.whisky_id); if (!base) continue
    const spokes = { ...base.spokes }
    for (const t of (n.flavour_tags || [])) if (categories.includes(t)) { spokes[t] = Math.max(spokes[t] || 0, TAG_FLOOR); notedFamilies.add(t) }
    noteContribs.push({ w: { spokes }, weight: NOTE_WEIGHT })
  }
  const contributors = [...loved.map(w => ({ w, weight: 1 })), ...consumption.map(c => ({ w: byId.get(c.whisky_id), weight: c.weight })).filter(x => x.w), ...noteContribs]
  const vector = {}
  if (contributors.length) {
    const totalW = contributors.reduce((s, c) => s + c.weight, 0)
    for (const cat of categories) {
      const sum = contributors.reduce((s, c) => s + (c.w.spokes[cat] || 0) * c.weight, 0)
      const v = sum / totalW
      if (v > 0) vector[cat] = Math.round(v * 100) / 100
    }
  }
  return { vector, sources: { loved_distilleries: [...new Set(loved.map(w => w.distillery).filter(Boolean))], loved_bottles: loved.map(w => w.name), consumption_rows: consumption.length, noted_count: noteContribs.length, noted_families: [...notedFamilies] }, source_count: loved.length + consumption.length + noteContribs.length }
}

const persist = process.argv.includes('--persist')

;(async () => {
  const [cats, ws, ints, prefs, members] = await Promise.all([
    get('flavour_categories?select=slug&order=sort_order'),
    get('whiskies?select=id,name,distillery'),
    get('whisky_flavour_intensities?select=whisky_id,category_slug,intensity'),
    get('preferences?select=member_no,preference_name&category=eq.Whisky%20%26%20Beverage&status=eq.active'),
    get('members?select=member_no'),
  ])
  const categories = cats.map(c => c.slug)
  const spokesByW = {}; for (const r of ints) (spokesByW[r.whisky_id] = spokesByW[r.whisky_id] || {})[r.category_slug] = r.intensity
  const mapped = ws.filter(w => spokesByW[w.id]).map(w => ({ id: w.id, name: w.name, distillery: w.distillery, spokes: spokesByW[w.id] }))
  const prefsByMember = {}; for (const p of prefs) (prefsByMember[p.member_no] = prefsByMember[p.member_no] || []).push(p.preference_name)
  // consumption seam — read when the table exists (empty today)
  let consumptionByMember = {}
  try { const con = await get('member_consumption?select=member_no,whisky_id'); for (const c of con) if (c.whisky_id) (consumptionByMember[c.member_no] = consumptionByMember[c.member_no] || []).push({ whisky_id: c.whisky_id, weight: 1 }) } catch { /* table not yet created */ }
  // tasting notes seam — the flywheel. author (profiles.id) → member_no via profiles.
  let notesByMember = {}
  try {
    const [profs, notes] = await Promise.all([get('profiles?select=id,member_no'), get('tasting_notes?select=author,whisky_id,flavour_tags')])
    const memberOfAuthor = {}; for (const p of profs) if (p.member_no) memberOfAuthor[p.id] = p.member_no
    for (const n of notes) { const mno = memberOfAuthor[n.author]; if (mno && n.whisky_id) (notesByMember[mno] = notesByMember[mno] || []).push({ whisky_id: n.whisky_id, flavour_tags: n.flavour_tags || [] }) }
  } catch { /* table not yet created */ }

  console.log(`mapped pool: ${mapped.length} whiskies · members: ${members.length}\n`)
  const rows = []
  for (const m of members) {
    const d = deriveTasteVector(prefsByMember[m.member_no] || [], mapped, categories, consumptionByMember[m.member_no] || [], notesByMember[m.member_no] || [])
    rows.push({ member_no: m.member_no, vector: d.vector, sources: d.sources, source_count: d.source_count })
    console.log(`── ${m.member_no} — ${d.source_count} loved bottle(s) from ${d.sources.loved_distilleries.join(', ') || '(none)'}`)
    if (d.source_count === 0) console.log('   EMPTY profile (no mapped loved bottles) → engine will need an expressed Finder shape.')
    else {
      console.log('   loved bottles:', d.sources.loved_bottles.map(n => n.slice(0, 38)).join(' · '))
      console.log('   taste vector:', Object.entries(d.vector).map(([k, v]) => `${k} ${v}`).join('  '))
    }
  }

  if (persist) {
    for (const r of rows) {
      const res = await fetch(`${B}/rest/v1/member_taste_profiles?on_conflict=member_no`, {
        method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ member_no: r.member_no, vector: r.vector, sources: r.sources, source_count: r.source_count, updated_at: new Date().toISOString() }),
      })
      if (!res.ok) { console.error(`  ✗ persist ${r.member_no}: ${res.status} ${await res.text()}`); process.exit(1) }
    }
    console.log(`\npersisted ${rows.length} profiles to member_taste_profiles.`)
  } else {
    console.log('\n(dry run — nothing persisted. Apply db/member_taste_profiles.sql, then re-run with --persist.)')
  }
})().catch(e => { console.error(e); process.exit(1) })
