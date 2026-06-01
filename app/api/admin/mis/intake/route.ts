import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isAdmin } from '@/lib/admin'

// MIS Pass 1.5 — Interview transcript intake.
//
// Streams Claude Opus 4.7 output back to the browser as Server-Sent Events,
// emitting one parsed preference at a time so the admin sees extraction
// happening live. The system prompt encodes the §2 derivation rules from
// docs/MIS_canonical_spec_and_DDL.md verbatim — preferences emerge with
// S₀/C/λ/F already chosen against the spec, ready to commit or edit.
//
// Output contract: Claude emits JSON Lines (one object per line, no array
// wrapper, no markdown fences). We buffer text, parse complete lines, and
// fire one SSE 'preference' event per parsed object. Raw text chunks also
// stream as 'partial' events so the UI can show typing-in-progress.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'  // SSE + Anthropic SDK want Node runtime, not Edge.

const SYSTEM_PROMPT = `You are the preference extractor for The Rampant Club's Member Intelligence System (MIS). Read an interview transcript and emit one preference per line as JSON.

## Output format — STRICT

- Emit JSON Lines: one complete JSON object per line, separated by \\n.
- No array wrapper. No markdown fences. No commentary before, between, or after.
- Each object MUST have exactly these fields:
  { "category": str, "subcategory": str, "preference_name": str, "detail": str, "verbatim_quote": str, "s0": int, "confidence": float, "lambda": float, "frequency": float }
- All numeric values must come from the allowed sets below — never invent intermediate values.

## The 9 canonical categories (use exactly one of these strings)

Personal & Lifestyle
Food & Beverage
Whisky & Beverage
Social & Networking
Business & Productivity
Wellness & Comfort
Cultural & Intellectual
Family & Personal
Travel & Global

## S₀ — Importance (integer 1–5)

5 = Absolute / non-negotiable. "Never / always / allergic / require" plus emotion plus repetition. Member would be angry if surprised.
4 = Strong. "Really prefer / strongly dislike / love / hate" plus a reason or story. Member would be disappointed.
3 = Moderate. "Tend to / usually / enjoy" stated calmly. Member would be mildly annoyed.
2 = Mild. "Sometimes / don't mind / might be nice."
1 = Aware. "Okay either way / no opinion."

## C — Confidence (one of 1.00, 0.75, 0.50, 0.25)

1.00 = Explicit. Member directly stated it.
0.75 = Observed. Pattern seen 3+ times in the transcript.
0.50 = Inferred. Derived from related info.
0.25 = Speculative. One-off mention or uncertain.

Modifiers (apply, then clamp to [0.25, 1.00]):
- Emotional language: +0.20
- Repetition: +0.10 per additional mention
- Hedging qualifier ("sometimes", "maybe"): −0.20
- Internal contradiction: −0.50

At first interview almost everything is 1.00 unless hedged or contradicted.

## λ — Decay (one of 0.000, 0.002, 0.005, 0.010, 0.020)

0.000 = Medical, safety, religious identity. Would be the same in 10 years.
0.002 = Core personality, cultural identity, lifelong aesthetic. About who they ARE.
0.005 = Established habit, consistent preference across contexts.
0.010 = Variable, emerging, mood-dependent. Could change in 2–3 months.
0.020 = Temporary, seasonal, current situation. Different in 6 months.

When uncertain, prefer the SLOWER decay (lower number).

## F — Frequency (one of 0.8, 1.0, 1.2, 1.5)

At an INITIAL interview, default F = 1.0 for every preference. Only deviate if the transcript explicitly states the frequency, in which case:
1.5 = daily / every visit
1.2 = weekly / most visits
1.0 = monthly (default)
0.8 = rarely

## Cadence-aware adjustments (transcript stage directions in [brackets])

[Firmly] / [Leans forward] / [Points] → bump S₀ by +1
[Interrupts] → set S₀ to at least 4
[Softens] / [Voice drops] → set λ = 0.002
[Pauses] / [Long pause] → reduce C by 0.25
[Laughs] → reduce S₀ by 1
[Sheepish] → set λ = 0.010

## Health & Safety rule (always)

ANY allergy, medical, safety, dietary religion, or accessibility need → S₀ = 5, C = 1.00, λ = 0.000. No exceptions, regardless of how casually the member mentions it.

## Field-by-field guidance

- category: exactly one of the 9 strings above.
- subcategory: a short topic (e.g. "Time Preference", "Comfort Food", "Cocktails"). Lowercase or title case, whatever reads naturally.
- preference_name: a 3–6 word title for staff to scan (e.g. "Evening Person", "Never Hot Towel", "Springbank 15").
- detail: one sentence describing the preference in plain prose.
- verbatim_quote: a snippet from the transcript, paraphrased only if needed to fit on one line. Strip quote marks; we wrap them ourselves.
- One preference per row. If the member states two related but distinct preferences in the same breath, split them.

## Final reminders

- Read the WHOLE transcript before you start emitting. Identify every preference, then output them in the order they appear in the transcript.
- Do NOT emit any prose, explanation, or summary. Only JSON Lines.
- Do NOT wrap output in [ ] or , — each line is a standalone object.
- Health & Safety items take the override rule even if the member is casual.
- When in doubt on λ, pick the slower one. When in doubt on C, pick the higher one (you can revise down on later contact).`

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

  // Resolve member name for the prompt — fall back to member_no if missing.
  const memberName = await fetchMemberName(member_no, req.nextUrl.origin) || member_no

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500 })
  }
  const anthropic = new Anthropic({ apiKey })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      let textBuffer = ''         // accumulates current line until \n
      let extracted = 0
      let inputTokens = 0
      let outputTokens = 0
      let cacheReadTokens = 0
      let cacheCreationTokens = 0

      try {
        send('status', { phase: 'starting', member_name: memberName })

        const claudeStream = anthropic.messages.stream({
          model: 'claude-opus-4-7',
          max_tokens: 32000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'high' },
          system: [{
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },  // cache the rulebook across interviews
          }],
          messages: [{
            role: 'user',
            content: USER_PROMPT_TEMPLATE(memberName, transcript),
          }],
        })

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'thinking_delta') {
              // Surface thinking subtly so the UI can show "Reasoning…"
              send('thinking', { text: event.delta.thinking })
            } else if (event.delta.type === 'text_delta') {
              const chunk = event.delta.text
              textBuffer += chunk
              send('partial', { text: chunk })

              // Try to flush complete lines as preferences.
              let nl = textBuffer.indexOf('\n')
              while (nl !== -1) {
                const line = textBuffer.slice(0, nl).trim()
                textBuffer = textBuffer.slice(nl + 1)
                if (line) {
                  const parsed = tryParsePreference(line)
                  if (parsed) {
                    extracted += 1
                    send('preference', { index: extracted, pref: parsed })
                  }
                }
                nl = textBuffer.indexOf('\n')
              }
            }
          } else if (event.type === 'message_delta') {
            // Final usage lands here
            if (event.usage) {
              inputTokens = event.usage.input_tokens || 0
              outputTokens = event.usage.output_tokens || 0
              cacheReadTokens = event.usage.cache_read_input_tokens || 0
              cacheCreationTokens = event.usage.cache_creation_input_tokens || 0
            }
          }
        }

        // Final flush — last line may not end with \n
        const tail = textBuffer.trim()
        if (tail) {
          const parsed = tryParsePreference(tail)
          if (parsed) {
            extracted += 1
            send('preference', { index: extracted, pref: parsed })
          }
        }

        send('usage', {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_input_tokens: cacheReadTokens,
          cache_creation_input_tokens: cacheCreationTokens,
        })
        send('done', { count: extracted })
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
      'X-Accel-Buffering': 'no',  // disable Nginx/Vercel proxy buffering on SSE
    },
  })
}

