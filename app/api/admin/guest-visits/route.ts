import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { signatureIsLive } from '@/lib/guests'

// Log & list guest / non-member attendance (feeds the weekly report's
// "Who's been in" section). Admin-only, service-role.
export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const BASE = 'id, guest_name, host_member_no, visit_date, duration_min, party_size, note'
// The door columns (db/guest_signin.sql). signature_data_url is deliberately NOT
// here: the list carries only whether a signature still exists, and the image is
// fetched per row from /[id]/signature, which applies the seven-day rule itself.
const DOOR = 'signed_in_at, signature_deleted_at, on_list, referred_reason, decision, decision_reason, decided_by_staff, decided_at, booking_id'

type Row = { id: string; guest_name: string; host_member_no: string | null; visit_date: string; duration_min: number | null; party_size: number; note: string | null
  signed_in_at?: string | null; signature_deleted_at?: string | null; on_list?: boolean | null; referred_reason?: string | null
  decision?: string | null; decision_reason?: string | null; decided_by_staff?: string | null; decided_at?: string | null; booking_id?: string | null }

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const a = svc()
  const full = await a.from('guest_visits').select(`${BASE}, ${DOOR}`)
    .order('visit_date', { ascending: false }).order('created_at', { ascending: false }).limit(200)
  // Before the SQL has run: the manual log, exactly as it was.
  if (full.error) {
    const { data } = await a.from('guest_visits').select(BASE)
      .order('visit_date', { ascending: false }).order('created_at', { ascending: false }).limit(120)
    return NextResponse.json({ guests: data || [], door_ready: false })
  }
  const rows = (full.data || []) as Row[]
  const staffIds = [...new Set(rows.map(r => r.decided_by_staff).filter((x): x is string => !!x))]
  const hostNos = [...new Set(rows.map(r => r.host_member_no).filter((x): x is string => !!x))]
  const [{ data: staff }, { data: hosts }] = await Promise.all([
    staffIds.length ? a.from('team_members').select('id, display_name').in('id', staffIds) : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    hostNos.length ? a.from('members').select('member_no, full_name').in('member_no', hostNos) : Promise.resolve({ data: [] as { member_no: string; full_name: string }[] }),
  ])
  const staffName = new Map((staff || []).map(s => [s.id, s.display_name]))
  const hostName = new Map((hosts || []).map(h => [h.member_no, h.full_name]))
  const now = Date.now()
  return NextResponse.json({
    door_ready: true,
    guests: rows.map(r => ({
      ...r,
      host_name: r.host_member_no ? hostName.get(r.host_member_no) || null : null,
      decided_by_name: r.decided_by_staff ? staffName.get(r.decided_by_staff) || null : null,
      // 'live' → a thumbnail may be shown · 'deleted' → past its seven days · null → never taken.
      signature: r.signed_in_at ? (signatureIsLive(r.signed_in_at, r.signature_deleted_at, now) ? 'live' : 'deleted') : null,
    })),
  })
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
