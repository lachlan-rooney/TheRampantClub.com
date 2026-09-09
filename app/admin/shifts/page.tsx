'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// YOUR SHIFT — a checklist, not a Gantt.
// ───────────────────────────────────────────────────────────────────────────
// Four to eight tasks, one person, one day, read standing at a desk or in a
// corridor. A Gantt shows duration and dependency and this has neither; a kanban
// costs a drag per task for a state most tasks enter once. So: one scrolling
// list, the measure pinned at the top because it is the point of the screen, the
// charter collapsed behind it, and each task expanding IN PLACE to take its
// evidence. No navigation to tick something.
const MONO = "'Google Sans Code', monospace"
const SERIF = "'Rampant Sans', serif"

interface Tpl { id: string; slug: string; day_of_week: number; title_en: string; title_vi: string | null
  assignee_team_member_id: string | null; charter_en: string | null; charter_vi: string | null
  measure_en: string | null; measure_vi: string | null }
interface Task { id: string; template_id: string; sort: number; title_en: string; title_vi: string | null; is_prospect_task: boolean }
interface Inst { id: string; template_task_id: string; template_id: string; status: string; evidence: string | null
  blocked_reason: string | null; blocked_unblocker: string | null; note: string | null
  carried_over_count: number; shift_date: string; prospect_id: string | null }
interface Ev { id: string; instance_id: string; kind: string; actor_name: string | null; old_status: string | null; new_status: string | null; note: string | null; created_at: string }
interface Member { id: string; display_name: string; is_shift_supervisor: boolean }
interface Note { key: string; body_en: string; body_vi: string | null; applies_to: string }
interface Obj { template_id: string; objective_en: string; objective_vi: string | null }

const STATUS: Record<string, { en: string; vi: string; colour: string }> = {
  not_started: { en: 'Not started', vi: 'Chưa bắt đầu', colour: 'rgba(229,212,194,0.25)' },
  in_progress: { en: 'In progress', vi: 'Đang làm',     colour: '#D4B85A' },
  done:        { en: 'Done',        vi: 'Xong',         colour: '#7AB07A' },
  blocked:     { en: 'Blocked',     vi: 'Bị chặn',      colour: '#C27070' },
}

