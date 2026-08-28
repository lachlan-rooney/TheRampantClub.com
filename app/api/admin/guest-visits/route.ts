import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// Log & list guest / non-member attendance (feeds the weekly report's
// "Who's been in" section). Admin-only, service-role.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await svc().from('guest_visits')
    .select('id, guest_name, host_member_no, visit_date, duration_min, party_size, note')
    .order('visit_date', { ascending: false }).order('created_at', { ascending: false }).limit(120)
  return NextResponse.json({ guests: data || [] })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  const p = await req.json().catch(() => null)
  const guest_name = typeof p?.guest_name === 'string' ? p.guest_name.trim() : ''
  if (guest_name.length < 1 || guest_name.length > 120) return NextResponse.json({ error: 'Guest name required.' }, { status: 400 })
  const visit_date = typeof p?.visit_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.visit_date) ? p.visit_date : null
  if (!visit_date) return NextResponse.json({ error: 'visit_date required (YYYY-MM-DD).' }, { status: 400 })
  const duration_min = Number.isFinite(Number(p?.duration_min)) && Number(p.duration_min) > 0 ? Math.min(1440, Math.round(Number(p.duration_min))) : null
  const party_size = Number.isFinite(Number(p?.party_size)) && Number(p.party_size) > 0 ? Math.min(100, Math.round(Number(p.party_size))) : 1
  const host_member_no = typeof p?.host_member_no === 'string' && p.host_member_no.trim() ? p.host_member_no.trim().slice(0, 12) : null
  const note = typeof p?.note === 'string' && p.note.trim() ? p.note.trim().slice(0, 400) : null

  const ins = await svc().from('guest_visits').insert({
    guest_name, visit_date, duration_min, party_size, host_member_no, note,
    logged_by: user?.email || user?.id || null,
  }).select('id').single()
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: ins.data.id })
}
