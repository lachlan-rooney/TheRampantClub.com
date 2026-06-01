import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/recap/[id]/extract
//
// Reads the Evening Recap narrative, hands it to Claude Opus 4.7, streams
// extracted events back as SSE (one JSON Lines object per event), and
// persists every accepted line into harmony_extractions as status='pending'
// so the staff review screen can render them and accept/reject each one.
//
// Mirrors /api/admin/mis/intake (interview extraction) — same SSE shape,
// same prompt-caching pattern. Output kinds: visit | preference |
// bottle_depletion | prospect | complaint | card_charge.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SYSTEM_PROMPT = `You are the shift extractor for The Rampant Club's Evening Recap. A team member just typed a narrative of the evening. Read the whole thing, then emit one structured event per line as JSON.

## Output format — STRICT

- JSON Lines: one complete JSON object per line, separated by \\n.
- No array wrapper. No markdown fences. No commentary before, between, or after.
- Every object MUST have a "kind" field and a "payload" object.
- Allowed kinds: "visit" | "preference" | "bottle_depletion" | "prospect" | "complaint" | "card_charge".
- Read the WHOLE narrative before emitting anything. Each line you emit is one row that the team will tick-accept.

## Member resolution

The narrative references people by first name, nickname, or full name. You do NOT have the roster — emit the member's name verbatim as "member_hint" inside the payload. The server resolves names against the live roster before saving.

## "visit"

A member was present in the club tonight. Emit one per member you can identify (do NOT double-emit if the same person appears in many sentences).

  { "kind": "visit",
    "payload": {
      "member_hint": "Smith",
      "space": "Lounge" | "Library" | "Bar" | "Cigar Terrace" | null,
      "duration_min": 120 | null,
      "emotional_state": "celebratory" | "subdued" | "festive" | "tense" | null,
      "notes": "Came in with Tran, stayed two hours."
    }
  }

## "preference"

The member mentioned, requested, or asked about a specific bottle, food, or experience. Use the MIS rubric: S₀ (1–5), confidence (1.00 explicit / 0.75 observed / 0.50 inferred / 0.25 speculative), lambda (0.005 established / 0.010 emerging / 0.020 transient — default 0.010 for a one-shift mention), frequency 1.0 default.

  { "kind": "preference",
    "payload": {
      "member_hint": "Smith",
      "category": "Whisky & Beverage",
      "subcategory": "Japanese Single Malt",
      "preference_name": "Bowmore 25",
      "detail": "Asked about trying Bowmore 25 next visit.",
      "verbatim_quote": "He wants to try the Bowmore 25",
      "s0": 3, "confidence": 1.0, "lambda": 0.010, "frequency": 1.0
    }
  }

The 9 canonical categories: Personal & Lifestyle, Food & Beverage, Whisky & Beverage, Social & Networking, Business & Productivity, Wellness & Comfort, Cultural & Intellectual, Family & Personal, Travel & Global.

Health and safety items (allergies, medical, religious dietary) → S₀=5, C=1.0, λ=0.000 — no exceptions.

## "bottle_depletion"

A bottle owned by the member (lives in their locker) was poured down tonight. Emit only when the narrative is explicit ("finished his Hibiki 21", "two pours from her Springbank").

  { "kind": "bottle_depletion",
    "payload": {
      "member_hint": "Smith",
      "bottle_name": "Hibiki 21",
      "estimated_pours": 2 | null,
      "estimated_new_fill_pct": 0 | 25 | 50 | 75 | null,
      "note": "Finished tonight."
    }
  }

If the narrative says "finished" use estimated_new_fill_pct = 0. Otherwise leave null and the staff will set it on review.

## "prospect"

A non-member was mentioned as a potential candidate (walked in, brought as a guest, referred). Emit only when the team would genuinely want them in the pipeline.

  { "kind": "prospect",
    "payload": {
      "full_name": "Mike Tran",
      "profession": "Hedge fund manager" | null,
      "referred_by_hint": "Smith" | null,
      "source_channel": "Referral" | "Direct Approach" | "Event" | null,
      "notes": "Smith's friend, finance, asked about membership."
    }
  }

## "complaint"

Any friction surfaced tonight — service, product, facility, billing. Severity scale 1 (minor) to 5 (critical). Status "resolved" if the team handled it in-shift; otherwise "open".

  { "kind": "complaint",
    "payload": {
      "member_hint": "Sarah" | null,
      "category": "service" | "product" | "facility" | "billing" | "other",
      "severity": 1 | 2 | 3 | 4 | 5,
      "summary": "Music volume too high early evening",
      "detail": "Optional extended narrative — context the team would want to see when triaging this later. Leave null if summary is enough." | null,
      "status": "resolved" | "open",
      "resolution": "Lowered volume" | null
    }
  }

## "card_charge"

