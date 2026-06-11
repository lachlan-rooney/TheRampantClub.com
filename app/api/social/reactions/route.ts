import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit } from '@/lib/social/server'

// Toggle a TRC-voice reaction (🥃 raise_glass · 🔖 noted · 🤝 join_me) on a feed
// item. Session identity; route-only (no member write policy). 🔖 noted on a
// whisky-referencing item ALSO saves that bottle to the member's list (and
// un-noting removes it — a clean toggle). Quiet: emits the spine event, NEVER a
// notification (no per-reaction ping).

export const dynamic = 'force-dynamic'
const REACTIONS = ['raise_glass', 'noted', 'join_me']
const TYPES = ['post', 'tasting_note']

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })

  const p = await req.json().catch(() => null)
  const item_type: unknown = p?.item_type
  const item_id: unknown = p?.item_id
  const reaction: unknown = p?.reaction
  if (typeof item_type !== 'string' || !TYPES.includes(item_type) || typeof item_id !== 'string' || typeof reaction !== 'string' || !REACTIONS.includes(reaction)) {
    return NextResponse.json({ error: 'Bad reaction.' }, { status: 400 })
  }

  const a = svc()
  // Verify the item is one the member can actually see in the feed (or their own).
  let whiskyId: string | null = null
  if (item_type === 'post') {
    const { data: post } = await a.from('posts').select('published, hidden, author').eq('id', item_id).maybeSingle()
    if (!post || ((!post.published || post.hidden) && post.author !== actor.id)) return NextResponse.json({ error: 'No such item.' }, { status: 404 })
  } else {
    const { data: note } = await a.from('tasting_notes').select('visibility, author, whisky_id').eq('id', item_id).maybeSingle()
    if (!note || (note.visibility !== 'snug' && note.author !== actor.id)) return NextResponse.json({ error: 'No such item.' }, { status: 404 })
    whiskyId = note.whisky_id
  }

  // Toggle.
  const { data: existing } = await a.from('reactions').select('id').eq('member', actor.id).eq('item_type', item_type).eq('item_id', item_id).eq('reaction', reaction).maybeSingle()
  let reacted: boolean
  if (existing) { await a.from('reactions').delete().eq('id', existing.id); reacted = false }
  else { await a.from('reactions').insert({ member: actor.id, item_type, item_id, reaction }); reacted = true }

  // 🔖 noted on a whisky-referencing item → save/unsave the bottle.
  let saved: boolean | null = null
  if (reaction === 'noted' && item_type === 'tasting_note' && whiskyId) {
    if (reacted) { await a.from('member_saved_whiskies').upsert({ member: actor.id, whisky_id: whiskyId }, { onConflict: 'member,whisky_id' }); saved = true }
    else { await a.from('member_saved_whiskies').delete().eq('member', actor.id).eq('whisky_id', whiskyId); saved = false }
  }

  await socialEmit(actor.sb, reacted ? 'reaction.added' : 'reaction.removed', item_type, item_id, { reaction })
  return NextResponse.json({ reacted, saved })
}
