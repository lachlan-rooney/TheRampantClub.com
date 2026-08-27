import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// Press items — admin write path via service role (so writes never depend on
// per-table RLS), gated on isAdmin. POST creates a press item.
export const dynamic = 'force-dynamic'

const TYPES = ['kit', 'release', 'mention']

export async function GET() {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { data, error } = await svc().from('press_items')
    .select('*')
    .order('type', { ascending: true })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const p = await req.json().catch(() => null)
  const title = typeof p?.title === 'string' ? p.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  const type = TYPES.includes(p?.type) ? p.type : 'release'

  const ins = await svc().from('press_items').insert({
    type,
    title,
    outlet: p?.outlet?.trim() || null,
    body: p?.body?.trim() || null,
    link: p?.link?.trim() || null,
    image_url: p?.image_url?.trim() || null,
    published_at: p?.published_at || null,
    is_published: p?.is_published ?? true,
    sort_order: Number.isFinite(p?.sort_order) ? p.sort_order : 0,
  }).select('*').single()
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
  return NextResponse.json({ item: ins.data })
}
