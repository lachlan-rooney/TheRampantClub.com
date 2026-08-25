import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'
import { renderReportBody, type ReportRow } from '@/lib/reports/render'

// Public, tokened, read-only report page. Reads ONE row by share_token via the
// service-role client (no public RLS policy — mirrors app/sign/[token]). Serves
// approved/sent reports externally + stamps a view; draft/pending are visible
// only to a logged-in admin (preview). Renders the same body as the email, with
// inline SVG charts.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export default async function ReportTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const sb = svc()
  const { data: r } = await sb.from('weekly_reports').select('*').eq('share_token', token).maybeSingle()
  if (!r) notFound()

  const isDraft = r.status !== 'approved' && r.status !== 'sent'
  if (isDraft && !(await isAdmin())) notFound()

  if (!isDraft) {
    await sb.from('weekly_reports').update({
      token_view_count: (r.token_view_count || 0) + 1,
      token_viewed_at: r.token_viewed_at || new Date().toISOString(),
    }).eq('id', r.id)
  }

  const html = renderReportBody(r as ReportRow, 'svg')
  return (
    <div style={{ minHeight: '100vh', background: '#052E20', padding: '44px 16px 72px' }}>
      {isDraft && (
        <div style={{ maxWidth: 720, margin: '0 auto 20px', fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#C9A84C', textAlign: 'center', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 8, padding: '8px 12px' }}>
          Draft preview — not yet approved
        </div>
      )}
      <div style={{ maxWidth: 720, margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
