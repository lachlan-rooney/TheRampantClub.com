'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'
import { ADMIN_SURFACE } from '@/lib/admin/surfaces'

// ═══════════════════════════════════════════════════════════════════════════
// DAY SHIFTS — read on a phone, standing up, mid-shift.
// ───────────────────────────────────────────────────────────────────────────
// The primary device is a phone held in one hand in a corridor, NOT a desk. So:
// one day at a time down a vertical list, because the question is "what is the
// next thing to do" and that is a list, never a grid. A week of columns cannot
// work at 390px and pretending otherwise costs a horizontal scroll to find
// today — which is the one thing that must never be more than zero taps away.
//
// EVERYTHING HERE READS FROM INSTANCES. The template is touched for exactly two
// things — the day's measure/charter, and sort order — and for NOTHING that
// decides whether a task existed or what it said. A past week is drawn from its
// own rows, so retiring a task tomorrow cannot erase it from a week somebody did
// it in, and adding one cannot make last month look like it was failing.
const MONO = "'Google Sans Code', monospace"
const SERIF = "'Rampant Sans', serif"

const DONE = '#7AB07A', WIP = '#D4B85A', BLOCKED = '#C27070', NREQ = '#8A8172'

interface Tpl { id: string; day_of_week: number; title_en: string; title_vi: string | null
  assignee_team_member_id: string | null; charter_en: string | null; charter_vi: string | null
  measure_en: string | null; measure_vi: string | null }
interface Task { id: string; template_id: string; sort: number }
interface Inst {
  id: string; template_task_id: string | null; template_id: string; status: string
  evidence: string | null; blocked_reason: string | null; blocked_unblocker: string | null
  note: string | null; carried_over_count: number; shift_date: string; prospect_id: string | null
  title_en: string; title_vi: string | null; is_one_off: boolean; completed_by: string | null
  // Who was ROSTERED, snapshotted when the week was generated. Kept apart from
  // completed_by so a cover shows as a cover rather than being flattened away.
  assignee_team_member_id: string | null
}
interface Ev { id: string; instance_id: string; kind: string; actor_name: string | null
  old_status: string | null; new_status: string | null; note: string | null; created_at: string }
interface Member { id: string; display_name: string; is_shift_supervisor: boolean }
interface Obj { template_id: string; objective_en: string; objective_vi: string | null }

type Data = {
  week: string; acting: Member | null; templates: Tpl[]; tasks: Task[]; instances: Inst[]
  events: Ev[]; team: Member[]; objectives: Obj[]; nrCounts: Record<string, number>
}

const mondayOf = (d: Date) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10) }
const addDays = (iso: string, n: number) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)
const vnToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

// NOT REQUIRED COUNTS AS COMPLETE. Decided deliberately: a day with two of eight
// not required and six done is DONE, not 75%. If the feature that removes noise
// made every day look unfinished, staff would stop using it and the noise wins.
const isComplete = (s: string) => s === 'done' || s === 'not_required'

