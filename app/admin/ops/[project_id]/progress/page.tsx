'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { describeEvent, actorName, timeAgo } from '@/lib/ops/feed'
import type { ActivityEvent, Project } from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"

type Progress = { total: number; open_count: number; done: number; lapsed: number; overdue: number; completed_this_week: number; pct_complete: number }
type Week = { week_start: string; completed: number }

// The trajectory shows the meaningful arc — completions, lapses, and board-level
// milestones — not every move/assign (that's the full Activity feed's job).
const MILESTONE = (ev: ActivityEvent) =>
  ev.object_type === 'project' || ev.verb === 'completed' || ev.verb === 'lapsed'

export default function BoardProgress() {
  const supabase = createBrowserSupabaseClient()
  const { project_id } = useParams<{ project_id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [p, setP] = useState<Progress | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: pj }, { data: prog }, { data: thru }, { data: ev }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', project_id).single(),
        supabase.rpc('ops_project_progress', { p_project_id: project_id }),
        supabase.rpc('ops_project_throughput', { p_project_id: project_id }),
        supabase.from('activity_events').select('*').eq('project_id', project_id).order('created_at', { ascending: false }).limit(200),
      ])
      if (pj) setProject(pj as Project)
      if (prog && prog[0]) setP(prog[0] as Progress)
      setWeeks((thru as Week[]) || [])
      setEvents((ev as ActivityEvent[]) || [])
      setLoading(false)
    })()
  }, [project_id])  // eslint-disable-line react-hooks/exhaustive-deps

  const maxWeek = Math.max(1, ...weeks.map(w => w.completed))
  const milestones = events.filter(MILESTONE)

  return (
    <>
      <Link href="/admin/ops/reports" style={backLink}>← Reports</Link>
      <div style={{ ...eyebrow, marginTop: 12 }}>Board progress</div>
      <h1 style={pageTitle}>{project?.name || '…'}</h1>

      {loading || !p ? <div style={emptyText}>Loading…</div> : (
        <>
          {/* summary */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0 8px' }}>
            <Stat label="Complete" value={`${fmtPct(p.pct_complete)}%`} accent />
            <Stat label="Done" value={`${p.done}/${p.total}`} />
            <Stat label="Open" value={p.open_count} />
            <Stat label="Lapsed" value={p.lapsed} />
            <Stat label="Overdue" value={p.overdue} danger={p.overdue > 0} />
            <Stat label="Done this week" value={p.completed_this_week} />
          </div>
          <div style={{ ...progressBarOuter, maxWidth: 640 }}><span style={{ ...progressBarInner, width: `${p.pct_complete}%` }} /></div>

          {/* throughput */}
          <h2 style={sectionTitle}>Weekly throughput</h2>
          {weeks.length === 0 ? <div style={emptyText}>No completions yet.</div> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, maxWidth: 640 }}>
              {weeks.map(w => (
                <div key={w.week_start} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ ...metaText, fontSize: 9 }}>{w.completed}</span>
                  <div title={`${w.completed} completed`} style={{ width: '100%', maxWidth: 28, height: `${(w.completed / maxWeek) * 88}px`, minHeight: 2, background: '#D4B85A', borderRadius: '3px 3px 0 0' }} />
                  <span style={{ ...metaText, fontSize: 8, color: '#7E7864' }}>{new Date(w.week_start + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
          )}

          {/* trajectory (milestones from the spine) */}
          <h2 style={sectionTitle}>Trajectory</h2>
          {milestones.length === 0 ? <div style={emptyText}>No milestones yet.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640 }}>
              {milestones.map(ev => (
                <div key={ev.id} style={trajRow}>
                  <span style={{ ...dot, background: ev.verb === 'completed' ? '#7AB07A' : ev.verb === 'lapsed' ? '#C27070' : '#D4B85A' }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ fontFamily: FAMILY, fontSize: 12, color: '#E5D4C2' }}>
                      <b style={{ color: '#B2AA98', fontWeight: 600 }}>{actorName(ev)}</b> {describeEvent(ev)}
                    </span>
                    <span style={{ display: 'block', ...metaText, fontSize: 9, color: '#7E7864', marginTop: 1 }}>{timeAgo(ev.created_at)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

function Stat({ label, value, accent, danger }: { label: string; value: React.ReactNode; accent?: boolean; danger?: boolean }) {
  return (
    <div style={{ background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8, padding: '10px 14px', minWidth: 92 }}>
      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 22, color: danger ? '#C27070' : accent ? '#D4B85A' : '#E5D4C2' }}>{value}</div>
      <div style={{ fontFamily: FAMILY, fontSize: 9, color: '#7E7864', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  )
}

const fmtPct = (n: number) => (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(1))
const backLink: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', textDecoration: 'none' }
const eyebrow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 26, color: '#E5D4C2', margin: 0 }
const sectionTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', margin: '32px 0 12px' }
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const emptyText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic', padding: '12px 0' }
const progressBarOuter: React.CSSProperties = { width: '100%', height: 8, background: 'rgba(229,212,194,0.10)', borderRadius: 4, overflow: 'hidden', marginTop: 6 }
const progressBarInner: React.CSSProperties = { display: 'block', height: '100%', background: '#D4B85A' }
const trajRow: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(229,212,194,0.05)' }
const dot: React.CSSProperties = { flex: '0 0 8px', width: 8, height: 8, borderRadius: '50%', marginTop: 5 }
