import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// Update / delete one press item (admin, service role).
export const dynamic = 'force-dynamic'

const TYPES = ['kit', 'release', 'mention']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const p = await req.json().catch(() => null)
  if (!p) return NextResponse.json({ error: 'Bad request.' }, { status: 400 })

  // Accept either a full edit payload or a partial (e.g. toggle is_published).
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof p.title === 'string') { if (!p.title.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 }); patch.title = p.title.trim() }
  if (TYPES.includes(p.type)) patch.type = p.type
  if ('outlet' in p) patch.outlet = p.outlet?.trim() || null
  if ('body' in p) patch.body = p.body?.trim() || null
  if ('link' in p) patch.link = p.link?.trim() || null
  if ('image_url' in p) patch.image_url = p.image_url?.trim() || null
  if ('published_at' in p) patch.published_at = p.published_at || null
  if ('is_published' in p) patch.is_published = !!p.is_published
  if (Number.isFinite(p.sort_order)) patch.sort_order = p.sort_order

  const upd = await svc().from('press_items').update(patch).eq('id', id).select('*').single()
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })
  return NextResponse.json({ item: upd.data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const { id } = await params
  const { error } = await svc().from('press_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
