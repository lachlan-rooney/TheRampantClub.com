#!/usr/bin/env node
// backfill-tasting-notes.mjs
// One-shot backfill for tasting notes on the whiskies catalogue.
//
// Asks Claude per whisky for tasting notes using its training-data
// knowledge of the major distilleries and reviews indexed during
// pre-training. CRITICAL: the prompt is structured to REFUSE rather
// than FABRICATE — if the model can't confidently identify the
// specific bottling, it returns confidence=unknown and we skip the
// write rather than inserting a guess. Human-curated rows (marked
// tasting_notes_source = 'human' by the migration) are skipped
// unconditionally.
//
// Required env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
//                NEXT_PUBLIC_SUPABASE_URL — picked up from .env.local.
//
// Run:    node scripts/backfill-tasting-notes.mjs
// Re-run: safe — already-filled rows are skipped by source check.
// Flags:  --overwrite    (rewrite EVEN human-curated rows; double-confirm)
//         --limit=N      (cap how many rows to process)
//         --concurrency=N (default 5; raise carefully — Claude rate limits)
//         --dry-run      (call Claude but don't write)

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolvePath(__dirname, '..')

// ── .env.local loader (no dotenv dep) ─────────────────────────────────
async function loadEnvLocal() {
  try {
    const raw = await readFile(resolvePath(root, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env.local; rely on ambient */ }
}
await loadEnvLocal()

const requiredEnv = ['ANTHROPIC_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const k of requiredEnv) {
  if (!process.env[k]) { console.error(`Missing env: ${k}`); process.exit(2) }
}

// ── flags ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const overwrite   = args.includes('--overwrite')
const dryRun      = args.includes('--dry-run')
const limitArg    = args.find(a => a.startsWith('--limit='))
const concArg     = args.find(a => a.startsWith('--concurrency='))
const limit       = limitArg ? Math.max(1, Number(limitArg.split('=')[1])) : Infinity
const concurrency = Math.max(1, Math.min(20, concArg ? Number(concArg.split('=')[1]) : 5))

if (overwrite) {
  console.log('--overwrite SET. Will rewrite human-curated tasting_notes rows. Sleeping 5s in case that was a mistake.')
  await new Promise(r => setTimeout(r, 5000))
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ── load catalogue ────────────────────────────────────────────────────
const { data: allWhiskies, error: loadErr } = await sb
  .from('whiskies')
  .select('id, name, distillery, region, cask_type, age, abv, tasting_notes, tasting_notes_source')
  .order('name')
if (loadErr) { console.error('Load failed:', loadErr.message); process.exit(1) }

const queue = allWhiskies.filter(w => {
  if (overwrite) return true
  // Skip rows the team has already filled by hand.
  if (w.tasting_notes_source === 'human') return false
  // Skip rows that already got a successful backfill (re-running shouldn't
  // duplicate API spend; pass --overwrite if you actually want a redo).
  if (w.tasting_notes_source && w.tasting_notes_source.startsWith('claude-auto-backfill-')) return false
  return true
}).slice(0, limit)

console.log(`Catalogue: ${allWhiskies.length} whiskies · queueing ${queue.length} for backfill · concurrency=${concurrency} · dry-run=${dryRun}`)
if (queue.length === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}

// ── prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a whisky reference. The user will give you a whisky bottling (name + distillery + optional region/age/ABV/cask). Your job: return CONCISE tasting notes — nose, palate, finish — if and only if you can identify the SPECIFIC bottling with high confidence from your training data.

If you are NOT highly confident the bottling you have in mind is the same one being asked about (multiple releases with the same name; an independent bottling you don't recognise; a name you can't place to a real distillery release), set confidence="unknown" and tasting_notes=null. DO NOT GUESS. A blank row is far better than a wrong one.

Return STRICT JSON only, no prose, no markdown fence:
{
  "tasting_notes": "Nose: ... Palate: ... Finish: ..."  | null,
  "confidence":    "high" | "medium" | "low" | "unknown",
  "reasoning":     "one short sentence on why this confidence"
}

Length: ~40-90 words of tasting prose total when filled, written like a brief reference card. No flowery purple prose. No "I think" or "perhaps". No bullets. Just three labelled clauses separated by spaces.`

function userPrompt(w) {
  const fields = [
    `Name: ${w.name}`,
    w.distillery && `Distillery: ${w.distillery}`,
    w.region     && `Region: ${w.region}`,
    w.age        && `Age: ${w.age}`,
    w.abv        && `ABV: ${w.abv}%`,
    w.cask_type  && `Cask: ${w.cask_type}`,
  ].filter(Boolean).join('\n')
  return `Provide tasting notes for this whisky bottling.\n\n${fields}`
}

// ── per-whisky call ────────────────────────────────────────────────────
async function generateFor(w) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt(w) }],
    })
    let raw = (msg?.content?.[0]?.text ?? '').trim()
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    let parsed
    try { parsed = JSON.parse(raw) }
    catch { return { ok: false, reason: 'unparseable json', raw: raw.slice(0, 200) } }
    const { tasting_notes, confidence, reasoning } = parsed
    if (!confidence || !['high', 'medium', 'low', 'unknown'].includes(confidence)) {
      return { ok: false, reason: 'bad confidence', raw }
    }
    return { ok: true, tasting_notes, confidence, reasoning }
  } catch (e) {
    return { ok: false, reason: 'api error', error: e.message }
  }
}

// ── runner with concurrency control ───────────────────────────────────
const stamp = new Date().toISOString().slice(0, 10)
const source = `claude-auto-backfill-${stamp}`
let done = 0, written = 0, skipped = 0, failed = 0
const skippedRows = [], failedRows = []

async function processOne(w) {
  const r = await generateFor(w)
  done++
  const tick = `[${String(done).padStart(3)}/${queue.length}]`
  if (!r.ok) {
    failed++
    failedRows.push({ id: w.id, name: w.name, reason: r.reason, raw: r.raw, error: r.error })
    console.log(`${tick} ✗ ${w.name} — ${r.reason}${r.error ? `: ${r.error}` : ''}`)
    return
  }
  if (r.confidence === 'unknown' || r.tasting_notes == null) {
    skipped++
    skippedRows.push({ id: w.id, name: w.name, distillery: w.distillery, reasoning: r.reasoning })
    console.log(`${tick} ○ ${w.name} — unknown (${r.reasoning?.slice(0, 80) ?? ''})`)
    return
  }
  if (dryRun) {
    written++
    console.log(`${tick} ⊙ ${w.name} — ${r.confidence} (dry-run, not writing)`)
    return
  }
  const { error: updErr } = await sb
    .from('whiskies')
    .update({
      tasting_notes:               r.tasting_notes,
      tasting_notes_source:        source,
      tasting_notes_confidence:    r.confidence,
      tasting_notes_generated_at:  new Date().toISOString(),
    })
    .eq('id', w.id)
  if (updErr) {
    failed++
    failedRows.push({ id: w.id, name: w.name, reason: 'db update failed', error: updErr.message })
    console.log(`${tick} ✗ ${w.name} — db error: ${updErr.message}`)
  } else {
    written++
    console.log(`${tick} ✓ ${w.name} — ${r.confidence}`)
  }
}

async function runPool() {
  const idx = { i: 0 }
  async function worker() {
    while (idx.i < queue.length) {
      const myI = idx.i++
      await processOne(queue[myI])
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
}

const t0 = Date.now()
await runPool()
const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

// ── review queue csv (the entries the model wouldn't touch) ──────────
if (skippedRows.length > 0 || failedRows.length > 0) {
  await mkdir(resolvePath(root, 'scripts/data'), { recursive: true })
  const path = resolvePath(root, `scripts/data/tasting-notes-review-${stamp}.csv`)
  const esc = v => {
    if (v == null) return ''
    const s = String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = ['id,name,distillery,status,reason']
  for (const r of skippedRows) lines.push(`${esc(r.id)},${esc(r.name)},${esc(r.distillery)},skipped,${esc(r.reasoning)}`)
  for (const r of failedRows)  lines.push(`${esc(r.id)},${esc(r.name)},${esc('')},failed,${esc(r.reason)}${r.error ? ' :: ' + esc(r.error) : ''}`)
  await writeFile(path, lines.join('\n'))
  console.log(`\nReview queue written to: ${path}`)
}

console.log(`\nDone in ${elapsed}s — wrote ${written}, skipped ${skipped} (model wouldn't commit), failed ${failed}.`)
if (skipped > 0) console.log(`  → skipped rows need human entry — see review CSV.`)
if (failed > 0)  console.log(`  → failed rows need investigation — see review CSV.`)
