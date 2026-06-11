import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// The Snug feed — UNION-AT-READ (decision A): published, non-hidden posts +
// snug-visibility tasting_notes, merged by time into one timeline. Each table
// stays single-purpose; a note edited in S2a auto-reflects (same row); no
// duplication. House posts render as "The Club" — never a staff name. Members only.

export const dynamic = 'force-dynamic'
const BUCKET = 'member-media'
const PAGE = 30

interface FeedItem {
  kind: string; item_type: string; id: string; created_at: string; author_name: string; is_own: boolean
  body?: string; note?: string; flavour_tags?: string[]; whisky_id?: string | null; whisky_name?: string
  photo_url: string | null
  my_reactions: string[]; reaction_summary?: { raise_glass: number; noted: number; join_me: number }
}

export async function GET(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ items: [], next: null })
  const before = new URL(req.url).searchParams.get('before')
  const a = svc()

  let pq = a.from('posts').select('id, author, author_kind, body, media_path, created_at')
    .eq('published', true).eq('hidden', false).order('created_at', { ascending: false }).limit(PAGE)
  let nq = a.from('tasting_notes').select('id, author, note, flavour_tags, media_path, created_at, whisky_id, whiskies(name)')
    .eq('visibility', 'snug').order('created_at', { ascending: false }).limit(PAGE)
  if (before) { pq = pq.lt('created_at', before); nq = nq.lt('created_at', before) }
  const [{ data: posts }, { data: notes }] = await Promise.all([pq, nq])

  // author display names (member posts + notes; house posts never show a name)
  const ids = new Set<string>()
  for (const p of posts || []) if (p.author_kind !== 'house' && p.author) ids.add(p.author)
  for (const n of notes || []) if (n.author) ids.add(n.author)
  const nameOf: Record<string, string> = {}
  if (ids.size) { const { data: profs } = await a.from('profiles').select('id, display_name').in('id', [...ids]); for (const p of profs || []) nameOf[p.id] = p.display_name || 'A member' }

  const sign = async (path: string | null) => {
    if (!path) return null
    const { data } = await a.storage.from(BUCKET).createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }

  const items: FeedItem[] = []
  for (const p of posts || []) {
    items.push({
      kind: p.author_kind === 'house' ? 'house_post' : 'member_post', item_type: 'post', id: p.id, created_at: p.created_at,
      author_name: p.author_kind === 'house' ? 'The Club' : (nameOf[p.author] || 'A member'),
      is_own: p.author === actor.id, body: p.body, photo_url: await sign(p.media_path), my_reactions: [],
    })
  }
  for (const n of notes || []) {
    const wname = Array.isArray(n.whiskies) ? n.whiskies[0]?.name : (n.whiskies as { name?: string } | null)?.name
    items.push({
      kind: 'tasting_note', item_type: 'tasting_note', id: n.id, created_at: n.created_at,
      author_name: nameOf[n.author] || 'A member', is_own: n.author === actor.id,
      note: n.note, flavour_tags: n.flavour_tags || [], whisky_id: n.whisky_id, whisky_name: wname || 'a whisky',
      photo_url: await sign(n.media_path), my_reactions: [],
    })
  }
  items.sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
  const page = items.slice(0, PAGE)

  // Reactions for this page — quiet: my OWN state on every item; the count summary
  // only on items I own (never a public tally to others).
  const pageIds = page.map(i => i.id)
  if (pageIds.length) {
    const { data: rx } = await a.from('reactions').select('member, item_type, item_id, reaction').in('item_id', pageIds)
    for (const it of page) {
      const forItem = (rx || []).filter(r => r.item_type === it.item_type && r.item_id === it.id)
      it.my_reactions = forItem.filter(r => r.member === actor.id).map(r => r.reaction)
      if (it.is_own) {
        const sum = { raise_glass: 0, noted: 0, join_me: 0 }
        for (const r of forItem) if (r.reaction in sum) sum[r.reaction as keyof typeof sum]++
        it.reaction_summary = sum
      }
    }
  }
  const next = page.length === PAGE ? page[page.length - 1].created_at : null
  return NextResponse.json({ items: page, next })
}
