'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, PromptModal, useToast } from '@/components/admin/dialogs'
import ActivityFeed from '../ActivityFeed'
import {
  createTask, updateTask, moveTask, reorderColumn, assignTask, deleteTask,
  createColumn, addProjectMember, removeProjectMember,
} from '@/lib/ops/api'
import type {
  Project, BoardColumn, Task, TeamMember, ProjectMember, TaskPriority, ProjectRole,
} from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"
const PRIORITY_COLOUR: Record<TaskPriority, string> = {
  low: '#7E7864', normal: '#5E6650', high: '#D4B85A', urgent: '#C27070',
}
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent']

interface ProfileLite { id: string; display_name: string | null }

export default function OpsBoardPage({ params }: { params: Promise<{ project_id: string }> }) {
  const { project_id } = use(params)
  const supabase = createBrowserSupabaseClient()
  const { showToast, toastNode } = useToast()

  const [project, setProject] = useState<Project | null>(null)
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [profiles, setProfiles] = useState<ProfileLite[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState<Task | null>(null)
  const [draft, setDraft] = useState<{ title: string; description: string; priority: TaskPriority; due_date: string }>({ title: '', description: '', priority: 'normal', due_date: '' })
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null)
  const [newCardCol, setNewCardCol] = useState<string | null>(null)
  const [newColOpen, setNewColOpen] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: pj }, { data: cols }, { data: tk }, { data: tm }, { data: pm }, { data: { user } }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', project_id).single(),
      supabase.from('board_columns').select('*').eq('project_id', project_id).order('sort_order'),
      supabase.from('tasks').select('*').eq('project_id', project_id).order('sort_order').order('created_at'),
      supabase.from('team_members').select('*').eq('active', true).order('display_name'),
      supabase.from('project_members').select('*').eq('project_id', project_id),
      supabase.auth.getUser(),
    ])
    if (pj) setProject(pj as Project)
    if (cols) setColumns(cols as BoardColumn[])
    if (tk) setTasks(tk as Task[])
    if (tm) setTeam(tm as TeamMember[])
    if (pm) setMembers(pm as ProjectMember[])

    // canEdit = admin OR a project owner/contributor (viewer = read-only).
    let admin = false
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      admin = prof?.is_admin === true
    }
    const myRole = (pm as ProjectMember[] | null)?.find(m => m.member === user?.id)?.role
    setCanEdit(admin || myRole === 'owner' || myRole === 'contributor')
    setLoading(false)
  }, [project_id])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // Access picker needs the auth-user roster — admin-only service route.
  useEffect(() => {
    if (!showMembers) return
    fetch('/api/admin/members').then(r => r.json()).then(d => {
      if (Array.isArray(d.members)) setProfiles(d.members.map((m: ProfileLite) => ({ id: m.id, display_name: m.display_name })))
    }).catch(() => {})
  }, [showMembers])

  const teamName = (id: string | null) => id ? (team.find(t => t.id === id)?.display_name ?? '—') : null
  const profileName = (id: string) => profiles.find(p => p.id === id)?.display_name || id.slice(0, 8)
  const tasksIn = (colId: string) => tasks.filter(t => t.column_id === colId)

  const wrap = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    try { await fn(); after?.(); load() }
    catch (e) { showToast((e as Error).message, 'error') }
    finally { setBusy(false) }
  }

  // ── card create / edit ──
  const handleCreateCard = (colId: string) => (title: string) =>
    wrap(() => createTask({ project_id, column_id: colId, title }), () => setNewCardCol(null))

  const openEditor = (t: Task) => {
    setEditing(t)
    setDraft({ title: t.title, description: t.description || '', priority: t.priority, due_date: t.due_date || '' })
  }
  const saveEditor = () => {
    if (!editing) return
    wrap(() => updateTask({
      id: editing.id, title: draft.title.trim(), description: draft.description.trim() || null,
      priority: draft.priority, due_date: draft.due_date || null,
    }), () => setEditing(null))
  }
  const changeAssignee = (taskId: string, assignee: string) =>
    wrap(() => assignTask(taskId, assignee || null))

  // ── drag and drop ──
  const onDropColumn = (colId: string) => {
    if (!dragId || !canEdit) return
    const dragged = tasks.find(t => t.id === dragId)
    setDragId(null)
    if (!dragged || dragged.column_id === colId) return  // same-column handled by card drop
    wrap(() => moveTask(dragged.id, colId, tasksIn(colId).length))
  }
  const onDropCard = (target: Task) => {
    if (!dragId || !canEdit || dragId === target.id) { setDragId(null); return }
    const dragged = tasks.find(t => t.id === dragId)
    setDragId(null)
    if (!dragged) return
    if (dragged.column_id === target.column_id) {
      // reorder within column: place dragged immediately before target
      const ids = tasksIn(target.column_id).map(t => t.id).filter(id => id !== dragged.id)
      const at = ids.indexOf(target.id)
      ids.splice(at, 0, dragged.id)
      wrap(() => reorderColumn(target.column_id, ids))
    } else {
      // cross-column: append to the target's column (precise slotting is Phase-later)
      wrap(() => moveTask(dragged.id, target.column_id, tasksIn(target.column_id).length))
    }
  }

  if (loading) return <div style={emptyText}>Loading board…</div>
  if (!project) return <div style={emptyText}>Board not found, or you don’t have access.</div>

  return (
    <>
      <Link href="/admin/ops" style={backLink}>← Boards</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0 4px' }}>
        <h1 style={pageTitle}>{project.name}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowActivity(s => !s)} style={tinyBtn}>{showActivity ? 'Hide activity' : 'Activity'}</button>
          <button onClick={() => setShowMembers(s => !s)} style={tinyBtn}>{showMembers ? 'Hide access' : 'Access'}</button>
          {canEdit && <button onClick={() => setNewColOpen(true)} style={tinyBtn}>+ Column</button>}
        </div>
      </div>
      {!canEdit && <div style={{ ...metaText, color: '#D4B85A', marginBottom: 8 }}>View-only — you’re a viewer on this board.</div>}

      {showActivity && (
        <div style={{ ...columnStyle, width: 'auto', marginBottom: 16 }}>
          <div style={columnHeader}><span style={{ color: '#E5D4C2' }}>Activity</span></div>
          <ActivityFeed projectId={project_id} />
        </div>
      )}

      {showMembers && (
        <MembersPanel
          members={members} profiles={profiles} profileName={profileName} canEdit={canEdit}
          onAdd={(member, role) => wrap(() => addProjectMember(project_id, member, role))}
          onRemove={(member) => wrap(() => removeProjectMember(project_id, member))}
        />
      )}

      {/* Board */}
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
        {columns.map(col => (
          <div
            key={col.id}
            style={columnStyle}
            onDragOver={e => { if (dragId && canEdit) e.preventDefault() }}
            onDrop={() => onDropColumn(col.id)}
          >
            <div style={columnHeader}>
              <span style={{ color: col.is_done_column ? '#7AB07A' : '#E5D4C2' }}>{col.name}</span>
              <span style={{ ...metaText, opacity: 0.6 }}>{tasksIn(col.id).length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 24 }}>
              {tasksIn(col.id).map(t => (
                <div
                  key={t.id}
                  draggable={canEdit}
                  onDragStart={() => setDragId(t.id)}
                  onDragOver={e => { if (dragId && canEdit) e.preventDefault() }}
                  onDrop={e => { e.stopPropagation(); onDropCard(t) }}
                  onClick={() => openEditor(t)}
                  style={{ ...cardStyle, borderLeft: `3px solid ${PRIORITY_COLOUR[t.priority]}`, cursor: canEdit ? 'grab' : 'pointer', opacity: dragId === t.id ? 0.4 : 1 }}
                >
                  <div style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12, lineHeight: 1.4 }}>{t.title}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {t.assignee && <span style={pill}>{teamName(t.assignee)}</span>}
                    {t.due_date && <span style={{ ...pill, color: '#D4B85A' }}>{new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                    {t.completed_at && <span style={{ ...pill, color: '#7AB07A' }}>done</span>}
                  </div>
                </div>
              ))}
            </div>
            {canEdit && (
              <button onClick={() => setNewCardCol(col.id)} style={{ ...tinyBtn, marginTop: 8, width: '100%' }}>+ Card</button>
            )}
          </div>
        ))}
      </div>

      {/* Card editor drawer */}
      {editing && (
        <>
          <div style={drawerBackdrop} onClick={() => { if (!busy) setEditing(null) }} />
          <div style={drawer} role="dialog">
            <div style={eyebrow}>Card</div>
            <input style={input} value={draft.title} disabled={!canEdit}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Title" />
            <textarea style={{ ...input, minHeight: 90, resize: 'vertical', marginTop: 10 }} value={draft.description} disabled={!canEdit}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Description" />
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>Priority</div>
                <select style={input} value={draft.priority} disabled={!canEdit}
                  onChange={e => setDraft(d => ({ ...d, priority: e.target.value as TaskPriority }))}>
                  {PRIORITIES.map(p => <option key={p} value={p} style={{ background: '#052E20' }}>{p}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>Due date</div>
                <input type="date" style={input} value={draft.due_date} disabled={!canEdit}
                  onChange={e => setDraft(d => ({ ...d, due_date: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={fieldLabel}>Assignee</div>
              <select style={input} value={editing.assignee || ''} disabled={!canEdit}
                onChange={e => changeAssignee(editing.id, e.target.value)}>
                <option value="" style={{ background: '#052E20' }}>— unassigned —</option>
                {team.map(m => <option key={m.id} value={m.id} style={{ background: '#052E20' }}>{m.display_name}</option>)}
              </select>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={saveEditor} disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button>
                <button onClick={() => setEditing(null)} style={tinyBtn}>Close</button>
                <button onClick={() => { const t = editing; setEditing(null); setConfirmDelete(t) }} style={{ ...tinyBtn, marginLeft: 'auto', color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>Delete</button>
              </div>
            )}
          </div>
        </>
      )}

      <PromptModal
        open={!!newCardCol}
        eyebrow="＋ NEW CARD"
        title="Add a card"
        label="Card title"
        confirmLabel="Add card"
        busy={busy}
        onCancel={() => setNewCardCol(null)}
        onConfirm={newCardCol ? handleCreateCard(newCardCol) : () => {}}
      />
      <PromptModal
        open={newColOpen}
        eyebrow="＋ NEW COLUMN"
        title="Add a column"
        label="Column name"
        confirmLabel="Add column"
        busy={busy}
        onCancel={() => setNewColOpen(false)}
        onConfirm={(name) => wrap(() => createColumn(project_id, name), () => setNewColOpen(false))}
      />
      <ConfirmModal
        open={!!confirmDelete}
        eyebrow="⚠ DELETE CARD"
        title="Delete this card?"
        subject={confirmDelete?.title}
        body="Removes the card permanently. The deletion is recorded in the activity log. Cannot be undone."
        confirmLabel="Delete card"
        busyLabel="Deleting…"
        busy={busy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => { const t = confirmDelete; if (t) wrap(() => deleteTask(t.id), () => setConfirmDelete(null)) }}
      />
      {toastNode}
    </>
  )
}

function MembersPanel({ members, profiles, profileName, canEdit, onAdd, onRemove }: {
  members: ProjectMember[]
  profiles: ProfileLite[]
  profileName: (id: string) => string
  canEdit: boolean
  onAdd: (member: string, role: ProjectRole) => void
  onRemove: (member: string) => void
}) {
  const [pick, setPick] = useState('')
  const [role, setRole] = useState<ProjectRole>('contributor')
  const available = profiles.filter(p => !members.some(m => m.member === p.id))
  return (
    <div style={{ ...columnStyle, width: 'auto', marginBottom: 16 }}>
      <div style={columnHeader}><span style={{ color: '#E5D4C2' }}>Access</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {members.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12 }}>{profileName(m.member)}</span>
            <span style={pill}>{m.role}</span>
            {canEdit && m.role !== 'owner' && (
              <button onClick={() => onRemove(m.member)} style={{ ...tinyBtn, marginLeft: 'auto', color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>Remove</button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <select value={pick} onChange={e => setPick(e.target.value)} style={{ ...input, width: 'auto', flex: 1 }}>
            <option value="" style={{ background: '#052E20' }}>— pick a person —</option>
            {available.map(p => <option key={p.id} value={p.id} style={{ background: '#052E20' }}>{p.display_name || p.id.slice(0, 8)}</option>)}
          </select>
          <select value={role} onChange={e => setRole(e.target.value as ProjectRole)} style={{ ...input, width: 'auto' }}>
            <option value="contributor" style={{ background: '#052E20' }}>contributor</option>
            <option value="viewer" style={{ background: '#052E20' }}>viewer</option>
            <option value="owner" style={{ background: '#052E20' }}>owner</option>
          </select>
          <button disabled={!pick} onClick={() => { onAdd(pick, role); setPick('') }} style={btnPrimary}>Add</button>
        </div>
      )}
    </div>
  )
}

const eyebrow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }
const backLink: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', letterSpacing: '0.04em', textDecoration: 'none', opacity: 0.7 }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 26, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', margin: 0 }
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const fieldLabel: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }
const columnStyle: React.CSSProperties = { width: 260, flex: '0 0 260px', background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8, padding: 12 }
const columnHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, fontFamily: FAMILY, fontSize: 12, letterSpacing: '0.06em' }
const cardStyle: React.CSSProperties = { background: 'rgba(5,46,32,0.6)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6, padding: '10px 12px' }
const pill: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9, color: '#B2AA98', background: 'rgba(229,212,194,0.08)', borderRadius: 3, padding: '2px 7px', letterSpacing: '0.04em' }
const input: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '8px 10px', fontFamily: FAMILY, fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none' }
const btnPrimary: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontFamily: FAMILY, fontSize: 11, letterSpacing: '0.06em' }
const tinyBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4, padding: '5px 10px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer', textDecoration: 'none' }
const emptyText: React.CSSProperties = { padding: '24px 0', fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
const drawerBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 500 }
const drawer: React.CSSProperties = { position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(420px, 92vw)', background: '#0A3526', borderLeft: '1px solid rgba(229,212,194,0.12)', boxShadow: '-12px 0 40px rgba(0,0,0,0.5)', zIndex: 501, padding: '28px 24px', overflowY: 'auto' }
