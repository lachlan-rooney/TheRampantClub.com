'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/admin-lang'
import { GALLERY_CATEGORIES, categoryLabel } from '@/lib/gallery'

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Album {
  id: string
  title: string
  category: string
  event_date: string | null
  url: string
  caption: string | null
  fixture_id: string | null
  submitter_name: string | null
  source: 'member' | 'staff'
  status: 'visible' | 'hidden'
  provider: string
  created_at: string
}
interface FixtureLite { id: string; title: string; sport: string; date: string }

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function AdminGalleryPage() {
  const { t } = useLang()
  const [albums, setAlbums] = useState<Album[]>([])
  const [fixtures, setFixtures] = useState<FixtureLite[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden' | 'member'>('all')
  const [busy, setBusy] = useState<string | null>(null)

  // Add form
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('social')
  const [eventDate, setEventDate] = useState('')
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [fixtureId, setFixtureId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/gallery', { cache: 'no-store' })
      const j = await r.json()
      setAlbums(j.albums || []); setFixtures(j.fixtures || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    if (submitting) return
    setSubmitting(true); setError(null)
    try {
      const r = await fetch('/api/admin/gallery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, category, url,
          event_date: eventDate || undefined,
          caption: caption || undefined,
          fixture_id: category === 'fixture' && fixtureId ? fixtureId : undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error || t('Could not save.', 'Không thể lưu.')); return }
      setTitle(''); setUrl(''); setCaption(''); setEventDate(''); setFixtureId(''); setCategory('social')
      await load()
    } catch { setError(t('Could not save.', 'Không thể lưu.')) } finally { setSubmitting(false) }
  }

  const setStatus = async (id: string, status: 'visible' | 'hidden') => {
    setBusy(id)
    setAlbums(a => a.map(x => x.id === id ? { ...x, status } : x))
    try { await fetch(`/api/admin/gallery/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }) } catch { /* */ } finally { setBusy(null) }
  }
  const remove = async (id: string) => {
    if (!confirm(t('Remove this album permanently?', 'Xoá album này vĩnh viễn?'))) return
    setBusy(id)
    setAlbums(a => a.filter(x => x.id !== id))
    try { await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' }) } catch { /* */ } finally { setBusy(null) }
  }

  const memberCount = albums.filter(a => a.source === 'member').length
  const shown = useMemo(() => albums.filter(a =>
    filter === 'all' ? true : filter === 'member' ? a.source === 'member' : a.status === filter
  ), [albums, filter])

  return (
    <div style={{ maxWidth: 1000 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .agx-input, .agx-select { box-sizing:border-box; background:rgba(5,46,32,0.5); color:#E5D4C2;
          border:1px solid rgba(229,212,194,0.14); border-radius:7px; padding:9px 12px; font-family:${MONO}; font-size:12px; outline:none; }
        .agx-btn { font-family:${MONO}; font-size:11px; letter-spacing:0.05em; padding:7px 14px; border-radius:7px; cursor:pointer; border:1px solid rgba(229,212,194,0.16); background:rgba(229,212,194,0.04); color:#B2AA98; }
        .agx-btn.gold { background:#D4B85A; color:#052E20; border:none; font-weight:700; }
        .agx-chip { font-family:${MONO}; font-size:10px; letter-spacing:0.05em; padding:5px 11px; border-radius:999px; cursor:pointer; border:1px solid rgba(229,212,194,0.14); background:transparent; color:#B2AA98; }
        .agx-chip.on { background:rgba(212,184,90,0.14); border-color:rgba(212,184,90,0.5); color:#E7C766; }
        .agx-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid rgba(229,212,194,0.10); border-radius:10px; margin-bottom:8px; }
      ` }} />

      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', marginBottom: 4 }}>{t('Event Gallery', 'Thư Viện Sự Kiện')}</h1>
      <p style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginBottom: 22, letterSpacing: '0.04em' }}>
        {t('Photo & video links from club events. Members can add their own — hide or remove anything here.', 'Liên kết ảnh & video từ các sự kiện. Hội viên có thể tự thêm — ẩn hoặc xoá tại đây.')}
        {memberCount > 0 && ` · ${memberCount} ${t('member-submitted', 'do hội viên gửi')}`}
      </p>

      {/* Add */}
      <div style={{ border: '1px solid rgba(212,184,90,0.25)', borderRadius: 12, padding: 18, marginBottom: 24, background: 'rgba(5,46,32,0.4)' }}>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#D4B85A', marginBottom: 12 }}>{t('Post a link', 'Đăng một liên kết')}</div>
        {error && <div style={{ fontFamily: MONO, fontSize: 11, color: '#C27070', marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input className="agx-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('Title', 'Tiêu đề')} maxLength={120} />
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
        <input className="agx-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/…" style={{ width: '100%', marginBottom: 10 }} />
        <input className="agx-input" value={caption} onChange={e => setCaption(e.target.value)} placeholder={t('A note (optional)', 'Ghi chú (tuỳ chọn)')} maxLength={280} style={{ width: '100%', marginBottom: 12 }} />
        <button className="agx-btn gold" onClick={add} disabled={submitting} style={{ opacity: submitting ? 0.5 : 1 }}>{submitting ? t('Saving…', 'Đang lưu…') : t('Post', 'Đăng')}</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['all', 'visible', 'hidden', 'member'] as const).map(f => (
          <button key={f} className={`agx-chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? t('All', 'Tất cả') : f === 'visible' ? t('Visible', 'Hiển thị') : f === 'hidden' ? t('Hidden', 'Đã ẩn') : t('Member-added', 'Hội viên thêm')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6 }}>{t('Loading…', 'Đang tải…')}</div>
      ) : shown.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic', padding: '24px 0' }}>{t('Nothing here.', 'Không có gì ở đây.')}</div>
      ) : shown.map(a => (
        <div key={a.id} className="agx-row" style={{ opacity: a.status === 'hidden' ? 0.5 : 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>{a.title}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#E7C766', background: 'rgba(212,184,90,0.12)', border: '1px solid rgba(212,184,90,0.3)', padding: '2px 8px', borderRadius: 999 }}>{categoryLabel(a.category, false)}</span>
              {a.source === 'member' && <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9FC29F', background: 'rgba(122,176,122,0.12)', border: '1px solid rgba(122,176,122,0.3)', padding: '2px 8px', borderRadius: 999 }}>{t('member', 'hội viên')}</span>}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98', marginTop: 4 }}>
              {[fmtDate(a.event_date), a.provider, a.submitter_name].filter(Boolean).join(' · ')}
            </div>
            <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: 10, color: '#D4B85A', textDecoration: 'none' }}>{t('Open link ↗', 'Mở liên kết ↗')}</a>
          </div>
          <button className="agx-btn" disabled={busy === a.id} onClick={() => setStatus(a.id, a.status === 'visible' ? 'hidden' : 'visible')}>
            {a.status === 'visible' ? t('Hide', 'Ẩn') : t('Show', 'Hiện')}
          </button>
          <button className="agx-btn" disabled={busy === a.id} onClick={() => remove(a.id)} style={{ color: '#C27070', borderColor: 'rgba(194,112,112,0.3)' }}>{t('Delete', 'Xoá')}</button>
        </div>
      ))}
    </div>
  )
}
