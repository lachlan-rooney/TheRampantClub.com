'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Fixture, FixtureSignup } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import NavOverlay from '@/components/NavOverlay'

const SPORT_COLORS: Record<string, string> = {
  golf: '#5E6650', tennis: '#28483C', padel: 'rgba(178,170,152,0.4)', hash: 'rgba(229,212,194,0.15)', other: 'rgba(229,212,194,0.1)',
}

function formatFixtureDate(d: string): string {
  const date = new Date(d)
  return date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }) + ', ' + date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [signups, setSignups] = useState<FixtureSignup[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserSupabaseClient()

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)
    const [{ data: f }, { data: s }] = await Promise.all([
      supabase.from('fixtures').select('*').order('date', { ascending: false }),
      supabase.from('fixture_signups').select('*'),
    ])
    if (f) setFixtures(f)
    if (s) setSignups(s)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const now = new Date()
  const upcoming = fixtures.filter(f => new Date(f.date) >= now)
  const past = fixtures.filter(f => new Date(f.date) < now)

  const countSignups = (fixtureId: string) => signups.filter(s => s.fixture_id === fixtureId).length
  const isSignedUp = (fixtureId: string) => signups.some(s => s.fixture_id === fixtureId && s.user_id === userId)
  const deadlinePassed = (f: Fixture) => f.signup_deadline && new Date(f.signup_deadline) < now

  const toggleSignup = async (fixtureId: string) => {
    if (!userId) return
    if (isSignedUp(fixtureId)) {
      await supabase.from('fixture_signups').delete().eq('fixture_id', fixtureId).eq('user_id', userId)
    } else {
      await supabase.from('fixture_signups').insert({ fixture_id: fixtureId, user_id: userId })
    }
    const { data } = await supabase.from('fixture_signups').select('*')
    if (data) setSignups(data)
  }

  const renderFixture = (f: Fixture, isUpcoming: boolean) => (
    <div key={f.id} style={{ padding: '24px 0', borderBottom: '1px solid rgba(229,212,194,0.1)' }}>
      <span style={{
        fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9,
        color: '#E5D4C2', background: SPORT_COLORS[f.sport] || 'rgba(229,212,194,0.1)',
        borderRadius: 4, padding: '2px 10px', display: 'inline-block', marginBottom: 8,
      }}>
        {f.sport}
      </span>
      <div style={{
        fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 600,
        color: '#E5D4C2', marginBottom: 4,
      }}>
        {f.title}
      </div>
      <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 4 }}>
        {formatFixtureDate(f.date)}
      </div>
      {f.location && (
        <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 8 }}>
          {f.location}
        </div>
      )}
      {f.description && (
        <p style={{
          fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
          color: '#B2AA98', lineHeight: 1.85, marginBottom: 12, margin: '0 0 12px',
        }}>
          {f.description}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: 'rgba(178,170,152,0.5)' }}>
          {countSignups(f.id)}{f.max_signups ? ` / ${f.max_signups}` : ''} signed up
        </span>
        {isUpcoming && (
          deadlinePassed(f) ? (
            <span style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
              color: '#B2AA98', opacity: 0.4,
            }}>
              Sign-ups closed
            </span>
          ) : (
            <button
              onClick={() => toggleSignup(f.id)}
              style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                borderRadius: 6, padding: '8px 20px', cursor: 'pointer',
                background: isSignedUp(f.id) ? 'rgba(229,212,194,0.12)' : 'transparent',
                color: isSignedUp(f.id) ? '#E5D4C2' : '#B2AA98',
                border: isSignedUp(f.id) ? 'none' : '1px solid rgba(229,212,194,0.2)',
              }}
            >
              {isSignedUp(f.id) ? 'Signed Up ◆' : 'Sign Up'}
            </button>
          )
        )}
      </div>
      {!isUpcoming && f.results && (
        <div style={{
          fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
          color: '#B2AA98', fontStyle: 'italic', marginTop: 8,
          padding: '12px 16px', background: 'rgba(229,212,194,0.04)', borderRadius: 6,
        }}>
          {f.results}
        </div>
      )}
    </div>
  )

  return (
    <>
      <NavOverlay variant="members" dark />
      <MemberPage title="Fixtures" subtitle="Lịch Thi Đấu">
        {loading ? (
          <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center' }}>Loading...</p>
        ) : (
          <>
            <h2 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500,
              color: '#E5D4C2', marginBottom: 20,
            }}>
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, fontStyle: 'italic', color: '#B2AA98' }}>
                No upcoming fixtures
              </p>
            ) : (
              upcoming.map(f => renderFixture(f, true))
            )}

            <h2 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500,
              color: '#E5D4C2', marginBottom: 20, marginTop: 48,
            }}>
              Past Results
            </h2>
            {past.length === 0 ? (
              <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, fontStyle: 'italic', color: '#B2AA98' }}>
                No past fixtures
              </p>
            ) : (
              past.map(f => renderFixture(f, false))
            )}
          </>
        )}
      </MemberPage>
    </>
  )
}
