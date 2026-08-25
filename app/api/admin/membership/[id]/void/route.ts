import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// POST /api/admin/membership/:id/void { reason } → void a recorded payment.
// Never deletes: void_membership_payment flips it + its period to voided, writes
// a mirroring adjustment counter-entry, re-activates the prior period if any,
// and logs the audit event. Runs under the cookie client so the RPC's admin
// gate + attribution resolve.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const reason = body.reason ? String(body.reason).slice(0, 300) : null

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const { error } = await sb.rpc('void_membership_payment', {
    p_payment_id: id,
    p_reason: reason,
    p_staff_id: user?.id || null,
    p_staff_email: user?.email || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
