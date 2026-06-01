import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import {
  buildSystemPrompt,
  buildCategoryBaselines,
  getActiveLearnedLambda,
  reconcile,
  type ExtractedPreference,
} from '@/lib/mis/extraction-decay'

// MIS Pass 4 — Interview transcript intake (streaming + end-of-stream reconcile).
//
// The intake still streams Claude's per-line emissions live so the admin sees
// extraction happening as it happens (unchanged UX). On top of that, this
// route now:
//   - Loads per-category baselines ONCE per request from learned_decay_constants
//     (active rows) falling through to the designed map in decay-priors.ts.
//     The system prompt is built from those baselines via buildSystemPrompt,
//     so the model reasons against the current canonical baselines (designed
//     today; learned once promotions land).
//   - Accumulates the model's raw parsed-line output server-side alongside the
//     per-line SSE emits, then runs reconcile(raw, baselines) when the stream
//     completes. Reconcile is authoritative: it drops non-canonical categories,
//     content-detects medical preferences and forces s0=5/C=1/lambda=0/
//     lambda_origin='forced_medical', and stamps lambda_origin on every kept
//     row ('ai_specific' | 'category_baseline_learned' | 'category_baseline_designed').
//   - Emits 'reconciling' (so the UI can dim the staged list) and finally
//     'reconciled' carrying the canonical list + medicalForced + dropped +
//     baselines used. The client replaces its staged list with the reconciled
//     payload wholesale — it does NOT merge, see the design call.
//
// The per-line 'preference' SSE event remains so the live preview keeps
// streaming. Those previews are throwaway; the truth arrives in 'reconciled'.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'  // SSE + Anthropic SDK want Node runtime, not Edge.

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const USER_PROMPT_TEMPLATE = (memberName: string, transcript: string) =>
  `Extract preferences for ${memberName} from the transcript below. Emit one JSON object per line per the rules.

TRANSCRIPT:
${transcript}`

interface RequestBody {
  member_no?: unknown
  transcript?: unknown
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const member_no = typeof body.member_no === 'string' ? body.member_no.trim() : ''
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : ''
  if (!member_no) return new Response(JSON.stringify({ error: 'member_no required' }), { status: 400 })
  if (!transcript) return new Response(JSON.stringify({ error: 'transcript required' }), { status: 400 })
  if (transcript.length > 200_000) {
    return new Response(JSON.stringify({ error: 'transcript too long (max 200k chars)' }), { status: 400 })
  }

