import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { renderNewsletterBody, type NewsletterRow } from '@/lib/newsletter/render'

// Public, tokened newsletter page. Reads one row by share_token via the
// service-role client (no anon RLS policy). Drafts 404 unless an admin previews.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export default async function NewsletterTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const a = svc()
  const { data: row } = await a.from('newsletters').select('*').eq('share_token', token).maybeSingle()
  if (!row) notFound()

  const live = row.status === 'approved' || row.status === 'sent'
  if (!live && !(await isAdmin())) notFound()

  // Stamp the view (first-view timestamp only) on a live issue.
  if (live) {
    try {
      await a.from('newsletters').update({
        token_view_count: (row.token_view_count || 0) + 1,
        token_viewed_at: row.token_viewed_at || new Date().toISOString(),
      }).eq('id', row.id)
    } catch { /* view-stamp is best-effort */ }
  }

  const nl: NewsletterRow = { subject: row.subject, sections: row.sections || {}, auto_data: row.auto_data || {}, hero_image: row.hero_image, share_token: row.share_token }
  const body = renderNewsletterBody(nl)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&display=swap');
        body { background:#052E20; margin:0; }
        .nlt-wrap { max-width:720px; margin:0 auto; padding:56px 22px 90px; }
        .nlt-card { background:#0A3526; border:1px solid rgba(229,212,194,0.12); border-radius:14px; padding:30px 30px 36px; box-shadow:0 30px 80px rgba(0,0,0,0.4); }
        .nlt-card h1 { font-family:'Playfair Display', Georgia, serif !important; }
        .nlt-draft { font-family:'Google Sans Code',monospace; font-size:11px; color:#052E20; background:#D4B85A; text-align:center; padding:7px; border-radius:8px; margin-bottom:14px; letter-spacing:0.06em; }
        .nlt-foot { text-align:center; font-family:'Google Sans Code',monospace; font-size:10px; color:#B2AA98; opacity:0.6; margin-top:22px; letter-spacing:0.06em; }
      ` }} />
      <div className="nlt-wrap">
        {!live && <div className="nlt-draft">DRAFT PREVIEW · not yet sent</div>}
        <div className="nlt-card" dangerouslySetInnerHTML={{ __html: body }} />
        <div className="nlt-foot">The Rampant Club</div>
      </div>
    </>
  )
}
