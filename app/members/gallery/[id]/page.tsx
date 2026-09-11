'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { categoryLabel } from '@/lib/gallery'
import { useLang, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'
import { PublicPage, Rise, type Ink } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// One event's wall: the title set large, the photographs as The Studio's rounded
// thumbnails that zoom on hover, the shared links as a hairline list. The house
// drawing for the kind of event drifts beside the title.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const INK = '#052E20'

interface EventHdr {
  id: string; title: string; category: string; event_date: string | null
  description: string | null; source: 'club' | 'member'; creator_name: string | null; mine: boolean
}
interface Media {
  id: string; kind: 'image' | 'link'; url: string; caption: string | null
  submitter_name: string | null; source: 'club' | 'member'; provider: string | null; mine: boolean
}

const INK_FOR: Record<string, Ink> = {
  tournament: 'golf-flag', fixture: 'golf-club', dinner: 'butler-tray', tasting: 'glass',
  social: 'gent-toast', event: 'girl-toast', other: 'newspaper',
}

const fmtDate = (d: string | null, lang: Lang) =>
  d ? new Date(d + 'T12:00:00+07:00').toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { t, lang } = useLang()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const fileRef = useRef<HTMLInputElement>(null)

  const [event, setEvent] = useState<EventHdr | null>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(0)      // count in flight
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/members/events/${id}`, { cache: 'no-store' })
      if (r.status === 404) { setEvent(null); return }
      const j = await r.json()
      setEvent(j.event); setMedia(j.media || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return
    setError(null)
    // Upload into THIS member's own sub-folder so the server can bind each
    // object to its uploader (see the media route) — nobody can register a row
    // over someone else's photo.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t('Please sign in again.', 'Vui lòng đăng nhập lại.')); return }
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    setUploading(u => u + list.length)
    for (const file of list) {
      try {
        // THROUGH THE SERVER, not straight to storage. The route re-encodes with
        // sharp, which strips EXIF — a photo taken at home carries the member's
        // GPS coordinates — and proves the bytes really are an image. The old
        // client-direct upload set Content-Type from `file.type`, i.e. from
        // whatever the browser claimed.
        const fd = new FormData()
        fd.append('file', file)
        const upRes = await fetch(`/api/members/events/${id}/media/upload`, { method: 'POST', body: fd })
        if (!upRes.ok) { setError((await upRes.json().catch(() => ({})))?.error || t('Upload failed — try again.', 'Tải lên thất bại — vui lòng thử lại.')); continue }
        const { storage_path: path, url: pub } = await upRes.json()
        const res = await fetch(`/api/members/events/${id}/media`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'image', url: pub, storage_path: path }),
        })
        if (!res.ok) setError((await res.json().catch(() => ({})))?.error || t('Could not save that photo.', 'Không thể lưu ảnh này.'))
      } catch { setError(t('Upload failed — try again.', 'Tải lên thất bại — vui lòng thử lại.')) } finally { setUploading(u => u - 1) }
    }
    await load()
  }

  const addLink = async () => {
    if (!linkUrl.trim()) return
    setError(null)
    const res = await fetch(`/api/members/events/${id}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'link', url: linkUrl.trim() }),
    })
    const j = await res.json()
    if (!res.ok) { setError(j.error || t('Could not add the link.', 'Không thể thêm liên kết.')); return }
    setLinkUrl(''); setLinkOpen(false); await load()
  }

  const removeMedia = async (mid: string) => {
    setMedia(m => m.filter(x => x.id !== mid))
    try { await fetch(`/api/members/events/${id}/media/${mid}`, { method: 'DELETE' }) } catch { /* */ }
  }
  const removeEvent = async () => {
    if (!confirm(t('Delete this whole event and its photos?', 'Xóa toàn bộ sự kiện này cùng các ảnh?'))) return
    try { await fetch(`/api/members/events/${id}`, { method: 'DELETE' }) } catch { /* */ }
    router.push('/members/gallery')
  }

  // The drawing for the kind of event, beside the title (not while loading).
  const drawing = !loading && event
    ? <CreamInk name={INK_FOR[event.category] || 'glass'} width="100%" rot={5} dur={9} />
    : null

  const images = media.filter(m => m.kind === 'image')
  const links = media.filter(m => m.kind === 'link')

  return (
    <PublicPage ground={INK} ink={CREAM}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* The masthead mirrors the member shell (components/MemberPage) so this
           page stands like its neighbours, with the way back to the gallery. */
        .evd { max-width: 1180px; margin: 0 auto; box-sizing: border-box; padding-bottom: 120px;
               padding-left: 24px; padding-right: max(24px, calc(150px - (100vw - 1180px) / 2)); }
        .evd-mast { display: grid; grid-template-columns: minmax(0, 1fr) clamp(150px, 19vw, 250px); gap: 48px; align-items: end;
                    padding-top: 118px; padding-bottom: 8px; }
        .evd-back { display: inline-flex; align-items: baseline; gap: 10px; color:${CREAM}; text-decoration: none;
                    font-family:${MONO}; font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase;
                    border-bottom: 1px solid rgba(229,212,194,.45); padding-bottom: 5px; opacity: .9;
                    transition: opacity .2s ease, border-color .2s ease; }
        .evd-back:hover { opacity: 1; border-bottom-color: ${GOLD}; }
        .evd-back .evd-go { display: inline-block; transition: transform .35s ease; }
        .evd-back:hover .evd-go { transform: translateX(-7px); }
        .evd-art { align-self: end; padding-bottom: 6px; }
        .evd-art .pk-float { height: clamp(170px, 20vw, 270px); display: flex; align-items: flex-end; justify-content: flex-end; }
        .evd-art .pk-float img { width: auto; height: auto; max-width: 100%; max-height: 100%; }
        .evd-top .evd-art { display: none; }
        .evd-title { font-family:${SERIF}; font-weight: 400; font-size: clamp(46px, 7.6vw, 104px); line-height: .92; margin: 34px 0 0;
                     overflow-wrap: anywhere; }
        .evd-title.is-long { font-size: clamp(34px, 5vw, 68px); line-height: .98; }
        .evd-meta { font-family:${MONO}; font-size: 13px; line-height: 1.8; margin-top: 22px; opacity: .9; }
        .evd-cat { color: ${GOLD}; }
        .evd-desc { font-family:${MONO}; font-size: 14px; line-height: 2; max-width: 620px; margin: 22px 0 0; opacity: .9; white-space: pre-line; }

        .evd-bar { display:flex; gap: 20px 34px; flex-wrap:wrap; align-items:center; margin: 48px 0 0; padding-bottom: 22px;
                   border-bottom: 1px solid rgba(229,212,194,.16); }
        .evd-cta { background: none; border: none; border-bottom: 1px solid currentColor; border-radius: 0; padding: 0 0 6px; cursor: pointer;
                   color: ${CREAM}; font-family: ${MONO}; font-size: 12.5px; letter-spacing: .14em; text-transform: uppercase; }
        .evd-cta.gold { color: ${GOLD}; }
        .evd-cta.danger { color: #E89B9B; border-bottom-color: rgba(232,155,155,.5); margin-left: auto; }
        .evd-cta:disabled { opacity: .55; cursor: default; }
        .evd-cta .pk-go { display: inline-block; transition: transform .35s ease; }
        .evd-cta:hover .pk-go { transform: translateX(7px); }
        .evd-linkform { display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-end; margin-top: 26px; max-width: 760px; }
        .evd-input { flex: 1; min-width: min(100%, 260px); box-sizing:border-box; background: transparent; color:${CREAM};
                     border: none; border-bottom: 1px solid rgba(229,212,194,.32); border-radius: 0; padding: 12px 0;
                     font-family:${MONO}; font-size: 14px; outline: none; transition: border-color .25s ease; }
        .evd-input::placeholder { color: rgba(229,212,194,.5); }
        .evd-input:focus { border-bottom-color: ${GOLD}; }
        .evd-err { font-family:${MONO}; font-size: 12.5px; line-height: 1.8; color: #E89B9B; margin: 18px 0 0; }

        .evd-h2 { font-family:${SERIF}; font-weight: 400; font-size: clamp(32px, 4.2vw, 52px); line-height: 1; margin: 64px 0 0; }
        .evd-n { font-family:${MONO}; font-size: 13px; letter-spacing: .1em; vertical-align: super; margin-left: 10px; opacity: .75; }

        .evd-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 22px; margin-top: 28px; }
        .evd-tile { position:relative; aspect-ratio: 4 / 5; border-radius: 12px; overflow:hidden; background: #0B3A29;
                    box-shadow: 0 14px 32px rgba(0,0,0,.32); }
        .evd-tile a { display: block; width: 100%; height: 100%; }
        .evd-tile img { width:100%; height:100%; object-fit:cover; display:block; transition: transform .7s cubic-bezier(.16,.84,.44,1); }
        .evd-tile:hover img { transform: scale(1.05); }
        .evd-rm { position:absolute; top: 10px; right: 10px; background: rgba(5,46,32,.82); color:${CREAM};
                  border: 1px solid rgba(229,212,194,.3); border-radius: 999px; font-family:${MONO}; font-size: 11px; letter-spacing: .06em;
                  padding: 5px 11px; cursor:pointer; }
        .evd-rm:hover { color: #E89B9B; border-color: rgba(232,155,155,.6); }

        .evd-links { margin-top: 22px; border-top: 1px solid rgba(229,212,194,.14); }
        .evd-link { display:flex; align-items:center; justify-content:space-between; gap: 12px 20px; flex-wrap: wrap;
                    padding: 20px 0; border-bottom: 1px solid rgba(229,212,194,.14); }
        .evd-link a { font-family:${SERIF}; font-size: clamp(22px, 2.4vw, 30px); line-height: 1.15; color:${CREAM}; text-decoration:none; min-width: 0; }
        .evd-link a:hover { color: ${GOLD}; }
        .evd-by { display: flex; gap: 16px; align-items: center; font-family:${MONO}; font-size: 12px; opacity: .85; }
        .evd-by .evd-rm { position: static; }
        .evd-empty { font-family:${MONO}; font-size: 13px; line-height: 1.9; opacity: .8; padding: 36px 0 0; }

        @media (max-width: 860px) {
          .evd { padding-left: 20px; padding-right: 20px; padding-bottom: 96px; }
          .evd-mast { display: block; padding-top: 118px; }
          .evd-mast > .evd-art { display: none; }
          .evd-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
          .evd-top .evd-art { display: block; width: 120px; flex: 0 0 auto; padding-bottom: 0; margin-right: -4px; }
          .evd-top .evd-art .pk-float { height: 88px; }
          .evd-title { margin-top: 26px; font-size: clamp(40px, 12vw, 64px); }
          .evd-title.is-long { font-size: clamp(30px, 8.4vw, 44px); }
        }
        @media (max-width: 600px) {
          .evd-desc { font-size: 13px; }
          .evd-input { font-size: 16px; }
          .evd-bar { gap: 18px 26px; margin-top: 36px; }
          .evd-cta.danger { margin-left: 0; }
          .evd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .evd-rm { top: 8px; right: 8px; padding: 4px 9px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .evd-tile img, .evd-cta .pk-go { transition: none; }
        }
      ` }} />
      <CreamInkDefs />

      <div className="evd">
        <header className="evd-mast">
          <div>
            <div className="evd-top">
              <Link href="/members/gallery" className="evd-back"><span className="evd-go" aria-hidden="true">←</span>{surfaceName('/members/gallery', lang)}</Link>
              {drawing && <div className="evd-art">{drawing}</div>}
            </div>
            {loading ? (
              <div className="evd-empty" style={{ marginTop: 30 }}>{t('Loading…', 'Đang tải…')}</div>
            ) : !event ? (
              <div className="evd-empty" style={{ marginTop: 30 }}>{t('This event isn’t available.', 'Sự kiện này không khả dụng.')}</div>
            ) : (
              <>
                <Rise><h1 className={'evd-title' + (event.title.length > 26 ? ' is-long' : '')}>{event.title}</h1></Rise>
                <Rise delay={0.08}>
                  <div className="evd-meta">
                    <span className="evd-cat">{categoryLabel(event.category, lang === 'vn')}{event.source === 'club' ? ' · The Club' : ''}</span>
                    {(event.event_date || event.source === 'member') && <br />}
                    {[fmtDate(event.event_date, lang), event.source === 'member' ? t(`added by ${event.creator_name}`, `do ${event.creator_name} thêm`) : null].filter(Boolean).join(' · ')}
                  </div>
                  {event.description && <p className="evd-desc">{event.description}</p>}
                </Rise>
              </>
            )}
          </div>
          {drawing && <Rise delay={0.12} className="evd-art">{drawing}</Rise>}
        </header>

        {!loading && event && (
          <>

            <div className="evd-bar">
              <button className="evd-cta gold" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
                {uploading > 0 ? t(`Uploading ${uploading}…`, `Đang tải lên ${uploading}…`) : t('+ Add photos', '+ Thêm ảnh')}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => onPickFiles(e.target.files)} />
              <button className="evd-cta" onClick={() => setLinkOpen(o => !o)}>{t('+ Add a link', '+ Thêm liên kết')}</button>
              {event.mine && <button className="evd-cta danger" onClick={removeEvent}>{t('Delete event', 'Xóa sự kiện')}</button>}
            </div>

            {linkOpen && (
              <div className="evd-linkform">
                <input className="evd-input" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder={t('https://drive.google.com/… or a YouTube link', 'https://drive.google.com/… hoặc liên kết YouTube')} />
                <button className="evd-cta gold" onClick={addLink}>{t('Add', 'Thêm')} <span className="pk-go">→</span></button>
              </div>
            )}
            {error && <div className="evd-err" role="alert">{error}</div>}

            {images.length > 0 && (
              <>
                <h2 className="evd-h2">{t('Photos', 'Ảnh')}<span className="evd-n">{images.length}</span></h2>
                <div className="evd-grid">
                  {images.map(m => (
                    <div key={m.id} className="evd-tile">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <a href={m.url} target="_blank" rel="noopener noreferrer"><img src={m.url} alt={m.caption || t('Event photo', 'Ảnh sự kiện')} loading="lazy" /></a>
                      {m.mine && <button className="evd-rm" onClick={() => removeMedia(m.id)}>{t('Remove', 'Xoá')}</button>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {links.length > 0 && (
              <>
                <h2 className="evd-h2">{t('Links', 'Liên kết')}<span className="evd-n">{links.length}</span></h2>
                <div className="evd-links">
                  {links.map(m => (
                    <div key={m.id} className="evd-link">
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        {m.provider && m.provider !== 'Link' ? m.provider : t('Link', 'Liên kết')}{m.caption ? ` — ${m.caption}` : ''} ↗
                      </a>
                      <span className="evd-by">
                        <span>{m.source === 'club' ? 'The Club' : m.submitter_name}</span>
                        {m.mine && <button className="evd-rm" onClick={() => removeMedia(m.id)}>{t('Remove', 'Xoá')}</button>}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {images.length === 0 && links.length === 0 && (
              <div className="evd-empty">{t('No photos yet — be the first to add some.', 'Chưa có ảnh nào — hãy là người đầu tiên thêm ảnh.')}</div>
            )}
          </>
        )}
      </div>
    </PublicPage>
  )
}
