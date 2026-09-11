'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import MemberPage from '@/components/MemberPage'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { GALLERY_CATEGORIES, categoryLabel } from '@/lib/gallery'
import { useLang, type Lang } from '@/lib/lang'
import { surfaceName } from '@/lib/members/surfaces'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'
import type { Ink } from '@/components/public/kit'

// The Event Gallery, set as The Studio sets its exhibitions: rounded pictures
// that zoom a little on hover, the title in the display face beneath, a mono
// line of particulars, and an arrow that slides. An event with no photographs
// yet shows one of the house drawings in its frame instead of an empty box.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'

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
interface FixtureLite { id: string; title: string; type: string; date: string }

// Which drawing stands in a frame that has no photograph yet.
const INK_FOR: Record<string, Ink> = {
  tournament: 'golf-flag', fixture: 'golf-club', dinner: 'butler-tray', tasting: 'glass',
  social: 'gent-toast', event: 'girl-toast', other: 'newspaper',
}
const inkFor = (c: string): Ink => INK_FOR[c] || 'glass'

const fmtDate = (d: string | null, lang: Lang) =>
  d ? new Date(d + 'T12:00:00+07:00').toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function GalleryPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { t, lang } = useLang()
  const [events, setEvents] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [fixtures, setFixtures] = useState<FixtureLite[]>([])
  const actionsRef = useRef<HTMLDivElement>(null)

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
    supabase.from('fixtures').select('id, title, type, date').order('date', { ascending: false }).limit(80)
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
      if (!r.ok) { setError(j.error || t('Could not create.', 'Không thể tạo.')); return }
      setTitle(''); setDescription(''); setEventDate(''); setFixtureId(''); setCategory('social'); setOpen(false)
      await load()
    } catch { setError(t('Could not create. Try again.', 'Không thể tạo. Vui lòng thử lại.')) } finally { setSubmitting(false) }
  }

  // The frame at the end of the grid opens the same form, then brings it into
  // view. window.scrollTo rather than scrollIntoView, which can also slide a
  // sideways-scrollable ancestor.
  const openFromGrid = () => {
    setOpen(true)
    const el = actionsRef.current
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' })
  }

  const shown = filter === 'all' ? events : events.filter(e => e.category === filter)
  const cats = ['all', ...GALLERY_CATEGORIES.map(c => c.key).filter(k => events.some(e => e.category === k))]

  return (
    <MemberPage title="Event Gallery" subtitle={surfaceName('/members/gallery', 'vn')} description={t('Every club moment — fixtures, dinners, tastings and socials. Open an event to see the photos, or start your own and add yours.', 'Mọi khoảnh khắc của câu lạc bộ — thi đấu, bữa tối, nếm thử và giao lưu. Mở một sự kiện để xem ảnh, hoặc tạo sự kiện của riêng bạn và thêm ảnh của bạn.')}>
      <style dangerouslySetInnerHTML={{ __html: `
        .ev { color: ${CREAM}; text-align: left; }
        .ev .pk-go { display: inline-block; transition: transform .35s ease; }
        .ev .pk-float img { display: block; width: 100%; height: auto; transform: rotate(var(--rot, -4deg));
                            animation: ev-drift var(--dur, 8s) ease-in-out infinite alternate; }
        @keyframes ev-drift { from { transform: rotate(var(--rot, -4deg)) translateY(0) }
                              to   { transform: rotate(calc(var(--rot, -4deg) + 3deg)) translateY(-8px) } }

        .ev-actions { display:flex; align-items:flex-end; justify-content:space-between; gap: 18px 32px; flex-wrap:wrap;
                      border-bottom: 1px solid rgba(229,212,194,.16); scroll-margin-top: 90px; }
        .ev-tabs { display:flex; gap: 26px; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
        .ev-tabs::-webkit-scrollbar { display: none; }
        .ev-tab { position: relative; flex-shrink: 0; background: none; border: none; cursor: pointer; color: ${CREAM};
                  padding: 0 0 14px; font-family: ${MONO}; font-size: 12px; letter-spacing: .16em; text-transform: uppercase;
                  opacity: .55; transition: opacity .3s ease; }
        .ev-tab::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: ${GOLD};
                         transform: scaleX(0); transform-origin: left; transition: transform .45s cubic-bezier(.16,.84,.44,1); }
        .ev-tab:hover { opacity: .85; }
        .ev-tab.on { opacity: 1; }
        .ev-tab.on::after { transform: scaleX(1); }

        .ev-cta { background: none; border: none; border-bottom: 1px solid ${GOLD}; border-radius: 0; padding: 0 0 6px; cursor: pointer;
                  color: ${GOLD}; font-family: ${MONO}; font-size: 12.5px; letter-spacing: .14em; text-transform: uppercase; }
        .ev-cta:hover .pk-go { transform: translateX(7px); }
        .ev-cta:disabled { opacity: .5; cursor: default; }
        .ev-actions .ev-cta { margin-bottom: 14px; }

        /* ── the form: underlined fields on the green, no box ── */
        .ev-form { padding: 34px 0 40px; border-bottom: 1px solid rgba(229,212,194,.16); display: grid; gap: 26px; }
        .ev-form > * { max-width: 760px; }
        .ev-label { font-family:${MONO}; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; opacity: .75; display:block; margin: 0 0 4px; }
        .ev-input, .ev-select { display: block; width: 100%; box-sizing: border-box; background: transparent; color: ${CREAM};
                   border: none; border-bottom: 1px solid rgba(229,212,194,.32); border-radius: 0; padding: 12px 0;
                   font-family: ${MONO}; font-size: 14px; outline: none; color-scheme: dark; transition: border-color .25s ease; }
        .ev-input::placeholder { color: rgba(229,212,194,.5); }
        .ev-input:focus, .ev-select:focus { border-bottom-color: ${GOLD}; }
        .ev-select option { background: #052E20; color: ${CREAM}; }
        .ev-row { display:grid; grid-template-columns: 1fr 1fr; gap: 26px 40px; }
        .ev-err { font-family:${MONO}; font-size: 12.5px; line-height: 1.8; color: #E89B9B; }

        /* ── the grid, as The Studio's ── */
        .ev-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 44px 30px; margin-top: 40px; }
        .ev-card { display:block; color: ${CREAM}; text-decoration:none; }
        .ev-thumb { position: relative; aspect-ratio: 4 / 5; border-radius: 14px; overflow: hidden;
                    background: #0B3A29; box-shadow: 0 16px 38px rgba(0,0,0,.32); }
        .ev-thumb img.ev-cover { display: block; width: 100%; height: 100%; object-fit: cover;
                                 transition: transform .7s cubic-bezier(.16,.84,.44,1); }
        .ev-card:hover .ev-thumb img.ev-cover { transform: scale(1.05); }
        .ev-thumb-ink { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .ev-title { font-family:${SERIF}; font-size: clamp(21px, 2vw, 25px); line-height:1.12; margin: 16px 0 0; }
        .ev-meta { font-family:${MONO}; font-size: 12px; line-height: 1.7; margin-top: 8px; opacity: .8; }
        .ev-cat { color: ${GOLD}; opacity: 1; }
        .ev-count { font-family:${MONO}; font-size: 12px; letter-spacing: .08em; margin-top: 10px; }
        .ev-card:hover .pk-go { transform: translateX(7px); }
        .ev-ghost { display: block; width: 100%; background: none; border: none; padding: 0; cursor: pointer; text-align: left; color: ${CREAM}; font: inherit; }
        .ev-ghost .ev-thumb { background: transparent; box-shadow: none; border: 1px dashed rgba(229,212,194,.28); }
        .ev-ghost:hover .ev-thumb { border-color: rgba(212,184,90,.6); }
        .ev-ghost .ev-count { color: ${GOLD}; }
        .ev-empty { font-family:${MONO}; font-size: 13px; line-height: 1.9; opacity: .8; padding: 36px 0 0; }

        @media (max-width: 600px) {
          .ev-row { grid-template-columns: 1fr; }
          .ev-input, .ev-select { font-size: 16px; }
          .ev-tabs { gap: 20px; }
          .ev-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 16px; margin-top: 30px; }
          .ev-thumb { border-radius: 12px; }
          .ev-title { font-size: 19px; margin-top: 12px; }
          .ev-meta, .ev-count { font-size: 11.5px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ev .pk-float img { animation: none; }
          .ev .pk-go, .ev-tab, .ev-tab::after, .ev-thumb img.ev-cover { transition: none; }
        }
      ` }} />
      <CreamInkDefs />

      <div className="ev">
        <div className="ev-actions" ref={actionsRef}>
          <div className="ev-tabs">
            {cats.map(c => (
              <button key={c} className={`ev-tab ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
                {c === 'all' ? t('All', 'Tất cả') : categoryLabel(c, lang === 'vn')}
              </button>
            ))}
          </div>
          <button className="ev-cta" onClick={() => setOpen(o => !o)}>{open ? t('Close', 'Đóng') : t('+ Create an event', '+ Tạo sự kiện')}</button>
        </div>

        {open && (
          <div className="ev-form">
            {error && <div className="ev-err" role="alert">{error}</div>}
            <div>
              <label className="ev-label">{t('Event title', 'Tiêu đề sự kiện')}</label>
              <input className="ev-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('e.g. Padel Social — August', 'vd. Giao lưu Padel — Tháng 8')} maxLength={120} />
            </div>
            <div className="ev-row">
              <div>
                <label className="ev-label">{t('What was it?', 'Đó là sự kiện gì?')}</label>
                <select className="ev-select" value={category} onChange={e => setCategory(e.target.value)}>
                  {GALLERY_CATEGORIES.map(c => <option key={c.key} value={c.key}>{lang === 'vn' ? c.vn : c.en}</option>)}
                </select>
              </div>
              <div>
                <label className="ev-label">{t('Date', 'Ngày')}</label>
                <input className="ev-input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </div>
            </div>
            {category === 'fixture' && fixtures.length > 0 && (
              <div>
                <label className="ev-label">{t('Link to a fixture (optional)', 'Liên kết với trận đấu (tuỳ chọn)')}</label>
                <select className="ev-select" value={fixtureId} onChange={e => setFixtureId(e.target.value)}>
                  <option value="">{t('— none —', '— không —')}</option>
                  {fixtures.map(f => <option key={f.id} value={f.id}>{f.title} · {fmtDate(f.date, lang)}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="ev-label">{t('A note (optional)', 'Ghi chú (tuỳ chọn)')}</label>
              <input className="ev-input" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('A word about the event', 'Đôi lời về sự kiện')} maxLength={600} />
            </div>
            <div>
              <button className="ev-cta" onClick={create} disabled={submitting}>
                {submitting ? t('Creating…', 'Đang tạo…') : <>{t('Create event', 'Tạo sự kiện')} <span className="pk-go">→</span></>}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="ev-empty">{t('Loading…', 'Đang tải…')}</div>
        ) : shown.length === 0 ? (
          <div className="ev-empty">{t('No events yet — create one and add the first photos.', 'Chưa có sự kiện nào — hãy tạo một sự kiện và thêm những bức ảnh đầu tiên.')}</div>
        ) : null}

        {!loading && (
          <div className="ev-grid">
            {shown.map(e => (
              <Link key={e.id} href={`/members/gallery/${e.id}`} className="ev-card">
                <div className="ev-thumb">
                  {e.cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img className="ev-cover" src={e.cover} alt="" loading="lazy" />
                    : <div className="ev-thumb-ink"><CreamInk name={inkFor(e.category)} width="58%" rot={-5} dur={9} /></div>}
                </div>
                <div className="ev-title">{e.title}</div>
                <div className="ev-meta">
                  <span className="ev-cat">{categoryLabel(e.category, lang === 'vn')}{e.source === 'club' ? ' · The Club' : ''}</span>
                  {[fmtDate(e.event_date, lang), e.source === 'member' ? e.creator_name : null].filter(Boolean).length > 0 && <br />}
                  {[fmtDate(e.event_date, lang), e.source === 'member' ? e.creator_name : null].filter(Boolean).join(' · ')}
                </div>
                <div className="ev-count">{e.media_count} {e.media_count === 1 ? t('item', 'mục') : t('items', 'mục')} <span className="pk-go">→</span></div>
              </Link>
            ))}
            {/* The last frame on the wall is an empty one: start your own. */}
            <button type="button" className="ev-ghost" onClick={openFromGrid}>
              <div className="ev-thumb"><div className="ev-thumb-ink"><CreamInk name="gent-toast" width="56%" rot={4} dur={10} /></div></div>
              <div className="ev-count" style={{ marginTop: 16 }}>{t('+ Create an event', '+ Tạo sự kiện')} <span className="pk-go">→</span></div>
            </button>
          </div>
        )}
      </div>
    </MemberPage>
  )
}
