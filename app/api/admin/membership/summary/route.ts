import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

// GET /api/admin/membership/summary → reconciliation totals over the active
// payment ledger (voids excluded), plus a breakdown by method and a
// current-year subtotal. Admin-gated.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()
  const { data, error } = await sb.from('membership_payments')
    .select('amount_vnd, payment_method, payment_date, status')
    .eq('status', 'active').gt('amount_vnd', 0)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date())
  let total = 0, count = 0, yearTotal = 0, yearCount = 0
  const byMethod: Record<string, { count: number; total: number }> = {}
  for (const p of data || []) {
    const amt = Number(p.amount_vnd) || 0
    total += amt; count++
    if (String(p.payment_date).startsWith(year)) { yearTotal += amt; yearCount++ }
    const m = p.payment_method || 'other'
    byMethod[m] = byMethod[m] || { count: 0, total: 0 }
    byMethod[m].count++; byMethod[m].total += amt
  }

  // Voided count for the audit line.
  const { count: voided } = await sb.from('membership_payments').select('id', { count: 'exact', head: true }).eq('status', 'voided')

  return NextResponse.json({ total, count, year, year_total: yearTotal, year_count: yearCount, by_method: byMethod, voided: voided || 0 })
}
