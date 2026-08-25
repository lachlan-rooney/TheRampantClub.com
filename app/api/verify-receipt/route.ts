import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

// GET /api/verify-receipt?no=TRC-R-2026-0001&h=<hash-from-pdf>
//
// Public receipt authenticity check. A receipt PDF prints its receipt number +
// integrity-hash prefix; this recomputes the hash from the authoritative ledger
// row and confirms it. Requires the hash (from the PDF) so receipt numbers can't
// be enumerated — no hash / wrong hash → not verified, no data leaked. On a match
// it returns the authoritative amount/date/status so the holder can spot any
// tampering of the printed figures.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Mirror the SQL: end = payment_date + 1 year - 1 day (inclusive).
function periodEnd(paymentDate: string): string {
  const d = new Date(paymentDate + 'T00:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() + 1)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const no = String(req.nextUrl.searchParams.get('no') || '').trim().toUpperCase()
  const h = String(req.nextUrl.searchParams.get('h') || '').trim().toLowerCase()
  if (!no || !h) return NextResponse.json({ verified: false, reason: 'Provide a receipt number and the code printed on the receipt.' }, { status: 400 })

  const sb = svc()
  const { data: pay } = await sb.from('membership_payments')
    .select('receipt_no, member_no, member_name_snap, amount_vnd, payment_date, fee_kind, status, integrity_hash')
    .eq('receipt_no', no).maybeSingle()

  // Fail closed + identical shape whether the receipt is missing or the hash is
  // wrong, so a caller can't tell an existing receipt from a non-existent one.
  const fail = NextResponse.json({ verified: false, reason: 'This receipt could not be verified.' })
  if (!pay || !pay.integrity_hash) return fail

  const start = pay.payment_date
  const end = periodEnd(pay.payment_date)
  const recomputed = createHash('sha256')
    .update(`${pay.receipt_no}|${pay.member_no}|${pay.amount_vnd}|${start}|${end}`)
    .digest('hex')

  // DB row self-consistent AND the supplied hash matches the stored hash.
  const dbConsistent = recomputed === pay.integrity_hash
  const supplied = pay.integrity_hash.startsWith(h) || h === pay.integrity_hash
  if (!dbConsistent || !supplied) return fail

  return NextResponse.json({
    verified: true,
    receipt_no: pay.receipt_no,
    member_name: pay.member_name_snap,
    amount_vnd: pay.amount_vnd,
    amount_display: new Intl.NumberFormat('en-US').format(pay.amount_vnd) + ' ₫',
    payment_date: pay.payment_date,
    period: { start, end },
    status: pay.status,           // 'active' | 'voided'
    note: pay.status === 'voided' ? 'This receipt has been voided.' : 'Authentic — issued by The Rampant Club.',
  })
}
