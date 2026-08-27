'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { vnDateString } from '@/lib/datetime'
import type { Fixture, FixtureSignup } from '@/lib/types'

// "What's On" — ONE surface for everything happening at the club. Sports
// fixtures (from `fixtures`, with RSVP) and house happenings (from
// calendar_entries — closures, tastings, distiller visits; informational, no
// RSVP) are merged into a single chronological timeline, tagged by type. Past
// fixtures with results show below. This replaces the old separate Events +
// Sports Fixtures pages.

interface Entry {
  id: string
  title: string
  description: string | null
  entry_date: string
  start_time: string | null
  end_time: string | null
  session_label: string | null
  space: string | null
  kind: string
}

const SPORT_META: Record<string, { label: string; tint: string; ring: string }> = {
  golf:   { label: 'Golf',   tint: 'rgba(94,102,80,0.30)',   ring: 'rgba(94,102,80,0.6)' },
  tennis: { label: 'Tennis', tint: 'rgba(40,72,60,0.34)',    ring: 'rgba(40,72,60,0.7)' },
  padel:  { label: 'Padel',  tint: 'rgba(178,170,152,0.26)', ring: 'rgba(178,170,152,0.55)' },
  hash:   { label: 'Hash',   tint: 'rgba(229,212,194,0.16)', ring: 'rgba(229,212,194,0.45)' },
  other:  { label: 'Sport',  tint: 'rgba(212,184,90,0.18)',  ring: 'rgba(212,184,90,0.45)' },
}
const KIND_META: Record<string, { label: string; tint: string; ring: string }> = {
  event:        { label: 'Event',          tint: 'rgba(212,184,90,0.20)',  ring: 'rgba(212,184,90,0.55)' },
  meeting:      { label: 'Meeting',        tint: 'rgba(178,170,152,0.16)', ring: 'rgba(178,170,152,0.45)' },
  interview:    { label: 'Interview',      tint: 'rgba(178,170,152,0.16)', ring: 'rgba(178,170,152,0.45)' },
  reminder:     { label: 'Reminder',       tint: 'rgba(178,170,152,0.16)', ring: 'rgba(178,170,152,0.45)' },
  closure:      { label: 'Club closed',    tint: 'rgba(194,112,112,0.18)', ring: 'rgba(194,112,112,0.5)' },
  private_hire: { label: 'Private event',  tint: 'rgba(212,184,90,0.16)',  ring: 'rgba(212,184,90,0.45)' },
  supplier:     { label: 'Distiller visit',tint: 'rgba(122,176,122,0.16)', ring: 'rgba(122,176,122,0.5)' },
  tasting:      { label: 'Tasting',        tint: 'rgba(212,184,90,0.20)',  ring: 'rgba(212,184,90,0.55)' },
  other:        { label: 'Notice',         tint: 'rgba(178,170,152,0.16)', ring: 'rgba(178,170,152,0.45)' },
}

const fmtFixtureDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  + ' · ' + new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
const fmtEntryDate = (iso: string) =>
  new Date(`${iso}T12:00:00+07:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
const fmtEntryTime = (e: Entry) => {
  if (e.start_time) { const t = e.start_time.slice(0, 5); return e.end_time ? `${t}–${e.end_time.slice(0, 5)}` : t }
  if (e.session_label) return e.session_label.charAt(0).toUpperCase() + e.session_label.slice(1)
  return 'All day'
}
const relativeDate = (ms: number) => {
  const days = Math.round((ms - Date.now()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 0 && days < 7) return `in ${days} days`
  return ''
}

type Item =
  | { type: 'fixture'; ms: number; f: Fixture }
  | { type: 'entry'; ms: number; e: Entry }

export default function WhatsOnPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [signups, setSignups] = useState<FixtureSignup[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())

  useEffect(() => { const id = setInterval(() => setNowTs(Date.now()), 60_000); return () => clearInterval(id) }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (user) setUserId(user.id)
      const [{ data: f }, { data: s }, { data: c }, { data: en }] = await Promise.all([
        supabase.from('fixtures').select('*').order('date', { ascending: false }),
        supabase.from('fixture_signups').select('*'),
        supabase.rpc('fixture_signup_counts'),
        supabase.from('calendar_entries')
          .select('id, title, description, entry_date, start_time, end_time, session_label, space, kind')
          .eq('visibility', 'member').gte('entry_date', vnDateString())
          .order('entry_date').order('start_time', { ascending: true, nullsFirst: true }),
      ])
      if (cancelled) return
      if (f) setFixtures(f)
      if (s) setSignups(s)
      if (c) setCounts(Object.fromEntries((c as { fixture_id: string; signups: number }[]).map(r => [r.fixture_id, Number(r.signups)])))
      if (en) setEntries(en as Entry[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const isSignedUp = (id: string) => signups.some(s => s.fixture_id === id && s.user_id === userId)
  const deadlinePassed = (f: Fixture) => f.signup_deadline ? new Date(f.signup_deadline).getTime() < nowTs : false

  const toggleSignup = async (fixtureId: string) => {
    if (!userId) return
    setBusyId(fixtureId); setErrorMsg(null)
    const op = isSignedUp(fixtureId)
      ? supabase.from('fixture_signups').delete().eq('fixture_id', fixtureId).eq('user_id', userId)
      : supabase.from('fixture_signups').insert({ fixture_id: fixtureId, user_id: userId })
    const { error } = await op
    if (error) { setErrorMsg(error.message || 'Could not update signup.'); setBusyId(null); return }
    const [{ data }, { data: c }] = await Promise.all([
      supabase.from('fixture_signups').select('*'),
      supabase.rpc('fixture_signup_counts'),
    ])
    if (data) setSignups(data)
    if (c) setCounts(Object.fromEntries((c as { fixture_id: string; signups: number }[]).map(r => [r.fixture_id, Number(r.signups)])))
    setBusyId(null)
  }

  // Merge upcoming fixtures + happenings into one chronological timeline.
  const upcoming: Item[] = useMemo(() => {
    const fx: Item[] = fixtures.filter(f => new Date(f.date).getTime() >= nowTs).map(f => ({ type: 'fixture', ms: new Date(f.date).getTime(), f }))
    const ev: Item[] = entries.map(e => ({ type: 'entry', ms: new Date(`${e.entry_date}T${(e.start_time || '12:00')}:00+07:00`).getTime(), e }))
    return [...fx, ...ev].sort((a, b) => a.ms - b.ms)
  }, [fixtures, entries, nowTs])
  const pastFixtures = useMemo(() => fixtures.filter(f => new Date(f.date).getTime() < nowTs), [fixtures, nowTs])

  const shownUpcoming = upcoming.filter(it =>
    filter === 'all' ? true
    : filter === 'happenings' ? it.type === 'entry'
    : it.type === 'fixture' && it.f.sport === filter)
  const myUpcoming = upcoming.filter(it => it.type === 'fixture' && isSignedUp(it.f.id)).length

  const tabs: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'golf', label: 'Golf' }, { key: 'tennis', label: 'Tennis' },
    { key: 'padel', label: 'Padel' }, { key: 'hash', label: 'Hash' },
    { key: 'happenings', label: 'Happenings' },
  ]

  const renderFixture = (f: Fixture) => {
    const meta = SPORT_META[f.sport] || SPORT_META.other
    const signed = isSignedUp(f.id)
    const closed = deadlinePassed(f)
    const count = counts[f.id] || 0
    const cap = f.max_signups
    const full = cap != null && count >= cap
    const rel = relativeDate(new Date(f.date).getTime())
    return (
      <div key={`f-${f.id}`} className="wo-card" style={{ borderLeftColor: meta.ring }}>
        <div className="wo-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wo-tags">
              <span className="wo-tag" style={{ background: meta.tint }}>{meta.label}</span>
              {rel && <span className="wo-rel">{rel}</span>}
              {signed && <span className="wo-in">You&apos;re in</span>}
            </div>
            <div className="wo-title">{f.title}</div>
            <div className="wo-meta">{fmtFixtureDate(f.date)}{f.location ? ' · ' + f.location : ''}</div>
            {f.description && <p className="wo-desc">{f.description}</p>}
          </div>
          <div className="wo-action">
            <div className="wo-count">{count}{cap != null ? `/${cap}` : ''} in</div>
            {closed ? <span className="wo-closed">Closed</span>
              : full && !signed ? <span className="wo-closed">Full</span>
              : <button onClick={() => toggleSignup(f.id)} disabled={busyId === f.id} className={signed ? 'wo-btn wo-btn-on' : 'wo-btn'}>
                  {busyId === f.id ? '…' : signed ? 'Withdraw' : 'Sign me up'}
                </button>}
          </div>
        </div>
      </div>
    )
  }

  const renderEntry = (e: Entry) => {
    const meta = KIND_META[e.kind] || KIND_META.other
    return (
      <div key={`e-${e.id}`} className="wo-card" style={{ borderLeftColor: meta.ring }}>
        <div className="wo-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wo-tags">
              <span className="wo-tag" style={{ background: meta.tint }}>{meta.label}</span>
            </div>
            <div className="wo-title">{e.title}</div>
            <div className="wo-meta">{fmtEntryDate(e.entry_date)} · {fmtEntryTime(e)}{e.space ? ' · ' + e.space : ''}</div>
            {e.description && <p className="wo-desc">{e.description}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        .wo-page { min-height: 100vh; background: #052E20; padding: 96px 24px 100px; }
        .wo-inner { max-width: 760px; margin: 0 auto; }
        .wo-back { font-family: 'Google Sans Code', monospace; font-size: 11px; color: #B2AA98; opacity: 0.8; text-decoration: none; letter-spacing: 0.06em; }
        .wo-back:hover { color: #D4B85A; }
        .wo-h1 { font-family: 'Rampant Sans', serif; font-size: 32px; color: #E5D4C2; margin: 22px 0 2px; }
        .wo-sub { font-family: 'Google Sans Code', monospace; font-size: 11px; color: #B2AA98; opacity: 0.6; letter-spacing: 0.08em; margin-bottom: 22px; }
        .wo-stats { display: flex; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
        .wo-stat { flex: 1; min-width: 130px; padding: 14px 16px; background: rgba(229,212,194,0.04); border: 1px solid rgba(229,212,194,0.08); border-radius: 12px; }
        .wo-stat-n { font-family: 'Rampant Sans', serif; font-size: 26px; color: #D4B85A; }
        .wo-stat-l { font-family: 'Google Sans Code', monospace; font-size: 10px; color: #B2AA98; letter-spacing: 0.06em; margin-top: 2px; }
        .wo-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
        .wo-tabbtn { font-family: 'Google Sans Code', monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; padding: 6px 12px; border-radius: 999px; cursor: pointer; border: 1px solid rgba(229,212,194,0.14); background: transparent; color: #B2AA98; }
        .wo-tabbtn.on { background: rgba(212,184,90,0.14); border-color: rgba(212,184,90,0.55); color: #E7C766; }
        .wo-sec { font-family: 'Google Sans Code', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #D4B85A; opacity: 0.7; margin: 28px 0 12px; }
        .wo-card { border: 1px solid rgba(229,212,194,0.10); border-left-width: 3px; border-radius: 12px; padding: 16px 18px; margin-bottom: 10px; background: rgba(229,212,194,0.03); }
        .wo-row { display: flex; gap: 16px; align-items: flex-start; }
        .wo-tags { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
        .wo-tag { font-family: 'Google Sans Code', monospace; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #E5D4C2; padding: 3px 9px; border-radius: 999px; }
        .wo-rel { font-family: 'Google Sans Code', monospace; font-size: 10px; color: #D4B85A; }
        .wo-in { font-family: 'Google Sans Code', monospace; font-size: 9px; letter-spacing: 0.06em; color: #052E20; background: #7AB07A; padding: 2px 8px; border-radius: 999px; }
        .wo-title { font-family: 'Rampant Sans', serif; font-size: 18px; color: #E5D4C2; line-height: 1.2; }
        .wo-meta { font-family: 'Google Sans Code', monospace; font-size: 11px; color: #B2AA98; margin-top: 4px; }
        .wo-desc { font-family: 'Google Sans Code', monospace; font-size: 11.5px; color: #B2AA98; opacity: 0.85; line-height: 1.6; margin: 10px 0 0; }
        .wo-action { flex-shrink: 0; text-align: right; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
        .wo-count { font-family: 'Google Sans Code', monospace; font-size: 10px; color: #B2AA98; }
        .wo-btn { font-family: 'Google Sans Code', monospace; font-size: 11px; letter-spacing: 0.04em; padding: 8px 14px; border-radius: 8px; cursor: pointer; background: #D4B85A; color: #052E20; border: none; font-weight: 700; }
        .wo-btn-on { background: transparent; color: #B2AA98; border: 1px solid rgba(229,212,194,0.25); font-weight: 400; }
        .wo-closed { font-family: 'Google Sans Code', monospace; font-size: 10px; color: #B2AA98; opacity: 0.6; }
        .wo-empty { font-family: 'Google Sans Code', monospace; font-size: 12px; color: #B2AA98; opacity: 0.6; font-style: italic; padding: 30px 0; text-align: center; }
        .wo-results { font-family: 'Google Sans Code', monospace; font-size: 11px; color: #B2AA98; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(229,212,194,0.08); }
        @media (max-width: 560px) { .wo-row { flex-direction: column; } .wo-action { text-align: left; align-items: flex-start; flex-direction: row; gap: 14px; } }
      ` }} />
      <div className="wo-page">
        <div className="wo-inner">
          <Link href="/members" className="wo-back">← Back to dashboard</Link>
          <h1 className="wo-h1">What&apos;s On</h1>
          <div className="wo-sub">Sự kiện & Lịch Thi Đấu</div>

          <div className="wo-stats">
            <div className="wo-stat"><div className="wo-stat-n">{upcoming.length}</div><div className="wo-stat-l">coming up</div></div>
            <div className="wo-stat"><div className="wo-stat-n">{myUpcoming}</div><div className="wo-stat-l">you&apos;re signed up for</div></div>
            <Link href="/members/gallery" className="wo-stat" style={{ textDecoration: 'none' }}><div className="wo-stat-n" style={{ fontSize: 18, paddingTop: 6 }}>Photos →</div><div className="wo-stat-l">from past events</div></Link>
          </div>

          <div className="wo-tabs">
            {tabs.map(tb => (
              <button key={tb.key} className={'wo-tabbtn' + (filter === tb.key ? ' on' : '')} onClick={() => setFilter(tb.key)}>{tb.label}</button>
            ))}
          </div>

          {errorMsg && <div className="wo-empty" style={{ color: '#C27070' }}>{errorMsg}</div>}

          {loading ? (
            <div className="wo-empty">Loading…</div>
          ) : (
            <>
              <div className="wo-sec">Coming up</div>
              {shownUpcoming.length === 0 ? (
                <div className="wo-empty">Nothing on the calendar here yet.</div>
              ) : shownUpcoming.map(it => it.type === 'fixture' ? renderFixture(it.f) : renderEntry(it.e))}

              {filter !== 'happenings' && pastFixtures.length > 0 && (
                <>
                  <div className="wo-sec">Past results</div>
                  {pastFixtures.filter(f => filter === 'all' || f.sport === filter).map(f => {
                    const meta = SPORT_META[f.sport] || SPORT_META.other
                    return (
                      <div key={`p-${f.id}`} className="wo-card" style={{ borderLeftColor: meta.ring, opacity: 0.8 }}>
                        <div className="wo-tags"><span className="wo-tag" style={{ background: meta.tint }}>{meta.label}</span></div>
                        <div className="wo-title">{f.title}</div>
                        <div className="wo-meta">{fmtFixtureDate(f.date)}{f.location ? ' · ' + f.location : ''}</div>
                        {f.results && <div className="wo-results">{f.results}</div>}
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
