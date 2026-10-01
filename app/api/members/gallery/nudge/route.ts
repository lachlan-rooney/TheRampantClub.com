import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'
import { vnDateString } from '@/lib/datetime'
import { recordPrompt } from '@/lib/gallery/prompt'

// ASK THE PEOPLE WHO WERE THERE.
//
// The Event Gallery holds 14 contributions and every one is there because
// somebody thought of it unprompted. gallery_prompts was built to do the asking
// and had never held a row, because nothing asked. This is the thing that asks.
//
// ── IT ASKS ONE PERSON ABOUT ONE EVENING ──────────────────────────────────
// A member who was signed up to a fixture that has now finished, inside the
// last month, and who has not been asked about it. Most recent first, one at a
// time. A list of six things to photograph is a list nobody acts on.
//
// Attendance is the gate, not membership: the question "were you at this?" is
// only worth asking of somebody who was. Staff-added attendees recorded by NAME
// rather than by account (12 of the 21 sign-up rows) cannot be matched to a
// login and so are never asked — which is right. Guessing from a name typed at
// the desk would put a stranger's evening in somebody else's prompt.
//
// ── WHY A FIXTURE AND NOT ALWAYS AN EVENT ─────────────────────────────────
// The ask worth making is the FIRST photograph, before a gallery event exists.
// gallery_prompts could only key a dismissal to an existing event, so a prompt
// may now point at a fixture instead (db/gallery_nudge.sql). Where an event
// already exists for the fixture, the prompt points at that and the card says
// how many are already in.
//
// ── WHAT COUNTS AS AN ANSWER ──────────────────────────────────────────────
// 'dismissed' is written when the member says not this time. 'posted' is NOT
// written when they tap through — it is written when a contribution actually
// arrives (see app/api/members/events/[id]/media/route.ts), because the whole
// value of keeping which outcome it was is learning whether asking works, and a
// tap that led nowhere is not a photograph.
//
// The cost of that honesty: somebody who opens the upload screen and gives up is
// asked again next time. That is the correct outcome — the ask is still
// outstanding — and the thirty-day window stops it becoming a haunting.
//
// WRITES GO THROUGH HERE under the service role, like the rest of the social
// layer: gallery_prompts has no member INSERT policy by design.

export const dynamic = 'force-dynamic'

/** How far back to look. A fixture older than this is a memory, not a prompt. */
const DAYS = 30

const isMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || e.code === 'PGRST205' ||
          /does not exist|schema cache/i.test(e.message || ''))

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  // A staff login with no membership was not at the dinner as a guest of the
  // club, and the gallery's own routes already treat it as "The Club".
  if (!actor.memberNo) return NextResponse.json({ ask: null })

  const a = svc()
  const today = vnDateString()
  const from = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10)

  // WHAT THEY WERE SIGNED UP TO. Either column identifies them: the portal
  // writes user_id, the desk writes member_no, and the same person can appear
  // through either door.
  const { data: signups } = await a.from('fixture_signups')
    .select('fixture_id, user_id, member_no')
    .or(`user_id.eq.${actor.id},member_no.eq.${actor.memberNo}`)
  const fixtureIds = [...new Set((signups || []).map(s => s.fixture_id).filter(Boolean))] as string[]
  if (!fixtureIds.length) return NextResponse.json({ ask: null })

  // FINISHED, AND RECENT. `lt(today)` not `lte`: an event still running tonight
  // is not something to ask about photographs of.
  const { data: fixtures } = await a.from('fixtures')
    .select('id, title, type, date, location')
    .in('id', fixtureIds).gte('date', from).lt('date', today)
    .order('date', { ascending: false })
  if (!fixtures?.length) return NextResponse.json({ ask: null })

  const ids = fixtures.map(f => f.id)

  // The gallery events already opened for these fixtures, and how much is in
  // each — so the card can say "add yours" rather than "be the first".
  const { data: events } = await a.from('events')
    .select('id, fixture_id').in('fixture_id', ids).eq('status', 'visible')
  const eventFor = new Map((events || []).map(e => [e.fixture_id as string, e.id as string]))
  const eventIds = [...eventFor.values()]

  const [{ data: media }, prompted] = await Promise.all([
    eventIds.length
      ? a.from('event_media').select('event_id, submitted_by').in('event_id', eventIds).eq('status', 'visible')
      : Promise.resolve({ data: [] as { event_id: string; submitted_by: string | null }[] }),
    // ASKED ONCE. Tolerates the column being absent so the nudge stops asking
    // rather than erroring where db/gallery_nudge.sql has not run.
    a.from('gallery_prompts').select('event_id, fixture_id').eq('member', actor.id)
      .then(r => r, () => ({ data: null, error: { code: '42703' } } as never)),
  ])
  if (isMissing(prompted.error as { code?: string } | null)) return NextResponse.json({ ask: null, ready: false })

  const askedFixture = new Set((prompted.data || []).map(p => p.fixture_id).filter(Boolean))
  const askedEvent = new Set((prompted.data || []).map(p => p.event_id).filter(Boolean))
  const counts = new Map<string, number>()
  const minePosted = new Set<string>()
  for (const m of media || []) {
    counts.set(m.event_id, (counts.get(m.event_id) || 0) + 1)
    if (m.submitted_by === actor.id) minePosted.add(m.event_id)
  }

  for (const f of fixtures) {
    const eventId = eventFor.get(f.id) || null
    if (askedFixture.has(f.id)) continue
    if (eventId && askedEvent.has(eventId)) continue
    // Already contributed to this one — the ask is answered whether or not a
    // prompt row exists, which matters for the evenings that predate this.
    if (eventId && minePosted.has(eventId)) continue
    return NextResponse.json({
      ask: {
        fixture_id: f.id,
        event_id: eventId,
        title: f.title,
        type: f.type,
        date: f.date,
        location: f.location,
        already: eventId ? (counts.get(eventId) || 0) : 0,
      },
    })
  }
  return NextResponse.json({ ask: null })
}

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })

  const p = await req.json().catch(() => null)
  const fixtureId = typeof p?.fixture_id === 'string' ? p.fixture_id : null
  if (!fixtureId) return NextResponse.json({ error: 'Which event?' }, { status: 400 })
  const a = svc()

  // The fixture must be one they were actually signed up to. Without this,
  // anybody could dismiss — or open an event for — any fixture in the book.
  const { data: mine } = await a.from('fixture_signups').select('fixture_id')
    .eq('fixture_id', fixtureId).or(`user_id.eq.${actor.id},member_no.eq.${actor.memberNo}`).limit(1)
  if (!mine?.length) return NextResponse.json({ error: 'You were not down for that one.' }, { status: 403 })

  const { data: f } = await a.from('fixtures').select('id, title, type, date').eq('id', fixtureId).maybeSingle()
  if (!f) return NextResponse.json({ error: 'No such event.' }, { status: 404 })

  const { data: existing } = await a.from('events')
    .select('id').eq('fixture_id', fixtureId).eq('status', 'visible').maybeSingle()

  // ── NOT THIS TIME ───────────────────────────────────────────────────────
  // Recorded against the event where one exists, so the two surfaces agree on
  // what has been asked; against the fixture otherwise.
  if (p?.action === 'dismiss') {
    // Through recordPrompt, NOT an upsert: the unique indexes are partial and
    // Postgres refuses to infer a conflict target from one (42P10), which is
    // how the first version of this took the answer and threw it away.
    const ok = existing?.id
      ? await recordPrompt(a, { member: actor.id, eventId: existing.id }, 'dismissed')
      : await recordPrompt(a, { member: actor.id, fixtureId }, 'dismissed')
    if (!ok) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── YES ─────────────────────────────────────────────────────────────────
  // Find or open the gallery event and hand back where to go. NOTHING is
  // recorded here: 'posted' belongs to the arrival of a photograph, not to a
  // tap. See the note at the top of this file.
  if (p?.action === 'open') {
    if (existing?.id) return NextResponse.json({ ok: true, event_id: existing.id, created: false })

    const { data: prof } = await a.from('profiles').select('display_name').eq('id', actor.id).maybeSingle()
    // The fixture's own type maps onto a gallery category where the gallery has
    // one; everything else is a fixture, which is what it is.
    const category = CATEGORY_FOR[String(f.type)] || 'fixture'
    const ins = await a.from('events').insert({
      title: f.title, category, event_date: f.date, fixture_id: fixtureId,
      created_by: actor.id, creator_name: prof?.display_name || 'A member',
      source: 'member', status: 'visible',
    }).select('id').single()
    if (ins.error) return NextResponse.json({ error: 'Could not open the album.' }, { status: 500 })
    return NextResponse.json({ ok: true, event_id: ins.data.id, created: true })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}

// lib/fixtures' types against lib/gallery's categories. Only where they really
// are the same thing: a golf day is a fixture, a tasting is a tasting.
const CATEGORY_FOR: Record<string, string> = {
  dinner: 'dinner', tasting: 'tasting', social: 'social',
  golf: 'fixture', tennis: 'fixture', padel: 'fixture', hash: 'fixture',
}
