import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isAdmin } from '@/lib/admin'

// ⚠ ANALYSIS SURFACE — three-run consistency meta-analysis.
//
// Reads three CAPTURED probe runs (already in the caller's browser session)
// and asks Claude to compare their judgement. Does NOT re-run extraction.
// Does NOT touch the DB. Does NOT touch the medical guardrail.
//
// Hardened rules (per the spec):
//   1. The medical lock is enforced in deterministic application code
//      (isMedicalPreference + the aiSaidZero branch in reconcile). It is
//      STRUCTURALLY INCAPABLE of varying between runs for the same input.
//      So any safety inconsistency surfaced here is a CODE DEFECT, not
//      model variance. The system prompt below tells the model that
//      verbatim; the model cannot soften it.
//
//   2. Analysis call: NO thinking, NO temperature override. Anthropic's API
//      rejects `temperature` entirely on claude-opus-4-7 ("temperature is
//      deprecated for this model"), so we can't tighten reproducibility via
//      that lever. With thinking disabled the model's default sampling is
//      tight enough that the VERDICT and structural classification (which
//      variances are granularity vs judgment vs safety) hold across runs —
//      the prose synthesis may vary slightly. That's the reproducibility
//      bar this analyser commits to: verdict stable, type-tags stable,
//      synthesis prose may rephrase.
//
//   3. JSON return, no streaming. Defensive parse: if the model emits
//      anything we can't parse against the expected shape, surface a 502
//      with a clear message rather than crashing the UI.
//
//   4. Gate posture identical to the rest of Panel 6: MIS_DEMO_ENABLED='1'
//      trip-wire BEFORE the admin check.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function gateOpen(): boolean {
  return process.env.MIS_DEMO_ENABLED === '1'
}

interface RunPref {
  category: string
  preference_name: string
  verbatim_quote: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
  lambda_origin: string | null
  rationale?: string | null
}
interface Run {
  preferences: RunPref[]
  summary?: { count?: number; medicalForced?: number; aiPermanent?: number }
}
interface RequestBody { runs?: unknown }

// The three exact difference definitions + the hardened safety framing,
// baked verbatim into the system prompt so the model cannot soften the
// safety-inconsistency framing into "minor variance".
const SYSTEM_PROMPT = `You are analysing three INDEPENDENT runs of the same preference-extraction pipeline on the SAME transcript. Your task is to determine whether the system's JUDGEMENT was consistent across the three runs.

CONTEXT: the extraction layer runs with adaptive thinking at temperature=1, so the COUNT of preferences and GRANULARITY of splitting will naturally vary across runs (the same underlying preference can be split into two rows in one run and merged into one in another). What must NOT vary is the JUDGEMENT — the scores (S₀, C, λ, F) and lock status (forced_medical / ai_permanent / ai_specific / category_baseline_designed / category_baseline_learned).

For each preference concept that appears across the runs, determine whether its SCORES (S₀, C, λ, F) and LOCK STATUS are consistent. Classify every difference as EXACTLY ONE of:

1. GRANULARITY — the same underlying preference(s) were split or merged differently across runs, but the scoring of the underlying content is CONSISTENT. (Example: "neat" and "pours own water" as one row in run A, two rows in runs B and C, with the same S₀ / C / λ on the equivalent content.) Cosmetic. Expected. Benign.

2. JUDGMENT — the same preference (matched by verbatim_quote / preference_name overlap) was scored DIFFERENTLY across runs — an S₀, C, or λ that actually MOVED between runs. Substantive.

3. SAFETY INCONSISTENCY — a medical / allergy preference (anything where the verbatim quote signals an allergy, intolerance, anaphylaxis, religious dietary rule, or other medical lock content) is forced_medical in some runs but not others. CRITICAL.

HARDENED SAFETY FRAMING — bake this conclusion in if you observe it; do not soften it:
The medical lock is enforced in DETERMINISTIC application code, NOT by your judgement. It is therefore structurally incapable of varying between runs for the same input. If you observe a medical / allergy preference that is forced_medical in some runs but not others, you MUST set verdict to "safety_inconsistency" and the synthesis MUST state that this indicates a GUARDRAIL CODE DEFECT to investigate immediately — you must NOT describe it as "model inconsistency", "minor variance", "borderline", or anything that softens it. A safety inconsistency is a code bug, full stop.

INVARIANTS: identify every score and lock that held identically across all three runs — especially safety locks (forced_medical), permanence locks (ai_permanent), and the key scored preferences. List each with the score/lock that held.

VERDICT RULES:
- If ANY safety inconsistency exists → verdict = "safety_inconsistency", regardless of everything else.
- Else if any JUDGMENT differences exist → verdict = "judgment_variance".
- Else (all variances are GRANULARITY-only) → verdict = "stable".

OUTPUT: STRICT JSON only, no markdown fences, no commentary before or after. Exact shape:
{
  "verdict": "stable" | "judgment_variance" | "safety_inconsistency",
  "headline": "one sentence summary",
  "invariants": [ { "preference": "...", "detail": "..." } ],
  "variances": [ { "preference": "...", "type": "granularity" | "judgment" | "safety", "detail": "..." } ],
  "counts": [n1, n2, n3],
  "synthesis": "one-paragraph prose summary"
}`

