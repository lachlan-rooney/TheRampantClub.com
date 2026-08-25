import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { isAdmin } from '@/lib/admin'
import { generateReceiptPdf } from '@/lib/receipts/generate-receipt-pdf'

// POST /api/admin/membership/:id/resend → re-send an existing receipt by email
// (member's account/login email + membership@). Reuses the stored PDF; if it's
// missing it regenerates from the ledger row. Admin-gated.

export const dynamic = 'force-dynamic'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BUCKET = 'membership_receipts'
const fmtVnd = (n: number) => new Intl.NumberFormat('en-US').format(n) + ' ₫'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sb = svc()

  const { data: pay } = await sb.from('membership_payments')
    .select('id, receipt_no, member_no, member_name_snap, tier_snap, amount_vnd, payment_method, payment_date, fee_kind, period_id, pdf_path, integrity_hash, status')
    .eq('id', id).maybeSingle()
  if (!pay) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (pay.status === 'voided') return NextResponse.json({ error: 'This receipt is voided.' }, { status: 400 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email is not configured.' }, { status: 500 })

  // Get the PDF bytes: stored copy first, else regenerate.
  let bytes: Uint8Array | null = null
  if (pay.pdf_path) {
    const { data: file } = await sb.storage.from(BUCKET).download(pay.pdf_path)
    if (file) bytes = new Uint8Array(await file.arrayBuffer())
  }
  if (!bytes) {
    let periodStart: string | null = null, periodEnd: string | null = null
    if (pay.period_id) {
      const { data: per } = await sb.from('membership_periods').select('start_date, end_date').eq('id', pay.period_id).maybeSingle()
      periodStart = per?.start_date || null; periodEnd = per?.end_date || null
    }
    bytes = await generateReceiptPdf({
      receiptNo: pay.receipt_no, memberName: pay.member_name_snap, memberNo: pay.member_no, tier: pay.tier_snap,
      amountVnd: pay.amount_vnd, paymentMethod: pay.payment_method, paymentDate: pay.payment_date,
      feeKind: pay.fee_kind, periodStart, periodEnd, integrityHash: pay.integrity_hash || '',
    }, { crestUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'}/images/lion-signature-opt.png` })
    const path = `${pay.receipt_no}_${Date.now()}.pdf`
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf' })
    if (!upErr) await sb.from('membership_payments').update({ pdf_path: path }).eq('id', id)
  }

  // Resolve the customer email — account/login first (same as the record route).
  let email: string | null = null
  const { data: p } = await sb.from('profiles').select('id').eq('member_no', pay.member_no).maybeSingle()
  if (p?.id) { const { data: au } = await sb.auth.admin.getUserById(p.id); email = au?.user?.email || null }
  if (!email) { const { data: m } = await sb.from('members').select('email').eq('member_no', pay.member_no).maybeSingle(); email = m?.email || null }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const attachment = { filename: `TRC_Receipt_${pay.receipt_no}.pdf`, content: Buffer.from(bytes) }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;background:#E5D4C2;">
      <div style="padding:40px;text-align:center;">
        <img src="${siteUrl}/images/lion-signature-opt.png" width="64" style="display:block;margin:0 auto 18px;" />
        <h1 style="color:#052E20;font-size:20px;font-weight:400;letter-spacing:0.08em;margin:0;">THE RAMPANT CLUB</h1>
        <p style="color:#5E6650;font-size:11px;margin:14px 0 0;">Your membership receipt <strong>${pay.receipt_no}</strong> (${fmtVnd(pay.amount_vnd)}) is attached.</p>
      </div>
    </div>`

  try {
    if (email) {
      await resend.emails.send({ from: 'The Rampant Club <membership@therampantclub.com>', to: email, subject: `Your Rampant Club Membership Receipt — ${pay.receipt_no}`, html, attachments: [attachment] })
    }
    await resend.emails.send({ from: 'The Rampant Club <membership@therampantclub.com>', to: 'membership@therampantclub.com', subject: `Receipt re-sent: ${pay.member_name_snap} — ${pay.receipt_no}`, html, attachments: [attachment] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Email failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, member_emailed: !!email })
}
