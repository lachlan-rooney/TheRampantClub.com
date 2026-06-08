'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { vnDateString } from '@/lib/datetime'

// Member-visible HOUSE entries (closures, distiller visits, tastings, notices)
// from calendar_entries. Informational — NO RSVP (a closure isn't RSVP'd; sports
// sign-ups live on /members/fixtures). RLS already restricts a member session to
// visibility='member' rows; the explicit filter is defence in depth.
//
// NOTE: this surfaces house calendar entries — it is NOT a full events+RSVP
// system (that's a separate, larger piece). The mock RSVP events were removed.

interface Entry {
  id: string
  title: string
  description: string | null
  entry_date: string
  start_time: string | null
  end_time: string | null
  session_label: string | null
  space: string | null
  kind: string
}

const KIND_LABEL: Record<string, string> = {
  closure: 'Club closed', private_hire: 'Private event', supplier: 'Distiller visit', tasting: 'Tasting', other: 'Notice',
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00+07:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh',
  })
}
function fmtTime(e: Entry): string {
  if (e.start_time) { const t = e.start_time.slice(0, 5); return e.end_time ? `${t}–${e.end_time.slice(0, 5)}` : t }
  if (e.session_label) return e.session_label.charAt(0).toUpperCase() + e.session_label.slice(1)
  return 'All day'
}

export default function EventsPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('calendar_entries')
      .select('id, title, description, entry_date, start_time, end_time, session_label, space, kind')
      .eq('visibility', 'member')
      .gte('entry_date', vnDateString())
      .order('entry_date').order('start_time', { ascending: true, nullsFirst: true })
      .then(({ data }) => { setEntries((data || []) as Entry[]); setLoading(false) })
  }, [])

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        .events-page { min-height: 100vh; background: #052E20; font-family: 'DM Mono', monospace; position: relative; }
        .events-grain { position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 200px; }
        .events-container { position: relative; z-index: 2; max-width: 680px; margin: 0 auto; padding: 100px 24px 80px; }
        .events-back { font-size: 11px; color: #B2AA98; opacity: 0.4; text-decoration: none; letter-spacing: 0.06em; transition: opacity 0.2s; display: inline-block; margin-bottom: 32px; }
        .events-back:hover { opacity: 0.7; }
        .events-title { font-family: 'Rampant Sans', serif; font-size: 28px; font-weight: 600; color: #E5D4C2; letter-spacing: 0.02em; margin-bottom: 4px; }
        .events-subtitle { font-size: 11px; color: #B2AA98; opacity: 0.4; letter-spacing: 0.06em; margin-bottom: 48px; }
        .event-card { padding: 28px 0; border-bottom: 1px solid rgba(229, 212, 194, 0.08); }
        .event-card:first-of-type { border-top: 1px solid rgba(229, 212, 194, 0.08); }
        .event-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 12px; }
        .event-meta span { font-size: 11px; color: #B2AA98; opacity: 0.55; letter-spacing: 0.04em; }
        .event-kind { color: #D4B85A !important; opacity: 0.9 !important; text-transform: uppercase; letter-spacing: 0.1em; font-size: 9px !important; }
        .event-meta-dot { width: 3px; height: 3px; background: #B2AA98; border-radius: 50%; opacity: 0.3; }
        .event-title-en { font-family: 'Rampant Sans', serif; font-size: 22px; font-weight: 600; color: #E5D4C2; letter-spacing: 0.02em; margin-bottom: 10px; }
        .event-desc { font-size: 12px; line-height: 1.7; color: #B2AA98; opacity: 0.7; letter-spacing: 0.02em; margin: 0; }
        .events-empty { font-size: 12px; color: #B2AA98; opacity: 0.5; font-style: italic; padding: 32px 0; }
        .events-diamond { width: 6px; height: 6px; background: #E5D4C2; transform: rotate(45deg); opacity: 0.2; margin: 48px auto 0; }
        @media (max-width: 768px) { .events-container { padding: 80px 20px 60px; } .events-title { font-size: 24px; } }
      ` }} />

      <div className="events-page">
        <div className="events-grain" />
        <div className="events-container">
          <Link href="/members" className="events-back">&larr; Back to dashboard</Link>

          <h1 className="events-title">Events &amp; Notices</h1>
          <p className="events-subtitle">Sự kiện &amp; Thông báo</p>

          {loading ? (
            <p className="events-empty">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="events-empty">Nothing on the calendar just now — check back soon. For sports sign-ups, see <Link href="/members/fixtures" style={{ color: '#D4B85A' }}>Fixtures</Link>.</p>
          ) : (
            entries.map(e => (
              <div key={e.id} className="event-card">
                <div className="event-meta">
                  <span className="event-kind">{KIND_LABEL[e.kind] || 'Notice'}</span>
                  <div className="event-meta-dot" />
                  <span>{fmtDate(e.entry_date)}</span>
                  <div className="event-meta-dot" />
                  <span>{fmtTime(e)}</span>
                  {e.space && <><div className="event-meta-dot" /><span>{e.space}</span></>}
                </div>
                <h2 className="event-title-en">{e.title}</h2>
                {e.description && <p className="event-desc">{e.description}</p>}
              </div>
            ))
          )}

          <div className="events-diamond" />
        </div>
      </div>
    </>
  )
}
