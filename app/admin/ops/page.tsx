'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, PromptModal, useToast } from '@/components/admin/dialogs'
import { createProject, archiveProject } from '@/lib/ops/api'
import NotificationSettings from '@/components/admin/NotificationSettings'
import CollapsibleHeader from '@/components/admin/CollapsibleHeader'
import type { Project, TeamMember } from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"

export default function OpsHubHome() {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const { showToast, toastNode } = useToast()

  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  const [newBoardOpen, setNewBoardOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState<Project | null>(null)
  const [newMemberOpen, setNewMemberOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  // per-board done/total/pct — one aggregate RPC (Phase 7), keyed by project_id (active boards only)
  const [progress, setProgress] = useState<Record<string, { done: number; total: number; pct: number }>>({})

  const load = async () => {
    const [{ data: pj }, { data: tm }, { data: prog }] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('team_members').select('*').order('display_name'),
      supabase.rpc('ops_all_boards_progress'),
    ])
    if (pj) setProjects(pj as Project[])
    if (tm) setTeam(tm as TeamMember[])
    if (prog) setProgress(Object.fromEntries(
      (prog as { project_id: string; done: number; total: number; pct_complete: number }[])
        .map(r => [r.project_id, { done: Number(r.done), total: Number(r.total), pct: Number(r.pct_complete) }])
    ))
    setLoading(false)
  }
  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const visible = projects.filter(p => showArchived ? true : p.status === 'active')

  const handleCreate = async (name: string) => {
    setBusy(true)
    try {
      const id = await createProject({ name })
      setNewBoardOpen(false)
      showToast('Board created.')
      router.push(`/admin/ops/${id}`)
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally { setBusy(false) }
  }

  const runArchive = async () => {
    if (!confirmArchive) return
    setBusy(true)
    try {
      await archiveProject(confirmArchive.id)
      setConfirmArchive(null)
      showToast('Board archived.')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally { setBusy(false) }
  }

  // Team roster — name-only people allowed (feeds task assignment). Admin-RLS
  // lets us write team_members directly; no activity event (not spine-grain).
  const addTeamMember = async (display_name: string) => {
    const { error } = await supabase.from('team_members').insert({ display_name })
    setNewMemberOpen(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Team member added.'); load()
  }
  const toggleActive = async (m: TeamMember) => {
    const { error } = await supabase.from('team_members').update({ active: !m.active }).eq('id', m.id)
    if (error) { showToast(error.message, 'error'); return }
    load()
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div style={eyebrow}>Operations Hub</div>
          <h1 style={pageTitle}>Boards</h1>
        </div>
        <button onClick={() => setNewBoardOpen(true)} style={btnPrimary}>+ New board</button>
      </div>
      <p style={lede}>
        Each board is a project — golf tournaments, the founding-membership drive, the exhibition.
        Cards move across columns; every move, assignment and completion is recorded.
      </p>

      <label style={{ ...metaText, display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 20px', cursor: 'pointer' }}>
        <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
        Show archived
      </label>

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={emptyText}>No boards yet. Create the first one.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 40 }}>
          {visible.map(p => (
            <div key={p.id} style={{ ...card, borderLeft: `3px solid ${p.colour || '#5E6650'}`, opacity: p.status === 'archived' ? 0.55 : 1 }}>
              <Link href={`/admin/ops/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', marginBottom: 4 }}>{p.name}</div>
                {p.description && <div style={{ ...metaText, marginBottom: 8 }}>{p.description}</div>}
                <div style={metaText}>
                  {p.status === 'archived' ? 'Archived' : 'Active'}
                  {p.target_date ? ` · target ${new Date(p.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                </div>
              </Link>
              {progress[p.id] && (
                <div style={{ marginTop: 10 }}>
                  <div style={progressOuter}><span style={{ ...progressInner, width: `${progress[p.id].pct}%` }} /></div>
                  <div style={{ ...metaText, fontSize: 9, marginTop: 3, opacity: 0.8 }}>
                    {progress[p.id].total > 0 ? `${progress[p.id].done}/${progress[p.id].total} · ${fmtPct(progress[p.id].pct)}%` : 'no tasks yet'}
                  </div>
                </div>
              )}
              {p.status === 'active' && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <Link href={`/admin/ops/${p.id}`} style={tinyBtn}>Open</Link>
                  <button onClick={() => setConfirmArchive(p)} style={{ ...tinyBtn, color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>Archive</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Roster (left) + Email notifications (right) — mirrored, identical collapsible
          headers; stacks to one column when the row gets tight. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28, marginTop: 40 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <CollapsibleHeader title="Team roster" open={rosterOpen} onToggle={() => setRosterOpen(o => !o)} count={team.length} />
            {rosterOpen && <button onClick={() => setNewMemberOpen(true)} style={{ ...tinyBtn, marginLeft: 'auto' }}>+ Add person</button>}
          </div>
          {rosterOpen && (
            team.length === 0 ? (
              <div style={emptyText}>No team members yet — add people to assign cards to.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {team.map(m => (
                  <div key={m.id} style={{ ...rosterRow, opacity: m.active ? 1 : 0.5 }}>
                    <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12 }}>{m.display_name}</span>
                    {m.role_title && <span style={metaText}>{m.role_title}</span>}
                    {!m.profile_id && <span style={{ ...metaText, opacity: 0.6 }}>· name-only</span>}
                    <button onClick={() => toggleActive(m)} style={{ ...tinyBtn, marginLeft: 'auto' }}>
                      {m.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
        <div>
          <NotificationSettings />
        </div>
      </div>

      <PromptModal
        open={newBoardOpen}
        eyebrow="＋ NEW BOARD"
        title="Create a board"
        label="Board name"
        placeholder="e.g. Founding-membership drive"
        confirmLabel="Create board"
        busy={busy}
        onCancel={() => setNewBoardOpen(false)}
        onConfirm={handleCreate}
      />
      <PromptModal
        open={newMemberOpen}
        eyebrow="＋ TEAM MEMBER"
        title="Add a team member"
        label="Display name (a name-only person is fine — no login required)"
        placeholder="e.g. Miss Châu"
        confirmLabel="Add"
        onCancel={() => setNewMemberOpen(false)}
        onConfirm={addTeamMember}
      />
      <ConfirmModal
        open={!!confirmArchive}
        eyebrow="⚠ ARCHIVE BOARD"
        title="Archive this board?"
        subject={confirmArchive?.name}
        body="The board is hidden from the active list but kept (with its full activity history) for the record. You can show archived boards with the toggle."
        confirmLabel="Archive board"
        busyLabel="Archiving…"
        busy={busy}
        onCancel={() => setConfirmArchive(null)}
        onConfirm={runArchive}
      />
      {toastNode}
    </>
  )
}

const eyebrow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', margin: 0 }
const lede: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 720, margin: '8px 0 0' }
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const card: React.CSSProperties = { padding: 16, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8 }
const rosterRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.06)', borderRadius: 6 }
const progressOuter: React.CSSProperties = { width: '100%', height: 4, background: 'rgba(229,212,194,0.10)', borderRadius: 2, overflow: 'hidden' }
const progressInner: React.CSSProperties = { display: 'block', height: '100%', background: '#7AB07A', borderRadius: 2 }
const fmtPct = (n: number) => (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(1))
const btnPrimary: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontFamily: FAMILY, fontSize: 11, letterSpacing: '0.06em' }
const tinyBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4, padding: '4px 10px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer', textDecoration: 'none' }
const emptyText: React.CSSProperties = { padding: '24px 0', fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
