import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { CLOSING_HANDOVER_ITEM_ID, type SheetItemState } from '@/lib/checklist-templates'

// POST /api/admin/checklists/upsert
//
// Body: {
//   shift_date, kind,
//   items,                 -- the SNAPSHOTTED items array (richer shape:
//                             id, label_en, label_vn?, type, zone,
//                             required, sort_order, checked, name, ts)
//   item_values?,          -- map of itemId -> string value for text items
//   free_notes?,           -- legacy free-form notes (still used to seed
//                             MX Daily for handover; CLOSING sheets ALSO
//                             write handover-note's text value into this
//                             column denormalised so the MX Daily seam
//                             stays untouched)
//   submit?: boolean,
//   submitted_by?
//   template_version_at?   -- only honoured on FIRST write (when row doesn't exist)
// }
//
// Server validation:
//   - sheet cannot be modified after submitted_at (sealed = immutable)
//   - on submit, ALL required items must be satisfied:
//       checkbox required: checked === true
//       text required:     item_values[id] non-empty (or, for the
//                          legacy handover-note id, free_notes non-empty)

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_KINDS = ['opening', 'closing'] as const
type Kind = typeof ALLOWED_KINDS[number]

function sanitiseItems(items: unknown): SheetItemState[] {
  if (!Array.isArray(items)) return []
  return items.map((raw): SheetItemState | null => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id.slice(0, 60) : ''
    if (!id) return null
    const label    = typeof r.label    === 'string' ? r.label.slice(0, 240)    : undefined
    const label_en = typeof r.label_en === 'string' ? r.label_en.slice(0, 240) : undefined
    const label_vn = typeof r.label_vn === 'string' ? r.label_vn.slice(0, 240) : null
    const type = r.type === 'text' ? 'text' : 'checkbox'
    const zone = typeof r.zone === 'string' ? r.zone.slice(0, 80) : undefined
    const required   = !!r.required
    const sort_order = Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0
    const placeholder = typeof r.placeholder === 'string' ? r.placeholder.slice(0, 240) : undefined
    // We accept a missing label_en when label is present (legacy rows).
    if (!label && !label_en) return null
    return {
      id,
      label: label ?? label_en,
      label_en: label_en ?? label,
      label_vn: label_vn || null,
      type, zone, required, sort_order, placeholder,
      checked: !!r.checked,
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 100) : null,
      ts:   typeof r.ts   === 'string' && r.ts.trim()   ? r.ts.trim().slice(0, 40)    : null,
    }
  }).filter((x): x is SheetItemState => x !== null)
}

function sanitiseItemValues(values: unknown): Record<string, string> {
  if (!values || typeof values !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (typeof v !== 'string') continue
    const key = k.slice(0, 60).trim()
    if (!key) continue
    out[key] = v.slice(0, 4000)
  }
  return out
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const shift_date = typeof body.shift_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.shift_date)
    ? body.shift_date : null
  const kind = ALLOWED_KINDS.includes(body.kind as Kind) ? (body.kind as Kind) : null
  if (!shift_date) return NextResponse.json({ error: 'shift_date YYYY-MM-DD required' }, { status: 400 })
  if (!kind)       return NextResponse.json({ error: "kind must be 'opening' or 'closing'" }, { status: 400 })

  const items       = sanitiseItems(body.items)
  const item_values = sanitiseItemValues(body.item_values)
  const submit      = !!body.submit
  const submittedName = typeof body.submitted_by === 'string' && body.submitted_by.trim()
    ? body.submitted_by.trim().slice(0, 100) : null

  // Closing handover seam — keep the existing free_notes column in sync
  // with the handover-note text value so MX Daily reads it without
  // needing to know about item_values. The seam: if free_notes is
  // explicitly sent, use it; otherwise derive it from the handover-note
  // item value (closing only).
  let free_notes: string | null | undefined
  if (typeof body.free_notes === 'string') {
    free_notes = body.free_notes.slice(0, 4000) || null
  } else if (kind === 'closing' && item_values[CLOSING_HANDOVER_ITEM_ID] != null) {
    free_notes = item_values[CLOSING_HANDOVER_ITEM_ID] || null
  }

  const sb = svc()

  // Existing row — confirm it isn't sealed before we accept a write.
  const { data: existing } = await sb
    .from('shift_checklists')
    .select('id, items, item_values, submitted_at, template_version_at')
    .eq('shift_date', shift_date).eq('kind', kind)
    .maybeSingle()

  if (existing?.submitted_at) {
    return NextResponse.json({ error: 'Sheet already sealed; edits not permitted.' }, { status: 409 })
  }

  // Server-side checks before sealing. The client also gates these, but the
  // server is the source of truth.
  let sealName = submittedName
  if (submit) {
    // If a roster signer + PIN are supplied, VERIFY the PIN server-side and take
    // the signer's name from the verified team member — so a permanent seal
    // can't be forged by posting an arbitrary submitted_by. (The no-roster
    // fallback still seals on a name alone.)
    const signerId = typeof body.signer_id === 'string' ? body.signer_id.trim() : ''
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (signerId || pin) {
      if (!signerId || !pin) return NextResponse.json({ error: 'PIN required to sign.' }, { status: 400 })
      const { data: verifiedId } = await sb.rpc('kiosk_verify_pin', { p_team_member: signerId, p_pin: pin })
      if (!verifiedId) return NextResponse.json({ error: 'Wrong PIN.' }, { status: 401 })
      const { data: tm } = await sb.from('team_members').select('display_name').eq('id', verifiedId as string).maybeSingle()
      sealName = tm?.display_name?.slice(0, 100) || submittedName
    }
    if (!sealName) return NextResponse.json({ error: 'submitted_by required when submitting' }, { status: 400 })
    const missing: string[] = []
    for (const it of items) {
      if (!it.required) continue
      if (it.type === 'text') {
        const val = it.id === CLOSING_HANDOVER_ITEM_ID
          ? (item_values[it.id] || free_notes || '')
          : (item_values[it.id] || '')
        if (!val.trim()) missing.push(it.label_en || it.label || it.id)
      } else {
        if (!it.checked) missing.push(it.label_en || it.label || it.id)
      }
    }
    if (missing.length > 0) {
      return NextResponse.json({
        error: 'Required items not yet completed',
        missing,
      }, { status: 400 })
    }
  }

  const payload: Record<string, unknown> = {
    shift_date, kind, items, item_values,
    updated_at: new Date().toISOString(),
  }
  if (free_notes !== undefined) payload.free_notes = free_notes
  if (!existing && body.template_version_at && typeof body.template_version_at === 'string') {
    payload.template_version_at = body.template_version_at
  }
  if (submit) {
    payload.submitted_by = sealName
    payload.submitted_at = new Date().toISOString()
  }

  const { data, error } = await sb.from('shift_checklists')
    .upsert(payload, { onConflict: 'shift_date,kind' })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, checklist: data })
}
