// Flavour-tag every NOTED-but-UNTAGGED whisky from its tasting-notes prose →
// whisky_flavour_intensities (the radar spokes). Mirrors scripts/whisky-flavour-
// tags.mjs rules: tag ONLY from the prose, never infer from name/region/age,
// empty/flavourless notes → zero tags (honest sparse radar). Writes confirmed=false
// (source 'llm-notes') so the batch lands as PENDING REVIEW. Idempotent: only
// touches whiskies that currently have no spokes (won't double-tag).
//
//   node scripts/tag-untagged-from-notes.mjs            (run)
//   node scripts/tag-untagged-from-notes.mjs --limit=5  (cap)

import { readFile } from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split('\n').map(l => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ai = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
const MODEL = 'claude-opus-4-8'
const limit = (process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]
const CONC = 5

const FAMILIES = [['cereal_biscuit','Cereal & Biscuit'],['green_grassy','Green & Grassy'],['orchard_fruit','Orchard Fruit'],['tropical_citrus','Tropical & Citrus'],['floral_honeyed','Floral & Honeyed'],['buttery_creamy','Buttery & Creamy'],['meaty_sulphury','Meaty & Sulphury'],['vanilla_coconut','Vanilla & Coconut'],['baking_spice','Baking Spice'],['pepper_tannin','Pepper & Tannin'],['dried_fruit_walnut','Dried Fruit & Walnut'],['treacle_roast','Treacle & Roast'],['leather_polished_oak','Leather & Polished Oak'],['woodsmoke','Woodsmoke'],['tar_iodine','Tar & Iodine'],['brine_shoreline','Brine & Shoreline']]
const SYS = `You tag Scotch/whisky tasting notes onto the fixed 16-family Flavour Compass. For EACH family genuinely present in the PROSE, return: category_slug, intensity (1=faint/a whisper, 2=clearly present, 3=prominent theme, 4=dominant/defining), confidence (0..1 it's present), and evidence (the exact supporting phrase). RULES: tag ONLY from the prose; NEVER infer from name/region/age; if the notes are empty or flavourless, return an empty list. Families: ${FAMILIES.map(f => f[0] + ' (' + f[1] + ')').join(', ')}.`
const TOOL = { name: 'tag', description: 'Flavour families present in the notes, with intensity.', input_schema: { type: 'object', properties: { categories: { type: 'array', items: { type: 'object', properties: { category_slug: { type: 'string', enum: FAMILIES.map(f => f[0]) }, intensity: { type: 'integer' }, confidence: { type: 'number' }, evidence: { type: 'string' } }, required: ['category_slug', 'intensity', 'confidence', 'evidence'] } } }, required: ['categories'] } }

// Unify the earlier sample batch under this run's source.
await sb.from('whisky_flavour_intensities').update({ source: 'llm-notes' }).eq('source', 'llm-sample')

const { data: spokeRows } = await sb.from('whisky_flavour_intensities').select('whisky_id')
const tagged = new Set((spokeRows || []).map(r => r.whisky_id))
const { data: ws } = await sb.from('whiskies').select('id, name, tasting_notes').not('tasting_notes', 'is', null)
let targets = ws.filter(w => !tagged.has(w.id))
if (limit) targets = targets.slice(0, Number(limit))
console.log(`Tagging ${targets.length} noted-but-untagged whiskies (concurrency ${CONC}, model ${MODEL})\n`)

let done = 0, tagOk = 0, sparse = 0, failed = 0
async function tagOne(w) {
  try {
    const msg = await ai.messages.create({ model: MODEL, max_tokens: 1500, tools: [TOOL], tool_choice: { type: 'tool', name: 'tag' }, system: SYS, messages: [{ role: 'user', content: `Whisky: ${w.name}\n\nTasting notes:\n${w.tasting_notes}` }] })
    const cats = msg.content.find(c => c.type === 'tool_use')?.input?.categories || []
    done++
    const tick = `[${String(done).padStart(3)}/${targets.length}]`
    if (!cats.length) { sparse++; console.log(`${tick} ○ ${w.name} — sparse`); return }
    const rows = cats.map(c => ({ whisky_id: w.id, category_slug: c.category_slug, intensity: Math.max(1, Math.min(4, c.intensity)), confidence: Math.max(0, Math.min(1, c.confidence)), source: 'llm-notes', model: MODEL, evidence: c.evidence, confirmed: false }))
    const { error } = await sb.from('whisky_flavour_intensities').insert(rows)
    if (error) { failed++; console.log(`${tick} ✗ ${w.name} — ${error.message}`) }
    else { tagOk++; console.log(`${tick} ✓ ${w.name} — ${cats.length} families`) }
  } catch (e) { done++; failed++; console.log(`[${done}/${targets.length}] ✗ ${w.name} — ${e.message}`) }
}

const q = [...targets]
await Promise.all(Array.from({ length: CONC }, async () => { while (q.length) await tagOne(q.shift()) }))
console.log(`\nDone — ${tagOk} tagged, ${sparse} sparse (no families in prose), ${failed} failed. All confirmed=false (pending review).`)
