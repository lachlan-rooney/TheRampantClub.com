'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Fixture, FixtureSignup } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import NavOverlay from '@/components/NavOverlay'

const SPORT_META: Record<string, { label: string; tint: string; ring: string }> = {
  golf:   { label: 'Golf',   tint: 'rgba(94,102,80,0.22)',   ring: 'rgba(94,102,80,0.55)' },
  tennis: { label: 'Tennis', tint: 'rgba(40,72,60,0.30)',    ring: 'rgba(40,72,60,0.65)' },
  padel:  { label: 'Padel',  tint: 'rgba(178,170,152,0.22)', ring: 'rgba(178,170,152,0.5)' },
  hash:   { label: 'Hash',   tint: 'rgba(229,212,194,0.14)', ring: 'rgba(229,212,194,0.4)' },
  other:  { label: 'Other',  tint: 'rgba(212,184,90,0.15)',  ring: 'rgba(212,184,90,0.4)' },
}

function formatFixtureDate(d: string) {
  const date = new Date(d)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  }) + ' · ' + date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function relativeDate(d: string) {
  const ms = new Date(d).getTime() - Date.now()
  const days = Math.round(ms / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 0 && days < 7) return `in ${days} days`
  if (days < 0 && days > -7) return `${-days} days ago`
  return ''
}

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [signups, setSignups] = useState<FixtureSignup[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Fixture['sport']>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())

  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (user) setUserId(user.id)
      const [{ data: f }, { data: s }] = await Promise.all([
        supabase.from('fixtures').select('*').order('date', { ascending: false }),
        supabase.from('fixture_signups').select('*'),
      ])
      if (cancelled) return
      if (f) setFixtures(f)
      if (s) setSignups(s)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const upcoming = useMemo(() => fixtures.filter(f => new Date(f.date).getTime() >= nowTs), [fixtures, nowTs])
  const past = useMemo(() => fixtures.filter(f => new Date(f.date).getTime() < nowTs), [fixtures, nowTs])

  const countSignups = (fixtureId: string) => signups.filter(s => s.fixture_id === fixtureId).length
  const isSignedUp = (fixtureId: string) => signups.some(s => s.fixture_id === fixtureId && s.user_id === userId)
  const deadlinePassed = (f: Fixture) => f.signup_deadline ? new Date(f.signup_deadline).getTime() < nowTs : false

  const myUpcoming = upcoming.filter(f => isSignedUp(f.id)).length
  const sportCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const f of upcoming) c[f.sport] = (c[f.sport] || 0) + 1
    return c
  }, [upcoming])

  const filtered = (list: Fixture[]) =>
    filter === 'all' ? list : list.filter(f => f.sport === filter)

  const visibleUpcoming = filtered(upcoming)
  const visiblePast = filtered(past)

  const toggleSignup = async (fixtureId: string) => {
    if (!userId) return
    setBusyId(fixtureId)
    setErrorMsg(null)
    const op = isSignedUp(fixtureId)
      ? supabase.from('fixture_signups').delete().eq('fixture_id', fixtureId).eq('user_id', userId)
      : supabase.from('fixture_signups').insert({ fixture_id: fixtureId, user_id: userId })
    const { error: opError } = await op
    if (opError) {
      setErrorMsg(opError.message || 'Could not update signup. Please try again.')
      setBusyId(null)
      return
    }
    const { data, error: refreshError } = await supabase.from('fixture_signups').select('*')
    if (refreshError) {
      setErrorMsg(refreshError.message || 'Signup saved, but the list failed to refresh.')
    } else if (data) {
      setSignups(data)
    }
    setBusyId(null)
  }

  const renderFixture = (f: Fixture, isUpcoming: boolean) => {
    const meta = SPORT_META[f.sport] || SPORT_META.other
    const signed = isSignedUp(f.id)
    const closed = deadlinePassed(f)
    const count = countSignups(f.id)
    const cap = f.max_signups
    const full = cap != null && count >= cap
    return (
      <div key={f.id} className="fx-card" style={{ borderLeftColor: meta.ring }}>
        <div className="fx-row">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="fx-sport" style={{ background: meta.tint, color: '#E5D4C2' }}>{meta.label}</span>
              {isUpcoming && relativeDate(f.date) && (
                <span className="fx-rel">{relativeDate(f.date)}</span>
              )}
              {signed && isUpcoming && (
                <span className="fx-pill-on">You're in</span>
              )}
            </div>
            <div className="fx-title">{f.title}</div>
            <div className="fx-meta">{formatFixtureDate(f.date)}{f.location ? ' · ' + f.location : ''}</div>
            {f.description && <p className="fx-desc">{f.description}</p>}
          </div>
          {isUpcoming && (
            <div className="fx-action">
              <div className="fx-count">{count}{cap != null ? `/${cap}` : ''} signed up</div>
              {closed ? (
                <span className="fx-closed">Sign-ups closed</span>
              ) : full && !signed ? (
                <span className="fx-closed">Full</span>
              ) : (
                <button
                  onClick={() => toggleSignup(f.id)}
                  disabled={busyId === f.id}
                  className={signed ? 'fx-btn fx-btn-on' : 'fx-btn'}
                >
                  {busyId === f.id ? '…' : signed ? 'Withdraw' : 'Sign me up'}
                </button>
              )}
            </div>
          )}
        </div>
        {!isUpcoming && f.results && (
          <div className="fx-results">{f.results}</div>
        )}
      </div>
    )
  }

  const sportTabs: Array<'all' | Fixture['sport']> = ['all', 'golf', 'tennis', 'padel', 'hash', 'other']

  return (
    <>
      <NavOverlay variant="members" dark />
      <style>{`
        .fx-stats {
          display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap;
        }
        .fx-stat {
          flex: 1; min-width: 140px;
          padding: 14px 16px;
          background: rgba(229,212,194,0.04);
          border: 1px solid rgba(229,212,194,0.08);
          border-radius: 10px;
        }
        .fx-stat-num {
          font-family: 'Rampant Sans', serif;
          font-size: 26px; font-weight: 600;
          color: #D4B85A; line-height: 1;
        }
        .fx-stat-label {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
          color: #B2AA98; opacity: 0.75; margin-top: 6px;
        }

        .fx-tabs {
          display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px;
        }
        .fx-tab {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; letter-spacing: 0.10em; text-transform: uppercase;
          padding: 6px 12px; border-radius: 16px; cursor: pointer;
          border: 1px solid rgba(229,212,194,0.18);
          background: transparent; color: #B2AA98;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .fx-tab.is-on {
          background: rgba(212,184,90,0.18);
          border-color: rgba(212,184,90,0.5);
          color: #D4B85A;
        }
        .fx-tab-count { opacity: 0.6; margin-left: 4px; }

        .fx-card {
          padding: 18px 20px;
          margin-bottom: 12px;
          background: rgba(229,212,194,0.03);
          border: 1px solid rgba(229,212,194,0.08);
          border-left: 3px solid;
          border-radius: 10px;
          transition: background 0.25s, border-color 0.25s;
        }
        .fx-card:hover {
          background: rgba(229,212,194,0.06);
          border-color: rgba(229,212,194,0.15);
        }
        .fx-row {
          display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap;
        }
        .fx-sport {
          display: inline-block;
          font-family: 'Google Sans Code', monospace;
          font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 12px;
        }
        .fx-rel {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: #D4B85A; opacity: 0.85;
          letter-spacing: 0.06em;
        }
        .fx-pill-on {
          font-family: 'Google Sans Code', monospace;
          font-size: 9px; letter-spacing: 0.10em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 10px;
          background: rgba(122,176,122,0.18); color: #B5DCB5;
          border: 1px solid rgba(122,176,122,0.35);
        }
        .fx-title {
          font-family: 'Rampant Sans', serif;
          font-size: 17px; font-weight: 600; color: #E5D4C2;
          margin-bottom: 4px; letter-spacing: 0.02em;
        }
        .fx-meta {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #B2AA98; margin-bottom: 8px;
        }
        .fx-desc {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #B2AA98; opacity: 0.85;
          line-height: 1.7; margin: 0;
        }
        .fx-action {
          display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
          min-width: 140px;
        }
        .fx-count {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: #B2AA98; opacity: 0.7;
          letter-spacing: 0.06em;
        }
        .fx-btn {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; letter-spacing: 0.08em;
          padding: 9px 18px; border-radius: 6px;
          background: rgba(212,184,90,0.18); color: #E5D4C2;
          border: 1px solid rgba(212,184,90,0.4);
          cursor: pointer; font-weight: 600;
          transition: background 0.2s, border-color 0.2s;
        }
        .fx-btn:hover { background: rgba(212,184,90,0.28); border-color: rgba(212,184,90,0.6); }
        .fx-btn-on {
          background: transparent;
          border-color: rgba(229,212,194,0.25);
          color: #B2AA98;
        }
        .fx-btn-on:hover { background: rgba(180,86,86,0.10); border-color: rgba(180,86,86,0.35); color: #E5D4C2; }
        .fx-closed {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: #B2AA98; opacity: 0.5;
          letter-spacing: 0.06em; padding: 6px 12px;
        }
        .fx-results {
          margin-top: 14px;
          padding: 12px 16px;
          background: rgba(212,184,90,0.06);
          border-left: 2px solid rgba(212,184,90,0.4);
          border-radius: 4px;
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #E5D4C2;
          font-style: italic; line-height: 1.65;
        }

        .fx-section-title {
          font-family: 'Rampant Sans', serif;
          font-size: 18px; font-weight: 500;
          color: #E5D4C2; margin: 32px 0 14px;
          letter-spacing: 0.02em;
        }
        .fx-empty {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #B2AA98; opacity: 0.55;
          font-style: italic;
          padding: 20px 0;
        }
      `}</style>
      <MemberPage title="Fixtures" subtitle="Lịch Thi Đấu">
        {loading ? (
          <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center' }}>Loading…</p>
        ) : (
          <>
            {errorMsg && (
              <div
                role="alert"
                style={{
                  fontFamily: "'Google Sans Code', monospace",
                  fontSize: 12,
                  color: '#E5D4C2',
                  background: 'rgba(176, 60, 60, 0.18)',
                  border: '1px solid rgba(220, 100, 100, 0.45)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 18,
                  textAlign: 'center',
                }}
              >
                {errorMsg}
              </div>
            )}
            {/* Stats row */}
            <div className="fx-stats">
              <div className="fx-stat">
                <div className="fx-stat-num">{upcoming.length}</div>
                <div className="fx-stat-label">Upcoming fixtures</div>
              </div>
              <div className="fx-stat">
                <div className="fx-stat-num">{myUpcoming}</div>
                <div className="fx-stat-label">You're in</div>
              </div>
              <div className="fx-stat">
                <div className="fx-stat-num">{past.length}</div>
                <div className="fx-stat-label">Past fixtures</div>
              </div>
            </div>

            {/* Sport filter chips */}
            <div className="fx-tabs" role="tablist">
              {sportTabs.map(t => (
                <button
                  key={t}
                  className={'fx-tab' + (filter === t ? ' is-on' : '')}
                  onClick={() => setFilter(t)}
                >
                  {t === 'all' ? 'All' : SPORT_META[t]?.label || t}
                  {t !== 'all' && (sportCounts[t] ?? 0) > 0 && (
                    <span className="fx-tab-count">· {sportCounts[t]}</span>
                  )}
                </button>
              ))}
            </div>

            <h2 className="fx-section-title">Upcoming</h2>
            {visibleUpcoming.length === 0 ? (
              <div className="fx-empty">{upcoming.length === 0 ? 'No upcoming fixtures' : 'No fixtures match this filter'}</div>
            ) : (
              visibleUpcoming.map(f => renderFixture(f, true))
            )}

            <h2 className="fx-section-title">Past Results</h2>
            {visiblePast.length === 0 ? (
              <div className="fx-empty">{past.length === 0 ? 'No past fixtures' : 'No past fixtures match this filter'}</div>
            ) : (
              visiblePast.slice(0, 12).map(f => renderFixture(f, false))
            )}
          </>
        )}
      </MemberPage>
    </>
  )
}
