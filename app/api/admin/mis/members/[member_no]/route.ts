import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// Update an existing member's record (currently: tier). Admin-only, service role.
// The tier a prospect is converted with is only the default; this lets staff
// correct it afterward on the member record.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TIERS = ['Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary']
const STATUSES = ['Active', 'Provisional', 'Lapsed', 'Pending Signature']

export async function PATCH(req: Request, { params }: { params: Promise<{ member_no: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { member_no } = await params
  const p = await req.json().catch(() => null)
  if (!p) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  // NOTE: the members table has no updated_at column — don't set one.
  const patch: Record<string, unknown> = {}
  if ('tier' in p) {
    if (!TIERS.includes(p.tier)) return NextResponse.json({ error: 'Invalid tier.' }, { status: 400 })
    patch.tier = p.tier
  }
  if ('status' in p) {
    if (!STATUSES.includes(p.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
    patch.status = p.status
  }
  if ('join_date' in p) {
    if (p.join_date === null || p.join_date === '') patch.join_date = null
    else if (typeof p.join_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.join_date)) patch.join_date = p.join_date
    else return NextResponse.json({ error: 'Bad join date.' }, { status: 400 })
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

  const { data, error } = await svc().from('members').update(patch).eq('member_no', member_no).select('member_no, tier, status, join_date').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, member: data })
}
