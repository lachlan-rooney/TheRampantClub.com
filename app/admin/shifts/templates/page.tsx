'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'

// The standing lists, editable without a deploy — add, edit, reorder,
// DEACTIVATE (never delete), and reassign a shift when a portfolio rotates.
const MONO = "'Google Sans Code', monospace"
const SERIF = "'Rampant Sans', serif"

interface Tpl { id: string; slug: string; day_of_week: number; title_en: string; title_vi: string | null
  assignee_team_member_id: string | null; charter_en: string | null; charter_vi: string | null
  measure_en: string | null; measure_vi: string | null }
interface Task { id: string; template_id: string; sort: number; title_en: string; title_vi: string | null; is_prospect_task: boolean }
interface Member { id: string; display_name: string; is_shift_supervisor: boolean }

export default function TemplatesPage() {
  const { t } = useLang()
  const [d, setD] = useState<{ templates: Tpl[]; tasks: Task[]; team: Member[]; acting: Member | null } | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [newTask, setNewTask] = useState({ en: '', vi: '' })

  const load = useCallback(() => {
    fetch('/api/admin/shifts', { cache: 'no-store' }).then(r => r.json())
      .then(j => { setD(j); if (!sel) setSel(j.templates?.[0]?.id ?? null) }).catch(() => {})
  }, [sel])
  useEffect(load, [load])

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null)
    const r = await fetch('/api/admin/shifts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) setErr((await r.json().catch(() => ({})))?.error || t('Could not save.', 'Không thể lưu.'))
    else load()
    setBusy(false)
  }

  if (!d) return null
  const tpl = d.templates.find(x => x.id === sel) || null
  const tasks = d.tasks.filter(x => x.template_id === sel).sort((a, b) => a.sort - b.sort)
  const canEdit = !!d.acting?.is_shift_supervisor

  return (
    <>
      <Link href="/admin/shifts" style={back}>← {t('Shifts', 'Ca làm việc')}</Link>
      <h1 style={{ fontFamily: SERIF, fontSize: 24, color: '#E5D4C2', margin: '16px 0 4px' }}>
        {t('Standing lists', 'Danh sách cố định')}
      </h1>
      <p style={meta}>
        {t('Edited here, not in a deploy. Deactivating a task keeps every past week intact — it is never deleted.',
           'Chỉnh sửa tại đây, không cần triển khai lại. Ngừng dùng một việc vẫn giữ nguyên các tuần đã qua — không bao giờ xoá.')}
      </p>

      {!canEdit && (
        <div style={warn}>
          {t('Only Mr Sĩ or Miss Chau can change these. You can look.',
             'Chỉ Mr Sĩ hoặc Miss Chau mới có thể thay đổi. Bạn có thể xem.')}
        </div>
      )}
      {err && <div style={{ ...warn, color: '#C27070' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0' }}>
        {d.templates.map(x => (
          <button key={x.id} onClick={() => setSel(x.id)} style={{ ...tab, ...(x.id === sel ? tabOn : null) }}>
            {['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][x.day_of_week]} · {x.title_en}
          </button>
        ))}
      </div>

      {tpl && (
        <>
          <div style={card}>
            <div style={label}>{t('Who has this shift', 'Ai phụ trách ca này')}</div>
            {/* Portfolios rotate quarterly and people leave — reassigning is a
                dropdown, not a migration. */}
            <select disabled={!canEdit || busy} value={tpl.assignee_team_member_id || ''} style={input}
              onChange={e => patch({ kind: 'template', id: tpl.id, assignee_team_member_id: e.target.value || null })}>
              <option value="">{t('— nobody —', '— chưa có ai —')}</option>
              {d.team.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>

            <div style={{ ...label, marginTop: 14 }}>{t('Measure of the week', 'Thước đo của tuần')}</div>
            <Editable value={tpl.measure_en || ''} disabled={!canEdit || busy} rows={2}
              onSave={v => patch({ kind: 'template', id: tpl.id, measure_en: v })} t={t} />

            <div style={{ ...label, marginTop: 14 }}>{t('Charter', 'Bản mô tả ca')}</div>
            <Editable value={tpl.charter_en || ''} disabled={!canEdit || busy} rows={8}
              onSave={v => patch({ kind: 'template', id: tpl.id, charter_en: v })} t={t} />
            <div style={{ ...meta, marginTop: 6 }}>
              {tpl.charter_vi
                ? t('Vietnamese charter present.', 'Đã có bản mô tả tiếng Việt.')
                : t('No Vietnamese yet — the shift view shows the English until there is.',
                    'Chưa có bản tiếng Việt — màn hình ca sẽ hiển thị tiếng Anh cho đến khi có.')}
            </div>
          </div>

          <div style={{ ...card, marginTop: 12 }}>
            <div style={label}>{t('Tasks', 'Công việc')} · {tasks.length}</div>
            {tasks.map((task, i) => (
              <div key={task.id} style={taskRow}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ ...meta, minWidth: 18 }}>{task.sort}</span>
                  <div style={{ flex: 1 }}>
                    <Editable value={task.title_en} disabled={!canEdit || busy} rows={2}
                      onSave={v => patch({ kind: 'task', id: task.id, title_en: v })} t={t} />
                    {task.title_vi && <div style={{ ...meta, marginTop: 4 }}>{task.title_vi}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {task.is_prospect_task && <span style={pill}>{t('prospect rule', 'quy tắc đề cử')}</span>}
                  <button disabled={!canEdit || busy || i === 0} style={mini}
                    onClick={() => { const above = tasks[i - 1]
                      patch({ kind: 'task', id: task.id, sort: above.sort })
                      patch({ kind: 'task', id: above.id, sort: task.sort }) }}>↑</button>
                  <button disabled={!canEdit || busy || i === tasks.length - 1} style={mini}
                    onClick={() => { const below = tasks[i + 1]
                      patch({ kind: 'task', id: task.id, sort: below.sort })
                      patch({ kind: 'task', id: below.id, sort: task.sort }) }}>↓</button>
                  <button disabled={!canEdit || busy} style={miniDanger}
                    onClick={() => patch({ kind: 'task', id: task.id, active: false })}>
                    {t('Deactivate', 'Ngừng dùng')}
                  </button>
                </div>
              </div>
            ))}

            {canEdit && (
              <div style={{ marginTop: 12, borderTop: '1px solid rgba(229,212,194,.1)', paddingTop: 12 }}>
                <input value={newTask.en} onChange={e => setNewTask(s => ({ ...s, en: e.target.value }))}
                  placeholder={t('New task (English)', 'Việc mới (tiếng Anh)')} style={input} />
                <input value={newTask.vi} onChange={e => setNewTask(s => ({ ...s, vi: e.target.value }))}
                  placeholder={t('Vietnamese (optional)', 'Tiếng Việt (tuỳ chọn)')} style={{ ...input, marginTop: 8 }} />
                <button disabled={busy || !newTask.en.trim()} style={{ ...btn, marginTop: 8 }}
                  onClick={async () => { await patch({ kind: 'task', create: true, template_id: tpl.id, title_en: newTask.en, title_vi: newTask.vi || null }); setNewTask({ en: '', vi: '' }) }}>
                  {t('Add to the list', 'Thêm vào danh sách')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

function Editable({ value, disabled, rows, onSave, t }: {
  value: string; disabled: boolean; rows: number
  onSave: (v: string) => void; t: (a: string, b: string) => string
}) {
  const [v, setV] = useState(value)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setV(value); setDirty(false) }, [value])
  return (
    <>
      <textarea value={v} disabled={disabled} rows={rows}
        onChange={e => { setV(e.target.value); setDirty(e.target.value !== value) }}
        style={{ ...input, resize: 'vertical', lineHeight: 1.7 }} />
      {dirty && !disabled && (
        <button style={{ ...mini, marginTop: 6 }} onClick={() => onSave(v)}>{t('Save', 'Lưu')}</button>
      )}
    </>
  )
}

const back: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', textDecoration: 'none' }
const card: React.CSSProperties = { padding: '14px 16px', borderRadius: 10, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.10)' }
const taskRow: React.CSSProperties = { padding: '10px 0', borderBottom: '1px solid rgba(229,212,194,0.06)' }
const meta: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, color: '#B2AA98', lineHeight: 1.7 }
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 6 }
const tab: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', border: '1px solid rgba(229,212,194,0.14)', background: 'transparent', color: '#B2AA98' }
const tabOn: React.CSSProperties = { background: 'rgba(212,184,90,0.14)', borderColor: 'rgba(212,184,90,0.55)', color: '#E7C766' }
const input: React.CSSProperties = { width: '100%', fontFamily: MONO, fontSize: 12, padding: '9px 11px', borderRadius: 7, background: 'rgba(5,46,32,0.6)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.16)' }
const btn: React.CSSProperties = { fontFamily: MONO, fontSize: 12, padding: '9px 16px', borderRadius: 7, border: 'none', background: '#D4B85A', color: '#052E20', fontWeight: 700, cursor: 'pointer' }
const mini: React.CSSProperties = { fontFamily: MONO, fontSize: 10, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(229,212,194,0.22)', background: 'transparent', color: '#B2AA98', cursor: 'pointer' }
const miniDanger: React.CSSProperties = { ...mini, borderColor: 'rgba(194,112,112,.4)', color: '#C27070' }
const pill: React.CSSProperties = { fontFamily: MONO, fontSize: 9, borderRadius: 999, padding: '2px 8px', background: 'rgba(158,143,196,.2)', color: '#9E8FC4' }
const warn: React.CSSProperties = { ...meta, color: '#D4B85A', marginTop: 12, padding: '9px 12px', borderRadius: 6, background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.2)' }
