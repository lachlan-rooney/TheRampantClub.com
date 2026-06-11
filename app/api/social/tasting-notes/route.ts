import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'

// Member tasting notes — a member's own notes on a whisky (private), optionally
// shared to the Snug. Writes route-only (no member INSERT policy). Reads go through
// the SESSION client so RLS enforces visibility (own any · others' snug only);
// author names are then resolved service-side (profiles RLS blocks cross-member
// reads, but attribution is the point of a shared note).

export const dynamic = 'force-dynamic'
const VIS = ['private', 'snug']

export async function GET(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ notes: [] })
  const whiskyId = new URL(req.url).searchParams.get('whisky_id')
  if (!whiskyId) return NextResponse.json({ error: 'Which whisky?' }, { status: 400 })

  // RLS-filtered to own (any visibility) + others' snug.
  const { data: notes } = await actor.sb.from('tasting_notes')
    .select('id, author, note, flavour_tags, visibility, created_at')
    .eq('whisky_id', whiskyId).order('created_at', { ascending: false })

  const authorIds = [...new Set((notes || []).map(n => n.author))].filter(id => id !== actor.id)
  const nameOf: Record<string, string> = {}
  if (authorIds.length) {
    const { data: profs } = await svc().from('profiles').select('id, display_name').in('id', authorIds)
    for (const p of profs || []) nameOf[p.id] = p.display_name || 'A member'
  }
  return NextResponse.json({
    notes: (notes || []).map(n => ({
      id: n.id, note: n.note, flavour_tags: n.flavour_tags || [], visibility: n.visibility, created_at: n.created_at,
      is_own: n.author === actor.id, author_name: n.author === actor.id ? 'You' : (nameOf[n.author] || 'A member'),
    })),
  })
}

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.', reason: actor.isAdmin ? 'staff' : 'unlinked' }, { status: 403 })

  const p = await req.json().catch(() => null)
  const whiskyId: unknown = p?.whisky_id
  const raw: unknown = p?.note
  const visibility: unknown = p?.visibility ?? 'private'
  const tagsIn: unknown = p?.flavour_tags
  if (typeof whiskyId !== 'string' || typeof raw !== 'string') return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  const note = raw.trim()
  if (note.length < 1 || note.length > 8000) return NextResponse.json({ error: 'Keep it between 1 and 8000 characters.' }, { status: 400 })
  if (typeof visibility !== 'string' || !VIS.includes(visibility)) return NextResponse.json({ error: 'Pick private or the Snug.' }, { status: 400 })
  const tags = Array.isArray(tagsIn) ? tagsIn.filter((t): t is string => typeof t === 'string').slice(0, 13) : []

  const a = svc()
  const ins = await a.from('tasting_notes')
    .insert({ author: actor.id, whisky_id: whiskyId, note, flavour_tags: tags, visibility })
    .select('id').single()
  if (ins.error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  await socialEmit(actor.sb, 'note.logged', 'tasting_note', ins.data.id, { whisky_id: whiskyId, visibility })
  return NextResponse.json({ id: ins.data.id })
}
