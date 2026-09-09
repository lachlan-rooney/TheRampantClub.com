import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/members/entries/attachments
//
// Which member-visible entries have a file, and what kind. Ids only — the FILE
// itself still goes through /api/entries/attachment/[id], which re-checks
// visibility. This route exists because entry_attachments has NO member-facing
// RLS policy, deliberately: the visibility rule lives in one place on the server
// rather than being restated as a policy that could drift from it.
//
// A staff-only entry's attachment is never listed here, so a member's page never
// even learns that a file exists.

export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const cookieSb = await createServerSupabaseClient()
  const { data: { user } } = await cookieSb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const sb = svc()
  const { data: rows } = await sb.from('entry_attachments')
    .select('id, entity_type, entity_id, verified_kind, filename')
  if (!rows?.length) return NextResponse.json({ attachments: {} })

  // Only entries a member may see. Fixtures are readable by any authenticated
  // user; calendar entries only when visibility = 'member'.
  const entryIds = rows.filter(r => r.entity_type === 'calendar_entry').map(r => r.entity_id)
  const visible = new Set<string>()
  if (entryIds.length) {
    const { data: ok } = await sb.from('calendar_entries')
      .select('id').in('id', entryIds).eq('visibility', 'member')
    for (const e of ok || []) visible.add(e.id)
  }

  const out: Record<string, { id: string; kind: string; filename: string }> = {}
  for (const r of rows) {
    if (r.entity_type === 'calendar_entry' && !visible.has(r.entity_id)) continue
    out[`${r.entity_type}:${r.entity_id}`] = { id: r.id, kind: r.verified_kind, filename: r.filename }
  }
  return NextResponse.json({ attachments: out })
}
