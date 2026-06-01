import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// PATCH /api/admin/complaints/[id]  — change status / add resolution

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ALLOWED_STATUS = ['open', 'acknowledged', 'resolved', 'dismissed']

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const sbCookie = await createServerSupabaseClient()
  const { data: { user } } = await sbCookie.auth.getUser()
  const actor = user?.email || user?.id || 'unknown'

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (typeof body.status === 'string' && ALLOWED_STATUS.includes(body.status)) patch.status = body.status
  if (typeof body.resolution === 'string') patch.resolution = body.resolution.slice(0, 4000) || null
  if (Number.isInteger(body.severity) && (body.severity as number) >= 1 && (body.severity as number) <= 5) patch.severity = body.severity
  if (patch.status === 'resolved' || patch.status === 'dismissed') {
    patch.resolved_at = new Date().toISOString()
    patch.resolved_by = actor
  }
  if (patch.status === 'open' || patch.status === 'acknowledged') {
    patch.resolved_at = null
    patch.resolved_by = null
  }

  const sb = svc()
  const { error } = await sb.from('complaints').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
