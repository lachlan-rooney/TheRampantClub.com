import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET  /api/admin/lockers          — full wall (lockers + member + counts)
// POST /api/admin/lockers          — bulk-seed empty lockers for a grid
//        body: { rows: number, cols: number, prefix?: string }
//
// Idempotent on locker_no — re-running won't duplicate.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()
  const [{ data: lockers, error: lErr }, { data: contents }] = await Promise.all([
    sb.from('lockers_with_member').select('*').order('position_row').order('position_col'),
    sb.from('locker_contents').select('*').order('added_at', { ascending: false }),
  ])
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
  return NextResponse.json({ lockers: lockers || [], contents: contents || [] })
}

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { rows?: unknown; cols?: unknown; prefix?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const rows = Number(body.rows)
  const cols = Number(body.cols)
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 20 || cols > 30) {
    return NextResponse.json({ error: 'rows and cols required (1..20 / 1..30)' }, { status: 400 })
  }
  const prefix = body.prefix ? String(body.prefix).slice(0, 4) : ''

  const sb = svc()
  const rowsArr = []
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const letter = ROW_LABELS[r - 1] || `R${r}`
      const locker_no = `${prefix}${letter}-${String(c).padStart(2, '0')}`
      rowsArr.push({
        locker_no,
        position_row: r,
        position_col: c,
        status: 'empty',
      })
    }
  }

  // Upsert (ignore conflict on existing locker_no — preserves any assignments).
  // `select` returns the actually-inserted rows so we can report a truthful count.
  const { data: created, error } = await sb
    .from('lockers')
    .upsert(rowsArr, { onConflict: 'locker_no', ignoreDuplicates: true })
    .select('locker_no')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    attempted: rowsArr.length,
    created: created?.length ?? 0,
    skipped: rowsArr.length - (created?.length ?? 0),
  })
}
