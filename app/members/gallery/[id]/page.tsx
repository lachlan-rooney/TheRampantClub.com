'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { categoryLabel } from '@/lib/gallery'
import { useLang, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"

interface EventHdr {
  id: string; title: string; category: string; event_date: string | null
  description: string | null; source: 'club' | 'member'; creator_name: string | null; mine: boolean
}
interface Media {
  id: string; kind: 'image' | 'link'; url: string; caption: string | null
  submitter_name: string | null; source: 'club' | 'member'; provider: string | null; mine: boolean
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

  const images = media.filter(m => m.kind === 'image')
  const links = media.filter(m => m.kind === 'link')

  return (
    <div style={{ minHeight: '100vh', background: '#052E20', padding: '92px 24px 100px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .evd-wrap { max-width: 920px; margin: 0 auto; }
        .evd-back { font-family:${MONO}; font-size:11px; color:#B2AA98; opacity:0.8; text-decoration:none; letter-spacing:0.06em; }
        .evd-back:hover { color:#D4B85A; }
        .evd-cat { font-family:${MONO}; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:#E7C766; margin:22px 0 8px; }
        .evd-title { font-family:${SERIF}; font-size:32px; color:#E5D4C2; margin:0 0 6px; line-height:1.1; }
        .evd-meta { font-family:${MONO}; font-size:11px; color:#B2AA98; letter-spacing:0.04em; }
        .evd-desc { font-family:${MONO}; font-size:12.5px; color:#B2AA98; line-height:1.7; max-width:640px; margin:14px 0 0; }
        .evd-bar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin:26px 0 8px; padding-top:20px; border-top:1px solid rgba(229,212,194,0.10); }
        .evd-btn { font-family:${MONO}; font-size:11px; letter-spacing:0.05em; padding:9px 16px; border-radius:8px; cursor:pointer; border:none; }
        .evd-btn.gold { background:#D4B85A; color:#052E20; font-weight:700; }
        .evd-btn.ghost { background:transparent; color:#B2AA98; border:1px solid rgba(229,212,194,0.18); }
        .evd-err { font-family:${MONO}; font-size:11px; color:#C27070; margin:10px 0; }
        .evd-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px,1fr)); gap:10px; margin-top:16px; }
        .evd-tile { position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden; border:1px solid rgba(229,212,194,0.12); background:#0A3526; }
        .evd-tile img { width:100%; height:100%; object-fit:cover; display:block; }
        .evd-rm { position:absolute; top:6px; right:6px; background:rgba(5,46,32,0.8); color:#E5D4C2; border:1px solid rgba(229,212,194,0.25); border-radius:6px; font-family:${MONO}; font-size:9px; padding:3px 7px; cursor:pointer; }
        .evd-rm:hover { color:#C27070; }
        .evd-links { display:flex; flex-direction:column; gap:8px; margin-top:14px; }
        .evd-link { display:flex; align-items:center; justify-content:space-between; gap:10px; border:1px solid rgba(229,212,194,0.12); border-radius:10px; padding:12px 14px; background:rgba(229,212,194,0.04); }
        .evd-link a { font-family:${MONO}; font-size:12px; color:#D4B85A; text-decoration:none; }
        .evd-sec { font-family:${MONO}; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:#B2AA98; opacity:0.7; margin:30px 0 4px; }
        .evd-empty { font-family:${MONO}; font-size:12px; color:#B2AA98; opacity:0.6; font-style:italic; padding:24px 0; }
        .evd-input { box-sizing:border-box; background:rgba(5,46,32,0.5); color:#E5D4C2; border:1px solid rgba(229,212,194,0.14); border-radius:7px; padding:9px 12px; font-family:${MONO}; font-size:12px; outline:none; min-width:260px; flex:1; }
      ` }} />
      <div className="evd-wrap">
        <Link href="/members/gallery" className="evd-back">← {surfaceName('/members/gallery', lang)}</Link>

        {loading ? (
          <div className="evd-empty" style={{ marginTop: 30 }}>{t('Loading…', 'Đang tải…')}</div>
        ) : !event ? (
          <div className="evd-empty" style={{ marginTop: 30 }}>{t('This event isn’t available.', 'Sự kiện này không khả dụng.')}</div>
        ) : (
          <>
            <div className="evd-cat">{categoryLabel(event.category, lang === 'vn')}{event.source === 'club' ? ' · The Club' : ''}</div>
            <h1 className="evd-title">{event.title}</h1>
            <div className="evd-meta">{[fmtDate(event.event_date, lang), event.source === 'member' ? t(`added by ${event.creator_name}`, `do ${event.creator_name} thêm`) : null].filter(Boolean).join(' · ')}</div>
            {event.description && <p className="evd-desc">{event.description}</p>}

            <div className="evd-bar">
              <button className="evd-btn gold" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
                {uploading > 0 ? t(`Uploading ${uploading}…`, `Đang tải lên ${uploading}…`) : t('+ Add photos', '+ Thêm ảnh')}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => onPickFiles(e.target.files)} />
              <button className="evd-btn ghost" onClick={() => setLinkOpen(o => !o)}>{t('+ Add a link', '+ Thêm liên kết')}</button>
              {event.mine && <button className="evd-btn ghost" onClick={removeEvent} style={{ marginLeft: 'auto', color: '#C27070' }}>{t('Delete event', 'Xóa sự kiện')}</button>}
            </div>

            {linkOpen && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <input className="evd-input" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder={t('https://drive.google.com/… or a YouTube link', 'https://drive.google.com/… hoặc liên kết YouTube')} />
                <button className="evd-btn gold" onClick={addLink}>{t('Add', 'Thêm')}</button>
              </div>
            )}
            {error && <div className="evd-err">{error}</div>}

            {images.length > 0 && (
              <>
                <div className="evd-sec">{t('Photos', 'Ảnh')} · {images.length}</div>
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
                <div className="evd-sec">{t('Links', 'Liên kết')} · {links.length}</div>
                <div className="evd-links">
                  {links.map(m => (
                    <div key={m.id} className="evd-link">
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        {m.provider && m.provider !== 'Link' ? m.provider : t('Link', 'Liên kết')}{m.caption ? ` — ${m.caption}` : ''} ↗
                      </a>
                      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864' }}>{m.source === 'club' ? 'The Club' : m.submitter_name}</span>
                        {m.mine && <button className="evd-rm" style={{ position: 'static' }} onClick={() => removeMedia(m.id)}>{t('Remove', 'Xoá')}</button>}
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
    </div>
  )
}
