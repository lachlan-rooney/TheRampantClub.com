import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/checklists/upsert
//
// Body: { shift_date, kind, items, free_notes?, submit?: boolean }
//
// Upserts the (shift_date, kind) row — saves the items array, the
// optional free_notes, and (if submit=true) the submitted_by/_at
// signature. Single endpoint so the client only does one round-trip
// when a tick happens or the sheet is locked.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_KINDS = ['opening', 'closing'] as const

interface ChecklistItem {
  id: string
  label: string
  checked: boolean
  name: string | null
  ts: string | null
}

function sanitize(items: unknown): ChecklistItem[] {
  if (!Array.isArray(items)) return []
  return items.map((raw): ChecklistItem | null => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const id    = typeof r.id === 'string'    ? r.id.slice(0, 60)    : ''
    const label = typeof r.label === 'string' ? r.label.slice(0, 200) : ''
    if (!id || !label) return null
    return {
      id, label,
      checked: !!r.checked,
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 100) : null,
      ts:   typeof r.ts === 'string'   && r.ts.trim()   ? r.ts.trim().slice(0, 40)    : null,
    }
  }).filter((x): x is ChecklistItem => x !== null)
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const shift_date = typeof body.shift_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.shift_date)
    ? body.shift_date : null
  const kind = typeof body.kind === 'string' && (ALLOWED_KINDS as readonly string[]).includes(body.kind)
    ? body.kind : null
  if (!shift_date) return NextResponse.json({ error: 'shift_date YYYY-MM-DD required' }, { status: 400 })
  if (!kind)       return NextResponse.json({ error: "kind must be 'opening' or 'closing'" }, { status: 400 })

  const items = sanitize(body.items)
  const free_notes = typeof body.free_notes === 'string' ? body.free_notes.slice(0, 4000) || null : undefined
  const submit = !!body.submit
  const submittedName = typeof body.submitted_by === 'string' && body.submitted_by.trim()
    ? body.submitted_by.trim().slice(0, 100) : null

  const payload: Record<string, unknown> = {
    shift_date, kind, items,
    updated_at: new Date().toISOString(),
  }
  if (free_notes !== undefined) payload.free_notes = free_notes
  if (submit) {
    if (!submittedName) return NextResponse.json({ error: 'submitted_by required when submitting' }, { status: 400 })
    payload.submitted_by = submittedName
    payload.submitted_at = new Date().toISOString()
  }

  const sb = svc()
  const { data, error } = await sb.from('shift_checklists')
    .upsert(payload, { onConflict: 'shift_date,kind' })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, checklist: data })
}
