import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// TRANSLATE MEMBER-FACING COPY INTO VIETNAMESE.
// ───────────────────────────────────────────────────────────────────────────
// The house rule used to be that member-facing Vietnamese is written by a
// person. Relaxed by the owner on 2026-09-14: translate automatically, let the
// EN/VN switch show it, and let a person replace it when they have time.
//
// Three things this route will not do:
//
//   1. IT NEVER OVERWRITES A HUMAN TRANSLATION. Rows whose *_vn_source is
//      'human' are skipped and reported as skipped. Miss Châu's work outlives
//      any number of runs of this.
//   2. IT NEVER INVENTS. The model is told to translate and nothing else — no
//      softening, no house style, no helpful additions. A rule that gains a
//      sentence in translation is a different rule.
//   3. IT NEVER GUESSES AT NAMES. The club's own names — The Rampant Room, The
//      Studio, the Library Bar, Mr Sĩ — stay as they are, because a member
//      looking for a room needs the word on the door.
//
// Haiku, not Opus: this is translation, the cheapest competent model does it,
// and the club's balance has been exhausted once already this month by work
// that ran on Opus without needing to.

export const dynamic = 'force-dynamic'

const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM = `You translate a private members' club's rules from English into Vietnamese.

Rules:
- Translate faithfully. Do not soften, expand, summarise or add.
- Keep proper nouns in English exactly as written: The Rampant Club, The Rampant Room, The Library Bar, The Studio, The Listening Room, the Private Dining Room, Source and Origin Lab, and any person's name.
- Keep numbers, currency and times exactly as written (1,000,000 VND stays 1,000,000 VND; 10:30pm stays 10:30pm).
- Use the register a club would use with its members: courteous, plain, not stiff.
- Return ONLY the Vietnamese translation. No preamble, no quotes, no notes.`

const svc = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function translate(anthropic: Anthropic, text: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: text }],
  })
  return msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('').trim()
}

export async function POST(req: Request) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admin only.' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'No translation key is configured.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  const only: string | null = typeof body?.id === 'string' ? body.id : null

  const a = svc()
  const { data: rules, error } = await a.from('house_rules')
    .select('id, section_title, section_title_vn, title_vn_source, body, body_vn, body_vn_source')
    .order('sort_order')
  if (error) return NextResponse.json({ error: 'Could not read the rules.' }, { status: 500 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const done: string[] = []
  const skipped: string[] = []
  const failed: { rule: string; why: string }[] = []

  for (const r of rules || []) {
    if (only && r.id !== only) continue
    // Human work is never overwritten, whatever else happens here.
    const bodyIsHuman = r.body_vn_source === 'human'
    const titleIsHuman = r.title_vn_source === 'human'
    if (bodyIsHuman && titleIsHuman) { skipped.push(r.section_title); continue }

    const patch: Record<string, string> = {}
    try {
      if (!bodyIsHuman && r.body) {
        patch.body_vn = await translate(anthropic, r.body)
        patch.body_vn_source = 'machine'
      }
      if (!titleIsHuman && !r.section_title_vn && r.section_title) {
        patch.section_title_vn = await translate(anthropic, r.section_title)
        patch.title_vn_source = 'machine'
      }
    } catch (e) {
      // The most likely failure by far is an exhausted balance, and saying so
      // beats "translation failed" — one is a thing you can fix in a minute.
      const why = e instanceof Error ? e.message : 'unknown'
      failed.push({ rule: r.section_title, why: /credit balance|billing/i.test(why) ? 'the Anthropic balance is exhausted' : why.slice(0, 120) })
      continue
    }
    if (Object.keys(patch).length) {
      const { error: upErr } = await a.from('house_rules').update(patch).eq('id', r.id)
      if (upErr) failed.push({ rule: r.section_title, why: upErr.message.slice(0, 120) })
      else done.push(r.section_title)
    }
  }

  return NextResponse.json({
    translated: done, skipped, failed,
    summary: `${done.length} translated · ${skipped.length} left as written by a person${failed.length ? ` · ${failed.length} failed` : ''}`,
  })
}
