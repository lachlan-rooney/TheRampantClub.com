import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// PATCH /api/admin/whiskies/fill?id=<whisky_id>
//        body: { fill_pct: number 0..100, note?: string }
//
// Atomic-ish update: writes the new fill to the whisky row AND logs a
// history entry stamped with the admin's uid + email. previous_fill_pct
// is captured BEFORE the write so the delta is computed against the true
// prior value, not whatever the client thought it was.
//
// GET /api/admin/whiskies/fill
//        ?id=<whisky_id>  -> history rows for one whisky (newest first)
//        (no id)          -> all history rows (newest first, capped 1000)
// Used by the trend graph + per-row sparklines on /admin/whisky.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface FillHistoryRow {
  id: string
  whisky_id: string
  fill_pct: number
  previous_fill_pct: number | null
  updated_by: string | null
  updated_by_email: string | null
  note: string | null
  created_at: string
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Pull the acting admin's identity from the session cookie — service-role
  // writes bypass RLS, so the AUDIT trail (who did this) lives in our
  // history columns, not in auth.uid() at the DB level.
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const updated_by       = user?.id ?? null
  const updated_by_email = user?.email ?? null

  const { searchParams } = new URL(req.url)
  const whisky_id = (searchParams.get('id') || '').trim()
  if (!whisky_id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: { fill_pct?: unknown; note?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const fill_pct_n = Number(body.fill_pct)
  if (!Number.isFinite(fill_pct_n)) return NextResponse.json({ error: 'fill_pct required' }, { status: 400 })
  const fill_pct = Math.max(0, Math.min(100, Math.round(fill_pct_n)))

  const note = typeof body.note === 'string' && body.note.trim().length > 0
    ? body.note.trim().slice(0, 500)
    : null

  const sb = svc()

  // Capture prior fill BEFORE updating, so the history delta is honest.
  const { data: priorRow, error: priorErr } = await sb
    .from('whiskies')
    .select('current_fill_pct')
    .eq('id', whisky_id)
    .single()
  if (priorErr) return NextResponse.json({ error: priorErr.message }, { status: 404 })
  const previous_fill_pct: number | null =
    priorRow?.current_fill_pct == null ? null : Number(priorRow.current_fill_pct)

  const nowIso = new Date().toISOString()

  const { error: updErr } = await sb
    .from('whiskies')
    .update({
      current_fill_pct:        fill_pct,
      last_fill_updated_at:    nowIso,
      last_fill_updated_by:    updated_by,
      last_fill_updated_email: updated_by_email,
    })
    .eq('id', whisky_id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const { data: history, error: histErr } = await sb
    .from('whisky_fill_history')
    .insert({
      whisky_id,
      fill_pct,
      previous_fill_pct,
      updated_by,
      updated_by_email,
      note,
    })
    .select()
    .single()
  if (histErr) {
    // The whisky update already succeeded; surface the history failure but
    // don't roll back (a missing history row is recoverable, an inconsistent
    // whisky row would mislead the bar).
    return NextResponse.json({
      ok: true,
      warning: `Fill updated but history write failed: ${histErr.message}`,
      whisky_id, fill_pct, previous_fill_pct,
    })
  }

  return NextResponse.json({
    ok: true,
    whisky_id, fill_pct, previous_fill_pct,
    last_fill_updated_at:    nowIso,
    last_fill_updated_email: updated_by_email,
    history: history as FillHistoryRow,
  })
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const whisky_id = searchParams.get('id')

  const sb = svc()
  let q = sb
    .from('whisky_fill_history')
    .select('id, whisky_id, fill_pct, previous_fill_pct, updated_by_email, note, created_at')
    .order('created_at', { ascending: false })

  if (whisky_id) {
    q = q.eq('whisky_id', whisky_id).limit(500)
  } else {
    q = q.limit(1000)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ history: data || [] })
}
