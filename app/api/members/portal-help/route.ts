import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getActor } from '@/lib/social/server'

// The Portal Guide's "ask a question" helper. Member-gated, tightly scoped: it
// only explains how to use the member portal / club features, and points
// anything personal or staff-actioned to the Concierge. Fast, cheap model.
export const dynamic = 'force-dynamic'

const PORTAL_MAP = `
WHISKY — Whisky Library (/members/whisky: browse/search 300+ bottles, each with a flavour radar; tap a bottle for its story + members' notes). Flavour Finder (/members/whisky/finder: tap the flavour wheel to say your mood — tap to add, tap again to raise 1–4 — then "Find my match" for your closest drams). Your Palate (/members/taste: your taste summary + radar, built from your notes). Your Notes (/members/notes: jot tasting notes on any dram). Your Journey (/members/journey: your whisky story over time).
WHAT'S ON — Events & Fixtures (/members/events: the upcoming calendar; filter by sport; "Sign me up" to join a fixture). Event Gallery (/members/gallery: photos/video from events; open an event then "Add photos" from your phone or paste a link). Notice Board (/members/notices: house announcements).
THE CLUB — Our Spaces (/members/spaces: the five floors + sports club). The Menus (/menus). The Snug (/members/snug: the club in conversation). The Concierge (/members/concierge: a private line to the Club — a real person replies).
COMMUNITY — The Members (/members/members: the directory, privacy is each member's choice). Introductions (/members/introductions: get introduced; both sides opt in). Messages (/members/messages).
YOU — My Membership (/members/profile: your card, number, locker, dram of choice, receipts). My Calendar (/members/calendar: your bookings + fixtures you've joined). Your Visits (/members/visits).
INFO — House Rules (/members/rules), Terms (/members/terms), Contact (/members/contact).
Getting around: the home page is a grid of photo tiles; the ≡ menu (top of any page) opens the full navigation. Members can't book rooms themselves — booking is staff-only, so ask the Concierge.
`

const SYSTEM = `You are the warm, concise in-app guide for The Rampant Club — a private whisky members' club in Saigon. You help members learn to use the member PORTAL and understand the club's features.

Answer in 2–4 short sentences, practical and specific — tell them exactly where to tap (use the section names above; you may mention the path in parentheses). If the member writes in Vietnamese, reply in Vietnamese; otherwise English.

Rules:
- ONLY answer questions about using the portal or the club's features. If it's off-topic (world news, coding, personal advice, etc.), gently decline and steer back to the club.
- For anything personal, account-specific, a booking, a special request, or something a human must do, tell them to use The Concierge (in The Club) — a real person replies.
- Never invent features that are not in the portal map. If you don't know, say so and suggest the Concierge.
- No legal, medical or financial advice.

PORTAL MAP:
${PORTAL_MAP}`

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo && !actor.isAdmin) return NextResponse.json({ error: 'Members only.' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Help is unavailable right now.' }, { status: 503 })

  const p = await req.json().catch(() => null)
  const question = typeof p?.question === 'string' ? p.question.trim().slice(0, 500) : ''
  if (question.length < 2) return NextResponse.json({ error: 'Ask a question first.' }, { status: 400 })

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: 'user', content: question }],
    })
    const answer = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('').trim()
    return NextResponse.json({ answer: answer || 'I’m not sure — the Concierge can help with that.' })
  } catch {
    return NextResponse.json({ error: 'Couldn’t answer just now — try the Concierge.' }, { status: 500 })
  }
}
