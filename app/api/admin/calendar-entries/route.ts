import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// GET  /api/admin/calendar-entries[?from=&to=&space=]  — list house entries
// POST /api/admin/calendar-entries                      — create one
// Admin/service-role. Free-text house/non-member entries (see db/calendar_entries.sql).

export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const KINDS = ['closure', 'private_hire', 'supplier', 'tasting', 'other']
const VIS = ['member', 'staff']

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from'), to = searchParams.get('to'), space = searchParams.get('space')
  let q = svc().from('calendar_entries').select('*').order('entry_date').order('start_time', { ascending: true, nullsFirst: false })
  if (from) q = q.gte('entry_date', from)
  if (to) q = q.lte('entry_date', to)
  if (space) q = q.eq('space', space)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach occupied table names for display.
  const list = (data || []) as Record<string, unknown>[]
  const ids = list.map(e => e.id as string)
  if (ids.length) {
    const { data: ets } = await svc().from('calendar_entry_tables')
      .select('entry_id, space_tables(name, sort)').in('entry_id', ids)
    const byEntry = new Map<string, { name: string; sort: number }[]>()
    for (const row of (ets || []) as { entry_id: string; space_tables: { name: string; sort: number } | { name: string; sort: number }[] | null }[]) {
      const st = Array.isArray(row.space_tables) ? row.space_tables[0] : row.space_tables
      if (!st) continue
      const a = byEntry.get(row.entry_id) || []; a.push(st); byEntry.set(row.entry_id, a)
    }
    for (const e of list) e.tables = (byEntry.get(e.id as string) || []).sort((x, y) => x.sort - y.sort).map(x => x.name)
  }
  return NextResponse.json({ entries: list })
}

// Shared validation → a clean row patch (used by POST here + PATCH in [id]).
export function buildEntryPatch(body: Record<string, unknown>): { patch?: Record<string, unknown>; error?: string } {
  const patch: Record<string, unknown> = {}
  if ('title' in body) { const t = String(body.title || '').trim(); if (!t) return { error: 'title required' }; patch.title = t.slice(0, 200) }
  if ('description' in body) patch.description = body.description ? String(body.description).slice(0, 2000) : null
  if ('entry_date' in body) { const d = String(body.entry_date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: 'entry_date must be YYYY-MM-DD' }; patch.entry_date = d }
  if ('start_time' in body) patch.start_time = typeof body.start_time === 'string' && /^\d{2}:\d{2}/.test(body.start_time) ? body.start_time : null
  if ('end_time' in body) patch.end_time = typeof body.end_time === 'string' && /^\d{2}:\d{2}/.test(body.end_time) ? body.end_time : null
  if ('session_label' in body) patch.session_label = body.session_label ? String(body.session_label).slice(0, 20) : null
  if ('space' in body) patch.space = body.space ? String(body.space).trim().slice(0, 40) : null
  if ('kind' in body) patch.kind = KINDS.includes(String(body.kind)) ? body.kind : 'other'
  if ('visibility' in body) { if (!VIS.includes(String(body.visibility))) return { error: "visibility must be 'member' or 'staff'" }; patch.visibility = body.visibility }
  if ('blocks_space' in body) patch.blocks_space = !!body.blocks_space
  return { patch }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Required fields for a create.
  for (const req_ of ['title', 'entry_date', 'visibility']) if (!(req_ in body)) return NextResponse.json({ error: `${req_} required` }, { status: 400 })
  const { patch, error } = buildEntryPatch(body)
  if (error || !patch) return NextResponse.json({ error: error || 'invalid' }, { status: 400 })

  const { data, error: insErr } = await svc().from('calendar_entries')
    .insert({ kind: 'other', blocks_space: true, ...patch, created_by: actor })
    .select('*').single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Optional table allocation (which tables this entry occupies/blocks).
  const unit_ids = Array.isArray(body.unit_ids) ? [...new Set((body.unit_ids as unknown[]).filter(x => typeof x === 'string') as string[])] : []
  if (unit_ids.length) {
    const { error: tErr } = await svc().from('calendar_entry_tables').insert(unit_ids.map(unit_id => ({ entry_id: data.id, unit_id })))
    if (tErr) {
      await svc().from('calendar_entries').delete().eq('id', data.id)   // roll back so we don't leave a half-saved entry
      return NextResponse.json({ error: `Could not save table allocation: ${tErr.message}` }, { status: 500 })
    }
  }
  return NextResponse.json({ entry: data })
}
