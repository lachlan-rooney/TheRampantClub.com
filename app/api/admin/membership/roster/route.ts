import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { DEMO_MEMBERS } from '@/lib/demo-members'

// GET /api/admin/membership/roster → every member (Google Sheet roster +
// demo entries) overlaid with their latest membership period + last payment,
// classified paid / due-soon / grace / overdue / never. Plus per-tier default
// fees (from tier_budgets) for the record form's prefill. Admin-gated.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function vnToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = svc()

  // 1. Roster identity from the Google Sheet (+ demo overlay), like the cards picker.
  let sheet: Record<string, string>[] = []
  try {
    const r = await fetch(new URL('/api/member-profiles', req.nextUrl.origin), { cache: 'no-store' })
    if (r.ok) sheet = await r.json()
  } catch { /* empty fallback */ }

  const identity = new Map<string, { member_no: string; full_name: string; tier: string }>()
  for (const m of sheet) {
    const no = m['Member No.']
    if (!no) continue
    identity.set(no, { member_no: no, full_name: m['Full Name'] || '', tier: m['Tier'] || '' })
  }
  for (const dm of DEMO_MEMBERS) {
    if (!identity.has(dm.member_number)) {
      identity.set(dm.member_number, { member_no: dm.member_number, full_name: dm.full_name, tier: dm.tier })
    }
  }

  // 2. Latest period + latest payment per member.
  const { data: periods } = await sb.from('membership_periods')
    .select('member_no, start_date, end_date, status, complimentary').order('end_date', { ascending: false })
  const latestPeriod = new Map<string, { start_date: string; end_date: string; status: string; complimentary: boolean }>()
  for (const p of periods || []) if (!latestPeriod.has(p.member_no)) latestPeriod.set(p.member_no, p)

  const { data: pays } = await sb.from('membership_payments')
    .select('member_no, amount_vnd, payment_date, receipt_no, status')
    .eq('status', 'active').order('created_at', { ascending: false })
  const latestPay = new Map<string, { amount_vnd: number; payment_date: string; receipt_no: string }>()
  for (const p of pays || []) if (!latestPay.has(p.member_no)) latestPay.set(p.member_no, p)

  // 3. Per-tier default fees.
  const { data: tb } = await sb.from('tier_budgets').select('tier, annual_dues_vnd')
  const tier_fees: Record<string, number> = {}
  for (const t of tb || []) tier_fees[t.tier] = Number(t.annual_dues_vnd) || 0

  const today = vnToday()
  const addDays = (d: string, n: number) => {
    const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n)
    return dt.toISOString().slice(0, 10)
  }

  // Whole-day difference between two YYYY-MM-DD dates (b - a), calendar days.
  const daysBetween = (a: string, b: string) =>
    Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)

  const roster = [...identity.values()].map(m => {
    const per = latestPeriod.get(m.member_no)
    const pay = latestPay.get(m.member_no) || null
    let state: 'paid' | 'due_soon' | 'grace' | 'overdue' | 'never' = 'never'
    // days_to_renewal: >0 = days remaining, 0 = renews today, <0 = days overdue.
    // Single source of truth = the membership period's end_date.
    const daysToRenewal = per ? daysBetween(today, per.end_date) : null
    if (per) {
      if (per.end_date >= today) state = per.end_date <= addDays(today, 30) ? 'due_soon' : 'paid'
      else state = per.end_date >= addDays(today, -30) ? 'grace' : 'overdue'
    }
    return {
      member_no: m.member_no,
      full_name: m.full_name,
      tier: m.tier,
      paid_through: per?.end_date || null,
      days_to_renewal: daysToRenewal,
      complimentary: !!per?.complimentary,
      state,
      last_payment: pay,
      default_fee: tier_fees[m.tier] ?? 0,
    }
  }).sort((a, b) => a.member_no.localeCompare(b.member_no))

  return NextResponse.json({ roster, tier_fees, today })
}
