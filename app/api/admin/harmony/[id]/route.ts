import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET    /api/admin/harmony/[id]  — single log + its extractions
// PATCH  /api/admin/harmony/[id]  — edit narrative or metadata
// DELETE /api/admin/harmony/[id]  — delete a draft (extractions cascade)

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_LABELS = ['early', 'evening', 'late', 'all-day']

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const sb = svc()
  const [{ data: log }, { data: extractions }] = await Promise.all([
    sb.from('harmony_logs_with_counts').select('*').eq('id', id).maybeSingle(),
    sb.from('harmony_extractions').select('*').eq('log_id', id).order('created_at', { ascending: true }),
  ])
  if (!log) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ log, extractions: extractions || [] })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.narrative === 'string')   patch.narrative   = body.narrative.slice(0, 200_000)
  if (typeof body.weather === 'string')     patch.weather     = body.weather.slice(0, 200) || null
  if (typeof body.room_state === 'string')  patch.room_state  = body.room_state.slice(0, 400) || null
  if (typeof body.shift_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.shift_date)) patch.shift_date = body.shift_date
  if (typeof body.shift_label === 'string' && ALLOWED_LABELS.includes(body.shift_label)) patch.shift_label = body.shift_label
  if (Number.isInteger(body.attendee_count) && (body.attendee_count as number) >= 0) patch.attendee_count = body.attendee_count

  const sb = svc()
  const { error } = await sb.from('harmony_logs').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const sb = svc()
  const { error } = await sb.from('harmony_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
