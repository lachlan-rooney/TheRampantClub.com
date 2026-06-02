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

// ⚠ DEMO SURFACE — Observatory live-extraction demonstration.
//
// Runs the EXACT SAME extraction pipeline as the live intake route
// (buildSystemPrompt + reconcile + the same SSE shape), but writes NOTHING.
// There is no DB insert in this file — not a disabled one, an ABSENT one.
// A demo run is physically incapable of touching real data because the code
// path that could do so does not exist here.
//
// Guarantees:
//   1. Gated by MIS_DEMO_ENABLED='1' (trip-wire BEFORE the admin check —
//      same posture as _debug/decay-demo). When the gate is off the route
//      403s and the UI renders a "demo disabled" state.
//   2. NO writes. No `from('preferences')`, no `.insert(`, no `.update(`,
//      no `.upsert(`, no `.delete(`, no `.rpc(` to any save function. The
//      only Supabase call is a READ to learned_decay_constants (via
//      getActiveLearnedLambda) so the demo speaks the live baselines.
//   3. Uses the REAL buildSystemPrompt and reconcile from
//      lib/mis/extraction-decay.ts — not a demo-flavoured approximation.
//      Credibility to a technical viewer rests on it being the real
//      pipeline.
//
// Stream shape mirrors /api/admin/mis/intake/route.ts exactly:
//   status:starting → (thinking | partial | preference)* → usage
//     → status:reconciling → reconciled → done
// The client replaces its staged preference list with the reconciled
// payload wholesale on the 'reconciled' frame.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function gateOpen(): boolean {
  return process.env.MIS_DEMO_ENABLED === '1'
}

interface RequestBody {
  transcript?: unknown
  member_name?: unknown
}

const USER_PROMPT = (memberName: string, transcript: string) =>
  `Extract preferences for ${memberName} from the transcript below. Emit one JSON object per line per the rules.

TRANSCRIPT:
${transcript}`

export async function POST(req: NextRequest) {
  if (!gateOpen()) {
    return new Response(JSON.stringify({
      error: 'demo affordance disabled',
      detail: 'Set MIS_DEMO_ENABLED=1 in the environment to enable. This endpoint is a closed-loop demonstration, not a feature.',
    }), { status: 403 })
  }
  if (!(await isAdmin())) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : ''
  if (!transcript) return new Response(JSON.stringify({ error: 'transcript required' }), { status: 400 })
  if (transcript.length > 200_000) {
    return new Response(JSON.stringify({ error: 'transcript too long (max 200k chars)' }), { status: 400 })
  }
  const memberName = (typeof body.member_name === 'string' && body.member_name.trim()) || 'Demo Member'

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500 })
  }
  const anthropic = new Anthropic({ apiKey })

  // Load baselines once — same call the live intake makes. The demo speaks
  // the current live baselines, so when a learned λ has been promoted, the
  // demo extraction inherits it just as a real intake would.
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
            cache_control: { type: 'ephemeral' },
          }],
          messages: [{
            role: 'user',
            content: USER_PROMPT(memberName, transcript),
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
      // INTENTIONAL: no save step here. The reconciled payload exists only
      // on the wire and in the calling browser session; it is not persisted
      // to any table by this route.
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

// ── Per-line parsing ──────────────────────────────────────────────────
//
// Duplicated from app/api/admin/mis/intake/route.ts — both routes parse the
// model's JSON-Lines output identically. Keeping the demo's parser
// self-contained means the live intake route stays untouched (Pass 4 is
// locked), and the duplication is small. Reconciliation and the medical
// guardrail come from the SHARED extraction-decay module — those are the
// load-bearing safety surfaces; this parser is plumbing.

function tryParseRawObject(line: string): ExtractedPreference | null {
  const cleaned = line.replace(/^[\s,]+|[\s,]+$/g, '')
  if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) return null
  let obj: Record<string, unknown>
  try { obj = JSON.parse(cleaned) } catch { return null }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
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
