import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET    /api/admin/lockers/[locker_no]  — single locker + its contents
// PATCH  /api/admin/lockers/[locker_no]  — assign member, edit label/status/notes/position
// DELETE /api/admin/lockers/[locker_no]  — retire (sets status='retired', clears member)

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_STATUS = ['occupied', 'reserved', 'empty', 'retired']

export async function GET(_req: NextRequest, ctx: { params: Promise<{ locker_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { locker_no } = await ctx.params
  const sb = svc()
  const [{ data: locker }, { data: contents }] = await Promise.all([
    sb.from('lockers_with_member').select('*').eq('locker_no', locker_no).maybeSingle(),
    sb.from('locker_contents').select('*').eq('locker_no', locker_no).order('added_at', { ascending: false }),
  ])
  if (!locker) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ locker, contents: contents || [] })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ locker_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { locker_no } = await ctx.params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('member_no' in body) patch.member_no = body.member_no ? String(body.member_no).slice(0, 12) : null
  if (typeof body.label === 'string') patch.label = body.label.slice(0, 200) || null
  if (typeof body.label === 'object' && body.label === null) patch.label = null
  if (typeof body.notes === 'string') patch.notes = body.notes.slice(0, 1000) || null
  if (typeof body.notes === 'object' && body.notes === null) patch.notes = null
  if (typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status)) patch.status = body.status
  // Allow explicit null to unposition, or a positive integer to set.
  if ('position_row' in body) {
    if (body.position_row === null) patch.position_row = null
    else if (Number.isInteger(body.position_row) && (body.position_row as number) >= 1) patch.position_row = body.position_row
  }
  if ('position_col' in body) {
    if (body.position_col === null) patch.position_col = null
    else if (Number.isInteger(body.position_col) && (body.position_col as number) >= 1) patch.position_col = body.position_col
  }

  // Auto-status: if member_no is being set, default to 'occupied'; if cleared, default to 'empty'.
  if ('member_no' in body && !('status' in body)) {
    patch.status = body.member_no ? 'occupied' : 'empty'
  }

  const sb = svc()
  const { error } = await sb.from('lockers').update(patch).eq('locker_no', locker_no)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ locker_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { locker_no } = await ctx.params
  const sb = svc()
  const { error } = await sb.from('lockers').update({
    status: 'retired', member_no: null, updated_at: new Date().toISOString(),
  }).eq('locker_no', locker_no)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
