import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/membership/export → CSV of the full payment ledger (for the
// finance handoff / reconciliation). Admin-gated.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()
  const { data, error } = await sb.from('membership_payments')
    .select('receipt_no, member_no, member_name_snap, tier_snap, amount_vnd, currency, payment_method, payment_date, fee_kind, status, staff_email, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cols = ['receipt_no', 'member_no', 'member_name_snap', 'tier_snap', 'amount_vnd', 'currency', 'payment_method', 'payment_date', 'fee_kind', 'status', 'staff_email', 'created_at']
  const header = ['Receipt No', 'Member No', 'Member Name', 'Tier', 'Amount (VND)', 'Currency', 'Method', 'Payment Date', 'Fee Kind', 'Status', 'Recorded By', 'Recorded At']
  const rows = (data || []).map(r => cols.map(c => esc((r as Record<string, unknown>)[c])).join(','))
  const csv = [header.join(','), ...rows].join('\n')

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rampant-membership-payments-${today}.csv"`,
    },
  })
}
