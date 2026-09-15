import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// Take someone off an event — a portal sign-up or a staff-added place alike.
// Admin-only, service role. Scoped to the fixture in the URL as well as the row
// id, so a stale page cannot remove a row from a different event.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; signupId: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, signupId } = await params
  const { data, error } = await svc().from('fixture_signups').delete()
    .eq('id', signupId).eq('fixture_id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Nothing deleted means it was already gone (a member withdrew, or another
  // admin removed it) — say so rather than report a removal that did not happen.
  if (!data?.length) return NextResponse.json({ error: 'That attendee was already removed.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
