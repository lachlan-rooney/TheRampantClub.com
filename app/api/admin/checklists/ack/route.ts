import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/checklists/ack
//
// Body: { shift_date, acknowledged_by }
//
// Records the opening team's read-receipt on the closing sheet for
// shift_date. This is the two-way seam: the closing team WROTE the
// handover note (which feeds MX Daily); the opening team CONFIRMS
// they read it. The receipt lives on the closing sheet's two ack
// columns — NOT inside the sealed items snapshot — so the seal's
// immutability rule is preserved (no change to what was checked /
// what was ticked / who signed).
//
// Idempotent: re-acknowledging overwrites only the timestamp + name
// (it's a current-state read receipt, not a log). If you want full
// history of who read it when, that'd be a separate table later.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const shift_date = typeof body.shift_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.shift_date)
    ? body.shift_date : null
  const acknowledged_by = typeof body.acknowledged_by === 'string' && body.acknowledged_by.trim()
    ? body.acknowledged_by.trim().slice(0, 100) : null

  if (!shift_date)      return NextResponse.json({ error: 'shift_date YYYY-MM-DD required' }, { status: 400 })
  if (!acknowledged_by) return NextResponse.json({ error: 'acknowledged_by required' }, { status: 400 })

  const sb = svc()

  // Verify the closing sheet exists AND is sealed — you can't acknowledge
  // a handover that was never written.
  const { data: row, error: lookupErr } = await sb
    .from('shift_checklists')
    .select('id, submitted_at')
    .eq('shift_date', shift_date).eq('kind', 'closing')
    .maybeSingle()
  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 })
  if (!row)      return NextResponse.json({ error: 'No closing sheet for that date.' }, { status: 404 })
  if (!row.submitted_at) return NextResponse.json({ error: 'That closing sheet was never sealed; no handover to acknowledge.' }, { status: 409 })

  const acknowledged_at = new Date().toISOString()
  const { error: updErr } = await sb
    .from('shift_checklists')
    .update({ handover_acknowledged_by: acknowledged_by, handover_acknowledged_at: acknowledged_at })
    .eq('id', row.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, acknowledged_by, acknowledged_at })
}
