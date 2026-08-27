'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/admin-lang'
import { GALLERY_CATEGORIES, categoryLabel } from '@/lib/gallery'

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface EventRow {
  id: string; title: string; category: string; event_date: string | null
  description: string | null; source: 'club' | 'member'; creator_name: string | null
  status: 'visible' | 'hidden'; media_count: number; media_hidden: number
}
interface Media {
  id: string; kind: 'image' | 'link'; url: string; caption: string | null
  submitter_name: string | null; source: 'club' | 'member'; status: 'visible' | 'hidden'; provider: string | null
}
interface FixtureLite { id: string; title: string; sport: string; date: string }

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function AdminGalleryPage() {
  const { t } = useLang()
  const [events, setEvents] = useState<EventRow[]>([])
  const [fixtures, setFixtures] = useState<FixtureLite[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden' | 'member'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [media, setMedia] = useState<Media[]>([])

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('social')
  const [eventDate, setEventDate] = useState('')
  const [description, setDescription] = useState('')
  const [fixtureId, setFixtureId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/events', { cache: 'no-store' })
      const j = await r.json()
      setEvents(j.events || []); setFixtures(j.fixtures || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const openEvent = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id); setMedia([])
    const r = await fetch(`/api/admin/events/${id}`, { cache: 'no-store' })
    const j = await r.json()
    setMedia(j.media || [])
  }

  const add = async () => {
    if (submitting) return
    setSubmitting(true); setError(null)
    try {
      const r = await fetch('/api/admin/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, event_date: eventDate || undefined, description: description || undefined, fixture_id: category === 'fixture' && fixtureId ? fixtureId : undefined }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error || t('Could not save.', 'Không thể lưu.')); return }
      setTitle(''); setDescription(''); setEventDate(''); setFixtureId(''); setCategory('social')
      await load()
    } catch { setError(t('Could not save.', 'Không thể lưu.')) } finally { setSubmitting(false) }
  }

  const setEventStatus = async (id: string, status: 'visible' | 'hidden') => {
    setBusy(id); setEvents(e => e.map(x => x.id === id ? { ...x, status } : x))
    try { await fetch(`/api/admin/events/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }) } catch { /* */ } finally { setBusy(null) }
  }
  const deleteEvent = async (id: string) => {
    if (!confirm(t('Delete this event and all its photos/links?', 'Xoá sự kiện này và toàn bộ ảnh/liên kết?'))) return
    setBusy(id); setEvents(e => e.filter(x => x.id !== id)); if (expanded === id) setExpanded(null)
    try { await fetch(`/api/admin/events/${id}`, { method: 'DELETE' }) } catch { /* */ } finally { setBusy(null) }
  }
  const setMediaStatus = async (mid: string, status: 'visible' | 'hidden') => {
    setMedia(m => m.map(x => x.id === mid ? { ...x, status } : x))
    try { await fetch(`/api/admin/events/${expanded}/media/${mid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }) } catch { /* */ }
  }
  const deleteMedia = async (mid: string) => {
    setMedia(m => m.filter(x => x.id !== mid))
    try { await fetch(`/api/admin/events/${expanded}/media/${mid}`, { method: 'DELETE' }) } catch { /* */ }
  }

  const memberCount = events.filter(e => e.source === 'member').length
  const shown = useMemo(() => events.filter(e =>
    filter === 'all' ? true : filter === 'member' ? e.source === 'member' : e.status === filter
  ), [events, filter])

  return (
    <div style={{ maxWidth: 1000 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .agx-input, .agx-select { box-sizing:border-box; background:rgba(5,46,32,0.5); color:#E5D4C2; border:1px solid rgba(229,212,194,0.14); border-radius:7px; padding:9px 12px; font-family:${MONO}; font-size:12px; outline:none; }
        .agx-btn { font-family:${MONO}; font-size:11px; letter-spacing:0.05em; padding:7px 14px; border-radius:7px; cursor:pointer; border:1px solid rgba(229,212,194,0.16); background:rgba(229,212,194,0.04); color:#B2AA98; }
        .agx-btn.gold { background:#D4B85A; color:#052E20; border:none; font-weight:700; }
        .agx-chip { font-family:${MONO}; font-size:10px; letter-spacing:0.05em; padding:5px 11px; border-radius:999px; cursor:pointer; border:1px solid rgba(229,212,194,0.14); background:transparent; color:#B2AA98; }
        .agx-chip.on { background:rgba(212,184,90,0.14); border-color:rgba(212,184,90,0.5); color:#E7C766; }
        .agx-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid rgba(229,212,194,0.10); border-radius:10px; margin-bottom:8px; flex-wrap:wrap; }
        .agx-mgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(120px,1fr)); gap:8px; margin-top:6px; }
        .agx-tile { position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; border:1px solid rgba(229,212,194,0.12); }
        .agx-tile img { width:100%; height:100%; object-fit:cover; }
      ` }} />

      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>{t('Event Gallery', 'Thư Viện Sự Kiện')}</h1>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 22, letterSpacing: '0.04em' }}>
        {t('Events members click into to see and add photos & links. Members create their own too — hide or remove anything here.', 'Sự kiện mà hội viên bấm vào để xem và thêm ảnh & liên kết. Hội viên cũng tự tạo — ẩn hoặc xoá bất cứ thứ gì tại đây.')}
        {memberCount > 0 && ` · ${memberCount} ${t('member-created', 'do hội viên tạo')}`}
      </p>

      {/* Create club event */}
      <div style={{ border: '1px solid rgba(212,184,90,0.25)', borderRadius: 12, padding: 18, marginBottom: 24, background: 'rgba(5,46,32,0.4)' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D4B85A', marginBottom: 12 }}>{t('Create a club event', 'Tạo sự kiện của câu lạc bộ')}</div>
        {error && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input className="agx-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('Event title', 'Tiêu đề sự kiện')} maxLength={120} />
          <select className="agx-select" value={category} onChange={e => setCategory(e.target.value)}>
            {GALLERY_CATEGORIES.map(c => <option key={c.key} value={c.key}>{t(c.en, c.vn)}</option>)}
          </select>
          <input className="agx-input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </div>
        {category === 'fixture' && fixtures.length > 0 && (
          <select className="agx-select" value={fixtureId} onChange={e => setFixtureId(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
            <option value="">{t('— link to a fixture (optional) —', '— liên kết với trận đấu (tuỳ chọn) —')}</option>
            {fixtures.map(f => <option key={f.id} value={f.id}>{f.title} · {fmtDate(f.date)}</option>)}
          </select>
        )}
        <input className="agx-input" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('A note (optional)', 'Ghi chú (tuỳ chọn)')} maxLength={600} style={{ width: '100%', marginBottom: 12 }} />
        <button className="agx-btn gold" onClick={add} disabled={submitting} style={{ opacity: submitting ? 0.5 : 1 }}>{submitting ? t('Saving…', 'Đang lưu…') : t('Create', 'Tạo')}</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['all', 'visible', 'hidden', 'member'] as const).map(f => (
          <button key={f} className={`agx-chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? t('All', 'Tất cả') : f === 'visible' ? t('Visible', 'Hiển thị') : f === 'hidden' ? t('Hidden', 'Đã ẩn') : t('Member-created', 'Hội viên tạo')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6 }}>{t('Loading…', 'Đang tải…')}</div>
      ) : shown.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic', padding: '24px 0' }}>{t('Nothing here.', 'Không có gì ở đây.')}</div>
      ) : shown.map(e => (
        <div key={e.id} style={{ marginBottom: 8 }}>
          <div className="agx-row" style={{ opacity: e.status === 'hidden' ? 0.5 : 1, marginBottom: 0 }}>
            <button onClick={() => openEvent(e.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>{e.title}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E7C766', background: 'rgba(212,184,90,0.12)', border: '1px solid rgba(212,184,90,0.3)', padding: '2px 8px', borderRadius: 999 }}>{categoryLabel(e.category, false)}</span>
                {e.source === 'member' && <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9FC29F', background: 'rgba(122,176,122,0.12)', border: '1px solid rgba(122,176,122,0.3)', padding: '2px 8px', borderRadius: 999 }}>{t('member', 'hội viên')}</span>}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', marginTop: 4 }}>
                {[fmtDate(e.event_date), `${e.media_count} ${t('items', 'mục')}`, e.source === 'member' ? e.creator_name : 'The Club'].filter(Boolean).join(' · ')}
                {e.media_hidden > 0 && ` · ${e.media_hidden} ${t('hidden', 'đã ẩn')}`}
              </div>
            </button>
            <button className="agx-btn" disabled={busy === e.id} onClick={() => setEventStatus(e.id, e.status === 'visible' ? 'hidden' : 'visible')}>{e.status === 'visible' ? t('Hide', 'Ẩn') : t('Show', 'Hiện')}</button>
            <button className="agx-btn" disabled={busy === e.id} onClick={() => deleteEvent(e.id)} style={{ color: '#C27070', borderColor: 'rgba(194,112,112,0.3)' }}>{t('Delete', 'Xoá')}</button>
          </div>

          {expanded === e.id && (
            <div style={{ border: '1px solid rgba(229,212,194,0.10)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 14 }}>
              {media.length === 0 ? (
                <div style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', opacity: 0.6 }}>{t('No contributions yet.', 'Chưa có đóng góp nào.')}</div>
              ) : (
                <>
                  <div className="agx-mgrid">
                    {media.filter(m => m.kind === 'image').map(m => (
                      <div key={m.id} className="agx-tile" style={{ opacity: m.status === 'hidden' ? 0.4 : 1 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <a href={m.url} target="_blank" rel="noopener noreferrer"><img src={m.url} alt="" loading="lazy" /></a>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', gap: 4, padding: 4, background: 'rgba(5,46,32,0.75)' }}>
                          <button onClick={() => setMediaStatus(m.id, m.status === 'visible' ? 'hidden' : 'visible')} style={{ flex: 1, fontFamily: MONO, fontSize: 8, background: 'none', border: 'none', color: '#E5D4C2', cursor: 'pointer' }}>{m.status === 'visible' ? t('Hide', 'Ẩn') : t('Show', 'Hiện')}</button>
                          <button onClick={() => deleteMedia(m.id)} style={{ flex: 1, fontFamily: MONO, fontSize: 8, background: 'none', border: 'none', color: '#C27070', cursor: 'pointer' }}>{t('Del', 'Xoá')}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {media.filter(m => m.kind === 'link').map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, opacity: m.status === 'hidden' ? 0.4 : 1 }}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontFamily: MONO, fontSize: 11, color: '#D4B85A', textDecoration: 'none' }}>{m.provider || 'Link'}{m.caption ? ` — ${m.caption}` : ''} ↗</a>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864' }}>{m.source === 'club' ? 'The Club' : m.submitter_name}</span>
                      <button className="agx-btn" onClick={() => setMediaStatus(m.id, m.status === 'visible' ? 'hidden' : 'visible')}>{m.status === 'visible' ? t('Hide', 'Ẩn') : t('Show', 'Hiện')}</button>
                      <button className="agx-btn" onClick={() => deleteMedia(m.id)} style={{ color: '#C27070', borderColor: 'rgba(194,112,112,0.3)' }}>{t('Delete', 'Xoá')}</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
