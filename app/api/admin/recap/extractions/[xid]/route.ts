import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// PATCH /api/admin/recap/extractions/[xid]
//
// Lifecycle changes that don't apply to the live tables — used for reject,
// or for editing the payload before apply. POST to /apply on the parent
// log is what actually fans rows out.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_STATUS = ['pending', 'accepted', 'rejected']

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ xid: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { xid } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status)) {
    patch.status = body.status
    patch.reviewed_by = actor
    patch.reviewed_at = new Date().toISOString()
  }
  if (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)) {
    patch.payload = body.payload
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const sb = svc()
  // Only transition while still pending — once accepted/rejected/applied
  // the row is owned by the apply flow. `.select()` returns the rows that
  // actually changed so we can distinguish "no-op" from "ok".
  const { data, error } = await sb
    .from('harmony_extractions')
    .update(patch)
    .eq('id', xid)
    .eq('status', 'pending')
    .select('id, status')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'extraction is no longer pending — refresh to see current state' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
