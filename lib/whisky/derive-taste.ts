import type { SupabaseClient } from '@supabase/supabase-js'

// Live palate derivation — the flywheel. Mirrors scripts/derive-taste-profiles.mjs
// (loved distilleries + consumption) and ADDS the member's own tasting notes as a
// blended signal: each note is a contributor at weight 2 (a self-tagged note is a
// stronger signal than a passive loved-distillery or consumption row at weight 1),
// using the noted whisky's REAL flavour spokes. The member's explicit flavour_tags
// floor those families at 2 (≥60% of the 1–4 scale) so their stated perception
// registers — but it's blended (averaged), never an overwrite. Called by the note
// route so logging a note enriches the palate on the spot.

const NOTE_WEIGHT = 2
const TAG_FLOOR = 2

const STOP = new Set(['single','malt','scotch','whisky','whiskey','blended','grain','cask','casks','finish','finished','bourbon','sherry','oloroso','port','wine','reserve','batch','strength','vintage','edition','release','years','year','distillers','matured','double','peated','peaty','smoky','maritime','classic','comfort','preference','preferred','default','current','always','often','never','occasional','exploration','exploratory','black','white','green','red','coffee','water','sparkling','still','negroni','martini','americano','espresso','brandy','cognac','rum','burgundy','unique','flavours','flavour','bold','delicate','japanese','global','devotee','unusual','origins','finishes','interest','islands','islay','speyside','highland','lowland','campbeltown','fashioned','kingston','passion','learning','elements','morning'])
const toks = (s: string | null) => (s || '').toLowerCase().match(/[a-z0-9]+/g) || []
const distinctive = (t: string) => t.length >= 5 && !STOP.has(t)

type Spokes = Record<string, number>
interface Mapped { id: string; name: string; distillery: string | null; spokes: Spokes }

export interface DerivedTaste {
  vector: Record<string, number>
  sources: { loved_distilleries: string[]; loved_bottles: string[]; consumption_rows: number; noted_count: number; noted_families: string[] }
  source_count: number
}

export async function deriveTasteForMember(sb: SupabaseClient, memberNo: string): Promise<DerivedTaste> {
  const [{ data: cats }, { data: ws }, { data: ints }] = await Promise.all([
    sb.from('flavour_categories').select('slug').order('sort_order'),
    sb.from('whiskies').select('id, name, distillery'),
    sb.from('whisky_flavour_intensities').select('whisky_id, category_slug, intensity'),
  ])
  const categories = (cats || []).map(c => c.slug)
  const spokesByW: Record<string, Spokes> = {}
  for (const r of ints || []) (spokesByW[r.whisky_id] = spokesByW[r.whisky_id] || {})[r.category_slug] = r.intensity
  const mapped: Mapped[] = (ws || []).filter(w => spokesByW[w.id]).map(w => ({ id: w.id, name: w.name, distillery: w.distillery, spokes: spokesByW[w.id] }))
  const byId = new Map(mapped.map(w => [w.id, w]))

  // loved distilleries (from the member's expressed preferences)
  const { data: prefs } = await sb.from('preferences').select('preference_name')
    .eq('member_no', memberNo).eq('category', 'Whisky & Beverage').eq('status', 'active')
  const prefToks = new Set<string>()
  for (const p of prefs || []) for (const t of toks(p.preference_name)) if (distinctive(t)) prefToks.add(t)
  const loved = mapped.filter(w => toks(w.distillery).some(t => prefToks.has(t)))

  // consumption (weight 1)
  const { data: cons } = await sb.from('member_consumption').select('whisky_id').eq('member_no', memberNo)
  const consumption = (cons || []).map(c => byId.get(c.whisky_id)).filter((w): w is Mapped => !!w).map(w => ({ w, weight: 1 }))

  // tasting notes — the flywheel (weight 2; tags floor their families)
  const { data: prof } = await sb.from('profiles').select('id').eq('member_no', memberNo).maybeSingle()
  const noteContribs: { w: { spokes: Spokes }; weight: number }[] = []
  const notedFamilies = new Set<string>()
  let notedCount = 0
  if (prof?.id) {
    const { data: notes } = await sb.from('tasting_notes').select('whisky_id, flavour_tags').eq('author', prof.id)
    for (const n of notes || []) {
      const base = n.whisky_id ? byId.get(n.whisky_id) : undefined
      if (!base) continue
      notedCount++
      const spokes: Spokes = { ...base.spokes }
      for (const t of (n.flavour_tags || []) as string[]) {
        if (categories.includes(t)) { spokes[t] = Math.max(spokes[t] || 0, TAG_FLOOR); notedFamilies.add(t) }
      }
      noteContribs.push({ w: { spokes }, weight: NOTE_WEIGHT })
    }
  }

  const contributors = [...loved.map(w => ({ w, weight: 1 })), ...consumption, ...noteContribs]
  const vector: Record<string, number> = {}
  if (contributors.length) {
    const totalW = contributors.reduce((s, c) => s + c.weight, 0)
    for (const cat of categories) {
      const sum = contributors.reduce((s, c) => s + (c.w.spokes[cat] || 0) * c.weight, 0)
      const v = sum / totalW
      if (v > 0) vector[cat] = Math.round(v * 100) / 100
    }
  }
  return {
    vector,
    sources: {
      loved_distilleries: [...new Set(loved.map(w => w.distillery).filter((d): d is string => !!d))],
      loved_bottles: loved.map(w => w.name),
      consumption_rows: consumption.length,
      noted_count: notedCount,
      noted_families: [...notedFamilies],
    },
    source_count: loved.length + consumption.length + noteContribs.length,
  }
}

// Re-derive and persist a member's profile (service-role; member_taste_profiles is
// admin-write). Best-effort caller should swallow errors so a note still saves.
export async function rederiveAndPersist(sb: SupabaseClient, memberNo: string): Promise<DerivedTaste> {
  const d = await deriveTasteForMember(sb, memberNo)
  await sb.from('member_taste_profiles').upsert(
    { member_no: memberNo, vector: d.vector, sources: d.sources, source_count: d.source_count, updated_at: new Date().toISOString() },
    { onConflict: 'member_no' }
  )
  return d
}
