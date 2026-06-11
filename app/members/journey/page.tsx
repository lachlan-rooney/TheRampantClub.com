'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import MemberPage from '@/components/MemberPage'
import RadarChart from '@/components/whisky/RadarChart'
import { fetchCategories, RADAR_GOLD, type Cat, type ShapeValues } from '@/components/whisky/flavour-data'
import { vectorToShape, type TasteVector } from '@/lib/whisky/taste-narrative'

// Your Whisky Journey — the timeline of becoming. Current palate up top, then the
// real milestones, an honest drift line (only when earned), and the chronological
// story of drams + notes. Sparse → an invitation, never a barren page.

const MONO = "'Google Sans Code', 'DM Mono', monospace"

interface Entry { kind: 'dram' | 'note'; date: string; whisky_id?: string; whisky_name: string; distillery?: string | null; note?: string; flavour_tags?: string[] }
interface Milestone { label: string; value: string }

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Journey() {
  const [loading, setLoading] = useState(true)
  const [cats, setCats] = useState<Cat[] | null>(null)
  const [shape, setShape] = useState<ShapeValues | null>(null)
  const [timeline, setTimeline] = useState<Entry[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [drift, setDrift] = useState<{ line: string } | null>(null)
  const [size, setSize] = useState(280)

  useEffect(() => {
    const fit = () => setSize(Math.max(240, Math.min(300, window.innerWidth - 96)))
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    Promise.all([fetchCategories(supabase), fetch('/api/members/journey').then(r => r.ok ? r.json() : null)])
      .then(([c, j]) => {
        setCats(c)
        if (j) {
          setShape(vectorToShape((j.palate || {}) as TasteVector))
          setTimeline(j.timeline || []); setMilestones(j.milestones || []); setDrift(j.drift || null)
        }
        setLoading(false)
      })
  }, [])

  const hasPalate = shape && Object.keys(shape).length > 0
  const story = [...timeline].reverse()   // newest first for reading

  return (
    <MemberPage title="Your Journey" subtitle="HÀNH TRÌNH CỦA BẠN" description="Every dram and every note becomes part of your story. This is it, unfolding.">
      {loading ? (
        <p style={muted}>Tracing your path…</p>
      ) : (
        <>
          {hasPalate && cats && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 18px' }}>
              <RadarChart cats={cats} shapes={[{ values: shape!, color: RADAR_GOLD, label: '' }]} size={size} />
            </div>
          )}
          {drift && <p style={driftLine}>{drift.line}</p>}

          {milestones.length > 0 && (
            <div style={milestoneGrid}>
              {milestones.map((m, i) => (
                <div key={i} style={milestoneCard}>
                  <div style={milestoneVal}>{m.value}</div>
                  <div style={milestoneLabel}>{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {story.length === 0 ? (
            <div style={sparse}>
              <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', marginBottom: 8 }}>Your journey begins.</div>
              <p style={muted}>Every dram poured for you and every note you log becomes part of the story here. Start in the <Link href="/members/whisky" style={link}>Whisky Library</Link> — <Link href="/members/notes" style={link}>note what you taste</Link>, and watch this fill.</p>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div style={sectionLabel}>The story so far</div>
              {story.map((e, i) => (
                <div key={i} style={entryRow}>
                  <div style={{ ...dot, background: e.kind === 'note' ? '#D4B85A' : '#7AB07A' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 15, color: '#E5D4C2' }}>
                        {e.whisky_id ? <Link href={`/members/whisky/${e.whisky_id}`} style={whiskyLink}>{e.whisky_name}</Link> : e.whisky_name}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864', flexShrink: 0 }}>{fmt(e.date)}</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: '#7E7864', marginTop: 1 }}>{e.kind === 'note' ? 'you noted it' : 'poured for you'}{e.distillery ? ` · ${e.distillery}` : ''}</div>
                    {e.note && <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98', lineHeight: 1.6, marginTop: 5, fontStyle: 'italic' }}>“{e.note}”</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </MemberPage>
  )
}

const muted: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: '#B2AA98', opacity: 0.8, lineHeight: 1.75, textAlign: 'center' }
const link: React.CSSProperties = { color: '#D4B85A', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.35)' }
const driftLine: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#D4B85A', textAlign: 'center', margin: '0 auto 18px', letterSpacing: '0.02em' }
const milestoneGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 26 }
const milestoneCard: React.CSSProperties = { border: '1px solid rgba(212,184,90,0.22)', borderRadius: 12, background: 'rgba(229,212,194,0.03)', padding: '14px 12px', textAlign: 'center' }
const milestoneVal: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 22, fontWeight: 600, color: '#D4B85A' }
const milestoneLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 9, color: '#B2AA98', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }
const sparse: React.CSSProperties = { textAlign: 'center', padding: '28px 12px', border: '1px solid rgba(212,184,90,0.2)', borderRadius: 14, background: 'rgba(229,212,194,0.03)' }
const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#D4B85A', opacity: 0.8, marginBottom: 14 }
const entryRow: React.CSSProperties = { display: 'flex', gap: 12, paddingBottom: 16, marginBottom: 4, borderLeft: '1px solid rgba(229,212,194,0.1)', paddingLeft: 14, marginLeft: 4, position: 'relative' }
const dot: React.CSSProperties = { position: 'absolute', left: -4, top: 4, width: 7, height: 7, borderRadius: '50%' }
const whiskyLink: React.CSSProperties = { color: '#E5D4C2', textDecoration: 'none', borderBottom: '1px solid rgba(212,184,90,0.3)' }