export default function DayShiftsPage() {
  const { t, lang } = useLang()
  const [d, setD] = useState<Data | null>(null)
  const [week, setWeek] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)          // a shift_date
  const [open, setOpen] = useState<string | null>(null)
  const [charter, setCharter] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState('')
  const chipRef = useRef<Record<string, HTMLButtonElement | null>>({})

  const load = useCallback(() => {
    fetch(`/api/admin/shifts${week ? `?week=${week}` : ''}`, { cache: 'no-store' })
      .then(r => r.json()).then((j: Data) => { setD(j); if (!week) setWeek(j.week) }).catch(() => {})
  }, [week])
  useEffect(load, [load])

  const pick = (en: string | null, vi: string | null) => (lang === 'vn' ? (vi || en) : en) || ''
  const thisWeek = mondayOf(new Date(Date.now() + 7 * 3600e3))

  // ── THE DAYS, derived from the week's own instances ────────────────────────
  // Not from the template list: a day only exists on this board because rows
  // exist for it, which is what makes a historical week honest.
  const days = useMemo(() => {
    if (!d) return []
    const by = new Map<string, Inst[]>()
    for (const i of d.instances) { const a = by.get(i.shift_date) || []; a.push(i); by.set(i.shift_date, a) }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, insts]) => {
        const total = insts.length
        const complete = insts.filter(i => isComplete(i.status)).length
        return { date, insts, total, complete, pct: total ? Math.round((complete / total) * 100) : 0,
                 dow: new Date(date + 'T00:00:00Z').getUTCDay() }
      })
  }, [d])

  // Open on TODAY. Falling back to the first day of the week when looking back.
  useEffect(() => {
    if (!days.length || day) return
    setDay(days.find(x => x.date === vnToday())?.date || days[0].date)
  }, [days, day])

  // …and scroll that chip into view, so finding today is never a horizontal drag.
  useEffect(() => {
    if (!day) return
    chipRef.current[day]?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [day, days.length])

  const today = days.find(x => x.date === day) || null
  const tpl = d?.templates.find(x => x.id === today?.insts[0]?.template_id) || null
  const rostered = d?.team.find(m => m.id === tpl?.assignee_team_member_id)
  const objective = d?.objectives.find(o => o.template_id === tpl?.id)

  const weekTotal = d?.instances.length || 0
  const weekDone = (d?.instances || []).filter(i => isComplete(i.status)).length

  // Order from the template's sort — the ONLY thing the template is asked for
  // here. A one-off has no template task, so it sits at the end of its day.
  const rows = useMemo(() => {
    if (!d || !today) return []
    const sortOf = (i: Inst) => i.template_task_id
      ? (d.tasks.find(x => x.id === i.template_task_id)?.sort ?? 900) : 950
    return [...today.insts].sort((a, b) => sortOf(a) - sortOf(b) || a.title_en.localeCompare(b.title_en))
  }, [d, today])

  const save = async (instId: string, patch: Record<string, unknown>) => {
    setBusy(true); setErr(null)
    const r = await fetch('/api/admin/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instId, ...patch }) })
    if (!r.ok) setErr((await r.json().catch(() => ({})))?.error || t('Could not save.', 'Không thể lưu.'))
    else { load(); setOpen(null) }
    setBusy(false)
  }

  const addOneOff = async () => {
    if (!adding.trim() || !tpl || !week) return
    setBusy(true); setErr(null)
    const r = await fetch('/api/admin/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_one_off', template_id: tpl.id, week_start: week, title: adding.trim() }) })
    if (!r.ok) setErr((await r.json().catch(() => ({})))?.error || t('Could not add that task.', 'Không thể thêm.'))
    else { setAdding(''); load() }
    setBusy(false)
  }

  if (!d) return null
  const name = lang === 'vn' ? ADMIN_SURFACE['/admin/shifts'].vn : ADMIN_SURFACE['/admin/shifts'].en

  return (
    <>
      {/* ── STICKY: the name, the week, and how the week is going ─────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#052E20', paddingBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 22, color: '#E5D4C2', letterSpacing: '.04em' }}>{name}</h1>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button style={mini} onClick={() => { setWeek(w => addDays(w || thisWeek, -7)); setDay(null) }}>‹</button>
            <span style={{ ...meta, minWidth: 88, textAlign: 'center' }}>
              {week === thisWeek ? t('This week', 'Tuần này') : `${week} →`}
            </span>
            <button style={mini} disabled={(week || thisWeek) >= thisWeek}
              onClick={() => { setWeek(w => addDays(w || thisWeek, 7)); setDay(null) }}>›</button>
          </div>
        </div>
        <Bar value={weekDone} total={weekTotal} height={3} />
        <div style={{ ...meta, marginTop: 3 }}>{weekDone} {t('of', '/')} {weekTotal} {t('across the week', 'trong tuần')}</div>
      </div>

      {err && <div style={{ ...warn, color: BLOCKED }}>{err}</div>}
      {!d.acting && (
        <div style={warn}>
          {t('Nobody is signed in on this device.', 'Chưa có ai đăng nhập trên thiết bị này.')}{' '}
          <Link href="/admin/who" style={{ color: WIP }}>{t('Pick your name', 'Chọn tên của bạn')} →</Link>
        </div>
      )}

      {/* ── DAY CHIPS. The DAY, never the person. ─────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 0 2px', scrollbarWidth: 'none' }}>
        {days.map(x => {
          const on = x.date === day
          return (
            <button key={x.date} ref={el => { chipRef.current[x.date] = el }}
              onClick={() => { setDay(x.date); setOpen(null); setCharter(false) }}
              style={{ ...chip, ...(on ? chipOn : null) }}>
              <span>{(lang === 'vn' ? DAY_VN : DAY_EN)[x.dow]}</span>
              <span style={{ display: 'block', height: 2, marginTop: 5, background: 'rgba(229,212,194,0.14)' }}>
                <span style={{ display: 'block', height: 2, width: `${x.pct}%`, background: x.pct === 100 ? DONE : WIP }} />
              </span>
            </button>
          )
        })}
      </div>

      {today && (
        <>
          {/* The rostered person is TEXT, never a column header. */}
          <div style={{ ...card, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: SERIF, fontSize: 16, color: '#E5D4C2' }}>
                {new Date(today.date + 'T00:00:00Z').toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB',
                  { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                {tpl && <span style={{ ...meta, marginLeft: 8 }}>{pick(tpl.title_en, tpl.title_vi)}</span>}
              </div>
              {rostered && <div style={meta}>{t('Rostered', 'Phân ca')}: {rostered.display_name}</div>}
            </div>

            <div style={{ marginTop: 10 }}>
              <Bar value={today.complete} total={today.total} height={6} />
              <div style={{ ...meta, marginTop: 4 }}>
                {today.complete} {t('of', '/')} {today.total}
                {today.insts.some(i => i.status === 'not_required') &&
                  <span style={{ color: NREQ }}>{'  ·  '}
                    {today.insts.filter(i => i.status === 'not_required').length} {t('not required', 'không cần')}</span>}
              </div>
            </div>

            {objective && (
              <div style={{ ...meta, marginTop: 8, color: WIP }}>
                {t('This week', 'Tuần này')}: {pick(objective.objective_en, objective.objective_vi)}
              </div>
            )}
            {tpl?.measure_en && <div style={{ ...meta, marginTop: 6 }}>{pick(tpl.measure_en, tpl.measure_vi)}</div>}
            {tpl?.charter_en && (
              <button style={{ ...mini, marginTop: 8 }} onClick={() => setCharter(c => !c)}>
                {charter ? t('Hide the charter', 'Ẩn bản mô tả') : t('The charter', 'Bản mô tả')}
              </button>
            )}
            {charter && <p style={{ ...meta, whiteSpace: 'pre-line', marginTop: 8 }}>{pick(tpl!.charter_en, tpl!.charter_vi)}</p>}
          </div>

          {/* ── THE LIST ─────────────────────────────────────────────────── */}
          <div style={{ marginTop: 12 }}>
            {rows.map(i => (
              <Row key={i.id} i={i} d={d} open={open === i.id} busy={busy}
                onToggle={() => setOpen(o => (o === i.id ? null : i.id))} onSave={save} t={t} lang={lang} />
            ))}
          </div>

          {/* ── ADD. The SCOPE IS IN THE LABEL, so nobody has to learn a rule. */}
          <div style={{ ...card, marginTop: 12 }}>
            <div style={label}>{t('Add a task', 'Thêm việc')}</div>
            <input value={adding} onChange={e => setAdding(e.target.value)} style={input}
              placeholder={t('Something that came up today', 'Việc phát sinh hôm nay')} />
            <button disabled={busy || !adding.trim()} style={{ ...mini, marginTop: 8 }} onClick={addOneOff}>
              + {t('Add a task — just today', 'Thêm việc — chỉ hôm nay')}
            </button>
            <div style={{ ...meta, marginTop: 6, opacity: .8 }}>
              {t('It stays on this day and does not come back next week. To make it weekly, add it in Templates.',
                 'Việc này chỉ nằm trong ngày hôm nay và không lặp lại tuần sau. Muốn lặp hằng tuần, hãy thêm trong Mẫu công việc.')}
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <Link href="/admin/shifts/prospects" style={ghost}>{ADMIN_SURFACE['/admin/shifts/prospects'][lang === 'vn' ? 'vn' : 'en']}</Link>
        {d.acting?.is_shift_supervisor && <Link href="/admin/shifts/review" style={ghost}>{ADMIN_SURFACE['/admin/shifts/review'][lang === 'vn' ? 'vn' : 'en']}</Link>}
        {d.acting?.is_shift_supervisor && <Link href="/admin/shifts/templates" style={ghost}>{ADMIN_SURFACE['/admin/shifts/templates'][lang === 'vn' ? 'vn' : 'en']}</Link>}
      </div>
    </>
  )
}

// ═══ ONE TASK ══════════════════════════════════════════════════════════════
function Row({ i, d, open, busy, onToggle, onSave, t, lang }: {
  i: Inst; d: Data; open: boolean; busy: boolean; onToggle: () => void
  onSave: (id: string, patch: Record<string, unknown>) => void
  t: (en: string, vn: string) => string; lang: string
}) {
  const [evidence, setEvidence] = useState('')
  const [reason, setReason] = useState('')
  const [revert, setRevert] = useState('')

  const nreq = i.status === 'not_required'
  const done = i.status === 'done'
  const title = (lang === 'vn' ? (i.title_vi || i.title_en) : i.title_en)

  // Who and when, from the EVENT — provenance, not a bare flag.
  const mark = d.events.filter(e => e.instance_id === i.id && (nreq ? e.kind === 'not_required' : e.kind === 'status'))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  const completer = d.team.find(m => m.id === i.completed_by)
  const nrTimes = i.template_task_id ? (d.nrCounts[i.template_task_id] || 0) : 0

  const dot = nreq ? NREQ : done ? DONE : i.status === 'blocked' ? BLOCKED
    : i.status === 'in_progress' ? WIP : 'rgba(229,212,194,0.28)'

  return (
    <div style={{ borderBottom: '1px solid rgba(229,212,194,0.07)' }}>
      <button onClick={onToggle} style={{ ...rowBtn, cursor: 'pointer' }}>
        <span style={{ width: 10, flexShrink: 0, color: dot, fontSize: 13, lineHeight: '20px' }}>
          {nreq ? '⊘' : done ? '●' : '○'}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontFamily: MONO, fontSize: 12.5, lineHeight: 1.5,
            color: nreq ? NREQ : '#E5D4C2',
            textDecoration: nreq ? 'line-through' : 'none',   // NOT a shade of done
            opacity: nreq ? .75 : 1,
          }}>{title}</span>
          {i.is_one_off && <span style={{ ...pill, background: 'rgba(158,143,196,.18)', color: '#9E8FC4', marginLeft: 6 }}>
            {t('just today', 'chỉ hôm nay')}</span>}
          {i.carried_over_count > 0 && <span style={{ ...pill, marginLeft: 6,
            background: i.carried_over_count >= 3 ? 'rgba(194,112,112,.22)' : 'rgba(212,184,90,.18)',
            color: i.carried_over_count >= 3 ? BLOCKED : WIP }}>×{i.carried_over_count}</span>}

          {/* Always visible, never behind a tap — a manager reading the week
              has to tell not-required from done at a glance. */}
          {nreq && (
            <span style={{ ...meta, display: 'block', color: NREQ }}>
              {t('not required', 'không cần')}{mark?.actor_name ? ` · ${mark.actor_name}` : ''}
              {mark ? ` · ${mark.created_at.slice(0, 10)}` : ''}
              {nrTimes >= 3 && <span style={{ color: WIP }}>{'  ·  '}{nrTimes}/8 {t('weeks', 'tuần')}</span>}
            </span>
          )}
          {done && completer && (
            <span style={{ ...meta, display: 'block', color: DONE }}>
              ✓ {completer.display_name}
              {i.assignee_team_member_id && i.completed_by !== i.assignee_team_member_id &&
                <span style={{ color: WIP }}> · {t('covered', 'làm thay')}</span>}
            </span>
          )}
          {i.status === 'blocked' && i.blocked_reason &&
            <span style={{ ...meta, display: 'block', color: BLOCKED }}>{i.blocked_reason}</span>}
        </span>
        {!nreq && <span style={{ ...meta, flexShrink: 0 }}>›</span>}
      </button>

      {open && (
        <div style={{ padding: '2px 0 14px 22px' }}>
          {!done && !nreq && (
            <>
              <div style={label}>{t('Evidence — what did you actually do?', 'Bằng chứng — bạn đã làm gì?')}</div>
              <input value={evidence} onChange={e => setEvidence(e.target.value)} style={input}
                placeholder={t('Counted, 3 bottles short — logged', 'Đã kiểm, thiếu 3 chai — đã ghi')} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <button disabled={busy || !evidence.trim()} style={{ ...mini, borderColor: DONE, color: DONE }}
                  onClick={() => onSave(i.id, { status: 'done', evidence })}>{t('Done', 'Xong')}</button>
                <button disabled={busy} style={mini}
                  onClick={() => onSave(i.id, { status: 'in_progress' })}>{t('Started', 'Đang làm')}</button>
              </div>

              <div style={{ ...label, marginTop: 14 }}>{t('Not required this week', 'Không cần trong tuần này')}</div>
              <input value={reason} onChange={e => setReason(e.target.value)} style={input}
                placeholder={t('Why not? (optional, one line)', 'Vì sao? (không bắt buộc)')} />
              <button disabled={busy} style={{ ...mini, marginTop: 8, borderColor: NREQ, color: NREQ }}
                onClick={() => onSave(i.id, { status: 'not_required', note: reason })}>
                {t('Not required', 'Không cần')}
              </button>
            </>
          )}

          {(done || nreq) && (
            <>
              <div style={label}>{t('Put it back — say why', 'Hoàn tác — cho biết lý do')}</div>
              <input value={revert} onChange={e => setRevert(e.target.value)} style={input}
                placeholder={t('Marked by mistake', 'Đánh dấu nhầm')} />
              <button disabled={busy || !revert.trim()} style={{ ...mini, marginTop: 8 }}
                onClick={() => onSave(i.id, { status: 'not_started', revert_note: revert })}>
                {t('Undo', 'Hoàn tác')}
              </button>
              {i.evidence && <div style={{ ...meta, marginTop: 8 }}>{i.evidence}</div>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

const Bar = ({ value, total, height }: { value: number; total: number; height: number }) => {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ height, background: 'rgba(229,212,194,0.10)', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ height, width: `${pct}%`, background: pct === 100 ? DONE : WIP, transition: 'width .25s' }} />
    </div>
  )
}

const meta: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, color: '#B2AA98', lineHeight: 1.7 }
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 4 }
const card: React.CSSProperties = { padding: '14px 16px', borderRadius: 10, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.10)' }
const chip: React.CSSProperties = { fontFamily: MONO, fontSize: 11, padding: '8px 14px', minWidth: 58, borderRadius: 8, border: '1px solid rgba(229,212,194,0.16)', background: 'transparent', color: '#B2AA98', cursor: 'pointer', flexShrink: 0 }
const chipOn: React.CSSProperties = { background: 'rgba(229,212,194,0.10)', color: '#E5D4C2', borderColor: 'rgba(229,212,194,0.4)' }
const rowBtn: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', minHeight: 44, padding: '12px 0', background: 'none', border: 'none', textAlign: 'left' }
const pill: React.CSSProperties = { fontFamily: MONO, fontSize: 9, borderRadius: 999, padding: '2px 7px' }
const mini: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, padding: '8px 13px', minHeight: 36, borderRadius: 6, border: '1px solid rgba(229,212,194,0.22)', background: 'transparent', color: '#B2AA98', cursor: 'pointer' }
const ghost: React.CSSProperties = { ...mini, textDecoration: 'none', display: 'inline-block' }
const input: React.CSSProperties = { width: '100%', fontFamily: MONO, fontSize: 12.5, padding: '10px 12px', minHeight: 42, borderRadius: 7, background: 'rgba(5,46,32,0.6)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.16)' }
const warn: React.CSSProperties = { ...meta, color: WIP, marginTop: 10, padding: '9px 12px', borderRadius: 6, background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.2)' }
