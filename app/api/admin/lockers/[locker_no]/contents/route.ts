import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// POST   /api/admin/lockers/[locker_no]/contents       — add bottle
// PATCH  /api/admin/lockers/[locker_no]/contents?id=…  — edit bottle (fill, notes, etc.)
// DELETE /api/admin/lockers/[locker_no]/contents?id=…  — remove bottle

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function clampFill(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return Math.max(0, Math.min(100, Math.round(n)))
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ locker_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { locker_no } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const bottle_name = String(body.bottle_name || '').trim()
  if (!bottle_name) return NextResponse.json({ error: 'bottle_name required' }, { status: 400 })

  const row: Record<string, unknown> = {
    locker_no,
    bottle_name: bottle_name.slice(0, 200),
    distillery: body.distillery ? String(body.distillery).slice(0, 200) : null,
    age:        Number.isInteger(body.age) ? body.age : (body.age ? Number(body.age) : null),
    abv:        body.abv != null && body.abv !== '' ? Number(body.abv) : null,
    fill_pct:   clampFill(body.fill_pct) ?? 100,
    opened_at:  body.opened_at ? String(body.opened_at).slice(0, 10) : null,
    notes:      body.notes ? String(body.notes).slice(0, 1000) : null,
  }

  const sb = svc()
  const { data, error } = await sb.from('locker_contents').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If the locker was empty, flip it to occupied.
  await sb.from('lockers')
    .update({ status: 'occupied', updated_at: new Date().toISOString() })
    .eq('locker_no', locker_no)
    .eq('status', 'empty')

  return NextResponse.json({ ok: true, content: data })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ locker_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { locker_no } = await ctx.params
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.bottle_name === 'string') patch.bottle_name = body.bottle_name.slice(0, 200)
  if ('distillery' in body) patch.distillery = body.distillery ? String(body.distillery).slice(0, 200) : null
  if ('age' in body) patch.age = body.age == null || body.age === '' ? null : Number(body.age)
  if ('abv' in body) patch.abv = body.abv == null || body.abv === '' ? null : Number(body.abv)
  if ('fill_pct' in body) {
    const f = clampFill(body.fill_pct)
    if (f != null) patch.fill_pct = f
  }
  if ('opened_at' in body) patch.opened_at = body.opened_at ? String(body.opened_at).slice(0, 10) : null
  if ('notes' in body) patch.notes = body.notes ? String(body.notes).slice(0, 1000) : null

  const sb = svc()
  const { error } = await sb.from('locker_contents').update(patch).eq('id', id).eq('locker_no', locker_no)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ locker_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { locker_no } = await ctx.params
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sb = svc()
  const { error } = await sb.from('locker_contents').delete().eq('id', id).eq('locker_no', locker_no)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
