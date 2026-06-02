// callum_x3_integration.mjs
// Pass-B integration probe — runs the Callum transcript through the live
// extractor 3 times and verifies the new precedence chain:
//
//   MEDICAL (forced_medical) > IDENTITY (forced_identity) > AI_PERMANENT > ai_specific
//
// The whole point of the pass: identity-permanence drift that the consistency
// analyser surfaced previously (anniversary/Sophie/no-birthdays toggling
// between ai_permanent and ai_specific) should now be IMPOSSIBLE for the same
// input — isIdentityPreference is deterministic content detection.
//
// Required env: ANTHROPIC_API_KEY (read from .env.local automatically below).
// Run:  node tests/mis/callum_x3_integration.mjs

import { readFile } from 'node:fs/promises'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolvePath(__dirname, '..', '..')

// ── Minimal .env.local loader (no dotenv dep) ──────────────────────────
async function loadEnvLocal() {
  try {
    const raw = await readFile(resolvePath(root, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env.local; fall back to ambient */ }
}
await loadEnvLocal()

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY missing — set it in .env.local or the environment.')
  process.exit(2)
}

// ── Import the live extractor + Callum transcript via tsx import ──────
// tsx makes the .ts modules importable from the script.
const { reconcile, buildCategoryBaselines, buildSystemPrompt, DESIGNED_LAMBDA } =
  await import('../../lib/mis/extraction-decay.ts')
const { OBSERVATORY_SAMPLES } = await import('../../lib/observatory-samples.ts')

const callum = OBSERVATORY_SAMPLES.find(s => s.id === 'callum-mackenzie')
if (!callum) {
  console.error('Callum sample not found in lib/observatory-samples.ts')
  process.exit(2)
}

// Designed baselines only — this script doesn't talk to Supabase. The point
// is to verify the GUARDRAIL precedence end-to-end on real model output, not
// to exercise the learned-λ path.
const baselines = buildCategoryBaselines({})
const system = buildSystemPrompt(baselines)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function runOnce() {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8000,
    system,
    messages: [{
      role: 'user',
      content: `Process this interview transcript for member "${callum.member_name}". ` +
               `Extract and score ALL preferences.\n\nTRANSCRIPT:\n${callum.transcript}`,
    }],
  })
  let text = (msg?.content?.[0]?.text ?? '').trim()
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const parsed = JSON.parse(text)
  return reconcile(parsed, baselines)
}

// ── Key-row matchers — content-based (the AI may rephrase preference_name). ──
const matchers = {
  anniversary:    p => /anniversary|14th of October|fourteenth of October/i.test(`${p.preference_name} ${p.detail} ${p.verbatim_quote}`),
  sophie:         p => /\bSophie\b|\bwife\b/i.test(`${p.preference_name} ${p.detail} ${p.verbatim_quote}`),
  no_birthdays:   p => /(don'?t do birthdays|no.*birthday|birthday.*never|no candle)/i.test(`${p.preference_name} ${p.detail} ${p.verbatim_quote}`),
  shellfish:      p => /shellfish|prawns?|crab/i.test(`${p.preference_name} ${p.detail} ${p.verbatim_quote}`),
  peat:           p => /(\bpeat(ed|y)?\b|Islay|smoky)/i.test(`${p.preference_name} ${p.detail} ${p.verbatim_quote}`)
                       && !/Laphroaig|Lagavulin/i.test(`${p.preference_name}`),
  laphroaig:      p => /Laphroaig/i.test(`${p.preference_name} ${p.detail} ${p.verbatim_quote}`),
}

function findFirst(prefs, pred) {
  for (const p of prefs) if (pred(p)) return p
  return null
}

console.log(`\nCallum × 3 — Pass-B precedence verification`)
console.log(`Designed baselines only. No DB. No save.\n`)

const runs = []
for (let i = 1; i <= 3; i++) {
  process.stdout.write(`  run ${i}/3 … `)
  const t0 = Date.now()
  try {
    const r = await runOnce()
    const dt = ((Date.now() - t0) / 1000).toFixed(1)
    runs.push(r)
    console.log(`${r.preferences.length} prefs · ${r.medicalForced} medical · ${r.identityForced} identity · ${r.aiPermanent} permanent (${dt}s)`)
  } catch (e) {
    console.log(`FAILED: ${e.message}`)
    process.exit(1)
  }
}

// ── Build a per-key view across the 3 runs ───────────────────────────
console.log(`\nKey rows · lambda_origin across the 3 runs:`)
const expected = {
  anniversary:  'forced_identity',
  sophie:       'forced_identity',
  no_birthdays: 'forced_identity',
  shellfish:    'forced_medical',
  peat:         'ai_specific',
  laphroaig:    'ai_specific',
}
let allPass = true
const summaries = {}
for (const [key, pred] of Object.entries(matchers)) {
  const cells = runs.map(r => findFirst(r.preferences, pred))
  const origins = cells.map(c => c ? c.lambda_origin : '(absent)')
  const want = expected[key]
  const allMatch = origins.every(o => o === want)
  // For peat: an absent cell in one run is acceptable (granularity); the rule
  // is "if PRESENT, must be ai_specific" — never swept in by identity.
  const peatPresent = origins.filter(o => o !== '(absent)')
  const peatOk = key === 'peat'
    ? peatPresent.every(o => o === 'ai_specific') && peatPresent.length >= 1
    : allMatch
  const ok = key === 'peat' ? peatOk : allMatch
  summaries[key] = { origins, want, ok }
  if (!ok) allPass = false
  console.log(`  ${ok ? '✓' : '✗'} ${key.padEnd(14)} expected ${want.padEnd(16)} got ${origins.join(' / ')}`)
}

console.log(`\nDrift check on critical-identity rows (anniversary/Sophie/no_birthdays):`)
const driftKeys = ['anniversary', 'sophie', 'no_birthdays']
let driftFree = true
for (const k of driftKeys) {
  const uniq = new Set(summaries[k].origins.filter(o => o !== '(absent)'))
  const stable = uniq.size <= 1
  console.log(`  ${stable ? '✓' : '✗'} ${k}: ${[...uniq].join(', ') || '(all absent)'}`)
  if (!stable) driftFree = false
}

console.log(`\nLaphroaig λ across runs (should be ai_specific, λ≈0.002 or 0.005 — NOT 0):`)
for (let i = 0; i < runs.length; i++) {
  const l = findFirst(runs[i].preferences, matchers.laphroaig)
  console.log(`  run ${i+1}: ${l ? `${l.preference_name} · origin=${l.lambda_origin} · λ=${l.lambda.toFixed(3)}` : '(absent)'}`)
}

if (allPass && driftFree) {
  console.log(`\n✓ Pass-B integration GREEN — identity facts stable as forced_identity; peat & Laphroaig untouched.`)
  process.exit(0)
} else {
  console.log(`\n✗ Pass-B integration FAILED — see rows marked ✗ above.`)
  process.exit(1)
}
