import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/whiskies/stocktake
//   Body: { started_at, summary: [...] }
//   Records a completed stocktake session. The page still downloads the
//   CSV report on finish — this endpoint persists the session header
//   (when, who, how many reviewed, what changed) so /admin/whisky can
//   show recent stocktakes without a separate report archive.
//
// GET /api/admin/whiskies/stocktake?limit=N
//   Returns the latest N sessions, newest first. Default 20. Used by
//   the history panel.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface SummaryEntry {
  id: string
  name: string
  fill_before: number | null
  fill_after: number
  changed: boolean
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const finished_by_email = user?.email ?? null

  let body: { started_at?: unknown; summary?: unknown; finished_by?: unknown; total_catalogue_count?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const started_at = typeof body.started_at === 'string' ? body.started_at : new Date().toISOString()
  const finished_by = typeof body.finished_by === 'string' && body.finished_by.trim()
    ? body.finished_by.trim().slice(0, 100) : null
  const total_catalogue_count = Number.isFinite(Number(body.total_catalogue_count))
    ? Math.max(0, Math.floor(Number(body.total_catalogue_count))) : 0

  if (!Array.isArray(body.summary)) {
    return NextResponse.json({ error: 'summary array required' }, { status: 400 })
  }
  if (body.summary.length > 2000) {
    return NextResponse.json({ error: 'summary too long (max 2000 entries)' }, { status: 400 })
  }

  const summary: SummaryEntry[] = []
  for (const raw of body.summary as unknown[]) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const id   = typeof r.id   === 'string' ? r.id.slice(0, 60) : ''
    const name = typeof r.name === 'string' ? r.name.slice(0, 240) : ''
    if (!id || !name) continue
    const fillBeforeRaw = r.fill_before
    const fill_before: number | null =
      fillBeforeRaw == null || fillBeforeRaw === ''
        ? null
        : (Number.isFinite(Number(fillBeforeRaw)) ? Math.max(0, Math.min(100, Math.round(Number(fillBeforeRaw)))) : null)
    const fill_after_raw = Number(r.fill_after)
    const fill_after = Number.isFinite(fill_after_raw)
      ? Math.max(0, Math.min(100, Math.round(fill_after_raw)))
      : 0
    summary.push({ id, name, fill_before, fill_after, changed: !!r.changed })
  }

  const reviewed_count  = summary.length
  const changed_count   = summary.filter(s => s.changed).length
  const unchanged_count = reviewed_count - changed_count

  const sb = svc()
  const { data, error } = await sb.from('whisky_stocktake_sessions').insert({
    started_at,
    finished_by,
    finished_by_email,
    reviewed_count,
    changed_count,
    unchanged_count,
    total_catalogue_count,
    summary,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, session: data })
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || 20)))
  const sb = svc()
  const { data, error } = await sb
    .from('whisky_stocktake_sessions')
    .select('id, started_at, finished_at, finished_by, finished_by_email, reviewed_count, changed_count, unchanged_count, total_catalogue_count')
    .order('finished_at', { ascending: false })
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data || [] })
}
