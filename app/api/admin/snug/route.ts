import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'

// Staff Snug surface: GET a moderation feed (recent posts INCLUDING hidden, + snug
// notes), POST a moderation action. Admin-gated.
//   hide/unhide → posts.hidden (the post leaves/returns to the member feed; the
//                 member is NOT notified — it just goes quiet; the spine holds it).
//   unsnug      → a tasting note's visibility back to 'private' (gentlest: the
//                 member keeps their note, it simply leaves the Snug).

export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()

  const { data: posts } = await a.from('posts').select('id, author, author_kind, body, hidden, created_at').order('created_at', { ascending: false }).limit(40)
  const { data: notes } = await a.from('tasting_notes').select('id, author, note, created_at, whiskies(name)').eq('visibility', 'snug').order('created_at', { ascending: false }).limit(40)

  const ids = new Set<string>()
  for (const p of posts || []) if (p.author_kind !== 'house' && p.author) ids.add(p.author)
  for (const n of notes || []) if (n.author) ids.add(n.author)
  const nameOf: Record<string, string> = {}
  if (ids.size) { const { data: profs } = await a.from('profiles').select('id, display_name').in('id', [...ids]); for (const p of profs || []) nameOf[p.id] = p.display_name || 'A member' }

  const items = [
    ...(posts || []).map(p => ({
      item_type: 'post', id: p.id, created_at: p.created_at, hidden: p.hidden,
      kind: p.author_kind === 'house' ? 'house_post' : 'member_post',
      author_name: p.author_kind === 'house' ? 'The Club' : (nameOf[p.author] || 'A member'),
      preview: (p.body || '').slice(0, 160),
    })),
    ...(notes || []).map(n => {
      const wname = Array.isArray(n.whiskies) ? n.whiskies[0]?.name : (n.whiskies as { name?: string } | null)?.name
      return { item_type: 'tasting_note', id: n.id, created_at: n.created_at, hidden: false, kind: 'tasting_note', author_name: nameOf[n.author] || 'A member', preview: `${wname || 'a whisky'} — ${(n.note || '').slice(0, 130)}` }
    }),
  ].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())

  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const p = await req.json().catch(() => null)
  const action: unknown = p?.action
  const itemId: unknown = p?.item_id
  if (typeof itemId !== 'string' || (action !== 'hide' && action !== 'unhide' && action !== 'unsnug')) {
    return NextResponse.json({ error: 'Bad action.' }, { status: 400 })
  }
  const a = svc()

  if (action === 'unsnug') {
    const { error } = await a.from('tasting_notes').update({ visibility: 'private' }).eq('id', itemId).eq('visibility', 'snug')
    if (error) return NextResponse.json({ error: 'Could not update.' }, { status: 500 })
    await socialEmit(actor.sb, 'note.unsnugged', 'tasting_note', itemId, {})
    return NextResponse.json({ ok: true })
  }

  const hidden = action === 'hide'
  const { error } = await a.from('posts').update({ hidden, hidden_by: hidden ? actor.id : null, hidden_at: hidden ? new Date().toISOString() : null }).eq('id', itemId)
  if (error) return NextResponse.json({ error: 'Could not update.' }, { status: 500 })
  await socialEmit(actor.sb, hidden ? 'post.hidden' : 'post.unhidden', 'post', itemId, {})
  return NextResponse.json({ ok: true })
}
