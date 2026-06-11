import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'

// Staff awareness of introductions FORMING — the gracious-host instinct. Admin reads
// the introductions base table (proven RLS), names resolved. Declines ARE shown
// (the audit trail). Staff see THAT connections form; they CANNOT read the DM
// contents (direct threads are closed to admin — proven, verified live).

export const dynamic = 'force-dynamic'

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.isAdmin) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })
  const a = svc()

  const { data: intros } = await a.from('introductions').select('id, requester, recipient, status, context, created_at, decided_at').order('created_at', { ascending: false }).limit(100)
  const ids = new Set<string>()
  for (const i of intros || []) { ids.add(i.requester); ids.add(i.recipient) }
  const nameOf: Record<string, string> = {}
  if (ids.size) { const { data: profs } = await a.from('profiles').select('id, display_name').in('id', [...ids]); for (const p of profs || []) nameOf[p.id] = p.display_name || 'A member' }

  return NextResponse.json({
    introductions: (intros || []).map(i => ({
      id: i.id, from_name: nameOf[i.requester] || 'A member', to_name: nameOf[i.recipient] || 'A member',
      status: i.status, context: i.context, created_at: i.created_at, decided_at: i.decided_at,
    })),
  })
}
