'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { categoryLabel } from '@/lib/gallery'

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

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
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
    if (!user) { setError('Please sign in again.'); return }
    const list = Array.from(files).filter(f => f.type.startsWith('image/'))
    setUploading(u => u + list.length)
    for (const file of list) {
      try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
        const path = `${id}/${user.id}/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from('event-media').upload(path, file, { contentType: file.type, upsert: false })
        if (up.error) { setError('Upload failed — try again.'); continue }
        const pub = supabase.storage.from('event-media').getPublicUrl(path).data.publicUrl
        const res = await fetch(`/api/members/events/${id}/media`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'image', url: pub, storage_path: path }),
        })
        if (!res.ok) setError((await res.json().catch(() => ({})))?.error || 'Could not save that photo.')
      } catch { setError('Upload failed — try again.') } finally { setUploading(u => u - 1) }
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
    if (!res.ok) { setError(j.error || 'Could not add the link.'); return }
    setLinkUrl(''); setLinkOpen(false); await load()
  }

  const removeMedia = async (mid: string) => {
    setMedia(m => m.filter(x => x.id !== mid))
    try { await fetch(`/api/members/events/${id}/media/${mid}`, { method: 'DELETE' }) } catch { /* */ }
  }
  const removeEvent = async () => {
    if (!confirm('Delete this whole event and its photos?')) return
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
        <Link href="/members/gallery" className="evd-back">← Event Gallery</Link>

        {loading ? (
          <div className="evd-empty" style={{ marginTop: 30 }}>Loading…</div>
        ) : !event ? (
          <div className="evd-empty" style={{ marginTop: 30 }}>This event isn’t available.</div>
        ) : (
          <>
            <div className="evd-cat">{categoryLabel(event.category)}{event.source === 'club' ? ' · The Club' : ''}</div>
            <h1 className="evd-title">{event.title}</h1>
            <div className="evd-meta">{[fmtDate(event.event_date), event.source === 'member' ? `added by ${event.creator_name}` : null].filter(Boolean).join(' · ')}</div>
            {event.description && <p className="evd-desc">{event.description}</p>}

            <div className="evd-bar">
              <button className="evd-btn gold" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
                {uploading > 0 ? `Uploading ${uploading}…` : '+ Add photos'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => onPickFiles(e.target.files)} />
              <button className="evd-btn ghost" onClick={() => setLinkOpen(o => !o)}>+ Add a link</button>
              {event.mine && <button className="evd-btn ghost" onClick={removeEvent} style={{ marginLeft: 'auto', color: '#C27070' }}>Delete event</button>}
            </div>

            {linkOpen && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <input className="evd-input" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://drive.google.com/… or a YouTube link" />
                <button className="evd-btn gold" onClick={addLink}>Add</button>
              </div>
            )}
            {error && <div className="evd-err">{error}</div>}

            {images.length > 0 && (
              <>
                <div className="evd-sec">Photos · {images.length}</div>
                <div className="evd-grid">
                  {images.map(m => (
                    <div key={m.id} className="evd-tile">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <a href={m.url} target="_blank" rel="noopener noreferrer"><img src={m.url} alt={m.caption || 'Event photo'} loading="lazy" /></a>
                      {m.mine && <button className="evd-rm" onClick={() => removeMedia(m.id)}>Remove</button>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {links.length > 0 && (
              <>
                <div className="evd-sec">Links · {links.length}</div>
                <div className="evd-links">
                  {links.map(m => (
                    <div key={m.id} className="evd-link">
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        {m.provider || 'Link'}{m.caption ? ` — ${m.caption}` : ''} ↗
                      </a>
                      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864' }}>{m.source === 'club' ? 'The Club' : m.submitter_name}</span>
                        {m.mine && <button className="evd-rm" style={{ position: 'static' }} onClick={() => removeMedia(m.id)}>Remove</button>}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {images.length === 0 && links.length === 0 && (
              <div className="evd-empty">No photos yet — be the first to add some.</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
