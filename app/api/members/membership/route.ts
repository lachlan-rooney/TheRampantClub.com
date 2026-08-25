import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/members/membership → the LOGGED-IN member's membership status +
// their receipts. Payment/period RLS is admin + read-own; we resolve the
// session → profiles.member_no and return via service-role with an explicit
// member-safe column allow-list (NO staff_*, idempotency_key, integrity_hash,
// or internal note).

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function vnToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export async function GET() {
  const cookie = await createServerSupabaseClient()
  const { data: { user } } = await cookie.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const sb = svc()
  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', user.id).maybeSingle()
  if (!prof?.member_no) return NextResponse.json({ status: null, payments: [] })
  const memberNo = prof.member_no

  const { data: periods } = await sb.from('membership_periods')
    .select('start_date, end_date, status')
    .eq('member_no', memberNo)
    .in('status', ['active', 'expired', 'superseded'])
    .order('end_date', { ascending: false })
    .limit(1)
  const per = periods?.[0] || null

  const today = vnToday()
  const addDays = (d: string, n: number) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10) }
  let status: null | { paid_through: string; is_current: boolean; in_grace: boolean; is_expired: boolean } = null
  if (per) {
    status = {
      paid_through: per.end_date,
      is_current: per.status === 'active' && per.end_date >= today,
      in_grace: per.end_date < today && per.end_date >= addDays(today, -30),
      is_expired: per.end_date < today,
    }
  }

  const { data: payments } = await sb.from('membership_payments')
    .select('id, receipt_no, amount_vnd, payment_date, fee_kind, pdf_path')
    .eq('member_no', memberNo)
    .eq('status', 'active')
    .gt('amount_vnd', 0)
    .order('payment_date', { ascending: false })

  const safe = (payments || []).map(p => ({
    id: p.id,
    receipt_no: p.receipt_no,
    amount_vnd: p.amount_vnd,
    payment_date: p.payment_date,
    fee_kind: p.fee_kind,
    receipt_available: !!p.pdf_path,
  }))

  return NextResponse.json({ status, payments: safe })
}
