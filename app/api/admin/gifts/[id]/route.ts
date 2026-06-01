import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { OCCASIONS, CATEGORIES } from '@/lib/gifting'

// PATCH  /api/admin/gifts/[id]   — edit a gift entry
// DELETE /api/admin/gifts/[id]   — remove the row (also unlinks photo)

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.gift_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.gift_date)) patch.gift_date = body.gift_date
  if (typeof body.occasion === 'string' && (OCCASIONS as readonly string[]).includes(body.occasion)) patch.occasion = body.occasion
  if ('category' in body) {
    patch.category = typeof body.category === 'string' && (CATEGORIES as readonly string[]).includes(body.category) ? body.category : null
  }
  if (typeof body.description === 'string')    patch.description    = body.description.slice(0, 2000)
  if (typeof body.source === 'string')         patch.source         = body.source.slice(0, 200) || null
  if (typeof body.expected_value === 'string') patch.expected_value = body.expected_value.slice(0, 2000) || null
  if (typeof body.notes === 'string')          patch.notes          = body.notes.slice(0, 2000) || null
  if (typeof body.photo_url === 'string')      patch.photo_url      = body.photo_url.slice(0, 400) || null
  if ('cost_vnd' in body) {
    const n = Number(body.cost_vnd)
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'cost_vnd must be non-negative' }, { status: 400 })
    patch.cost_vnd = Math.round(n)
  }

  const sb = svc()
  const { data, error } = await sb.from('gifts').update(patch).eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'gift not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sb = svc()
  // Best-effort photo unlink before deleting the row. If the photo URL
  // points into our gift-photos bucket, remove it.
  const { data: existing } = await sb.from('gifts').select('photo_url').eq('id', id).maybeSingle()
  if (existing?.photo_url) {
    try {
      const path = extractBucketPath(existing.photo_url)
      if (path) await sb.storage.from('gift-photos').remove([path])
    } catch { /* best-effort */ }
  }

  const { error } = await sb.from('gifts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function extractBucketPath(url: string): string | null {
  // Storage public URL pattern:  .../storage/v1/object/public/gift-photos/<path>
  // Signed URL pattern:          .../storage/v1/object/sign/gift-photos/<path>?token=…
  // We strip any query string before regex so the trailing token doesn't
  // become part of the captured path (the Supabase Storage remove() call
  // silently fails on a path with `?token=` appended).
  const clean = url.split('?')[0]
  const m = clean.match(/gift-photos\/(.+)$/)
  return m ? m[1] : (clean.startsWith('http') ? null : clean)
}
