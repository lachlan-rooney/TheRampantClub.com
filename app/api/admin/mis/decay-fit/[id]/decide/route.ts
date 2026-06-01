import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/admin/mis/decay-fit/[id]/decide
// Body: { action: 'accept' | 'reject', note?: string }
//
// Delegates to the accept_decay_proposal / reject_decay_proposal RPCs so the
// supersede + promote + audit steps run inside a single Postgres transaction.
// Without the RPCs, a mid-way failure could leave a category with no active
// row (after supersede but before promote) or an unlogged scoring change
// (after promote but before audit). With them, the decision is all-or-nothing.
// The partial-unique index on (category) where status='active' is the final
// backstop: even if the RPC had a bug, the DB would reject a double-promote.
//
// Only proposals with status='proposed' can be decided on; the RPCs enforce
// that with a clear error, and the UI hides the controls for other statuses.

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  // Who's deciding — we want the email/uid for the audit row, not just "admin".
  const cookieClient = await createServerSupabaseClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  const decidedBy = user?.email || user?.id || 'admin'

  let body: { action?: string; note?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const action = body.action
  const note = body.note || null
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
  }

  const sb = svc()
  const fn = action === 'accept' ? 'accept_decay_proposal' : 'reject_decay_proposal'

  const { error } = await sb.rpc(fn, {
    p_proposal_id: id,
    p_decided_by:  decidedBy,
    p_note:        note,
  })

  if (error) {
    // The RPC raises with a readable message ("Cannot accept row with
    // status=…", "Proposal … not found"). Surface it as a 400 so the UI
    // shows the right reason rather than a generic 500.
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, action })
}
