import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { OCCASIONS, CATEGORIES } from '@/lib/gifting'

// GET    /api/admin/gifts/[id]   — full gift row + edit history
// PATCH  /api/admin/gifts/[id]   — edit a gift entry (logs to gift_edits)
// DELETE /api/admin/gifts/[id]   — remove the row (also unlinks photo)

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Columns we copy into before_state / after_state for audit.
const AUDITED_COLUMNS = [
  'gift_date', 'occasion', 'category', 'description', 'source',
  'cost_vnd', 'expected_value', 'notes', 'photo_url',
] as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const sb = svc()
  const [{ data: gift }, { data: edits }] = await Promise.all([
    sb.from('gifts').select('*').eq('id', id).maybeSingle(),
    sb.from('gift_edits')
      .select('id, edited_by_email, before_state, after_state, changed_fields, created_at')
      .eq('gift_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(r => r, () => ({ data: [] as Record<string, unknown>[], error: null })),
  ])
  if (!gift) return NextResponse.json({ error: 'gift not found' }, { status: 404 })
  return NextResponse.json({ gift, edits: edits || [] })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  // Identity for the audit row.
  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const edited_by       = user?.id ?? null
  const edited_by_email = user?.email ?? null

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.gift_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.gift_date)) patch.gift_date = body.gift_date
  if (typeof body.occasion === 'string' && (OCCASIONS as readonly string[]).includes(body.occasion)) patch.occasion = body.occasion
  if ('category' in body) {
    patch.category = typeof body.category === 'string' && (CATEGORIES as readonly string[]).includes(body.category) ? body.category : null
  }
  if (typeof body.description === 'string')    patch.description    = body.description.slice(0, 2000)
  if (typeof body.source === 'string')         patch.source         = body.source.slice(0, 200) || null
  if (typeof body.expected_value === 'string') patch.expected_value = body.expected_value.slice(0, 2000) || null
  if (typeof body.notes === 'string')          patch.notes          = body.notes.slice(0, 2000) || null
  if (typeof body.photo_url === 'string')      patch.photo_url      = body.photo_url.slice(0, 400) || null
  if ('cost_vnd' in body) {
    const n = Number(body.cost_vnd)
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: 'cost_vnd must be non-negative' }, { status: 400 })
    patch.cost_vnd = Math.round(n)
  }

  const sb = svc()

  // Capture before-state BEFORE the update, so the audit row is honest
  // about what actually changed regardless of what the client thought
  // it was patching.
  const { data: prior } = await sb
    .from('gifts')
    .select(AUDITED_COLUMNS.join(', '))
    .eq('id', id)
    .maybeSingle() as { data: Record<string, unknown> | null }
  if (!prior) return NextResponse.json({ error: 'gift not found' }, { status: 404 })

  const { error } = await sb.from('gifts').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute the actual delta and log an audit row if any audited column
  // genuinely changed. A no-op PATCH (client sent fields with the same
  // values) does NOT log noise.
  const before_state: Record<string, unknown> = {}
  const after_state:  Record<string, unknown> = {}
  const changed_fields: string[] = []
  for (const col of AUDITED_COLUMNS) {
    if (!(col in patch)) continue
    const beforeVal = prior[col]
    const afterVal  = patch[col]
    if (beforeVal !== afterVal) {
      before_state[col] = beforeVal
      after_state[col]  = afterVal
      changed_fields.push(col)
    }
  }

  let activity_warning: string | null = null
  if (changed_fields.length > 0) {
    const { error: editErr } = await sb.from('gift_edits').insert({
      gift_id: id,
      edited_by,
      edited_by_email,
      before_state,
      after_state,
      changed_fields,
    })
    if (editErr) activity_warning = editErr.message
  }

  return NextResponse.json({ ok: true, changed_fields, activity_warning })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sb = svc()
  // Best-effort photo unlink before deleting the row. If the photo URL
  // points into our gift-photos bucket, remove it.
  const { data: existing } = await sb.from('gifts').select('photo_url').eq('id', id).maybeSingle()
  if (existing?.photo_url) {
    try {
      const path = extractBucketPath(existing.photo_url)
      if (path) await sb.storage.from('gift-photos').remove([path])
    } catch { /* best-effort */ }
  }

  const { error } = await sb.from('gifts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function extractBucketPath(url: string): string | null {
  const clean = url.split('?')[0]
  const m = clean.match(/gift-photos\/(.+)$/)
  return m ? m[1] : (clean.startsWith('http') ? null : clean)
}
