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
    <div style={{ minHeight: '100vh', background: '#052E20', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap');
        @keyframes rpt-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
        .rpt-grain { position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='6' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E");
          background-size: 300px; }
        .rpt-wrap { position: relative; z-index: 2; max-width: 720px; margin: 0 auto; padding: 40px 18px 80px; animation: rpt-rise 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .rpt-masthead { text-align: center; margin-bottom: 8px; }
        .rpt-masthead img { height: 40px; opacity: 0.85; }
        .rpt-report h1 { font-family: 'Playfair Display', Georgia, serif !important; }
        .rpt-foot { text-align: center; margin-top: 40px; font-family: 'Google Sans Code', monospace; font-size: 10px; color: #7E8A7E; letter-spacing: 0.06em; }
        @media (prefers-reduced-motion: reduce) { .rpt-wrap { animation: none } }
      ` }} />
      <div className="rpt-grain" />
      <div className="rpt-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="rpt-masthead"><img src="/images/logo-mark-cream.svg" alt="The Rampant Club" /></div>
        {isDraft && (
          <div style={{ margin: '0 auto 18px', maxWidth: 320, fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#C9A84C', textAlign: 'center', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 8, padding: '7px 12px' }}>
            Draft preview — not yet approved
          </div>
        )}
        <div className="rpt-report" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="rpt-foot">The Rampant Club · 74A2 Hai Ba Trung, District 1, Ho Chi Minh City</div>
      </div>
    </div>
  )
}