export default function ShiftPage() {
  const { t, lang } = useLang()
  const [d, setD] = useState<{ week: string; acting: Member | null; templates: Tpl[]; tasks: Task[]
    instances: Inst[]; events: Ev[]; notes: Note[]; objectives: Obj[]; team: Member[] } | null>(null)
  const [week, setWeek] = useState<string | null>(null)
  const [view, setView] = useState<string | null>(null)   // template id being shown
  const [open, setOpen] = useState<string | null>(null)   // expanded instance id
  const [charter, setCharter] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch(`/api/admin/shifts${week ? `?week=${week}` : ''}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { setD(j); if (!week) setWeek(j.week) }).catch(() => {})
  }, [week])
  useEffect(load, [load])

  // Default to the acting person's own shift — the screen should open on your
  // list, not on a picker.
  const mine = useMemo(() => d?.templates.find(x => x.assignee_team_member_id === d?.acting?.id) || null, [d])
  useEffect(() => { if (d && !view) setView(mine?.id || d.templates[0]?.id || null) }, [d, mine, view])

  const tpl = d?.templates.find(x => x.id === view) || null
  const isMine = !!tpl && !!d?.acting && tpl.assignee_team_member_id === d.acting.id
  const pick = (en: string | null, vi: string | null) => (lang === 'vn' ? (vi || en) : en) || ''

  const rows = useMemo(() => {
    if (!d || !tpl) return []
    return d.tasks.filter(x => x.template_id === tpl.id).sort((a, b) => a.sort - b.sort)
      .map(task => ({ task, inst: d.instances.find(i => i.template_task_id === task.id) || null }))
  }, [d, tpl])

  const save = async (instId: string, patch: Record<string, unknown>) => {
    setBusy(true); setErr(null)
    const r = await fetch('/api/admin/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instId, ...patch }) })
    if (!r.ok) setErr((await r.json().catch(() => ({})))?.error || t('Could not save.', 'Không thể lưu.'))
    else { load(); setOpen(null) }
    setBusy(false)
  }

  if (!d) return null
  const done = rows.filter(r => r.inst?.status === 'done').length
  const objective = d.objectives.find(o => o.template_id === tpl?.id)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: '#E5D4C2', letterSpacing: '.04em' }}>
          {t('Your shift', 'Ca của bạn')}
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/admin/shifts/prospects" style={ghost}>{t('Prospects', 'Đề cử')}</Link>
          {d.acting?.is_shift_supervisor && <Link href="/admin/shifts/review" style={ghost}>{t('Monday review', 'Rà soát thứ Hai')}</Link>}
          {d.acting?.is_shift_supervisor && <Link href="/admin/shifts/templates" style={ghost}>{t('Templates', 'Mẫu công việc')}</Link>}
        </div>
      </div>

      {!d.acting && (
        <div style={warn}>
          {t('Nobody is signed in on this device. Pick who you are before ticking anything.',
             'Chưa có ai đăng nhập trên thiết bị này. Hãy chọn bạn là ai trước khi tích công việc.')}{' '}
          <Link href="/admin/who" style={{ color: '#D4B85A' }}>{t('Pick your name', 'Chọn tên của bạn')} →</Link>
        </div>
      )}

      {/* Whose list — defaults to yours, but a supervisor can look at any. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0 4px' }}>
        {d.templates.map(x => {
          const who = d.team.find(m => m.id === x.assignee_team_member_id)
          const on = x.id === view
          return (
            <button key={x.id} onClick={() => { setView(x.id); setOpen(null); setCharter(false) }}
              style={{ ...tab, ...(on ? tabOn : null) }}>
              {who?.display_name || pick(x.title_en, x.title_vi)}
              {x.assignee_team_member_id === d.acting?.id && <span style={{ opacity: .7 }}> ·  {t('you', 'bạn')}</span>}
            </button>
          )
        })}
      </div>

      {tpl && (
        <div style={card}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#B2AA98' }}>
            {['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][tpl.day_of_week]} · {pick(tpl.title_en, tpl.title_vi)}
          </div>

          {/* THE MEASURE, never collapsed. It is the point of the screen. */}
          {tpl.measure_en && (
            <div style={{ fontFamily: SERIF, fontSize: 17, color: '#E7C766', lineHeight: 1.45, margin: '10px 0 4px' }}>
              {pick(tpl.measure_en, tpl.measure_vi)}
            </div>
          )}

          {objective && (
            <div style={{ ...meta, color: '#D4B85A', marginTop: 8 }}>
              {t('This week', 'Tuần này')}: {pick(objective.objective_en, objective.objective_vi)}
            </div>
          )}

          {tpl.charter_en && (
            <>
              <button onClick={() => setCharter(c => !c)} style={{ ...ghost, marginTop: 12 }}>
                {charter ? t('Hide the charter', 'Ẩn bản mô tả') : t('What this shift is for', 'Ca này để làm gì')}
              </button>
              {charter && (
                <div style={{ ...meta, whiteSpace: 'pre-line', marginTop: 10, lineHeight: 1.8 }}>
                  {pick(tpl.charter_en, tpl.charter_vi)}
                  {/* charter_vi is NULL until Miss Chau supplies it; pick() falls
                      back to English rather than rendering an empty block. */}
                </div>
              )}
            </>
          )}

          <div style={{ ...meta, marginTop: 12 }}>{done}/{rows.length} {t('done', 'đã xong')}</div>
        </div>
      )}

      {err && <div style={{ ...warn, color: '#C27070' }}>{err}</div>}

      {/* ── THE LIST ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 14 }}>
        {rows.map(({ task, inst }) => {
          const st = STATUS[inst?.status || 'not_started']
          const revert = d.events.find(e => e.instance_id === inst?.id && e.kind === 'revert')
          const isOpen = open === inst?.id
          return (
            <div key={task.id} style={{ ...row, borderLeft: `3px solid ${st.colour}` }}>
              <button onClick={() => inst && setOpen(isOpen ? null : inst.id)} style={rowBtn}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, color: '#E5D4C2', lineHeight: 1.6 }}>
                    {task.sort}. {pick(task.title_en, task.title_vi)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                    <span style={{ ...pill, background: st.colour, color: '#052E20' }}>{lang === 'vn' ? st.vi : st.en}</span>
                    {task.is_prospect_task && <span style={{ ...pill, background: 'rgba(158,143,196,.2)', color: '#9E8FC4' }}>{t('prospect', 'đề cử')}</span>}
                    {/* CARRY-OVER: 2 is a flag, 3+ is escalated. */}
                    {!!inst?.carried_over_count && inst.carried_over_count > 0 && (
                      <span style={{ ...pill,
                        background: inst.carried_over_count >= 3 ? 'rgba(194,112,112,.22)' : 'rgba(212,184,90,.18)',
                        color: inst.carried_over_count >= 3 ? '#C27070' : '#D4B85A' }}>
                        {t('carried over', 'chuyển tiếp')} ×{inst.carried_over_count}
                      </span>
                    )}
                    {inst?.evidence && <span style={{ ...meta, opacity: .6 }}>✓ {inst.evidence.slice(0, 40)}</span>}
                  </div>

                  {/* A REVERT IS SHOWN ON THE ROW. The person who ticked it must
                      see the correction without going looking for it. */}
                  {revert && (
                    <div style={{ ...meta, color: '#C27070', marginTop: 6, lineHeight: 1.6 }}>
                      {t('Reverted by', 'Bị hoàn lại bởi')} {revert.actor_name} — {revert.note}
                    </div>
                  )}
                </div>
              </button>

              {isOpen && inst && (
                <TaskEditor inst={inst} isMine={isMine} acting={d.acting} busy={busy} onSave={save} t={t} />
              )}
            </div>
          )
        })}
      </div>

      {/* Blocks that apply to this shift. */}
      {d.notes.filter(n => n.applies_to === 'all' || (n.applies_to === 'non_supervisor' && rows.some(r => r.task.is_prospect_task)))
        .map(n => (
          <div key={n.key} style={{ ...card, marginTop: 12 }}>
            <div style={{ ...meta, lineHeight: 1.8 }}>{pick(n.body_en, n.body_vi)}</div>
          </div>
        ))}
    </>
  )
}

function TaskEditor({ inst, isMine, acting, busy, onSave, t }: {
  inst: Inst; isMine: boolean; acting: Member | null; busy: boolean
  onSave: (id: string, patch: Record<string, unknown>) => void
  t: (a: string, b: string) => string
}) {
  const [evidence, setEvidence] = useState(inst.evidence || '')
  const [note, setNote] = useState(inst.note || '')
  const [reason, setReason] = useState(inst.blocked_reason || '')
  const [unblocker, setUnblocker] = useState(inst.blocked_unblocker || '')
  const [revertNote, setRevertNote] = useState('')
  const [pin, setPin] = useState('')
  const canRevert = !isMine && acting?.is_shift_supervisor && inst.status === 'done'

  if (canRevert) {
    return (
      <div style={editor}>
        <div style={{ ...meta, color: '#C27070', marginBottom: 8 }}>
          {t('You can send this back, with a note and your PIN. You cannot complete it for them.',
             'Bạn có thể trả lại việc này, kèm ghi chú và mã PIN. Bạn không thể làm thay họ.')}
        </div>
        <textarea value={revertNote} onChange={e => setRevertNote(e.target.value)} rows={2}
          placeholder={t('Why is it going back?', 'Vì sao trả lại?')} style={input} />
        <input value={pin} onChange={e => setPin(e.target.value)} inputMode="numeric" type="password"
          placeholder={t('Your PIN', 'Mã PIN của bạn')} style={{ ...input, width: 120, marginTop: 8 }} />
        <div style={{ marginTop: 8 }}>
          <button disabled={busy || !revertNote.trim() || !pin} style={btnDanger}
            onClick={() => onSave(inst.id, { status: 'in_progress', revert_note: revertNote, pin })}>
            {t('Send back', 'Trả lại')}
          </button>
        </div>
      </div>
    )
  }
  if (!isMine) {
    return <div style={editor}><div style={meta}>{t('This is not your task.', 'Đây không phải việc của bạn.')}</div></div>
  }
  return (
    <div style={editor}>
      <div style={{ ...meta, marginBottom: 4 }}>{t('Evidence — where it is, or a link. No evidence, not done.', 'Bằng chứng — ở đâu, hoặc một liên kết. Không có bằng chứng thì chưa xong.')}</div>
      <input value={evidence} onChange={e => setEvidence(e.target.value)} style={input}
        placeholder={t('Drive > Member Care > Occasions_wk36', 'Drive > Member Care > Occasions_wk36')} />
      <input value={note} onChange={e => setNote(e.target.value)} style={{ ...input, marginTop: 8 }}
        placeholder={t('Note (optional)', 'Ghi chú (tuỳ chọn)')} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button disabled={busy} style={btn} onClick={() => onSave(inst.id, { status: 'in_progress', evidence: evidence || null, note: note || null })}>
          {t('In progress', 'Đang làm')}
        </button>
        <button disabled={busy || !evidence.trim()} style={{ ...btn, background: '#7AB07A', opacity: evidence.trim() ? 1 : .4 }}
          onClick={() => onSave(inst.id, { status: 'done', evidence, note: note || null })}>
          {t('Done', 'Xong')}
        </button>
      </div>
      <div style={{ marginTop: 12, borderTop: '1px solid rgba(229,212,194,.1)', paddingTop: 10 }}>
        <input value={reason} onChange={e => setReason(e.target.value)} style={input}
          placeholder={t('Blocked because…', 'Bị chặn vì…')} />
        <input value={unblocker} onChange={e => setUnblocker(e.target.value)} style={{ ...input, marginTop: 8 }}
          placeholder={t('Who can unblock it? (optional)', 'Ai có thể gỡ? (tuỳ chọn)')} />
        <button disabled={busy || !reason.trim()} style={{ ...btnGhostDanger, marginTop: 8, opacity: reason.trim() ? 1 : .4 }}
          onClick={() => onSave(inst.id, { status: 'blocked', blocked_reason: reason, blocked_unblocker: unblocker || null })}>
          {t('Blocked', 'Bị chặn')}
        </button>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { padding: '14px 16px', borderRadius: 10, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.10)', marginTop: 10 }
const row: React.CSSProperties = { borderRadius: 10, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.08)', marginBottom: 8, overflow: 'hidden' }
const rowBtn: React.CSSProperties = { display: 'flex', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer' }
const editor: React.CSSProperties = { padding: '12px 14px', borderTop: '1px solid rgba(229,212,194,0.08)', background: 'rgba(5,46,32,0.35)' }
const meta: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, color: '#B2AA98', lineHeight: 1.7 }
const pill: React.CSSProperties = { fontFamily: MONO, fontSize: 9, borderRadius: 999, padding: '2px 8px', letterSpacing: '.04em' }
const tab: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', border: '1px solid rgba(229,212,194,0.14)', background: 'transparent', color: '#B2AA98' }
const tabOn: React.CSSProperties = { background: 'rgba(212,184,90,0.14)', borderColor: 'rgba(212,184,90,0.55)', color: '#E7C766' }
const input: React.CSSProperties = { width: '100%', fontFamily: MONO, fontSize: 12, padding: '9px 11px', borderRadius: 7, background: 'rgba(5,46,32,0.6)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.16)' }
const btn: React.CSSProperties = { fontFamily: MONO, fontSize: 12, padding: '9px 16px', borderRadius: 7, border: 'none', background: '#D4B85A', color: '#052E20', fontWeight: 700, cursor: 'pointer' }
const btnDanger: React.CSSProperties = { ...btn, background: '#C27070', color: '#fff' }
const btnGhostDanger: React.CSSProperties = { fontFamily: MONO, fontSize: 11, padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(194,112,112,.4)', background: 'transparent', color: '#C27070', cursor: 'pointer' }
const ghost: React.CSSProperties = { fontFamily: MONO, fontSize: 10, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(229,212,194,0.22)', background: 'transparent', color: '#B2AA98', cursor: 'pointer', textDecoration: 'none' }
const warn: React.CSSProperties = { ...meta, color: '#D4B85A', marginTop: 12, padding: '9px 12px', borderRadius: 6, background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.2)' }
