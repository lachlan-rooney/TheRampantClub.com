'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { describeEvent, actorName, timeAgo } from '@/lib/ops/feed'
import type { ActivityEvent, Project } from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"
const PAGE = 30

interface ProfileLite { id: string; display_name: string | null }

// Reusable feed. With a projectId it's the per-project tab (project fixed);
// without, it's the global feed (admin) with a project filter. RLS scopes the
// rows; the visibility rule is enforced in the DB, not here.
export default function ActivityFeed({ projectId }: { projectId?: string }) {
  const supabase = createBrowserSupabaseClient()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  // filters
  const [actorFilter, setActorFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')   // global view only
  const [profiles, setProfiles] = useState<ProfileLite[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const effectiveProject = projectId || projectFilter

  const fetchPage = useCallback(async (from: number, replace: boolean) => {
    let qy = supabase
      .from('activity_events')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (effectiveProject) qy = qy.eq('project_id', effectiveProject)
    if (actorFilter) qy = qy.eq('actor', actorFilter)
    const { data } = await qy
    const rows = (data || []) as ActivityEvent[]
    setHasMore(rows.length === PAGE)
    setOffset(from + rows.length)
    setEvents(prev => replace ? rows : [...prev, ...rows])
    setLoading(false)
  }, [supabase, effectiveProject, actorFilter])

  useEffect(() => { setLoading(true); fetchPage(0, true) }, [fetchPage])

  // Filter option sources — current-state UI affordances (not event text), so a
  // live read here is fine and consistent with the snapshot rule.
  useEffect(() => {
    fetch('/api/admin/members').then(r => r.json()).then(d => {
      if (Array.isArray(d.members)) setProfiles(d.members.map((m: ProfileLite) => ({ id: m.id, display_name: m.display_name })))
    }).catch(() => {})
    if (!projectId) {
      supabase.from('projects').select('*').order('name').then(({ data }) => { if (data) setProjects(data as Project[]) })
    }
  }, [projectId])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={actorFilter} onChange={e => setActorFilter(e.target.value)} style={select}>
          <option value="" style={opt}>Everyone</option>
          {profiles.map(p => <option key={p.id} value={p.id} style={opt}>{p.display_name || p.id.slice(0, 8)}</option>)}
        </select>
        {!projectId && (
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} style={select}>
            <option value="" style={opt}>All boards</option>
            {projects.map(p => <option key={p.id} value={p.id} style={opt}>{p.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : events.length === 0 ? (
        <div style={emptyText}>No activity yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map(ev => (
            <div key={ev.id} style={row}>
              <span style={dot} />
              <span style={line}>
                <strong style={{ color: '#E5D4C2', fontWeight: 600 }}>{actorName(ev)}</strong>
                {' '}<span style={{ color: '#B2AA98' }}>{describeEvent(ev)}</span>
              </span>
              <span style={when}>{timeAgo(ev.created_at)}</span>
            </div>
          ))}
          {hasMore && (
            <button onClick={() => fetchPage(offset, false)} style={loadMore}>Load more</button>
          )}
        </div>
      )}
    </div>
  )
}

const select: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '6px 10px', fontFamily: FAMILY, fontSize: 11, outline: 'none' }
const opt: React.CSSProperties = { background: '#052E20' }
const row: React.CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(229,212,194,0.06)' }
const dot: React.CSSProperties = { flex: '0 0 6px', width: 6, height: 6, borderRadius: '50%', background: 'rgba(212,184,90,0.6)', marginTop: 5 }
const line: React.CSSProperties = { flex: 1, fontFamily: FAMILY, fontSize: 12, lineHeight: 1.5 }
const when: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#7E7864', whiteSpace: 'nowrap' }
const loadMore: React.CSSProperties = { marginTop: 14, alignSelf: 'flex-start', background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '7px 16px', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
const emptyText: React.CSSProperties = { padding: '24px 0', fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
