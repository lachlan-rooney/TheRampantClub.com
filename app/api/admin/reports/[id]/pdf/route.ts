import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { printReportPdf } from '@/lib/reports/pdf-print'

// THE ATTACHMENT, ON DEMAND. The same printed PDF the email carries, handed
// back for download — so the owner can see what Shawn will open without
// sending anything to anybody, and so the print path can be proved in
// production rather than only on a laptop.
//
// Admin only. The PDF is printed from the report's own token page, which is
// public once approved; this route adds no new way to reach an unapproved one,
// because printing a draft would ask a browser with no session to open a page
// that refuses it.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Not permitted.' }, { status: 403 })
  const { id } = await params

  const { data: r } = await svc().from('weekly_reports')
    .select('share_token, period_end, status').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  if (!r.share_token) return NextResponse.json({ error: 'This report has no share link to print.' }, { status: 400 })
  if (r.status !== 'approved' && r.status !== 'sent') {
    // Said plainly rather than failing at the browser: a draft's page is
    // admin-only, and the printer is not an admin.
    return NextResponse.json({ error: 'Approve the report first — a draft page is not public, so it cannot be printed.' }, { status: 409 })
  }

  try {
    const pdf = await printReportPdf(r.share_token)
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Rampant_Weekly_Report_${r.period_end}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not print the report.' }, { status: 500 })
  }
}
