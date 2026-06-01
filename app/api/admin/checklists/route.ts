import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { vnDateString } from '@/lib/datetime'
import { templateFor } from '@/lib/checklist-templates'

// GET /api/admin/checklists?date=YYYY-MM-DD
//   Returns { opening, closing } for the day. Falls back to template
//   items in their unchecked state if no row exists yet — so the page
//   can render immediately, then create the row on first tick via PATCH.
//
// GET /api/admin/checklists?from=YYYY-MM-DD&to=YYYY-MM-DD
//   Range list — used by the page's "recent days" strip.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface ChecklistItem {
  id: string
  label: string
  checked?: boolean
  name?: string | null
  ts?: string | null
}

function blankFor(kind: 'opening' | 'closing'): ChecklistItem[] {
  return templateFor(kind).map(t => ({ id: t.id, label: t.label, checked: false, name: null, ts: null }))
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  const sb = svc()

  // Range path — list mode for the recent-days strip.
  if (from && to) {
    const { data, error } = await sb.from('shift_checklists')
      .select('*')
      .gte('shift_date', from).lte('shift_date', to)
      .order('shift_date', { ascending: false })
      .order('kind')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ checklists: data || [] })
  }

  // Single-day path. Default to today.
  const date = searchParams.get('date') || vnDateString()

  const { data, error } = await sb.from('shift_checklists')
    .select('*')
    .eq('shift_date', date)
    .in('kind', ['opening', 'closing'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const opening = (data || []).find(r => r.kind === 'opening') || null
  const closing = (data || []).find(r => r.kind === 'closing') || null

  return NextResponse.json({
    date,
    opening: opening || { id: null, shift_date: date, kind: 'opening', items: blankFor('opening'), free_notes: null, submitted_by: null, submitted_at: null },
    closing: closing || { id: null, shift_date: date, kind: 'closing', items: blankFor('closing'), free_notes: null, submitted_by: null, submitted_at: null },
  })
}
