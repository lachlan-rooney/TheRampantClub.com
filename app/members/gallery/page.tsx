'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { GALLERY_CATEGORIES, categoryLabel } from '@/lib/gallery'

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"

interface EventCard {
  id: string
  title: string
  category: string
  event_date: string | null
  description: string | null
  source: 'club' | 'member'
  creator_name: string | null
  media_count: number
  cover: string | null
  mine: boolean
}
interface FixtureLite { id: string; title: string; sport: string; date: string }

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T12:00:00+07:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function GalleryPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [events, setEvents] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [fixtures, setFixtures] = useState<FixtureLite[]>([])

  const [open, setOpen] = useState(false)
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
      const r = await fetch('/api/members/events', { cache: 'no-store' })
      const j = await r.json()
      setEvents(j.events || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.from('fixtures').select('id, title, sport, date').order('date', { ascending: false }).limit(80)
      .then(({ data }) => { if (data) setFixtures(data as FixtureLite[]) })
  }, [supabase])

  const create = async () => {
    if (submitting) return
    setSubmitting(true); setError(null)
    try {
      const r = await fetch('/api/members/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, category,
          event_date: eventDate || undefined,
          description: description || undefined,
          fixture_id: category === 'fixture' && fixtureId ? fixtureId : undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error || 'Could not create.'); return }
      setTitle(''); setDescription(''); setEventDate(''); setFixtureId(''); setCategory('social'); setOpen(false)
      await load()
    } catch { setError('Could not create. Try again.') } finally { setSubmitting(false) }
  }

  const shown = filter === 'all' ? events : events.filter(e => e.category === filter)
  const cats = ['all', ...GALLERY_CATEGORIES.map(c => c.key).filter(k => events.some(e => e.category === k))]

  return (
    <MemberPage title="Event Gallery" subtitle="Thư Viện Sự Kiện" description="Every club moment — fixtures, dinners, tastings and socials. Open an event to see the photos, or start your own and add yours.">
      <style dangerouslySetInnerHTML={{ __html: `
        .ev-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
        .ev-chips { display:flex; gap:6px; flex-wrap:wrap; }
        .ev-chip { font-family:${MONO}; font-size:10px; letter-spacing:0.06em; text-transform:uppercase; padding:5px 11px; border-radius:999px; cursor:pointer; border:1px solid rgba(229,212,194,0.14); background:transparent; color:#B2AA98; transition:all .2s ease; }
        .ev-chip:hover { border-color:rgba(212,184,90,0.5); color:#E5D4C2; }
        .ev-chip.on { background:rgba(212,184,90,0.14); border-color:rgba(212,184,90,0.55); color:#E7C766; }
        .ev-add { font-family:${MONO}; font-size:11px; letter-spacing:0.06em; padding:8px 16px; border-radius:8px; background:#D4B85A; color:#052E20; border:none; cursor:pointer; font-weight:700; }
        .ev-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px,1fr)); gap:16px; }
        .ev-card { display:flex; flex-direction:column; border:1px solid rgba(229,212,194,0.12); border-radius:14px; overflow:hidden; background:rgba(229,212,194,0.04); text-decoration:none; transition:border-color .3s ease, transform .3s ease; }
        .ev-card:hover { border-color:rgba(212,184,90,0.45); transform:translateY(-3px); }
        .ev-cover { height:150px; background:#0A3526; background-size:cover; background-position:center; position:relative; display:flex; align-items:flex-end; }
        .ev-cover-empty { background:linear-gradient(135deg, rgba(212,184,90,0.14), rgba(5,46,32,0.6)); }
        .ev-count { position:absolute; top:10px; right:10px; font-family:${MONO}; font-size:9px; letter-spacing:0.05em; color:#E5D4C2; background:rgba(5,46,32,0.7); border:1px solid rgba(229,212,194,0.2); padding:3px 8px; border-radius:999px; }
        .ev-body { padding:14px 16px 16px; }
        .ev-cat { font-family:${MONO}; font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:#E7C766; }
        .ev-title { font-family:${SERIF}; font-size:18px; color:#E5D4C2; line-height:1.2; margin:5px 0 4px; }
        .ev-meta { font-family:${MONO}; font-size:10px; color:#B2AA98; letter-spacing:0.04em; }
        .ev-form { border:1px solid rgba(212,184,90,0.25); border-radius:12px; padding:18px; margin-bottom:22px; background:rgba(5,46,32,0.4); }
        .ev-label { font-family:${MONO}; font-size:9px; letter-spacing:0.1em; text-transform:uppercase; color:#B2AA98; margin:0 0 5px; display:block; }
        .ev-input, .ev-select { width:100%; box-sizing:border-box; background:rgba(5,46,32,0.5); color:#E5D4C2; border:1px solid rgba(229,212,194,0.14); border-radius:7px; padding:9px 12px; font-family:${MONO}; font-size:12px; outline:none; margin-bottom:12px; }
        .ev-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .ev-err { font-family:${MONO}; font-size:11px; color:#C27070; margin-bottom:10px; }
        .ev-empty { font-family:${MONO}; font-size:12px; color:#B2AA98; opacity:0.65; font-style:italic; padding:40px 0; text-align:center; }
        @media (max-width:520px){ .ev-row { grid-template-columns:1fr; } }
      ` }} />

      <div className="ev-actions">
        <div className="ev-chips">
          {cats.map(c => (
            <button key={c} className={`ev-chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
              {c === 'all' ? 'All' : categoryLabel(c)}
            </button>
          ))}
        </div>
        <button className="ev-add" onClick={() => setOpen(o => !o)}>{open ? 'Close' : '+ Create an event'}</button>
      </div>

      {open && (
        <div className="ev-form">
          {error && <div className="ev-err">{error}</div>}
          <label className="ev-label">Event title</label>
          <input className="ev-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Padel Social — August" maxLength={120} />
          <div className="ev-row">
            <div>
              <label className="ev-label">What was it?</label>
              <select className="ev-select" value={category} onChange={e => setCategory(e.target.value)}>
                {GALLERY_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.en}</option>)}
              </select>
            </div>
            <div>
              <label className="ev-label">Date</label>
              <input className="ev-input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
          </div>
          {category === 'fixture' && fixtures.length > 0 && (
            <>
              <label className="ev-label">Link to a fixture (optional)</label>
              <select className="ev-select" value={fixtureId} onChange={e => setFixtureId(e.target.value)}>
                <option value="">— none —</option>
                {fixtures.map(f => <option key={f.id} value={f.id}>{f.title} · {fmtDate(f.date)}</option>)}
              </select>
            </>
          )}
          <label className="ev-label">A note (optional)</label>
          <input className="ev-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="A word about the event" maxLength={600} />
          <button className="ev-add" onClick={create} disabled={submitting} style={{ opacity: submitting ? 0.5 : 1 }}>
            {submitting ? 'Creating…' : 'Create event'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="ev-empty">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="ev-empty">No events yet — create one and add the first photos.</div>
      ) : (
        <div className="ev-grid">
          {shown.map(e => (
            <Link key={e.id} href={`/members/gallery/${e.id}`} className="ev-card">
              <div className={'ev-cover' + (e.cover ? '' : ' ev-cover-empty')} style={e.cover ? { backgroundImage: `url(${e.cover})` } : undefined}>
                <span className="ev-count">{e.media_count} {e.media_count === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="ev-body">
                <div className="ev-cat">{categoryLabel(e.category)}{e.source === 'club' ? ' · The Club' : ''}</div>
                <div className="ev-title">{e.title}</div>
                <div className="ev-meta">{[fmtDate(e.event_date), e.source === 'member' ? e.creator_name : null].filter(Boolean).join(' · ')}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </MemberPage>
  )
}
