import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { buildEntryPatch } from '../route'

// PATCH  /api/admin/calendar-entries/[id]  — edit a house entry
// DELETE /api/admin/calendar-entries/[id]  — remove one

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const { data, error } = await svc().from('calendar_entries').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { data: ets } = await svc().from('calendar_entry_tables').select('unit_id').eq('entry_id', id)
  return NextResponse.json({ entry: data, unit_ids: (ets || []).map(r => r.unit_id) })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { patch, error } = buildEntryPatch(body)
  if (error) return NextResponse.json({ error }, { status: 400 })

  // Sync table allocation when the edit includes it (replace the lot).
  const syncUnits = 'unit_ids' in body && Array.isArray(body.unit_ids)
  if (!patch || Object.keys(patch).length === 0) {
    if (!syncUnits) return NextResponse.json({ ok: true, no_changes: true })
  } else {
    patch.updated_at = new Date().toISOString()
    const { error: updErr } = await svc().from('calendar_entries').update(patch).eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  if (syncUnits) {
    const unit_ids = [...new Set((body.unit_ids as unknown[]).filter(x => typeof x === 'string') as string[])]
    await svc().from('calendar_entry_tables').delete().eq('entry_id', id)
    if (unit_ids.length) {
      const { error: tErr } = await svc().from('calendar_entry_tables').insert(unit_ids.map(unit_id => ({ entry_id: id, unit_id })))
      if (tErr) return NextResponse.json({ error: `Could not update table allocation: ${tErr.message}` }, { status: 500 })
    }
  }
  const { data } = await svc().from('calendar_entries').select('*').eq('id', id).maybeSingle()
  return NextResponse.json({ entry: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const { error } = await svc().from('calendar_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
