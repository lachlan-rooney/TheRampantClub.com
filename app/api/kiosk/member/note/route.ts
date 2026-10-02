import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { svc, memberSession, DEVICE_COOKIE } from '@/lib/kiosk/server'
import { rederiveAndPersist } from '@/lib/whisky/derive-taste'

// "WHAT ARE YOU DRINKING?" — a tasting note, logged at the moment it is true.
//
// THE CLUB HAS ZERO TASTING NOTES. Not few: none. Which is why every palate
// surface in the building is empty — the radar, the drift, the journey, the
// "members who share your palate" — all of them derive from notes, and nothing
// has ever asked for one at a moment when a member had a glass in their hand.
//
// The portal asks, on a page a member visits at home days later with nothing to
// taste. The tablet is standing next to the bottle. That is the whole argument
// for this route existing.
//
// ── IT CLOSES A LOOP THE REST OF THE SYSTEM IS WAITING ON ─────────────────
// A note carries the whisky's flavour families, so rederiveAndPersist rebuilds
// the member's taste vector on the spot: tap the dram you are drinking and the
// radar on the same screen fills in. That is also the honest reason to make this
// one tap rather than a form — the first note is the one that turns an empty
// shape into theirs, and nobody writes an essay standing up.
//
// ── WHY NOT /api/social/tasting-notes ─────────────────────────────────────
// That route authenticates with getActor() — a browser session. A member on a
// tablet has an OPAQUE kiosk session handle instead, exchanged server-side for a
// 60-second minted JWT that never reaches the device (lib/kiosk/server). The
// write is the same; only the proof of who is asking differs.
//
// ── WHAT IT WILL NOT TAKE ─────────────────────────────────────────────────
// No photo, no visibility, no tags. A camera on a shared bar-top tablet is a
// different conversation, and tasting notes have been PRIVATE ONLY since the
// Snug was stood down, so there is no visibility left to choose. The flavour
// tags come from the whisky, not from the member, which is what makes a one-tap
// note worth anything to the derivation.

export const dynamic = 'force-dynamic'

const MAX = 280
/** Per member, per hour. The portal's own ceiling is 60; this is a bar top with
 *  a three-minute idle logout, so a lower one is plenty and it is the shared
 *  device that makes a ceiling worth having at all. */
const HOURLY = 25

export async function POST(req: Request) {
  // memberSession() re-proves everything in Postgres on every call: the device
  // is still enrolled, the session is not ended, inside its TTL and its 90s
  // idle window, and belongs to THIS tablet. A handle lifted off the device is
  // refused there, not here.
  const session = await memberSession()
  if (!session) return NextResponse.json({ error: 'Session ended. Tap your card again.' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const whiskyId = typeof b?.whisky_id === 'string' ? b.whisky_id : ''
  if (!whiskyId) return NextResponse.json({ error: 'Which dram?' }, { status: 400 })
  const vn = b?.lang === 'vn'
  const typed = typeof b?.note === 'string' && b.note.trim() ? b.note.trim().slice(0, MAX) : null

  const a = svc()

  // ── tasting_notes.note IS NOT NULL ──────────────────────────────────────
  // So a wordless tap cannot be stored as nothing, and the first version of
  // this route 500'd on every single one. The answer is NOT to make the member
  // write something: what the system actually needs from a note is the WHISKY's
  // flavour families, and demanding prose from somebody standing up is how the
  // club ended with zero notes in the first place.
  //
  // It writes what truthfully happened instead — this dram, in this room,
  // tonight — in the member's own language, which reads properly in their notes
  // list rather than as a blank entry. A typed note replaces it entirely.
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  const { data: board } = token
    ? await a.rpc('kiosk_board', { p_device_token: token })
    : { data: null }
  const room = (Array.isArray(board) ? board[0] : board)?.room as string | undefined

  // It must be a real bottle, and one the club actually has. A note against an
  // arbitrary id would derive a palate from a whisky nobody poured.
  const { data: w } = await a.from('whiskies').select('id, name').eq('id', whiskyId).maybeSingle()
  if (!w) return NextResponse.json({ error: 'That is not on the shelf.' }, { status: 404 })

  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('tasting_notes')
    .select('id', { count: 'exact', head: true })
    .eq('author', session.profileId).gte('created_at', since)
  if ((count ?? 0) >= HOURLY) {
    return NextResponse.json({ error: 'That is a lot of drams in an hour. Have a word with the bar.' }, { status: 429 })
  }

  // ONE NOTE PER DRAM PER SITTING. A member tapping the same bottle twice in an
  // evening has not drunk it twice as much, and a double-counted family would
  // bend their palate towards whatever they tapped by accident.
  const { data: already } = await a.from('tasting_notes')
    .select('id').eq('author', session.profileId).eq('whisky_id', whiskyId)
    .gte('created_at', new Date(Date.now() - 6 * 3600_000).toISOString()).maybeSingle()
  if (already) {
    return NextResponse.json({ ok: true, already: true, name: w.name })
  }

  const fallback = room
    ? (vn ? `Đã uống tại ${room}.` : `Poured in ${room}.`)
    : (vn ? 'Đã uống tại câu lạc bộ.' : 'Poured at the club.')
  const note = typed || fallback

  const ins = await a.from('tasting_notes')
    .insert({ author: session.profileId, whisky_id: whiskyId, note, flavour_tags: [], visibility: 'private' })
    .select('id').single()
  if (ins.error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })

  // THE FLYWHEEL. Best-effort: the note is the record, and a palate that failed
  // to rebuild is rebuilt by the next note or by the derive script. Losing the
  // note because the derivation threw would be the wrong way round.
  let count_after: number | null = null
  try {
    const d = await rederiveAndPersist(a, session.memberNo)
    count_after = d?.source_count ?? null
  } catch { /* the note still saved */ }

  return NextResponse.json({ ok: true, id: ins.data.id, name: w.name, source_count: count_after })
}
