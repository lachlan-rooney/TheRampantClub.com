import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Ops Hub — the single WRITE gateway. Every mutation that emits an activity
// event goes through here; reads stay client-side (browser Supabase + select-RLS).
//
// Why the SESSION client, not the service-role client the other admin routes
// use: the action RPCs stamp `actor = auth.uid()` and rely on per-user RLS for
// role enforcement. Service-role would null out auth.uid() and bypass RLS,
// defeating both. So we forward the call under the caller's JWT — the RPC does
// write + ops_emit_event in one transaction, as the user.
//
// The admin gate here is defense-in-depth for Phase 1 (only admins reach the
// Hub today). When team members get access later, relax this gate and let the
// RPC-level RLS govern — the spine and role rules are already in the DB.

export const dynamic = 'force-dynamic'

// Allowlist — only these DB functions are callable through the gateway.
const ALLOWED_ACTIONS = new Set([
  'ops_create_project',
  'ops_archive_project',
  'ops_create_column',
  'ops_rename_column',
  'ops_create_task',
  'ops_update_task',
  'ops_move_task',
  'ops_reorder_column',
  'ops_assign_task',
  'ops_delete_task',
  'ops_add_project_member',
  'ops_remove_project_member',
])

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { action?: unknown; args?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action
  if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  const args = body.args && typeof body.args === 'object' ? (body.args as Record<string, unknown>) : {}

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc(action, args)
  if (error) {
    // RLS denials and validation raises surface here — return the message.
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, data })
}
