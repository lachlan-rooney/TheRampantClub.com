'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import NavOverlay from '@/components/NavOverlay'

interface Entry {
  id: string
  title: string
  body: string
  excerpt: string | null
  author_name: string | null
  cover_image_url: string | null
  published_at: string
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export default function MembersJournal() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Entry | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('journal_entries')
      .select('id, title, body, excerpt, author_name, cover_image_url, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        if (data) setEntries(data as Entry[])
        setLoading(false)
      })
  }, [])

  return (
    <>
      <NavOverlay variant="members" dark />
      <style>{`
        .jrnl-empty {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; color: #B2AA98; opacity: 0.7;
          padding: 28px 20px; text-align: center;
          background: rgba(229,212,194,0.04);
          border: 1px dashed rgba(229,212,194,0.15);
          border-radius: 10px;
          font-style: italic;
        }
        .jrnl-list { display: flex; flex-direction: column; gap: 14px; }
        .jrnl-card {
          padding: 22px 24px;
          background: rgba(229,212,194,0.04);
          border: 1px solid rgba(229,212,194,0.08);
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.25s, border-color 0.25s, transform 0.25s;
        }
        .jrnl-card:hover {
          background: rgba(229,212,194,0.07);
          border-color: rgba(212,184,90,0.35);
          transform: translateY(-2px);
        }
        .jrnl-meta {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; letter-spacing: 0.10em; text-transform: uppercase;
          color: #D4B85A; opacity: 0.85; margin-bottom: 8px;
        }
        .jrnl-title {
          font-family: 'Rampant Sans', serif;
          font-size: 22px; font-weight: 500; color: #E5D4C2;
          margin: 0 0 8px; letter-spacing: 0.02em; line-height: 1.2;
        }
        .jrnl-excerpt {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; color: #B2AA98; opacity: 0.85;
          line-height: 1.7; margin: 0;
        }

        /* Reader modal */
        .jrnl-back {
          position: fixed; inset: 0;
          background: rgba(5,46,32,0.62);
          backdrop-filter: blur(8px);
          z-index: 99980;
          display: flex; align-items: flex-start; justify-content: center;
          padding: 60px 20px 40px; overflow-y: auto;
          animation: jrnl-fade 0.3s ease;
        }
        @keyframes jrnl-fade { from { opacity: 0 } to { opacity: 1 } }
        .jrnl-reader {
          background: #052E20;
          color: #E5D4C2;
          border: 1px solid rgba(212,184,90,0.32);
          border-radius: 14px;
          max-width: 680px; width: 100%;
          padding: 44px 40px 36px;
          position: relative;
          box-shadow: 0 30px 80px rgba(0,0,0,0.5);
          animation: jrnl-rise 0.4s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes jrnl-rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .jrnl-close {
          position: absolute; top: 14px; right: 14px;
          background: transparent; color: #B2AA98;
          border: 1px solid rgba(229,212,194,0.18);
          border-radius: 50%; width: 32px; height: 32px;
          cursor: pointer; font-size: 16px;
          transition: background 0.2s;
        }
        .jrnl-close:hover { background: rgba(229,212,194,0.06); color: #E5D4C2; }
        .jrnl-cover { width: 100%; height: 220px; object-fit: cover; border-radius: 8px; margin-bottom: 22px; }
        .jrnl-r-meta {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
          color: #D4B85A; margin-bottom: 8px;
        }
        .jrnl-r-title {
          font-family: 'Rampant Sans', serif;
          font-size: 32px; font-weight: 500; color: #E5D4C2;
          margin: 0 0 22px; letter-spacing: 0.02em; line-height: 1.15;
        }
        .jrnl-r-byline {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #B2AA98; opacity: 0.7;
          margin: 0 0 26px; font-style: italic;
        }
        .jrnl-r-body p {
          font-family: 'Google Sans Code', monospace;
          font-size: 13px; line-height: 1.85;
          color: #E5D4C2; opacity: 0.9; margin: 0 0 18px;
          letter-spacing: 0.01em;
        }
      `}</style>

      <MemberPage title="The Cellarmaster's Journal" subtitle="Nhật Ký Cellarmaster">
        {loading ? (
          <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center' }}>Loading…</p>
        ) : entries.length === 0 ? (
          <div className="jrnl-empty">
            The Cellarmaster has not yet committed pen to paper.
            New entries will appear here as they are written.
          </div>
        ) : (
          <div className="jrnl-list">
            {entries.map(e => (
              <div key={e.id} className="jrnl-card" onClick={() => setOpen(e)}>
                <div className="jrnl-meta">
                  {e.author_name || 'The Cellarmaster'} &middot; {fmtDate(e.published_at)}
                </div>
                <h2 className="jrnl-title">{e.title}</h2>
                {e.excerpt && <p className="jrnl-excerpt">{e.excerpt}</p>}
              </div>
            ))}
          </div>
        )}
      </MemberPage>

      {open && (
        <div className="jrnl-back" onClick={() => setOpen(null)}>
          <article className="jrnl-reader" onClick={e => e.stopPropagation()}>
            <button className="jrnl-close" onClick={() => setOpen(null)} aria-label="Close">×</button>
            {open.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.cover_image_url} alt="" className="jrnl-cover" />
            )}
            <div className="jrnl-r-meta">From the Cellarmaster's Journal</div>
            <h1 className="jrnl-r-title">{open.title}</h1>
            <div className="jrnl-r-byline">
              {open.author_name || 'The Cellarmaster'} &middot; {fmtDate(open.published_at)}
            </div>
            <div className="jrnl-r-body">
              {open.body.split(/\n\s*\n/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </article>
        </div>
      )}
    </>
  )
}