// Helpers --------------------------------------------------------------

const allowedCategories = new Set([
  'Personal & Lifestyle', 'Food & Beverage', 'Whisky & Beverage',
  'Social & Networking', 'Business & Productivity', 'Wellness & Comfort',
  'Cultural & Intellectual', 'Family & Personal', 'Travel & Global',
])
const allowedConfidence = [1.00, 0.75, 0.50, 0.25]
const allowedLambda     = [0.000, 0.002, 0.005, 0.010, 0.020]
const allowedFrequency  = [0.8, 1.0, 1.2, 1.5]

function snap(v: unknown, allowed: number[]): number | null {
  const n = Number(v)
  if (Number.isNaN(n)) return null
  const m = allowed.find(a => Math.abs(a - n) < 1e-6)
  return m ?? null
}

interface ExtractedPreference {
  category: string
  subcategory: string | null
  preference_name: string
  detail: string | null
  verbatim_quote: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
}

function tryParsePreference(line: string): ExtractedPreference | null {
  // Strip leading commas / array tokens Claude might emit by mistake.
  const cleaned = line.replace(/^[\s,]+|[\s,]+$/g, '')
  if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) return null
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(cleaned)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null

  const category = String(obj.category || '').trim()
  if (!allowedCategories.has(category)) return null

  const preference_name = String(obj.preference_name || '').trim()
  if (!preference_name) return null

  const s0Raw = Number(obj.s0)
  if (!Number.isInteger(s0Raw) || s0Raw < 1 || s0Raw > 5) return null

  const confidence = snap(obj.confidence, allowedConfidence)
  if (confidence == null) return null

  const lambda = snap(obj.lambda, allowedLambda)
  if (lambda == null) return null

  const frequency = snap(obj.frequency, allowedFrequency)
  if (frequency == null) return null

  return {
    category,
    subcategory:     obj.subcategory     ? String(obj.subcategory).trim()     : null,
    preference_name,
    detail:          obj.detail          ? String(obj.detail).trim()          : null,
    verbatim_quote:  obj.verbatim_quote  ? String(obj.verbatim_quote).trim()  : null,
    s0: s0Raw,
    confidence,
    lambda,
    frequency,
  }
}

async function fetchMemberName(member_no: string, origin: string): Promise<string | null> {
  try {
    // Reuse the admin members endpoint so name resolution stays in one place.
    const r = await fetch(new URL('/api/admin/mis/members', origin), { cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json() as { members?: Array<{ member_no: string; full_name: string }> }
    return d.members?.find(m => m.member_no === member_no)?.full_name || null
  } catch {
    return null
  }
}