function compactPref(p: RunPref) {
  return {
    category: p.category,
    name: p.preference_name,
    quote: p.verbatim_quote,
    s0: p.s0,
    c: p.confidence,
    lambda: p.lambda,
    f: p.frequency,
    origin: p.lambda_origin,
    rationale: p.rationale ?? null,
  }
}

export async function POST(req: NextRequest) {
  if (!gateOpen()) {
    return NextResponse.json({
      error: 'consistency analyser disabled',
      detail: 'Set MIS_DEMO_ENABLED=1 to enable. This endpoint is a probe surface, not a feature.',
    }, { status: 403 })
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RequestBody
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!Array.isArray(body.runs) || body.runs.length !== 3) {
    return NextResponse.json({ error: 'runs must be an array of exactly 3' }, { status: 400 })
  }

  // Validate each run's shape minimally and project to the compact form.
  let runs: Run[]
  try {
    runs = (body.runs as Run[]).map((r, i) => {
      if (!Array.isArray(r.preferences)) throw new Error(`run ${i+1}: preferences missing`)
      return r
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }
  const anthropic = new Anthropic({ apiKey })

  const userContent =
    `Three runs of the extraction pipeline on the same transcript. ` +
    `Counts: ${runs.map(r => r.preferences.length).join(' / ')}.\n\n` +
    runs.map((r, i) =>
      `=== RUN ${i + 1} (${r.preferences.length} preferences) ===\n` +
      JSON.stringify(r.preferences.map(compactPref), null, 2)
    ).join('\n\n') +
    `\n\nProduce the stability analysis per the system prompt. Return STRICT JSON only.`

  let raw: string
  try {
    // No `temperature` override — claude-opus-4-7 deprecated the parameter.
    // No `thinking` block — the analyser is a structured comparison task, the
    // model's default sampling is tight enough without extended reasoning,
    // and skipping thinking keeps the report quick and bounded.
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })
    const block = msg.content.find(b => b.type === 'text')
    raw = block && 'text' in block ? block.text : ''
  } catch (e) {
    return NextResponse.json({ error: 'analysis call failed', detail: (e as Error).message }, { status: 502 })
  }

  // Defensive parse — strip any markdown fence the model may have added,
  // then JSON.parse, then validate the shape. If anything is off, return 502
  // with the raw text so the UI can show a useful error.
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  let parsed: unknown
  try { parsed = JSON.parse(cleaned) } catch {
    return NextResponse.json({
      error: 'model returned unparseable JSON',
      raw: raw.slice(0, 2000),
    }, { status: 502 })
  }
  const obj = parsed as Record<string, unknown>
  const verdict = String(obj.verdict || '')
  if (!['stable', 'judgment_variance', 'safety_inconsistency'].includes(verdict)) {
    return NextResponse.json({
      error: 'model returned invalid verdict',
      verdict,
      raw: raw.slice(0, 2000),
    }, { status: 502 })
  }

  return NextResponse.json({
    verdict,
    headline:    String(obj.headline    || ''),
    invariants:  Array.isArray(obj.invariants)  ? obj.invariants  : [],
    variances:   Array.isArray(obj.variances)   ? obj.variances   : [],
    counts:      Array.isArray(obj.counts)      ? obj.counts      : runs.map(r => r.preferences.length),
    synthesis:   String(obj.synthesis   || ''),
  })
}