  const memberName = await fetchMemberName(member_no, req.nextUrl.origin) || member_no

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500 })
  }
  const anthropic = new Anthropic({ apiKey })

  // One supabase lookup per intake — feeds both the prompt and the flush reconcile.
  // The library types its supabase param via `ReturnType<typeof createClient>` (no
  // generics), but the project's `svc()` returns a richer-typed client; the API
  // surface used inside getActiveLearnedLambda (from/select/eq/order) is identical
  // for both, so cast to the library's expected shape rather than weakening svc().
  const sb = svc()
  const learnedLambda = await getActiveLearnedLambda(
    sb as Parameters<typeof getActiveLearnedLambda>[0]
  )
  const baselines = buildCategoryBaselines(learnedLambda)
  const systemPrompt = buildSystemPrompt(baselines)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      let textBuffer = ''
      let extracted = 0
      let inputTokens = 0
      let outputTokens = 0
      let cacheReadTokens = 0
      let cacheCreationTokens = 0

      // Server-side raw accumulation — what reconcile sees at flush.
      // The model's true output (including non-canonical categories the line
      // parser would suppress in display) ends up here, so reconcile's
      // `dropped` counter reflects reality rather than what passed the
      // display filter.
      const assembledRaw: ExtractedPreference[] = []

      try {
        send('status', { phase: 'starting', member_name: memberName })

        const claudeStream = anthropic.messages.stream({
          model: 'claude-opus-4-7',
          max_tokens: 32000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'high' },
          system: [{
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },  // cache the rulebook across interviews
          }],
          messages: [{
            role: 'user',
            content: USER_PROMPT_TEMPLATE(memberName, transcript),
          }],
        })

        const handleLine = (line: string) => {
          const raw = tryParseRawObject(line)
          if (raw) assembledRaw.push(raw)
          const display = raw ? validateForDisplay(raw) : null
          if (display) {
            extracted += 1
            send('preference', { index: extracted, pref: display })
          }
        }

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'thinking_delta') {
              send('thinking', { text: event.delta.thinking })
            } else if (event.delta.type === 'text_delta') {
              const chunk = event.delta.text
              textBuffer += chunk
              send('partial', { text: chunk })

              let nl = textBuffer.indexOf('\n')
              while (nl !== -1) {
                const line = textBuffer.slice(0, nl).trim()
                textBuffer = textBuffer.slice(nl + 1)
                if (line) handleLine(line)
                nl = textBuffer.indexOf('\n')
              }
            }
          } else if (event.type === 'message_delta') {
            if (event.usage) {
              inputTokens = event.usage.input_tokens || 0
              outputTokens = event.usage.output_tokens || 0
              cacheReadTokens = event.usage.cache_read_input_tokens || 0
              cacheCreationTokens = event.usage.cache_creation_input_tokens || 0
            }
          }
        }

        const tail = textBuffer.trim()
        if (tail) handleLine(tail)

        send('usage', {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_input_tokens: cacheReadTokens,
          cache_creation_input_tokens: cacheCreationTokens,
        })

        // ── End-of-stream reconcile — the authoritative pass ────────────
        send('status', { phase: 'reconciling' })
        const reconciled = reconcile(assembledRaw, baselines)
        send('reconciled', {
          preferences: reconciled.preferences,
          dropped:      reconciled.dropped,
          medicalForced: reconciled.medicalForced,
          baselines,
          raw_count:    assembledRaw.length,
        })
        send('done', { count: reconciled.preferences.length })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        send('error', { message: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ── Per-line parsing helpers ──────────────────────────────────────────
//
// tryParseRawObject is liberal: any JSON object goes through, even with a
// non-canonical category. The streaming UX uses validateForDisplay to filter
// per-line; the assembled raw array preserves everything for reconcile, which
// is where the final canonical-categories drop is logged.

function tryParseRawObject(line: string): ExtractedPreference | null {
  const cleaned = line.replace(/^[\s,]+|[\s,]+$/g, '')
  if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) return null
  let obj: Record<string, unknown>
  try { obj = JSON.parse(cleaned) } catch { return null }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  // Coerce to the loose ExtractedPreference shape. Reconcile snaps numbers
  // and drops non-canonical categories itself; we don't pre-filter here.
  return {
    category:        typeof obj.category === 'string' ? obj.category.trim() : '',
    subcategory:     typeof obj.subcategory === 'string' ? obj.subcategory.trim() : undefined,
    preference_name: typeof obj.preference_name === 'string' ? obj.preference_name.trim() : undefined,
    detail:          typeof obj.detail === 'string' ? obj.detail.trim() : undefined,
    verbatim_quote:  typeof obj.verbatim_quote === 'string' ? obj.verbatim_quote.trim() : undefined,
    s0:              numberOrUndef(obj.s0),
    confidence:      numberOrUndef(obj.confidence),
    lambda:          numberOrUndef(obj.lambda),
    frequency:       numberOrUndef(obj.frequency),
  }
}

function numberOrUndef(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const ALLOWED_C = [1.00, 0.75, 0.50, 0.25]
const ALLOWED_L = [0.000, 0.002, 0.005, 0.010, 0.020]
const ALLOWED_F = [0.8, 1.0, 1.2, 1.5]
const CANONICAL = new Set([
  'Personal & Lifestyle', 'Food & Beverage', 'Whisky & Beverage',
  'Social & Networking', 'Business & Productivity', 'Wellness & Comfort',
  'Cultural & Intellectual', 'Family & Personal', 'Travel & Global',
])

function snap(v: number | undefined, set: number[]): number | null {
  if (v == null || !Number.isFinite(v)) return null
  const m = set.find(a => Math.abs(a - v) < 1e-6)
  return m ?? null
}

/** Display-shape validator for the live stream preview. The truth comes from reconcile. */
function validateForDisplay(raw: ExtractedPreference): {
  category: string
  subcategory: string | null
  preference_name: string
  detail: string | null
  verbatim_quote: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
} | null {
  if (!CANONICAL.has(raw.category)) return null
  if (!raw.preference_name) return null
  const s0 = raw.s0
  if (s0 == null || !Number.isInteger(s0) || s0 < 1 || s0 > 5) return null
  const confidence = snap(raw.confidence, ALLOWED_C)
  if (confidence == null) return null
  const lambda = snap(raw.lambda, ALLOWED_L)
  if (lambda == null) return null
  const frequency = snap(raw.frequency, ALLOWED_F)
  if (frequency == null) return null
  return {
    category:        raw.category,
    subcategory:     raw.subcategory ?? null,
    preference_name: raw.preference_name,
    detail:          raw.detail ?? null,
    verbatim_quote:  raw.verbatim_quote ?? null,
    s0, confidence, lambda, frequency,
  }
}

async function fetchMemberName(member_no: string, origin: string): Promise<string | null> {
  try {
    const r = await fetch(new URL('/api/admin/mis/members', origin), { cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json() as { members?: Array<{ member_no: string; full_name: string }> }
    return d.members?.find(m => m.member_no === member_no)?.full_name || null
  } catch {
    return null
  }
}
