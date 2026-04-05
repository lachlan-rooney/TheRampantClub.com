'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Profile } from '@/lib/types'
import MemberPage from '@/components/MemberPage'

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 6,
  padding: '8px 12px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', display: 'block', marginBottom: 4,
}

const INTERESTS = ['Golf', 'Tennis', 'Padel', 'Running', 'Whisky Tastings', 'Private Dinners', 'Art & Exhibitions', 'Cigar Evenings']

interface Preferences {
  dietary?: string
  allergies?: string
  drink_preferences?: string
  contact_method?: string
  interests?: string[]
  seating?: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [preferredDram, setPreferredDram] = useState('')
  const [prefs, setPrefs] = useState<Preferences>({})
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setEmail(data.user.email || '')
      supabase.from('profiles').select('*').eq('id', data.user.id).single()
        .then(({ data: p }) => {
          if (p) {
            setProfile(p)
            setDisplayName(p.display_name || '')
            setPreferredDram(p.preferred_dram || '')
            setPrefs((p as Record<string, unknown>).preferences as Preferences || {})
          }
          setLoading(false)
        })
    })
  }, [])

  const handleSave = async () => {
    if (!profile) return
    const supabase = createBrowserSupabaseClient()
    await supabase.from('profiles').update({
      display_name: displayName || null,
      preferred_dram: preferredDram || null,
      preferences: prefs,
    }).eq('id', profile.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleInterest = (interest: string) => {
    setPrefs(prev => {
      const current = prev.interests || []
      const next = current.includes(interest)
        ? current.filter(i => i !== interest)
        : [...current, interest]
      return { ...prev, interests: next }
    })
  }

  const readOnlyFields = [
    { label: 'Email', value: email },
    { label: 'Member Number', value: profile?.member_number ? `No. ${String(profile.member_number).padStart(3, '0')}` : '—' },
    { label: 'Admitted', value: formatDate(profile?.admitted_at || null) },
    { label: 'Locker', value: profile?.locker_number || '—' },
  ]

  return (
    <MemberPage title="My Membership" subtitle="Tư Cách Thành Viên">
      {loading ? (
        <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', textAlign: 'center' }}>Loading...</p>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {profile?.member_number ? (
              <div style={{
                fontFamily: "'Rampant Sans', serif", fontSize: 48, fontWeight: 500,
                color: '#E5D4C2', marginBottom: 8,
              }}>
                No. {String(profile.member_number).padStart(3, '0')}
              </div>
            ) : (
              <p style={{
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                fontStyle: 'italic', color: '#B2AA98',
              }}>
                Your membership number will be assigned by the Committee.
              </p>
            )}
          </div>

          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            {readOnlyFields.map(f => (
              <div key={f.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '10px 0', borderBottom: '1px solid rgba(229,212,194,0.1)',
              }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>{f.label}</span>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#E5D4C2', textAlign: 'right' }}>
                  {f.value}
                </span>
              </div>
            ))}

            {/* Editable details */}
            <div style={{ marginTop: 32 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Display Name</label>
                <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Preferred Dram</label>
                <input style={inputStyle} value={preferredDram} onChange={e => setPreferredDram(e.target.value)} />
              </div>
            </div>

            {/* Preferences */}
            <div style={{
              width: 8, height: 8, background: '#E5D4C2',
              transform: 'rotate(45deg)', opacity: 0.15, margin: '36px auto',
            }} />

            <h3 style={{
              fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
              color: '#E5D4C2', textAlign: 'center', letterSpacing: '0.04em', marginBottom: 24,
            }}>
              Preferences
            </h3>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Dietary Requirements</label>
              <input
                style={inputStyle}
                placeholder="e.g. Vegetarian, Pescatarian, Halal"
                value={prefs.dietary || ''}
                onChange={e => setPrefs(p => ({ ...p, dietary: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Allergies</label>
              <input
                style={inputStyle}
                placeholder="e.g. Shellfish, nuts"
                value={prefs.allergies || ''}
                onChange={e => setPrefs(p => ({ ...p, allergies: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Drink Preferences (beyond whisky)</label>
              <input
                style={inputStyle}
                placeholder="e.g. Negronis, natural wine, no beer"
                value={prefs.drink_preferences || ''}
                onChange={e => setPrefs(p => ({ ...p, drink_preferences: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Preferred Contact Method</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Email', 'Zalo', 'WhatsApp', 'Phone'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPrefs(p => ({ ...p, contact_method: m }))}
                    style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                      borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                      border: prefs.contact_method === m ? 'none' : '1px solid rgba(229,212,194,0.15)',
                      background: prefs.contact_method === m ? 'rgba(229,212,194,0.12)' : 'transparent',
                      color: prefs.contact_method === m ? '#E5D4C2' : '#B2AA98',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Interests</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {INTERESTS.map(i => (
                  <button
                    key={i}
                    onClick={() => toggleInterest(i)}
                    style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                      borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                      border: (prefs.interests || []).includes(i) ? 'none' : '1px solid rgba(229,212,194,0.15)',
                      background: (prefs.interests || []).includes(i) ? 'rgba(229,212,194,0.12)' : 'transparent',
                      color: (prefs.interests || []).includes(i) ? '#E5D4C2' : '#B2AA98',
                    }}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Preferred Seating</label>
              <input
                style={inputStyle}
                placeholder="e.g. Rooftop, Library Bar corner, Rampant Room"
                value={prefs.seating || ''}
                onChange={e => setPrefs(p => ({ ...p, seating: e.target.value }))}
              />
            </div>

            {/* Save */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <button
                onClick={handleSave}
                style={{
                  background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none', borderRadius: 6,
                  padding: '10px 24px', cursor: 'pointer',
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
                }}
              >
                Save
              </button>
              {saved && (
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98' }}>
                  Saved
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </MemberPage>
  )
}
