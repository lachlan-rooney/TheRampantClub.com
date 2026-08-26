'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, PromptModal, useToast } from '@/components/admin/dialogs'
import { createProject, archiveProject, updateProject, softDeleteProject } from '@/lib/ops/api'
import NotificationSettings from '@/components/admin/NotificationSettings'
import CollapsibleHeader from '@/components/admin/CollapsibleHeader'
import { useLang } from '@/lib/admin-lang'
import type { Project, TeamMember } from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"

export default function OpsHubHome() {
  const { t } = useLang()
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
  // Edit (name + description) + soft-delete (typed-name gate) modals.
  const [editing, setEditing] = useState<Project | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [deleteTyped, setDeleteTyped] = useState('')
  const [newMemberOpen, setNewMemberOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  // per-board done/total/pct — one aggregate RPC (Phase 7), keyed by project_id (active boards only)
  const [progress, setProgress] = useState<Record<string, { done: number; total: number; pct: number }>>({})

  const load = async () => {
    const [{ data: pj }, { data: tm }, { data: prog }] = await Promise.all([
      supabase.from('projects').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
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

  // Active boards keep the load order (created_at desc); archived go in their
  // own section, alphabetical by name. Soft-deleted never load (deleted_at filter).
  const activeBoards = projects.filter(p => p.status === 'active')
  const archivedBoards = projects
    .filter(p => p.status === 'archived')
    .sort((a, b) => a.name.localeCompare(b.name))

  const openEdit = (p: Project) => {
    setEditing(p); setEditName(p.name); setEditDesc(p.description || '')
  }
  const saveEdit = async () => {
    if (!editing || !editName.trim()) return
    setBusy(true)
    try {
      await updateProject(editing.id, editName.trim(), editDesc.trim() || null)
      setEditing(null); showToast(t('Board updated.', 'Đã cập nhật bảng.')); load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally { setBusy(false) }
  }

  const openDelete = (p: Project) => { setDeleting(p); setDeleteTyped('') }
  const runDelete = async () => {
    if (!deleting || deleteTyped !== deleting.name) return  // exact-name gate
    setBusy(true)
    try {
      await softDeleteProject(deleting.id)
      setDeleting(null); showToast(t('Board deleted (recoverable).', 'Đã xóa bảng (có thể khôi phục).')); load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally { setBusy(false) }
  }

  const handleCreate = async (name: string) => {
    setBusy(true)
    try {
      const id = await createProject({ name })
      setNewBoardOpen(false)
      showToast(t('Board created.', 'Đã tạo bảng.'))
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
      showToast(t('Board archived.', 'Đã lưu trữ bảng.'))
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
    showToast(t('Team member added.', 'Đã thêm thành viên nhóm.')); load()
  }
  const toggleActive = async (m: TeamMember) => {
    const { error } = await supabase.from('team_members').update({ active: !m.active }).eq('id', m.id)
    if (error) { showToast(error.message, 'error'); return }
    load()
  }

  const renderCard = (p: Project) => (
    <div key={p.id} style={{ ...card, borderLeft: `3px solid ${p.colour || '#5E6650'}`, opacity: p.status === 'archived' ? 0.7 : 1 }}>
      <Link href={`/admin/ops/${p.id}`} style={{ textDecoration: 'none' }}>
        <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', marginBottom: 4 }}>{p.name}</div>
        {p.description && <div style={{ ...metaText, marginBottom: 8 }}>{p.description}</div>}
        <div style={metaText}>
          {p.status === 'archived' ? t('Archived', 'Đã lưu trữ') : t('Active', 'Đang hoạt động')}
          {p.target_date ? ` · ${t('target', 'mục tiêu')} ${new Date(p.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
        </div>
      </Link>
      {progress[p.id] && (
        <div style={{ marginTop: 10 }}>
          <div style={progressOuter}><span style={{ ...progressInner, width: `${progress[p.id].pct}%` }} /></div>
          <div style={{ ...metaText, fontSize: 9, marginTop: 3, opacity: 0.8 }}>
            {progress[p.id].total > 0 ? `${progress[p.id].done}/${progress[p.id].total} · ${fmtPct(progress[p.id].pct)}%` : t('no tasks yet', 'chưa có nhiệm vụ')}
          </div>
        </div>
      )}
      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/admin/ops/${p.id}`} style={tinyBtn}>{t('Open', 'Mở')}</Link>
        <button onClick={() => openEdit(p)} style={tinyBtn}>{t('Edit', 'Sửa')}</button>
        {p.status === 'active' && (
          <button onClick={() => setConfirmArchive(p)} style={{ ...tinyBtn, color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>{t('Archive', 'Lưu trữ')}</button>
        )}
        {p.status === 'archived' && (
          <button onClick={() => openDelete(p)} style={{ ...tinyBtn, color: '#C27070', borderColor: 'rgba(194,112,112,0.4)' }}>{t('Delete', 'Xóa')}</button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div style={eyebrow}>{t('Operations Hub', 'Trung tâm Vận hành')}</div>
          <h1 style={pageTitle}>{t('Boards', 'Bảng')}</h1>
        </div>
        <button onClick={() => setNewBoardOpen(true)} style={btnPrimary}>{t('+ New board', '+ Bảng mới')}</button>
      </div>
      <p style={lede}>
        {t('Each board is a project — golf tournaments, the founding-membership drive, the exhibition. Cards move across columns; every move, assignment and completion is recorded.', 'Mỗi bảng là một dự án — giải golf, chiến dịch tuyển hội viên sáng lập, buổi triển lãm. Thẻ di chuyển qua các cột; mọi lần di chuyển, phân công và hoàn thành đều được ghi lại.')}
      </p>

      <label style={{ ...metaText, display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 20px', cursor: 'pointer' }}>
        <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
        {t('Show archived', 'Hiện bảng đã lưu trữ')}
      </label>

      {loading ? (
        <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
      ) : activeBoards.length === 0 && (!showArchived || archivedBoards.length === 0) ? (
        <div style={emptyText}>{t('No boards yet. Create the first one.', 'Chưa có bảng nào. Hãy tạo bảng đầu tiên.')}</div>
      ) : (
        <>
          {activeBoards.length > 0 && (
            <div style={boardGrid}>{activeBoards.map(renderCard)}</div>
          )}
          {showArchived && archivedBoards.length > 0 && (
            <>
              <div style={sectionHeading}>{t('Archived', 'Đã lưu trữ')}</div>
              <div style={boardGrid}>{archivedBoards.map(renderCard)}</div>
            </>
          )}
        </>
      )}

      {/* Roster (left) + Email notifications (right) — mirrored, identical collapsible
          headers; stacks to one column when the row gets tight. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28, marginTop: 40 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <CollapsibleHeader title={t('Team roster', 'Danh sách nhóm')} open={rosterOpen} onToggle={() => setRosterOpen(o => !o)} count={team.length} />
            {rosterOpen && <button onClick={() => setNewMemberOpen(true)} style={{ ...tinyBtn, marginLeft: 'auto' }}>{t('+ Add person', '+ Thêm người')}</button>}
          </div>
          {rosterOpen && (
            team.length === 0 ? (
              <div style={emptyText}>{t('No team members yet — add people to assign cards to.', 'Chưa có thành viên nào — thêm người để phân công thẻ.')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {team.map(m => (
                  <div key={m.id} style={{ ...rosterRow, opacity: m.active ? 1 : 0.5 }}>
                    <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 12 }}>{m.display_name}</span>
                    {m.role_title && <span style={metaText}>{m.role_title}</span>}
                    {!m.profile_id && <span style={{ ...metaText, opacity: 0.6 }}>{t('· name-only', '· chỉ tên')}</span>}
                    <button onClick={() => toggleActive(m)} style={{ ...tinyBtn, marginLeft: 'auto' }}>
                      {m.active ? t('Deactivate', 'Ngừng kích hoạt') : t('Reactivate', 'Kích hoạt lại')}
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
        eyebrow={t('＋ NEW BOARD', '＋ BẢNG MỚI')}
        title={t('Create a board', 'Tạo bảng')}
        label={t('Board name', 'Tên bảng')}
        placeholder={t('e.g. Founding-membership drive', 'vd. Chiến dịch tuyển hội viên sáng lập')}
        confirmLabel={t('Create board', 'Tạo bảng')}
        busy={busy}
        onCancel={() => setNewBoardOpen(false)}
        onConfirm={handleCreate}
      />
      <PromptModal
        open={newMemberOpen}
        eyebrow={t('＋ TEAM MEMBER', '＋ THÀNH VIÊN NHÓM')}
        title={t('Add a team member', 'Thêm thành viên nhóm')}
        label={t('Display name (a name-only person is fine — no login required)', 'Tên hiển thị (người chỉ có tên cũng được — không cần đăng nhập)')}
        placeholder={t('e.g. Miss Châu', 'vd. Cô Châu')}
        confirmLabel={t('Add', 'Thêm')}
        onCancel={() => setNewMemberOpen(false)}
        onConfirm={addTeamMember}
      />
      <ConfirmModal
        open={!!confirmArchive}
        eyebrow={t('⚠ ARCHIVE BOARD', '⚠ LƯU TRỮ BẢNG')}
        title={t('Archive this board?', 'Lưu trữ bảng này?')}
        subject={confirmArchive?.name}
        body={t('The board is hidden from the active list but kept (with its full activity history) for the record. You can show archived boards with the toggle.', 'Bảng được ẩn khỏi danh sách đang hoạt động nhưng vẫn được giữ lại (cùng toàn bộ lịch sử hoạt động) để lưu hồ sơ. Bạn có thể hiện các bảng đã lưu trữ bằng nút gạt.')}
        confirmLabel={t('Archive board', 'Lưu trữ bảng')}
        busyLabel={t('Archiving…', 'Đang lưu trữ…')}
        busy={busy}
        onCancel={() => setConfirmArchive(null)}
        onConfirm={runArchive}
      />

      {/* Edit board — name + description (two fields; the generic PromptModal is single-field) */}
      {editing && (
        <>
          <div style={modalBackdrop} onClick={() => { if (!busy) setEditing(null) }} />
          <div style={modalBox} role="dialog">
            <div style={eyebrow}>{t('✎ EDIT BOARD', '✎ SỬA BẢNG')}</div>
            <div style={{ ...metaText, marginBottom: 14 }}>{t('Update the board name and description.', 'Cập nhật tên và mô tả bảng.')}</div>
            <div style={fieldLabel}>{t('Name', 'Tên')}</div>
            <input style={modalInput} value={editName} onChange={e => setEditName(e.target.value)} />
            <div style={{ ...fieldLabel, marginTop: 12 }}>{t('Description', 'Mô tả')}</div>
            <textarea
              style={{ ...modalInput, minHeight: 96, resize: 'vertical', lineHeight: 1.5 }}
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder={t('What this board is for…', 'Bảng này dùng để làm gì…')}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={saveEdit} disabled={busy || !editName.trim()} style={{ ...btnPrimary, opacity: busy || !editName.trim() ? 0.5 : 1 }}>
                {busy ? t('Saving…', 'Đang lưu…') : t('Save', 'Lưu')}
              </button>
              <button onClick={() => setEditing(null)} style={tinyBtn}>{t('Cancel', 'Hủy')}</button>
            </div>
          </div>
        </>
      )}

      {/* Soft-delete — typed-name gate. Confirm enables ONLY on an exact name match. */}
      {deleting && (
        <>
          <div style={modalBackdrop} onClick={() => { if (!busy) setDeleting(null) }} />
          <div style={modalBox} role="dialog">
            <div style={{ ...eyebrow, color: '#C27070' }}>{t('⚠ DELETE BOARD', '⚠ XÓA BẢNG')}</div>
            <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', margin: '2px 0 8px' }}>
              {t('Delete', 'Xóa')} “{deleting.name}”?
            </div>
            <div style={{ ...metaText, lineHeight: 1.6, marginBottom: 14 }}>
              {t('Soft delete — the board leaves every view, but its tasks and full activity history are kept and remain recoverable. To confirm, type the board\'s exact name below.', 'Xóa mềm — bảng biến mất khỏi mọi màn hình, nhưng các nhiệm vụ và toàn bộ lịch sử hoạt động vẫn được giữ lại và có thể khôi phục. Để xác nhận, hãy gõ chính xác tên bảng bên dưới.')}
            </div>
            <div style={fieldLabel}>{t('Type', 'Gõ')} <span style={{ color: '#E5D4C2' }}>{deleting.name}</span> {t('to confirm', 'để xác nhận')}</div>
            <input
              style={modalInput}
              value={deleteTyped}
              onChange={e => setDeleteTyped(e.target.value)}
              placeholder={deleting.name}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={runDelete}
                disabled={busy || deleteTyped !== deleting.name}
                style={{
                  ...btnPrimary, background: '#7E3B3B',
                  opacity: busy || deleteTyped !== deleting.name ? 0.45 : 1,
                  cursor: deleteTyped !== deleting.name ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? t('Deleting…', 'Đang xóa…') : t('Delete board', 'Xóa bảng')}
              </button>
              <button onClick={() => setDeleting(null)} style={tinyBtn}>{t('Cancel', 'Hủy')}</button>
            </div>
          </div>
        </>
      )}
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
const boardGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 24 }
const sectionHeading: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#B2AA98', letterSpacing: '0.16em', textTransform: 'uppercase', margin: '16px 0 12px', paddingBottom: 6, borderBottom: '1px solid rgba(229,212,194,0.10)' }
const fieldLabel: React.CSSProperties = { fontFamily: FAMILY, fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 5 }
const modalInput: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '9px 11px', fontFamily: FAMILY, fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none' }
const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500 }
const modalBox: React.CSSProperties = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(460px, 92vw)', background: '#0A3526', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 8, padding: '22px 24px', zIndex: 501, boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }
