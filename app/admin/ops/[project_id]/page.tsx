'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { vnDateString } from '@/lib/datetime'
import { ConfirmModal, PromptModal, useToast } from '@/components/admin/dialogs'
import ActivityFeed from '../ActivityFeed'
import GanttView from './GanttView'
import { OPS_STATUS_COLORS } from '@/lib/ops/status'
import { useLang } from '@/lib/admin-lang'
import {
  createTask, updateTask, moveTask, assignTask, deleteTask,
  createColumn, addProjectMember, removeProjectMember,
  createTemplate, setTemplateActive, materialiseNow, linkTask, unlinkTask, rescheduleTask,
} from '@/lib/ops/api'
import {
  resolveLinks, searchLinkTargets, LINK_TYPE_META, LINK_TYPES,
  type LinkType, type ResolvedLink,
} from '@/lib/ops/links'
import type {
  Project, BoardColumn, Task, TeamMember, ProjectMember, TaskPriority, ProjectRole,
  TaskTemplate, Recurrence,
} from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"
const PRIORITY_COLOUR: Record<TaskPriority, string> = {
  low: '#7E7864', normal: '#5E6650', high: '#D4B85A', urgent: '#C27070',
}
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent']

interface ProfileLite { id: string; display_name: string | null }

export default function OpsBoardPage({ params }: { params: Promise<{ project_id: string }> }) {
  const { t } = useLang()
  const { project_id } = use(params)
  const supabase = createBrowserSupabaseClient()
  const { showToast, toastNode } = useToast()

  const [project, setProject] = useState<Project | null>(null)
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [linkMap, setLinkMap] = useState<Map<string, ResolvedLink>>(new Map())
  const [profiles, setProfiles] = useState<ProfileLite[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState<Task | null>(null)
  const [draft, setDraft] = useState<{ title: string; description: string; priority: TaskPriority; due_date: string; start_date: string }>({ title: '', description: '', priority: 'normal', due_date: '', start_date: '' })
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null)
  const [newCardCol, setNewCardCol] = useState<string | null>(null)
  const [newColOpen, setNewColOpen] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'gantt'>('board')
  const [linkedFixtures, setLinkedFixtures] = useState<{ id: string; title: string }[]>([])  // member fixtures pointing at this board

  // Gantt drag-to-adjust: optimistic local update, then one reschedule write
  // (which emits a 'rescheduled' event). Reload on settle to re-sync the spine.
  const onReschedule = (taskId: string, start: string | null, due: string | null) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, start_date: start, due_date: due } : t))
    wrap(() => rescheduleTask(taskId, start, due), undefined, reloadTasks)
  }

  const load = useCallback(async () => {
    const [{ data: pj }, { data: cols }, { data: tk }, { data: tm }, { data: pm }, { data: tpl }, { data: { user } }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', project_id).single(),
      supabase.from('board_columns').select('*').eq('project_id', project_id).order('sort_order'),
      supabase.from('tasks').select('*').eq('project_id', project_id).order('sort_order').order('created_at'),
      supabase.from('team_members').select('*').eq('active', true).order('display_name'),
      supabase.from('project_members').select('*').eq('project_id', project_id),
      supabase.from('task_templates').select('*').eq('project_id', project_id).order('created_at'),
      supabase.auth.getUser(),
    ])
    if (pj) setProject(pj as Project)
    if (cols) setColumns(cols as BoardColumn[])
    if (tk) setTasks(tk as Task[])
    if (tm) setTeam(tm as TeamMember[])
    if (pm) setMembers(pm as ProjectMember[])
    if (tpl) setTemplates(tpl as TaskTemplate[])

    // Resolve cross-site links live (Phase 5) — batch, graceful on missing.
    const refs = (tk as Task[] | null || [])
      .filter(t => t.linked_object_type && t.linked_object_id)
      .map(t => ({ type: t.linked_object_type as string, id: t.linked_object_id as string }))
    setLinkMap(refs.length ? await resolveLinks(supabase, refs) : new Map())

    // Member fixture(s) linked to this board (Fixtures D) — navigable, read-only.
    const { data: fx } = await supabase.from('fixtures').select('id, title').eq('ops_project_id', project_id)
    setLinkedFixtures(fx || [])

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

  // A move/reschedule/assign only changes the `tasks` table — reconcile with ONE
  // query instead of the full board reload (columns/team/links/fixtures/profile
  // are unchanged). Keeps the post-action settle cheap so rapid moves stay snappy.
  const reloadTasks = useCallback(async () => {
    const { data: tk } = await supabase.from('tasks').select('*').eq('project_id', project_id).order('sort_order').order('created_at')
    if (tk) setTasks(tk as Task[])
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
  // Cards within a column are AUTO-SORTED (no manual order): active columns by
  // due_date ASC (NULLS LAST) so the soonest/overdue rises to the top; the Done
  // column by completed_at DESC so the most-recently-finished is on top. Stable
  // created_at tiebreak so order never flickers. (sort_order is now vestigial.)
  const tasksIn = (colId: string) => {
    const isDone = columns.find(c => c.id === colId)?.is_done_column === true
    const list = tasks.filter(t => t.column_id === colId)
    if (isDone) {
      return list.sort((a, b) =>
        (b.completed_at || '').localeCompare(a.completed_at || '') ||
        (b.created_at || '').localeCompare(a.created_at || ''))
    }
    return list.sort((a, b) => {
      const ad = a.due_date, bd = b.due_date
      if (ad && bd) return ad.localeCompare(bd) || a.created_at.localeCompare(b.created_at)
      if (ad) return -1                       // dated rises above date-less
      if (bd) return 1
      return a.created_at.localeCompare(b.created_at)
    })
  }

  // `reload` defaults to the full board load; quick task-only ops (move, reschedule,
  // assign) pass reloadTasks to skip the heavy refetch.
  const wrap = async (fn: () => Promise<unknown>, after?: () => void, reload: () => Promise<void> = load) => {
    setBusy(true)
    try { await fn(); after?.(); reload() }
    catch (e) { showToast((e as Error).message, 'error') }
    finally { setBusy(false) }
  }

  // ── card create / edit ──
  const handleCreateCard = (colId: string) => (title: string) =>
    wrap(() => createTask({ project_id, column_id: colId, title }), () => setNewCardCol(null))

  const openEditor = (t: Task) => {
    setEditing(t)
    setDraft({ title: t.title, description: t.description || '', priority: t.priority, due_date: t.due_date || '', start_date: t.start_date || '' })
  }
  const saveEditor = () => {
    if (!editing) return
    wrap(() => updateTask({
      id: editing.id, title: draft.title.trim(), description: draft.description.trim() || null,
      priority: draft.priority, due_date: draft.due_date || null, start_date: draft.start_date || null,
    }), () => setEditing(null))
  }
  const changeAssignee = (assignee: string) => {
    if (!editing) return
    const id = editing.id
    // Reflect immediately in the open drawer (editing is a snapshot — without this
    // the controlled <select> snaps back to the old value until reopened).
    setEditing(e => e ? { ...e, assignee: assignee || null } : e)
    wrap(() => assignTask(id, assignee || null), undefined, reloadTasks)
  }
  // Move the card to another column from the editor (works from the Gantt popup too).
  // Picking a done-column = "mark done": ops_move_task stamps completed_at+status
  // (same path as a drag), leaving a done-column clears them. Optimistically reflect
  // done-ness so the drawer + the Gantt's status colour update immediately; wrap's
  // reload then re-syncs from the spine.
  const changeColumn = (colId: string) => {
    if (!editing || colId === editing.column_id) return
    const id = editing.id
    const isDone = columns.find(c => c.id === colId)?.is_done_column === true
    setEditing(e => e ? { ...e, column_id: colId, status: isDone ? 'done' : 'open', completed_at: isDone ? (e.completed_at || new Date().toISOString()) : null } : e)
    wrap(() => moveTask(id, colId, tasksIn(colId).length), undefined, reloadTasks)
  }

  // ── drag and drop ──
  // Move the card in local state IMMEDIATELY (optimistic), then persist — the same
  // pattern the Gantt + editor use. Without this the card only jumps after the
  // server move AND a full board reload, which reads as a long lag on the floor.
  const optimisticMove = (taskId: string, colId: string) => {
    const isDone = columns.find(c => c.id === colId)?.is_done_column === true
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t, column_id: colId,
      status: isDone ? 'done' : 'open',
      completed_at: isDone ? (t.completed_at || new Date().toISOString()) : null,
    } : t))
  }
  const onDropColumn = (colId: string) => {
    if (!dragId || !canEdit) return
    const dragged = tasks.find(t => t.id === dragId)
    setDragId(null)
    if (!dragged || dragged.column_id === colId) return  // same-column handled by card drop
    const pos = tasksIn(colId).length
    optimisticMove(dragged.id, colId)
    wrap(() => moveTask(dragged.id, colId, pos), undefined, reloadTasks)
  }
  const onDropCard = (target: Task) => {
    if (!dragId || !canEdit || dragId === target.id) { setDragId(null); return }
    const dragged = tasks.find(t => t.id === dragId)
    setDragId(null)
    if (!dragged) return
    // Within-column manual reorder is dropped — order is automatic (the sort rule).
    // A same-column drop is a no-op; only cross-column moves matter, and the card
    // lands in its sorted position by its due_date / completed_at.
    if (dragged.column_id === target.column_id) return
    const pos = tasksIn(target.column_id).length
    optimisticMove(dragged.id, target.column_id)
    wrap(() => moveTask(dragged.id, target.column_id, pos), undefined, reloadTasks)
  }

  if (loading) return <div style={emptyText}>{t('Loading board…', 'Đang tải bảng…')}</div>
  if (!project) return <div style={emptyText}>{t('Board not found, or you don’t have access.', 'Không tìm thấy bảng, hoặc bạn không có quyền truy cập.')}</div>

  return (
    <>
      <Link href="/admin/ops" style={backLink}>← {t('Boards', 'Bảng')}</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0 20px' }}>
        <h1 style={pageTitle}>{project.name}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => setView('board')} style={{ ...toggleBtn, background: view === 'board' ? 'rgba(212,184,90,0.18)' : 'transparent', color: view === 'board' ? '#D4B85A' : '#B2AA98' }}>{t('Board', 'Bảng')}</button>
            <button onClick={() => setView('gantt')} style={{ ...toggleBtn, background: view === 'gantt' ? 'rgba(212,184,90,0.18)' : 'transparent', color: view === 'gantt' ? '#D4B85A' : '#B2AA98' }}>Gantt</button>
          </div>
          <Link href={`/admin/ops/${project.id}/progress`} style={{ ...tinyBtn, textDecoration: 'none' }}>{t('Progress', 'Tiến độ')}</Link>
          <button onClick={() => setShowRecurring(s => !s)} style={tinyBtn}>{showRecurring ? t('Hide recurring', 'Ẩn định kỳ') : t('Recurring', 'Định kỳ')}</button>
          <button onClick={() => setShowActivity(s => !s)} style={tinyBtn}>{showActivity ? t('Hide activity', 'Ẩn hoạt động') : t('Activity', 'Hoạt động')}</button>
          <button onClick={() => setShowMembers(s => !s)} style={tinyBtn}>{showMembers ? t('Hide access', 'Ẩn quyền truy cập') : t('Access', 'Quyền truy cập')}</button>
          {canEdit && <button onClick={() => setNewColOpen(true)} style={tinyBtn}>{t('+ Column', '+ Cột')}</button>}
        </div>
      </div>
      {!canEdit && <div style={{ ...metaText, color: '#D4B85A', marginBottom: 8 }}>{t('View-only — you’re a viewer on this board.', 'Chỉ xem — bạn là người xem trên bảng này.')}</div>}
      {linkedFixtures.map(fx => (
        <Link key={fx.id} href="/admin/fixtures" style={{ ...metaText, color: '#9E8FC4', textDecoration: 'none', display: 'inline-block', marginBottom: 8 }} title={t('Open the linked member fixture', 'Mở lịch thi đấu hội viên đã liên kết')}>🏌 {t('Member fixture:', 'Lịch thi đấu hội viên:')} {fx.title} →</Link>
      ))}

      {showRecurring && (
        <RecurringPanel
          templates={templates} columns={columns} team={team} canEdit={canEdit} busy={busy}
          onCreate={(t) => wrap(() => createTemplate({ project_id, ...t }))}
          onToggle={(id, active) => wrap(() => setTemplateActive(id, active))}
          onMaterialise={() => wrap(async () => {
            const s = await materialiseNow()
            showToast(`${t('Materialised', 'Đã tạo')} ${s.created} · ${t('lapsed', 'đã hết hạn')} ${s.lapsed}.`)
          })}
        />
      )}

      {showActivity && (
        <div style={{ ...columnStyle, width: 'auto', marginBottom: 16 }}>
          <div style={columnHeader}><span style={{ color: '#E5D4C2' }}>{t('Activity', 'Hoạt động')}</span></div>
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

      {/* Gantt view — bars (start→due) + milestones (due-only), drag-to-adjust */}
      {view === 'gantt' && (
        <GanttView tasks={tasks} project={project} canEdit={canEdit} onOpenCard={openEditor} onReschedule={onReschedule} />
      )}

      {/* Board */}
      {view === 'board' && (
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
                  style={{ ...cardStyle, borderLeft: `3px solid ${t.status === 'lapsed' ? OPS_STATUS_COLORS.lapsed : PRIORITY_COLOUR[t.priority]}`, cursor: canEdit ? 'grab' : 'pointer', opacity: dragId === t.id ? 0.4 : t.status === 'lapsed' ? 0.55 : 1 }}
                >
                  <div style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12, lineHeight: 1.4, textDecoration: t.status === 'lapsed' ? 'line-through' : 'none' }}>
                    {t.template_id && <span title="Recurring" style={{ color: '#9E8FC4', marginRight: 5 }}>↻</span>}
                    {t.title}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {t.assignee && <span style={pill}>{teamName(t.assignee)}</span>}
                    {t.due_date && (() => {
                      const overdue = t.due_date < vnDateString() && !t.completed_at && t.status !== 'lapsed'
                      return (
                        <span style={{ ...pill, color: overdue ? OPS_STATUS_COLORS.overdue : OPS_STATUS_COLORS.upcoming, fontWeight: overdue ? 600 : 400 }} title={overdue ? 'Overdue' : 'Due'}>
                          {overdue ? '⚠ ' : ''}{new Date(t.due_date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                        </span>
                      )
                    })()}
                    {t.completed_at && <span style={{ ...pill, color: OPS_STATUS_COLORS.done }}>done</span>}
                    {t.status === 'lapsed' && <span style={{ ...pill, color: '#C27070' }}>lapsed</span>}
                    {t.linked_object_type && t.linked_object_id && (() => {
                      const rl = linkMap.get(`${t.linked_object_type}:${t.linked_object_id}`)
                      if (!rl) return null
                      if (rl.missing) return <span style={{ ...pill, color: '#7E7864', fontStyle: 'italic' }} title="linked object deleted">🔗 {rl.label}</span>
                      return (
                        <Link href={rl.url} onClick={e => e.stopPropagation()} style={{ ...pill, color: '#9E8FC4', textDecoration: 'none' }} title={`Open ${LINK_TYPE_META[rl.type].label}`}>
                          {LINK_TYPE_META[rl.type].icon} {rl.label}{rl.type === 'whisky' && rl.fillPct != null ? ` · ${rl.fillPct}%` : ''}
                        </Link>
                      )
                    })()}
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
      )}

      {/* Card editor drawer */}
      {editing && (
        <>
          <div style={drawerBackdrop} onClick={() => { if (!busy) setEditing(null) }} />
          <div style={drawer} role="dialog">
            <div style={eyebrow}>{t('Card', 'Thẻ')}</div>
            <input style={input} value={draft.title} disabled={!canEdit}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder={t('Title', 'Tiêu đề')} />
            <textarea style={{ ...input, minHeight: 90, resize: 'vertical', marginTop: 10 }} value={draft.description} disabled={!canEdit}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder={t('Description', 'Mô tả')} />
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>{t('Priority', 'Ưu tiên')}</div>
                <select style={input} value={draft.priority} disabled={!canEdit}
                  onChange={e => setDraft(d => ({ ...d, priority: e.target.value as TaskPriority }))}>
                  {PRIORITIES.map(p => <option key={p} value={p} style={{ background: '#052E20' }}>{p}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>{t('Start date', 'Ngày bắt đầu')} <span style={{ opacity: 0.5 }}>{t('· optional', '· tùy chọn')}</span></div>
                <input type="date" style={input} value={draft.start_date} disabled={!canEdit}
                  max={draft.due_date || undefined}
                  onChange={e => setDraft(d => ({ ...d, start_date: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>{t('Due date', 'Ngày đến hạn')}</div>
                <input type="date" style={input} value={draft.due_date} disabled={!canEdit}
                  min={draft.start_date || undefined}
                  onChange={e => setDraft(d => ({ ...d, due_date: e.target.value }))} />
              </div>
            </div>
            <div style={{ ...fieldLabel, marginTop: 6, opacity: 0.6 }}>
              {t('Both dates → a bar on the Gantt. Due only → a milestone. Leave both blank → unscheduled.', 'Cả hai ngày → một thanh trên Gantt. Chỉ ngày đến hạn → một mốc. Để trống cả hai → chưa lên lịch.')}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>{t('Column / status', 'Cột / trạng thái')}</div>
                <select style={input} value={editing.column_id} disabled={!canEdit}
                  onChange={e => changeColumn(e.target.value)}>
                  {columns.map(c => <option key={c.id} value={c.id} style={{ background: '#052E20' }}>{c.name}{c.is_done_column ? ' ✓' : ''}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={fieldLabel}>{t('Assignee', 'Người phụ trách')}</div>
                <select style={input} value={editing.assignee || ''} disabled={!canEdit}
                  onChange={e => changeAssignee(e.target.value)}>
                  <option value="" style={{ background: '#052E20' }}>{t('— unassigned —', '— chưa phân công —')}</option>
                  {team.map(m => <option key={m.id} value={m.id} style={{ background: '#052E20' }}>{m.display_name}</option>)}
                </select>
              </div>
            </div>

            {/* Cross-site link (Phase 5) */}
            <div style={{ marginTop: 10 }}>
              <div style={fieldLabel}>{t('Linked to', 'Liên kết tới')}</div>
              {editing.linked_object_type && editing.linked_object_id ? (() => {
                const rl = linkMap.get(`${editing.linked_object_type}:${editing.linked_object_id}`)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {rl && !rl.missing ? (
                      <Link href={rl.url} style={{ ...pill, color: '#9E8FC4', textDecoration: 'none' }}>
                        {LINK_TYPE_META[rl.type].icon} {rl.label}{rl.type === 'whisky' && rl.fillPct != null ? ` · ${rl.fillPct}% ${t('full', 'đầy')}` : ''}
                      </Link>
                    ) : (
                      <span style={{ ...pill, color: '#7E7864', fontStyle: 'italic' }}>🔗 {rl?.label || t('linked object no longer exists', 'đối tượng liên kết không còn tồn tại')}</span>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => wrap(() => unlinkTask(editing.id, rl?.label || null), () => setEditing(e => e ? { ...e, linked_object_type: null, linked_object_id: null } : e))}
                        style={{ ...tinyBtn, color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}
                      >{t('Unlink', 'Hủy liên kết')}</button>
                    )}
                  </div>
                )
              })() : canEdit ? (
                <LinkPicker onLink={(type, id, label) => wrap(
                  () => linkTask(editing.id, type, id, label),
                  () => setEditing(e => e ? { ...e, linked_object_type: type, linked_object_id: id } : e),
                )} />
              ) : <span style={metaText}>—</span>}
            </div>

            {canEdit && (
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={saveEditor} disabled={busy} style={btnPrimary}>{busy ? t('Saving…', 'Đang lưu…') : t('Save', 'Lưu')}</button>
                <button onClick={() => setEditing(null)} style={tinyBtn}>{t('Close', 'Đóng')}</button>
                <button onClick={() => { const t = editing; setEditing(null); setConfirmDelete(t) }} style={{ ...tinyBtn, marginLeft: 'auto', color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>{t('Delete', 'Xóa')}</button>
              </div>
            )}
          </div>
        </>
      )}

      <PromptModal
        open={!!newCardCol}
        eyebrow={t('＋ NEW CARD', '＋ THẺ MỚI')}
        title={t('Add a card', 'Thêm thẻ')}
        label={t('Card title', 'Tiêu đề thẻ')}
        confirmLabel={t('Add card', 'Thêm thẻ')}
        busy={busy}
        onCancel={() => setNewCardCol(null)}
        onConfirm={newCardCol ? handleCreateCard(newCardCol) : () => {}}
      />
      <PromptModal
        open={newColOpen}
        eyebrow={t('＋ NEW COLUMN', '＋ CỘT MỚI')}
        title={t('Add a column', 'Thêm cột')}
        label={t('Column name', 'Tên cột')}
        confirmLabel={t('Add column', 'Thêm cột')}
        busy={busy}
        onCancel={() => setNewColOpen(false)}
        onConfirm={(name) => wrap(() => createColumn(project_id, name), () => setNewColOpen(false))}
      />
      <ConfirmModal
        open={!!confirmDelete}
        eyebrow={t('⚠ DELETE CARD', '⚠ XÓA THẺ')}
        title={t('Delete this card?', 'Xóa thẻ này?')}
        subject={confirmDelete?.title}
        body={t('Removes the card permanently. The deletion is recorded in the activity log. Cannot be undone.', 'Xóa thẻ vĩnh viễn. Việc xóa được ghi lại trong nhật ký hoạt động. Không thể hoàn tác.')}
        confirmLabel={t('Delete card', 'Xóa thẻ')}
        busyLabel={t('Deleting…', 'Đang xóa…')}
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
  const { t } = useLang()
  const [pick, setPick] = useState('')
  const [role, setRole] = useState<ProjectRole>('contributor')
  const available = profiles.filter(p => !members.some(m => m.member === p.id))
  return (
    <div style={{ ...columnStyle, width: 'auto', marginBottom: 16 }}>
      <div style={columnHeader}><span style={{ color: '#E5D4C2' }}>{t('Access', 'Quyền truy cập')}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {members.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12 }}>{profileName(m.member)}</span>
            <span style={pill}>{m.role}</span>
            {canEdit && m.role !== 'owner' && (
              <button onClick={() => onRemove(m.member)} style={{ ...tinyBtn, marginLeft: 'auto', color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>{t('Remove', 'Xóa')}</button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <select value={pick} onChange={e => setPick(e.target.value)} style={{ ...input, width: 'auto', flex: 1 }}>
            <option value="" style={{ background: '#052E20' }}>{t('— pick a person —', '— chọn một người —')}</option>
            {available.map(p => <option key={p.id} value={p.id} style={{ background: '#052E20' }}>{p.display_name || p.id.slice(0, 8)}</option>)}
          </select>
          <select value={role} onChange={e => setRole(e.target.value as ProjectRole)} style={{ ...input, width: 'auto' }}>
            <option value="contributor" style={{ background: '#052E20' }}>contributor</option>
            <option value="viewer" style={{ background: '#052E20' }}>viewer</option>
            <option value="owner" style={{ background: '#052E20' }}>owner</option>
          </select>
          <button disabled={!pick} onClick={() => { onAdd(pick, role); setPick('') }} style={btnPrimary}>{t('Add', 'Thêm')}</button>
        </div>
      )}
    </div>
  )
}

// Cross-site link picker (Phase 5): choose a type, search the real objects, link one.
function LinkPicker({ onLink }: { onLink: (type: LinkType, id: string, label: string) => void }) {
  const { t } = useLang()
  const supabase = createBrowserSupabaseClient()
  const [type, setType] = useState<LinkType>('member')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; label: string }[]>([])
  useEffect(() => {
    let cancelled = false
    searchLinkTargets(supabase, type, q).then(r => { if (!cancelled) setResults(r) }).catch(() => {})
    return () => { cancelled = true }
  }, [type, q])  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <select value={type} onChange={e => { setType(e.target.value as LinkType); setQ('') }} style={{ ...input, width: 'auto' }}>
          {LINK_TYPES.map(t => <option key={t} value={t} style={{ background: '#052E20' }}>{LINK_TYPE_META[t].icon} {LINK_TYPE_META[t].label}</option>)}
        </select>
        {type !== 'checklist' && (
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`${t('Search', 'Tìm')} ${LINK_TYPE_META[type].label.toLowerCase()}…`} style={input} />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 160, overflowY: 'auto' }}>
        {results.length === 0 ? (
          <span style={{ ...metaText, opacity: 0.5, fontStyle: 'italic' }}>{t('No matches.', 'Không có kết quả.')}</span>
        ) : results.map(r => (
          <button key={r.id} onClick={() => onLink(type, r.id, r.label)} style={{ ...tinyBtn, textAlign: 'left' }}>
            {LINK_TYPE_META[type].icon} {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const WEEKDAYS = [{ n: 1, l: 'Mon' }, { n: 2, l: 'Tue' }, { n: 3, l: 'Wed' }, { n: 4, l: 'Thu' }, { n: 5, l: 'Fri' }, { n: 6, l: 'Sat' }, { n: 7, l: 'Sun' }]

function recurrenceSummary(r: Recurrence, t: (en: string, vi: string) => string): string {
  if (r.freq === 'daily') return t('Daily', 'Hàng ngày')
  const days = (r.weekdays || []).slice().sort((a, b) => a - b).map(n => WEEKDAYS.find(w => w.n === n)?.l || n).join(', ')
  return days ? `${t('Weekly', 'Hàng tuần')} · ${days}` : t('Weekly', 'Hàng tuần')
}

// When the first card for a freshly-added template will materialise. The cron
// runs at 00:05 VN per day, so a template added now first appears on its next
// due day (daily → tomorrow; weekly → the next matching weekday).
function firstCardLabel(r: Recurrence, t: (en: string, vi: string) => string): string {
  const iso = (d: Date) => ((d.getDay() + 6) % 7) + 1
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
  if (r.freq === 'daily') {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return `${t('tomorrow', 'ngày mai')} (${fmt(d)})`
  }
  const set = r.weekdays || []
  for (let i = 1; i <= 7; i++) {
    const c = new Date(); c.setDate(c.getDate() + i)
    if (set.includes(iso(c))) return fmt(c)
  }
  return t('its next scheduled day', 'ngày dự kiến kế tiếp')
}

function RecurringPanel({ templates, columns, team, canEdit, busy, onCreate, onToggle, onMaterialise }: {
  templates: TaskTemplate[]
  columns: BoardColumn[]
  team: TeamMember[]
  canEdit: boolean
  busy: boolean
  onCreate: (t: { column_id: string; title: string; priority: TaskPriority; default_assignee: string | null; recurrence: Recurrence }) => void
  onToggle: (id: string, active: boolean) => void
  onMaterialise: () => void
}) {
  const { t } = useLang()
  const [title, setTitle] = useState('')
  const [columnId, setColumnId] = useState(columns[0]?.id || '')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [assignee, setAssignee] = useState('')
  const [freq, setFreq] = useState<'daily' | 'weekly'>('daily')
  const [weekdays, setWeekdays] = useState<number[]>([1])
  const [confirm, setConfirm] = useState<string | null>(null)

  const toggleDay = (n: number) => setWeekdays(d => d.includes(n) ? d.filter(x => x !== n) : [...d, n].sort((a, b) => a - b))
  const submit = () => {
    if (!title.trim() || !columnId) return
    if (freq === 'weekly' && weekdays.length === 0) return
    const recurrence: Recurrence = freq === 'daily' ? { freq: 'daily' } : { freq: 'weekly', weekdays }
    const col = columns.find(c => c.id === columnId)?.name || t('the board', 'bảng')
    onCreate({ column_id: columnId, title: title.trim(), priority, default_assignee: assignee || null, recurrence })
    setConfirm(t(
      `“${title.trim()}” is set (${recurrenceSummary(recurrence, t)}). It isn’t a card yet — its first card appears in ${col} on ${firstCardLabel(recurrence, t)}, just after midnight. Recurring tasks come online on their due day, not when you add them.`,
      `“${title.trim()}” đã được thiết lập (${recurrenceSummary(recurrence, t)}). Đây chưa phải là một thẻ — thẻ đầu tiên sẽ xuất hiện trong ${col} vào ${firstCardLabel(recurrence, t)}, ngay sau nửa đêm. Các tác vụ định kỳ chỉ hiển thị vào ngày đến hạn, không phải khi bạn thêm chúng.`,
    ))
    setTitle('')
  }

  return (
    <div style={{ ...columnStyle, width: 'auto', marginBottom: 16 }}>
      <div style={columnHeader}>
        <span style={{ color: '#9E8FC4' }}>↻ {t('Recurring templates', 'Mẫu định kỳ')}</span>
        {canEdit && <button onClick={onMaterialise} disabled={busy} style={tinyBtn}>{t('Materialise now', 'Tạo ngay')}</button>}
      </div>
      {templates.length === 0 ? (
        <div style={{ ...metaText, opacity: 0.6, fontStyle: 'italic', marginBottom: 10 }}>{t('No templates yet — recurring tasks auto-appear once you add one.', 'Chưa có mẫu nào — các tác vụ định kỳ sẽ tự động xuất hiện khi bạn thêm một mẫu.')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {templates.map(tpl => (
            <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: tpl.active ? 1 : 0.5 }}>
              <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12 }}>{tpl.title}</span>
              <span style={pill}>{recurrenceSummary(tpl.recurrence, t)}</span>
              {canEdit && <button onClick={() => onToggle(tpl.id, !tpl.active)} style={{ ...tinyBtn, marginLeft: 'auto' }}>{tpl.active ? t('Pause', 'Tạm dừng') : t('Resume', 'Tiếp tục')}</button>}
            </div>
          ))}
        </div>
      )}
      {confirm && (
        <div style={recurringConfirm}>
          <span style={{ flex: 1, lineHeight: 1.5 }}>✓ {confirm}</span>
          <button onClick={() => setConfirm(null)} title={t('Dismiss', 'Bỏ qua')} style={{ background: 'transparent', border: 'none', color: '#9E8FC4', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      )}
      {canEdit && (
        <div style={{ display: 'grid', gap: 8 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('New recurring task title', 'Tiêu đề tác vụ định kỳ mới')} style={input} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={columnId} onChange={e => setColumnId(e.target.value)} style={{ ...input, width: 'auto', flex: 1 }}>
              {columns.map(c => <option key={c.id} value={c.id} style={{ background: '#052E20' }}>{c.name}</option>)}
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} style={{ ...input, width: 'auto' }}>
              {PRIORITIES.map(p => <option key={p} value={p} style={{ background: '#052E20' }}>{p}</option>)}
            </select>
            <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{ ...input, width: 'auto' }}>
              <option value="" style={{ background: '#052E20' }}>{t('— unassigned —', '— chưa phân công —')}</option>
              {team.map(m => <option key={m.id} value={m.id} style={{ background: '#052E20' }}>{m.display_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={freq} onChange={e => setFreq(e.target.value as 'daily' | 'weekly')} style={{ ...input, width: 'auto' }}>
              <option value="daily" style={{ background: '#052E20' }}>{t('Daily', 'Hàng ngày')}</option>
              <option value="weekly" style={{ background: '#052E20' }}>{t('Weekly', 'Hàng tuần')}</option>
            </select>
            {freq === 'weekly' && WEEKDAYS.map(w => (
              <button key={w.n} onClick={() => toggleDay(w.n)}
                style={{ ...tinyBtn, background: weekdays.includes(w.n) ? 'rgba(158,143,196,0.25)' : 'rgba(229,212,194,0.06)', color: weekdays.includes(w.n) ? '#E5D4C2' : '#B2AA98' }}>
                {w.l}
              </button>
            ))}
            <button onClick={submit} disabled={busy || !title.trim()} style={{ ...btnPrimary, marginLeft: 'auto' }}>{t('Add template', 'Thêm mẫu')}</button>
          </div>
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
const recurringConfirm: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 8, margin: '0 0 12px', padding: '10px 12px', background: 'rgba(158,143,196,0.10)', border: '1px solid rgba(158,143,196,0.35)', borderRadius: 6, fontFamily: FAMILY, fontSize: 11, color: '#E5D4C2' }
const input: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '8px 10px', fontFamily: FAMILY, fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none' }
const btnPrimary: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', fontFamily: FAMILY, fontSize: 11, letterSpacing: '0.06em' }
const tinyBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4, padding: '5px 10px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer', textDecoration: 'none' }
const toggleBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: '5px 12px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer' }
const emptyText: React.CSSProperties = { padding: '24px 0', fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
const drawerBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 500 }
const drawer: React.CSSProperties = { position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(420px, 92vw)', background: '#0A3526', borderLeft: '1px solid rgba(229,212,194,0.12)', boxShadow: '-12px 0 40px rgba(0,0,0,0.5)', zIndex: 501, padding: '28px 24px', overflowY: 'auto' }
