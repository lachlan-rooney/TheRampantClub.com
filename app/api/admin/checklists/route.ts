import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { vnDateString } from '@/lib/datetime'
import { fallbackTemplateFor, snapshotItems, type ChecklistTemplateItem, type SheetItemState } from '@/lib/checklist-templates'

// GET /api/admin/checklists?date=YYYY-MM-DD
//   Returns { date, opening, closing } for the day. For each kind, if a
//   row exists it is returned verbatim (the SEALED OR IN-PROGRESS
//   snapshot). If no row exists yet, a blank snapshot is constructed
//   from the current DB template — so the page can render immediately,
//   and the row gets persisted on first tick via the upsert endpoint.
//
//   This is the decoupling seam: once a row exists, this endpoint never
//   re-fetches the template. The sheet OWNS its items from the moment
//   the first tick lands.
//
// GET /api/admin/checklists?from=YYYY-MM-DD&to=YYYY-MM-DD
//   Range list — used by the page's history strip.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Kind = 'opening' | 'closing'

interface TemplateLookup {
  items: ChecklistTemplateItem[]
  version_at: string
}

async function getTemplate(kind: Kind): Promise<TemplateLookup> {
  const sb = svc()
  try {
    const { data, error } = await sb
      .from('checklist_templates')
      .select('items, updated_at')
      .eq('kind', kind)
      .maybeSingle()
    if (error || !data) throw error || new Error('no row')
    return {
      items: (data.items as ChecklistTemplateItem[]) || [],
      version_at: data.updated_at,
    }
  } catch {
    return { items: fallbackTemplateFor(kind), version_at: new Date(0).toISOString() }
  }
}

interface BlankSheet {
  id: null
  shift_date: string
  kind: Kind
  items: SheetItemState[]
  item_values: Record<string, string>
  free_notes: string | null
  submitted_by: null
  submitted_at: null
  template_version_at: string
}

function buildBlankSheet(date: string, kind: Kind, template: TemplateLookup): BlankSheet {
  return {
    id: null,
    shift_date: date,
    kind,
    items: snapshotItems(template.items),
    item_values: {},
    free_notes: null,
    submitted_by: null,
    submitted_at: null,
    template_version_at: template.version_at,
  }
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  const sb = svc()

  // Range path — list mode for the history strip.
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

  // Templates are fetched only for kinds without an existing row. Once a
  // sheet exists for the day, the template is irrelevant — that sheet
  // owns its snapshot.
  const [openingTpl, closingTpl] = await Promise.all([
    opening ? Promise.resolve(null) : getTemplate('opening'),
    closing ? Promise.resolve(null) : getTemplate('closing'),
  ])

  return NextResponse.json({
    date,
    opening: opening || buildBlankSheet(date, 'opening', openingTpl!),
    closing: closing || buildBlankSheet(date, 'closing', closingTpl!),
  })
}
