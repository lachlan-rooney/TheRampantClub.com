import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'
import { rederiveAndPersist } from '@/lib/whisky/derive-taste'

// Edit / delete a member's OWN tasting note. Own-only (author = session uid;
// another member's note is untouchable). Both re-derive the palate (the flywheel
// reflects the change) and log to the spine. Route-only; no member UPDATE/DELETE
// policy exists.

export const dynamic = 'force-dynamic'
const VIS = ['private', 'snug']
const BUCKET = 'member-media'

async function ownNote(a: ReturnType<typeof svc>, id: string, uid: string) {
  const { data } = await a.from('tasting_notes').select('id, author, media_path').eq('id', id).maybeSingle()
  if (!data) return { error: 'No such note.', status: 404 as const }
  if (data.author !== uid) return { error: 'Not your note.', status: 403 as const }
  return { note: data }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })
  const { id } = await params
  const a = svc()
  const owned = await ownNote(a, id, actor.id)
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

  const p = await req.json().catch(() => null)
  if (!p) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if (typeof p.note === 'string') {
    const note = p.note.trim()
    if (note.length < 1 || note.length > 8000) return NextResponse.json({ error: 'Keep it between 1 and 8000 characters.' }, { status: 400 })
    patch.note = note
  }
  if (typeof p.visibility === 'string') {
    if (!VIS.includes(p.visibility)) return NextResponse.json({ error: 'Pick private or the Snug.' }, { status: 400 })
    patch.visibility = p.visibility
  }
  if (Array.isArray(p.flavour_tags)) patch.flavour_tags = p.flavour_tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 13)
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

  const { error } = await a.from('tasting_notes').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not update.' }, { status: 500 })
  await socialEmit(actor.sb, 'note.updated', 'tasting_note', id, {})
  try { await rederiveAndPersist(a, actor.memberNo) } catch { /* best-effort */ }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })
  const { id } = await params
  const a = svc()
  const owned = await ownNote(a, id, actor.id)
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

  if (owned.note.media_path) await a.storage.from(BUCKET).remove([owned.note.media_path])
  const { error } = await a.from('tasting_notes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  await socialEmit(actor.sb, 'note.deleted', 'tasting_note', id, {})
  try { await rederiveAndPersist(a, actor.memberNo) } catch { /* best-effort */ }
  return NextResponse.json({ ok: true })
}
