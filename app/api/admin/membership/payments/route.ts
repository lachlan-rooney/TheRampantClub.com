import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'
import { generateReceiptPdf } from '@/lib/receipts/generate-receipt-pdf'

// POST /api/admin/membership/payments → record a membership-fee payment.
// Admin-gated. Records via the atomic RPC under the COOKIE client (so the
// ledger + activity_events attribute to the real admin), then generates the
// branded PDF, stores it privately, and emails the receipt (member + club).
//
// GET  /api/admin/membership/payments?member_no=TRC-M003 → that member's
// payment history (admin only).

export const dynamic = 'force-dynamic'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const METHODS = ['bank_transfer', 'cash', 'card_offline', 'other']
const FEE_KINDS = ['membership_fee', 'renewal', 'joining_fee', 'proration']
const BUCKET = 'membership_receipts'

function fmtVnd(n: number): string {
  return new Intl.NumberFormat('en-US').format(n) + ' ₫'
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const memberNo = String(req.nextUrl.searchParams.get('member_no') || '').trim()
  if (!memberNo) return NextResponse.json({ error: 'member_no required' }, { status: 400 })
  const sb = svc()
  const { data, error } = await sb.from('membership_payments')
    .select('id, receipt_no, amount_vnd, payment_method, payment_date, fee_kind, status, note, staff_email, pdf_path, created_at')
    .eq('member_no', memberNo)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payments: data || [] })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const member_no = String(body.member_no || '').trim()
  const member_name = String(body.member_name || '').trim()
  const tier = body.tier ? String(body.tier).trim() : null
  const amount_vnd = Math.round(Number(body.amount_vnd))
  const payment_method = String(body.payment_method || 'bank_transfer')
  const payment_date = String(body.payment_date || '').trim()
  const fee_kind = String(body.fee_kind || 'membership_fee')
  const note = body.note ? String(body.note).slice(0, 300) : null
  const email_override = body.email ? String(body.email).trim() : null
  const idempotency_key = body.idempotency_key ? String(body.idempotency_key) : null

  if (!member_no) return NextResponse.json({ error: 'member_no required' }, { status: 400 })
  if (!member_name) return NextResponse.json({ error: 'member_name required' }, { status: 400 })
  if (!Number.isFinite(amount_vnd) || amount_vnd <= 0) return NextResponse.json({ error: 'amount_vnd must be positive' }, { status: 400 })
  if (!METHODS.includes(payment_method)) return NextResponse.json({ error: 'invalid payment_method' }, { status: 400 })
  if (!FEE_KINDS.includes(fee_kind)) return NextResponse.json({ error: 'invalid fee_kind' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payment_date)) return NextResponse.json({ error: 'payment_date must be YYYY-MM-DD' }, { status: 400 })

  // 1. Record via the atomic RPC under the cookie client (real actor).
  const cookieClient = await createServerSupabaseClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  const { data, error } = await cookieClient.rpc('record_membership_payment', {
    p_member_no: member_no,
    p_member_name: member_name,
    p_tier: tier,
    p_amount_vnd: amount_vnd,
    p_payment_method: payment_method,
    p_payment_date: payment_date,
    p_fee_kind: fee_kind,
    p_note: note,
    p_idempotency_key: idempotency_key,
    p_staff_id: user?.id || null,
    p_staff_email: user?.email || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.receipt_no) return NextResponse.json({ error: 'record failed' }, { status: 500 })

  const sb = svc()

  // 2. Fetch the integrity hash + generate the branded PDF.
  const { data: pay } = await sb.from('membership_payments')
    .select('integrity_hash, pdf_path').eq('id', row.payment_id).maybeSingle()

  let pdfPath: string | null = pay?.pdf_path ?? null
  let pdfBytes: Uint8Array | null = null
  if (!pdfPath) {
    try {
      pdfBytes = await generateReceiptPdf({
        receiptNo: row.receipt_no,
        memberName: member_name,
        memberNo: member_no,
        tier,
        amountVnd: amount_vnd,
        paymentMethod: payment_method,
        paymentDate: payment_date,
        feeKind: fee_kind,
        periodStart: row.start_date || null,
        periodEnd: row.end_date || null,
        integrityHash: pay?.integrity_hash || '',
      }, { crestUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'}/images/lion-signature-opt.png` })
      pdfPath = `${row.receipt_no}_${Date.now()}.pdf`
      const { error: upErr } = await sb.storage.from(BUCKET).upload(pdfPath, pdfBytes, { contentType: 'application/pdf' })
      if (upErr) { console.error('receipt upload error:', upErr.message); pdfPath = null }
      else await sb.from('membership_payments').update({ pdf_path: pdfPath }).eq('id', row.payment_id)
    } catch (e) {
      console.error('receipt PDF generation failed:', e)
    }
  }

  // 3. Email the receipt (member + club). Never fail the payment on email error.
  if (process.env.RESEND_API_KEY && pdfBytes) {
    try {
      // Resolve the customer email. Primary source of truth = the member's
      // ACCOUNT/LOGIN email (their linked profile → auth.users), set via the
      // login panel on the member profile. Then a one-off override, then any
      // members.email on file.
      let email = email_override
      if (!email) {
        const { data: p } = await sb.from('profiles').select('id').eq('member_no', member_no).maybeSingle()
        if (p?.id) {
          const { data: au } = await sb.auth.admin.getUserById(p.id)
          email = au?.user?.email || null
        }
      }
      if (!email) {
        const { data: m } = await sb.from('members').select('email').eq('member_no', member_no).maybeSingle()
        email = m?.email || null
      }
      const resend = new Resend(process.env.RESEND_API_KEY)
      const attachment = { filename: `TRC_Receipt_${row.receipt_no}.pdf`, content: Buffer.from(pdfBytes) }
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'
      const html = receiptEmailHtml({ siteUrl, memberName: member_name, receiptNo: row.receipt_no, amount: fmtVnd(amount_vnd), periodEnd: row.end_date })

      if (email) {
        await resend.emails.send({
          from: 'The Rampant Club <membership@therampantclub.com>',
          to: email,
          subject: `Your Rampant Club Membership Receipt — ${row.receipt_no}`,
          html, attachments: [attachment],
        })
      }
      await resend.emails.send({
        from: 'The Rampant Club <membership@therampantclub.com>',
        to: 'membership@therampantclub.com',
        subject: `Membership payment recorded: ${member_name} — ${fmtVnd(amount_vnd)} (${row.receipt_no})`,
        html, attachments: [attachment],
      })
    } catch (e) {
      console.error('receipt email error:', e)
    }
  }

  return NextResponse.json({
    ok: true,
    receipt_no: row.receipt_no,
    payment_id: row.payment_id,
    period: row.start_date && row.end_date ? { start: row.start_date, end: row.end_date } : null,
    pdf_available: !!pdfPath,
  })
}

function receiptEmailHtml(p: { siteUrl: string; memberName: string; receiptNo: string; amount: string; periodEnd?: string | null }): string {
  const lionUrl = `${p.siteUrl}/images/lion-signature-opt.png`
  const paidThrough = p.periodEnd
    ? new Date(p.periodEnd + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  return `
    <div style="max-width:600px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;background-color:#E5D4C2;">
      <div style="background-color:#E5D4C2;padding:48px 40px 24px;text-align:center;">
        <img src="${lionUrl}" alt="" width="72" style="display:block;margin:0 auto 20px;" />
        <h1 style="color:#052E20;font-size:22px;font-weight:400;letter-spacing:0.08em;margin:0;">THE RAMPANT CLUB</h1>
        <p style="color:#5E6650;font-size:10px;letter-spacing:0.12em;margin:10px 0 0;text-transform:uppercase;">Official Membership Receipt</p>
      </div>
      <div style="background-color:#E5D4C2;padding:24px 48px 40px;">
        <p style="color:#052E20;font-size:15px;line-height:1.8;margin:0 0 20px;">Dear ${p.memberName},</p>
        <p style="color:#5E6650;font-size:13px;line-height:1.85;margin:0 0 16px;">
          Thank you for your membership payment to The Rampant Club. Your official receipt
          <strong style="color:#052E20;">${p.receiptNo}</strong> is attached to this email for your records.
        </p>
        <div style="background-color:#052E20;border-radius:6px;padding:22px 24px;margin:24px 0;text-align:center;">
          <p style="color:#B2AA98;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 6px;">Amount Paid</p>
          <p style="color:#E5D4C2;font-size:26px;margin:0;">${p.amount}</p>
          ${paidThrough ? `<p style="color:#D4B85A;font-size:11px;margin:12px 0 0;">Membership active — paid through ${paidThrough}</p>` : ''}
        </div>
        <p style="color:#5E6650;font-size:13px;line-height:1.85;margin:16px 0 0;">
          You can view your membership status and download this receipt any time from your member portal.
        </p>
      </div>
      <div style="background-color:#052E20;padding:28px 40px;text-align:center;">
        <p style="color:#B2AA98;font-size:10px;line-height:1.7;margin:0;">
          74A2 Hai Ba Trung, District 1, Ho Chi Minh City<br>
          Membership@TheRampantClub.com &nbsp;|&nbsp; (+84) 817 888 768
        </p>
      </div>
    </div>`
}
