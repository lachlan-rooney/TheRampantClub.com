import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'

// Edit / delete a Snug post. Own-only — a member's own post, or a house post by
// any admin. Another member's post is untouchable (moderation is soft-hide, not
// delete; that lives in /api/admin/snug). Spine-logged.

export const dynamic = 'force-dynamic'
const BUCKET = 'member-media'

async function ownPost(a: ReturnType<typeof svc>, id: string, actor: { id: string; isAdmin: boolean }) {
  const { data } = await a.from('posts').select('id, author, author_kind, media_path').eq('id', id).maybeSingle()
  if (!data) return { error: 'No such post.', status: 404 as const }
  const allowed = data.author === actor.id || (actor.isAdmin && data.author_kind === 'house')
  if (!allowed) return { error: 'Not your post.', status: 403 as const }
  return { post: data }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  const a = svc()
  const owned = await ownPost(a, id, actor)
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

  const p = await req.json().catch(() => null)
  if (typeof p?.body !== 'string') return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  const body = p.body.trim()
  if (body.length < 1 || body.length > 8000) return NextResponse.json({ error: 'Keep it between 1 and 8000 characters.' }, { status: 400 })

  const { error } = await a.from('posts').update({ body }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not update.' }, { status: 500 })
  await socialEmit(actor.sb, 'post.updated', 'post', id, {})
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await params
  const a = svc()
  const owned = await ownPost(a, id, actor)
  if ('error' in owned) return NextResponse.json({ error: owned.error }, { status: owned.status })

  if (owned.post.media_path) await a.storage.from(BUCKET).remove([owned.post.media_path])
  await a.from('reactions').delete().eq('item_type', 'post').eq('item_id', id)   // tidy the reactions
  const { error } = await a.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  await socialEmit(actor.sb, 'post.deleted', 'post', id, {})
  return NextResponse.json({ ok: true })
}
