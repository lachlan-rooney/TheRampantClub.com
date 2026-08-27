'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import MemberPage from '@/components/MemberPage'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { GALLERY_CATEGORIES, categoryLabel } from '@/lib/gallery'

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"

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
  provider: string
  mine: boolean
}
interface FixtureLite { id: string; title: string; sport: string; date: string }

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function GalleryPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [fixtures, setFixtures] = useState<FixtureLite[]>([])

  // Add form
  const [open, setOpen] = useState(false)
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
      const r = await fetch('/api/members/gallery', { cache: 'no-store' })
      const j = await r.json()
      setAlbums(j.albums || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // Fixtures for the optional picker (read via RLS like the Fixtures page).
  useEffect(() => {
    supabase.from('fixtures').select('id, title, sport, date').order('date', { ascending: false }).limit(80)
      .then(({ data }) => { if (data) setFixtures(data as FixtureLite[]) })
  }, [supabase])

  const submit = async () => {
    if (submitting) return
    setSubmitting(true); setError(null)
    try {
      const r = await fetch('/api/members/gallery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, category, url,
          event_date: eventDate || undefined,
          caption: caption || undefined,
          fixture_id: category === 'fixture' && fixtureId ? fixtureId : undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error || 'Could not save.'); return }
      setTitle(''); setUrl(''); setCaption(''); setEventDate(''); setFixtureId(''); setCategory('social')
      setOpen(false)
      await load()
    } catch { setError('Could not save. Try again.') } finally { setSubmitting(false) }
  }

  const remove = async (id: string) => {
    setAlbums(a => a.filter(x => x.id !== id))
    try { await fetch(`/api/members/gallery/${id}`, { method: 'DELETE' }) } catch { /* */ }
  }

  const shown = filter === 'all' ? albums : albums.filter(a => a.category === filter)
  const cats = ['all', ...GALLERY_CATEGORIES.map(c => c.key).filter(k => albums.some(a => a.category === k))]

  return (
    <MemberPage title="Event Gallery" subtitle="Thư Viện Sự Kiện" description="Photos & video from around the club — fixtures, dinners, tastings and socials. Add a link to your own.">
      <style dangerouslySetInnerHTML={{ __html: `
        .gal-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
        .gal-chips { display:flex; gap:6px; flex-wrap:wrap; }
        .gal-chip { font-family:${MONO}; font-size:10px; letter-spacing:0.06em; text-transform:uppercase;
          padding:5px 11px; border-radius:999px; cursor:pointer; border:1px solid rgba(229,212,194,0.14);
          background:transparent; color:#B2AA98; transition:all .2s ease; }
        .gal-chip:hover { border-color:rgba(212,184,90,0.5); color:#E5D4C2; }
        .gal-chip.on { background:rgba(212,184,90,0.14); border-color:rgba(212,184,90,0.55); color:#E7C766; }
        .gal-add { font-family:${MONO}; font-size:11px; letter-spacing:0.06em; padding:8px 16px; border-radius:8px;
          background:#D4B85A; color:#052E20; border:none; cursor:pointer; font-weight:700; }
        .gal-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px,1fr)); gap:14px; }
        .gal-card { position:relative; display:flex; flex-direction:column; border:1px solid rgba(229,212,194,0.12);
          border-radius:12px; padding:16px 16px 14px; background:rgba(229,212,194,0.04);
          transition:border-color .3s ease, transform .3s ease, background .3s ease; text-decoration:none; }
        .gal-card:hover { border-color:rgba(212,184,90,0.45); transform:translateY(-3px); background:rgba(229,212,194,0.07); }
        .gal-cat { align-self:flex-start; font-family:${MONO}; font-size:9px; letter-spacing:0.1em; text-transform:uppercase;
          color:#E7C766; background:rgba(212,184,90,0.12); border:1px solid rgba(212,184,90,0.3);
          padding:3px 9px; border-radius:999px; margin-bottom:12px; }
        .gal-title { font-family:${SERIF}; font-size:18px; color:#E5D4C2; line-height:1.2; margin-bottom:4px; }
        .gal-meta { font-family:${MONO}; font-size:10px; color:#B2AA98; letter-spacing:0.04em; margin-bottom:10px; }
        .gal-cap { font-family:${MONO}; font-size:11px; color:#B2AA98; opacity:0.85; line-height:1.5; margin-bottom:12px; }
        .gal-open { margin-top:auto; display:inline-flex; align-items:center; gap:6px; font-family:${MONO}; font-size:11px;
          letter-spacing:0.06em; color:#D4B85A; text-decoration:none; }
        .gal-byline { font-family:${MONO}; font-size:9px; color:#7E7864; letter-spacing:0.05em; margin-top:10px;
          display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .gal-remove { background:none; border:none; color:#8A6A6A; font-family:${MONO}; font-size:9px; cursor:pointer; letter-spacing:0.05em; }
        .gal-remove:hover { color:#C27070; }
        .gal-form { border:1px solid rgba(212,184,90,0.25); border-radius:12px; padding:18px; margin-bottom:22px; background:rgba(5,46,32,0.4); }
        .gal-label { font-family:${MONO}; font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:#B2AA98; margin:0 0 5px; display:block; }
        .gal-input, .gal-select { width:100%; box-sizing:border-box; background:rgba(5,46,32,0.5); color:#E5D4C2;
          border:1px solid rgba(229,212,194,0.14); border-radius:7px; padding:9px 12px; font-family:${MONO}; font-size:12px; outline:none; margin-bottom:12px; }
        .gal-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .gal-err { font-family:${MONO}; font-size:11px; color:#C27070; margin-bottom:10px; }
        .gal-empty { font-family:${MONO}; font-size:12px; color:#B2AA98; opacity:0.65; font-style:italic; padding:40px 0; text-align:center; }
        @media (max-width:520px){ .gal-row { grid-template-columns:1fr; } }
      ` }} />

      <div className="gal-actions">
        <div className="gal-chips">
          {cats.map(c => (
            <button key={c} className={`gal-chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
              {c === 'all' ? 'All' : categoryLabel(c)}
            </button>
          ))}
        </div>
        <button className="gal-add" onClick={() => setOpen(o => !o)}>{open ? 'Close' : '+ Add photos / video'}</button>
      </div>

      {open && (
        <div className="gal-form">
          {error && <div className="gal-err">{error}</div>}
          <label className="gal-label">Title</label>
          <input className="gal-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Padel Social — August" maxLength={120} />
          <div className="gal-row">
            <div>
              <label className="gal-label">What was it?</label>
              <select className="gal-select" value={category} onChange={e => setCategory(e.target.value)}>
                {GALLERY_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.en}</option>)}
              </select>
            </div>
            <div>
              <label className="gal-label">Date</label>
              <input className="gal-input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
          </div>
          {category === 'fixture' && fixtures.length > 0 && (
            <>
              <label className="gal-label">Link to a fixture (optional)</label>
              <select className="gal-select" value={fixtureId} onChange={e => setFixtureId(e.target.value)}>
                <option value="">— none —</option>
                {fixtures.map(f => <option key={f.id} value={f.id}>{f.title} · {fmtDate(f.date)}</option>)}
              </select>
            </>
          )}
          <label className="gal-label">Link (Google Drive, Photos, YouTube…)</label>
          <input className="gal-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          <label className="gal-label">A note (optional)</label>
          <input className="gal-input" value={caption} onChange={e => setCaption(e.target.value)} placeholder="A word about the evening" maxLength={280} />
          <button className="gal-add" onClick={submit} disabled={submitting} style={{ opacity: submitting ? 0.5 : 1 }}>
            {submitting ? 'Saving…' : 'Share it'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="gal-empty">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="gal-empty">No albums yet — be the first to share photos from an event.</div>
      ) : (
        <div className="gal-grid">
          {shown.map(a => (
            <div key={a.id} className="gal-card">
              <span className="gal-cat">{categoryLabel(a.category)}</span>
              <div className="gal-title">{a.title}</div>
              <div className="gal-meta">{[fmtDate(a.event_date), a.provider].filter(Boolean).join(' · ')}</div>
              {a.caption && <div className="gal-cap">{a.caption}</div>}
              <a className="gal-open" href={a.url} target="_blank" rel="noopener noreferrer">Open ↗</a>
              <div className="gal-byline">
                <span>{a.source === 'staff' ? 'The Club' : (a.submitter_name || 'A member')}</span>
                {a.mine && <button className="gal-remove" onClick={() => remove(a.id)}>Remove</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </MemberPage>
  )
}
