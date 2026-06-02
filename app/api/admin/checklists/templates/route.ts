import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { fallbackTemplateFor, type ChecklistTemplateItem } from '@/lib/checklist-templates'

// GET /api/admin/checklists/templates
//   Returns both templates: { opening, closing }, each as
//   { kind, items, updated_by, updated_at }. Falls back to the in-repo
//   seed if the DB table hasn't been migrated yet (so the page renders
//   immediately on a fresh checkout).
//
// PUT /api/admin/checklists/templates
//   Body: { kind, items }
//   Upserts the template for kind. Stamps updated_by from the session
//   email, updated_at from the server clock. Returns the saved row.
//   CHANGES AFFECT ONLY FUTURE SHEETS — sealed sheets snapshotted the
//   items at start-time and never re-read this row.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Kind = 'opening' | 'closing'
const ALLOWED_KINDS: Kind[] = ['opening', 'closing']

interface TemplateRow {
  kind: Kind
  items: ChecklistTemplateItem[]
  updated_by: string | null
  updated_at: string
  source: 'db' | 'fallback'
}

async function loadTemplate(kind: Kind): Promise<TemplateRow> {
  const sb = svc()
  try {
    const { data, error } = await sb
      .from('checklist_templates')
      .select('kind, items, updated_by, updated_at')
      .eq('kind', kind)
      .maybeSingle()
    if (error || !data) throw error || new Error('no row')
    return {
      kind,
      items: (data.items as ChecklistTemplateItem[]) || [],
      updated_by: data.updated_by ?? null,
      updated_at: data.updated_at,
      source: 'db',
    }
  } catch {
    // DB not migrated yet, or the row doesn't exist — fall back to the
    // in-repo seed so the page renders something usable. The "source"
    // flag lets the UI surface "running on fallback content" if useful.
    return {
      kind,
      items: fallbackTemplateFor(kind),
      updated_by: null,
      updated_at: new Date(0).toISOString(),
      source: 'fallback',
    }
  }
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [opening, closing] = await Promise.all([loadTemplate('opening'), loadTemplate('closing')])
  return NextResponse.json({ opening, closing })
}

// Sanitises a single template item from raw JSON. Returns null when the
// shape is so wrong the item can't be salvaged.
function sanitiseItem(raw: unknown): ChecklistTemplateItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id       = typeof r.id === 'string'       ? r.id.trim().slice(0, 60)       : ''
  const label_en = typeof r.label_en === 'string' ? r.label_en.trim().slice(0, 240) : ''
  if (!id || !label_en) return null
  const label_vn = typeof r.label_vn === 'string' && r.label_vn.trim()
    ? r.label_vn.trim().slice(0, 240) : null
  const typeRaw = r.type === 'text' ? 'text' : 'checkbox'
  const zone   = typeof r.zone === 'string'  ? r.zone.trim().slice(0, 80) : ''
  const required   = !!r.required
  const sort_order = Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0
  const placeholder = typeof r.placeholder === 'string' && r.placeholder.trim()
    ? r.placeholder.trim().slice(0, 240) : undefined
  return { id, label_en, label_vn, type: typeRaw, zone, required, sort_order, placeholder }
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const updated_by = user?.email ?? user?.id ?? null

  let body: { kind?: unknown; items?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const kind = ALLOWED_KINDS.includes(body.kind as Kind) ? (body.kind as Kind) : null
  if (!kind) return NextResponse.json({ error: "kind must be 'opening' or 'closing'" }, { status: 400 })
  if (!Array.isArray(body.items)) return NextResponse.json({ error: 'items must be an array' }, { status: 400 })
  if (body.items.length > 200)    return NextResponse.json({ error: 'too many items (200 max)' }, { status: 400 })

  const items = (body.items as unknown[])
    .map(sanitiseItem)
    .filter((x): x is ChecklistTemplateItem => x !== null)

  // ID uniqueness — IDs are the join key between template + sheet rows;
  // duplicates would silently break tick state on a future sheet.
  const seen = new Set<string>()
  for (const it of items) {
    if (seen.has(it.id)) return NextResponse.json({ error: `duplicate item id: "${it.id}"` }, { status: 400 })
    seen.add(it.id)
  }

  const sb = svc()
  const { data, error } = await sb
    .from('checklist_templates')
    .upsert({ kind, items, updated_by, updated_at: new Date().toISOString() }, { onConflict: 'kind' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, template: data })
}
