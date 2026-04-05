'use client'

import { useEffect, useState } from 'react'

type Member = Record<string, string>

const SECTIONS = [
  {
    title: 'Food & Beverage',
    fields: ['Allergies', 'Dietary Requirements', 'Cuisine Preference', 'Spice Tolerance', 'Coffee/Tea', 'Comfort Food', 'Water Preference'],
  },
  {
    title: 'Whisky & Drinks',
    fields: ['Whisky Profile', 'Preferred Region', 'Favourite Expression', 'Default Serve', 'Flavour Loves', 'Flavour Avoids', 'Non-Alcoholic', 'Wine Preference', 'Cocktail Style'],
  },
  {
    title: 'Social & Environment',
    fields: ['Social Type', 'Preferred Group Size', 'Preferred Space', 'Seating Preference', 'Music/Volume', 'Greeting Preference', 'Introduction Rules', 'Celebration Preference'],
  },
  {
    title: 'Personal & Lifestyle',
    fields: ['Profession/Industry', 'Hobbies & Interests', 'Art/Culture', 'Whisky Education Level', 'Technology Comfort', 'Meeting Style', 'Client Entertainment', 'Billing Preference'],
  },
  {
    title: 'Service Intelligence',
    fields: ['Morning/Evening', 'Temperature', 'Comfort Notes', 'Preferred Merch', 'Surprise Preference', 'Family Inclusion'],
  },
]

export default function QuickRefPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/member-profiles')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMembers(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          Member Quick Reference
        </h1>
      </div>

      {loading ? (
        <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98' }}>Loading...</p>
      ) : (
        <>
          {/* Member dropdown */}
          <div style={{ marginBottom: 32 }}>
            <select
              value={selected?.['Full Name'] || ''}
              onChange={e => {
                const m = members.find(m => m['Full Name'] === e.target.value)
                setSelected(m || null)
              }}
              style={{
                background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
                border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
                padding: '12px 16px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
                fontSize: 13, width: '100%', maxWidth: 400, boxSizing: 'border-box',
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="" style={{ background: '#052E20' }}>Select a member...</option>
              {members.map(m => (
                <option key={m['Member No.']} value={m['Full Name']} style={{ background: '#052E20' }}>
                  {m['Full Name']} — {m['Member No.']} ({m['Tier']})
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              {/* Header */}
              <div style={{
                padding: '24px 28px', marginBottom: 32,
                background: 'rgba(229,212,194,0.04)', borderRadius: 8,
                border: '1px solid rgba(229,212,194,0.06)',
              }}>
                <div style={{
                  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
                  color: '#E5D4C2', marginBottom: 4,
                }}>
                  {selected['Full Name']}
                </div>
                <div style={{
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                  color: '#B2AA98', display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12,
                }}>
                  <span>{selected['Member No.']}</span>
                  <span>·</span>
                  <span>{selected['Tier']}</span>
                  {selected['Last Updated'] && <>
                    <span>·</span>
                    <span>Updated: {selected['Last Updated']}</span>
                  </>}
                </div>
                {selected['Score 5 List'] && (
                  <div style={{
                    fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                    color: '#E5D4C2', letterSpacing: '0.02em',
                    padding: '8px 12px', background: 'rgba(229,212,194,0.06)', borderRadius: 4,
                    marginTop: 8,
                  }}>
                    <span style={{ color: '#B2AA98', marginRight: 8 }}>◆ KEY ALERTS:</span>
                    {selected['Score 5 List']}
                  </div>
                )}
              </div>

              {/* Sections */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                {SECTIONS.map(section => (
                  <div key={section.title} style={{
                    padding: '20px 24px',
                    background: 'rgba(229,212,194,0.03)', borderRadius: 8,
                    border: '1px solid rgba(229,212,194,0.04)',
                  }}>
                    <div style={{
                      fontFamily: "'Rampant Sans', serif", fontSize: 15, fontWeight: 500,
                      color: '#E5D4C2', marginBottom: 16, letterSpacing: '0.04em',
                    }}>
                      {section.title}
                    </div>
                    {section.fields.map(field => {
                      const val = selected[field]
                      if (!val) return null
                      return (
                        <div key={field} style={{ marginBottom: 14 }}>
                          <div style={{
                            fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9,
                            color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase',
                            marginBottom: 3, opacity: 0.6,
                          }}>
                            {field}
                          </div>
                          <div style={{
                            fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                            color: '#E5D4C2', lineHeight: 1.7, opacity: 0.85,
                          }}>
                            {val}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
