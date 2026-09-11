'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import { useLang, type Lang } from '@/lib/lang'

interface Entry {
  id: string
  title: string
  body: string
  excerpt: string | null
  author_name: string | null
  cover_image_url: string | null
  published_at: string
}

const fmtDate = (d: string, lang: Lang = 'en') =>
  new Date(d).toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export default function MembersJournal() {
  const { t, lang } = useLang()
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
      <style>{`
        .jrnl-empty { font-family: 'Google Sans Code', monospace; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .8;
                      max-width: 560px; margin: 0; }
        .jrnl-quiet { font-family: 'Google Sans Code', monospace; font-size: 14px; color: #E5D4C2; opacity: .8; margin: 0; }

        /* The entries, as a contents page: the title set large, the excerpt
           beneath, the date and hand in the margin of the line. */
        .jrnl-list { max-width: 900px; border-bottom: 1px solid rgba(229,212,194,.18); }
        .jrnl-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 32px; align-items: baseline;
                     padding: 30px 0 32px; border-top: 1px solid rgba(229,212,194,.18); cursor: pointer; color: #E5D4C2; }
        .jrnl-title { grid-column: 1; font-family: 'Rampant Sans', serif; font-weight: 400; font-size: clamp(30px, 3.8vw, 50px);
                      line-height: 1; margin: 0; transition: color .3s ease; }
        .jrnl-card:hover .jrnl-title { color: #D4B85A; }
        .jrnl-go { grid-column: 2; grid-row: 1; font-family: 'Google Sans Code', monospace; font-size: 16px; color: #D4B85A; }
        .jrnl-meta { grid-column: 1 / -1; font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .12em;
                     text-transform: uppercase; color: #D4B85A; margin-top: 6px; }
        .jrnl-excerpt { grid-column: 1; font-family: 'Google Sans Code', monospace; font-size: 13.5px; line-height: 1.95;
                        color: #E5D4C2; opacity: .85; margin: 6px 0 0; max-width: 640px; }

        /* The reader: the entry delivered on a sheet of the house paper */
        .jrnl-back {
          position: fixed; inset: 0;
          background: rgba(5,46,32,0.82);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          z-index: 99980;
          display: flex; align-items: flex-start; justify-content: center;
          padding: 7vh 16px 9vh; overflow-y: auto; overscroll-behavior: contain;
          animation: jrnl-fade 0.4s ease;
        }
        @keyframes jrnl-fade { from { opacity: 0 } to { opacity: 1 } }
        .jrnl-reader {
          background: #F3E9DA; color: #052E20;
          border-radius: 4px;
          max-width: 720px; width: 100%;
          padding: clamp(34px, 6vw, 64px) clamp(24px, 6vw, 68px) clamp(34px, 5vw, 56px);
          position: relative;
          box-shadow: 0 40px 90px rgba(0,0,0,.45), 0 10px 24px rgba(0,0,0,.25);
          animation: jrnl-rise 0.8s cubic-bezier(.16,.84,.44,1);
        }
        .jrnl-reader::before { content: ''; position: absolute; inset: 12px; border: 1px solid rgba(5,46,32,.12); border-radius: 2px; pointer-events: none; }
        @keyframes jrnl-rise {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .jrnl-close {
          position: relative; z-index: 1; display: block; margin-left: auto;
          background: none; border: none; cursor: pointer; color: #052E20; padding: 4px 0;
          font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
        }
        .jrnl-close span { display: inline-block; margin-left: 8px; font-size: 16px; line-height: 1; transition: transform .35s ease; }
        .jrnl-close:hover span { transform: rotate(90deg); }
        .jrnl-cover { display: block; width: 100%; height: auto; max-height: 360px; object-fit: cover; border-radius: 3px; margin: 22px 0 6px; }
        .jrnl-r-meta {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
          opacity: .65; margin: 28px 0 0;
        }
        .jrnl-r-title {
          font-family: 'Rampant Sans', serif; font-weight: 400;
          font-size: clamp(38px, 6vw, 64px); line-height: .96;
          margin: 14px 0 0;
        }
        .jrnl-r-byline {
          font-family: 'Google Sans Code', monospace;
          font-size: 12px; letter-spacing: .04em; opacity: .7;
          margin: 16px 0 30px;
        }
        .jrnl-r-body p {
          font-family: 'Google Sans Code', monospace;
          font-size: 13.5px; line-height: 2;
          opacity: .92; margin: 0 0 18px;
        }
        .jrnl-r-body p:first-child::first-letter { font-family: 'Rampant Sans', serif; float: left; font-size: 64px; line-height: .82; margin: 7px 6px 0 0; }
        @media (max-width: 600px) {
          .jrnl-card { grid-template-columns: minmax(0, 1fr); padding: 26px 0 28px; }
          .jrnl-go { display: none; }
          .jrnl-reader::before { inset: 8px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jrnl-back, .jrnl-reader { animation: none; }
          .jrnl-close span { transition: none; }
        }
      `}</style>

      <MemberPage title="The Cellarmaster's Journal" subtitle="Nhật Ký Cellarmaster">
        {loading ? (
          <p className="jrnl-quiet">{t('Loading…', 'Đang tải…')}</p>
        ) : entries.length === 0 ? (
          <p className="jrnl-empty">
            {t('The Cellarmaster has not yet committed pen to paper. New entries will appear here as they are written.',
              'Cellarmaster vẫn chưa đặt bút. Các bài viết mới sẽ xuất hiện tại đây khi được hoàn thành.')}
          </p>
        ) : (
          <div className="jrnl-list">
            {entries.map(e => (
              <div key={e.id} className="jrnl-card" onClick={() => setOpen(e)}>
                <h2 className="jrnl-title">{e.title}</h2>
                <span className="jrnl-go" aria-hidden="true">→</span>
                {e.excerpt && <p className="jrnl-excerpt">{e.excerpt}</p>}
                <div className="jrnl-meta">
                  {e.author_name || t('The Cellarmaster', 'Cellarmaster')} &middot; {fmtDate(e.published_at, lang)}
                </div>
              </div>
            ))}
          </div>
        )}
      </MemberPage>

      {open && (
        <div className="jrnl-back" onClick={() => setOpen(null)}>
          <article className="jrnl-reader" onClick={e => e.stopPropagation()}>
            <button className="jrnl-close" onClick={() => setOpen(null)} aria-label={t('Close', 'Đóng')}>{t('Close', 'Đóng')}<span aria-hidden="true">×</span></button>
            {open.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.cover_image_url} alt="" className="jrnl-cover" />
            )}
            <div className="jrnl-r-meta">{t("From the Cellarmaster's Journal", 'Trích từ Nhật Ký Cellarmaster')}</div>
            <h1 className="jrnl-r-title">{open.title}</h1>
            <div className="jrnl-r-byline">
              {open.author_name || t('The Cellarmaster', 'Cellarmaster')} &middot; {fmtDate(open.published_at, lang)}
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