A member paid for something with their card. Emit only when the amount is explicit. amount_vnd is positive (the kind tells us it was a charge).

  { "kind": "card_charge",
    "payload": {
      "member_hint": "Tran",
      "amount_vnd": 4200000,
      "note": "Tab for the evening"
    }
  }

## Final reminders

- ONE event per line. No duplicates. No filler. If the narrative is short and uneventful, emit fewer events.
- "member_hint" is always a string the team would recognise — what the narrative actually called the person. The server resolves.
- Do not emit prose. Do not summarise. Do not wrap output in [] or commas.
- If you cannot confidently classify something, do not emit it. Quality over completeness.`

const USER_PROMPT_TEMPLATE = (date: string, label: string, narrative: string) =>
  `Shift: ${label} of ${date}.

NARRATIVE:
${narrative}

Emit one JSON object per line per the rules.`

interface PendingExtraction {
  kind: string
  payload: Record<string, unknown>
  member_hint: string | null
}

const ALLOWED_KINDS = new Set(['visit', 'preference', 'bottle_depletion', 'prospect', 'complaint', 'card_charge'])

function tryParseExtraction(line: string): PendingExtraction | null {
  const cleaned = line.replace(/^[\s,]+|[\s,]+$/g, '')
  if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) return null
  let obj: Record<string, unknown>
  try { obj = JSON.parse(cleaned) } catch { return null }
  const kind = typeof obj.kind === 'string' ? obj.kind : ''
  if (!ALLOWED_KINDS.has(kind)) return null
  const payload = obj.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const p = payload as Record<string, unknown>
  const member_hint = typeof p.member_hint === 'string' ? p.member_hint : null
  return { kind, payload: p, member_hint }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const { id } = await ctx.params

  const sb = svc()
  const { data: log, error: logErr } = await sb
    .from('harmony_logs')
    .select('id, shift_date, shift_label, narrative, status, extraction_started_at, extraction_finished_at')
    .eq('id', id)
    .maybeSingle()
  if (logErr || !log) {
    return new Response(JSON.stringify({ error: 'log not found' }), { status: 404 })
  }

  // Refuse to start a second extraction while one is still in flight. A
  // stream is considered live if it began less than 5 minutes ago and has
  // no finished_at. Older "stuck" streams fall through so the user can
  // retry after a crash.
  if (log.status === 'extracted' && !log.extraction_finished_at && log.extraction_started_at) {
    const started = new Date(log.extraction_started_at).getTime()
    if (Date.now() - started < 5 * 60 * 1000) {
      return new Response(JSON.stringify({ error: 'extraction already in progress for this log' }), { status: 409 })
    }
  }

  // Wipe any prior pending extractions so re-running is idempotent.
  await sb.from('harmony_extractions').delete().eq('log_id', id).in('status', ['pending'])
  await sb.from('harmony_logs').update({
    status: 'extracted',
    extraction_started_at: new Date().toISOString(),
    extraction_finished_at: null,
    extraction_token_cost: null,
  }).eq('id', id)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500 })
  const anthropic = new Anthropic({ apiKey })

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

      const persist = async (e: PendingExtraction) => {
        const { data: row, error } = await sb.from('harmony_extractions').insert({
          log_id: id,
          kind: e.kind,
          payload: e.payload,
          member_hint: e.member_hint,
          status: 'pending',
        }).select().single()
        if (error) {
          send('error', { message: `persist failed: ${error.message}` })
          return null
        }
        return row
      }

      try {
        send('status', { phase: 'starting', shift_date: log.shift_date, shift_label: log.shift_label })

        const claudeStream = anthropic.messages.stream({
          model: 'claude-opus-4-7',
          max_tokens: 32000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'high' },
          system: [{
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          }],
          messages: [{
            role: 'user',
            content: USER_PROMPT_TEMPLATE(log.shift_date, log.shift_label, log.narrative),
          }],
        })

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
                if (line) {
                  const parsed = tryParseExtraction(line)
                  if (parsed) {
                    extracted += 1
                    const row = await persist(parsed)
                    send('extraction', { index: extracted, extraction: row || parsed })
                  }
                }
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
        if (tail) {
          const parsed = tryParseExtraction(tail)
          if (parsed) {
            extracted += 1
            const row = await persist(parsed)
            send('extraction', { index: extracted, extraction: row || parsed })
          }
        }

        const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens
        await sb.from('harmony_logs').update({
          extraction_finished_at: new Date().toISOString(),
          extraction_token_cost: totalTokens,
          updated_at: new Date().toISOString(),
        }).eq('id', id)

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
        // Recover the log row so a future retry isn't blocked by the
        // "extraction in progress" guard. Roll status back to draft if no
        // extractions landed, else leave as 'extracted' for review.
        try {
          await sb.from('harmony_logs').update({
            extraction_finished_at: new Date().toISOString(),
            status: extracted > 0 ? 'extracted' : 'draft',
            updated_at: new Date().toISOString(),
          }).eq('id', id)
        } catch { /* best effort */ }
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
