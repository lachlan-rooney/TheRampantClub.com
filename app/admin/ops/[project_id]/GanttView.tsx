'use client'

import { useMemo, useState } from 'react'
import { vnDateString } from '@/lib/datetime'
import type { Task, Project } from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"
const DAY_W = 30          // px per day
const LABEL_W = 180       // sticky task-name column
const ROW_H = 34
const EDGE = 8            // resize grab-zone width (wide enough to be intentional, per the eyeball note)
const PAD = 3             // days of padding around the axis

// ── date math in whole UTC days (no TZ drift) ──
const MS = 86400000
const toDays = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / MS) }
const fromDays = (n: number) => new Date(n * MS).toISOString().slice(0, 10)
const fmtDay = (n: number) => new Date(n * MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

type Kind = 'bar' | 'ms-due' | 'ms-start'
type Placed = { task: Task; kind: Kind; start: number | null; due: number | null }

type DragMode = 'move' | 'resize-start' | 'resize-due' | 'move-ms'
type Drag = { id: string; mode: DragMode; downX: number; baseStart: number | null; baseDue: number | null; curStart: number | null; curDue: number | null; moved: boolean }

export default function GanttView({ tasks, project, canEdit, onOpenCard, onReschedule }: {
  tasks: Task[]
  project: Project | null
  canEdit: boolean
  onOpenCard: (t: Task) => void
  onReschedule: (taskId: string, start: string | null, due: string | null) => void
}) {
  const [drag, setDrag] = useState<Drag | null>(null)

  // Split tasks: anything with a date is on the timeline; the rest is unscheduled.
  const { placed, unscheduled } = useMemo(() => {
    const placed: Placed[] = []
    const unscheduled: Task[] = []
    for (const t of tasks) {
      const hasStart = !!t.start_date, hasDue = !!t.due_date
      if (hasStart && hasDue) placed.push({ task: t, kind: 'bar', start: toDays(t.start_date!), due: toDays(t.due_date!) })
      else if (hasDue) placed.push({ task: t, kind: 'ms-due', start: null, due: toDays(t.due_date!) })
      else if (hasStart) placed.push({ task: t, kind: 'ms-start', start: toDays(t.start_date!), due: null })
      else unscheduled.push(t)
    }
    placed.sort((a, b) => (a.start ?? a.due!) - (b.start ?? b.due!))
    return { placed, unscheduled }
  }, [tasks])

  // Axis: board window if both set, else fit to the tasks, else a default month.
  const todayN = toDays(vnDateString())
  const { axisStart, totalDays } = useMemo(() => {
    let lo: number, hi: number
    if (project?.start_date && project?.target_date) {
      lo = toDays(project.start_date); hi = toDays(project.target_date)
    } else if (placed.length) {
      const ds = placed.flatMap(p => [p.start, p.due].filter((x): x is number => x != null))
      lo = Math.min(...ds); hi = Math.max(...ds)
    } else {
      lo = todayN - 7; hi = todayN + 28
    }
    lo = Math.min(lo, todayN); hi = Math.max(hi, todayN)   // always show "today"
    return { axisStart: lo - PAD, totalDays: (hi - lo) + 1 + PAD * 2 }
  }, [project, placed, todayN])

  const xOf = (dayN: number) => (dayN - axisStart) * DAY_W
  const trackW = totalDays * DAY_W

  // live dates for a row (drag overrides while dragging this task)
  const liveDates = (p: Placed): { start: number | null; due: number | null } =>
    drag && drag.id === p.task.id ? { start: drag.curStart, due: drag.curDue } : { start: p.start, due: p.due }

  const onDown = (e: React.PointerEvent, p: Placed, mode: DragMode) => {
    if (!canEdit) { onOpenCard(p.task); return }
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ id: p.task.id, mode, downX: e.clientX, baseStart: p.start, baseDue: p.due, curStart: p.start, curDue: p.due, moved: false })
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return
    const delta = Math.round((e.clientX - drag.downX) / DAY_W)
    let curStart = drag.baseStart, curDue = drag.baseDue
    if (drag.mode === 'move') { curStart = (drag.baseStart ?? 0) + delta; curDue = (drag.baseDue ?? 0) + delta }
    else if (drag.mode === 'resize-start') { curStart = Math.min((drag.baseStart ?? 0) + delta, drag.baseDue ?? 0); curDue = drag.baseDue }          // clamp: start ≤ due
    else if (drag.mode === 'resize-due') { curDue = Math.max((drag.baseDue ?? 0) + delta, drag.baseStart ?? 0); curStart = drag.baseStart }            // clamp: due ≥ start
    else if (drag.mode === 'move-ms') { if (drag.baseDue != null) curDue = drag.baseDue + delta; else curStart = (drag.baseStart ?? 0) + delta }
    setDrag(d => d ? { ...d, curStart, curDue, moved: d.moved || delta !== 0 } : d)
  }
  const onUp = (e: React.PointerEvent, p: Placed) => {
    if (!drag) return
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    const d = drag
    setDrag(null)
    if (!d.moved) { onOpenCard(p.task); return }   // a click, not a drag
    onReschedule(p.task.id, d.curStart != null ? fromDays(d.curStart) : null, d.curDue != null ? fromDays(d.curDue) : null)
  }

  // header ticks
  const ticks = Array.from({ length: totalDays }, (_, i) => axisStart + i)

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', marginBottom: 12 }}>
        Bars span start→due; diamonds are due-only milestones. {canEdit ? 'Drag a bar to move it, drag an edge to resize, drag a diamond to change its date.' : 'Read-only.'}
      </p>

      <div style={{ overflowX: 'auto', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8 }}>
        <div style={{ width: LABEL_W + trackW, minWidth: '100%' }}>
          {/* header */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(229,212,194,0.12)', height: 30 }}>
            <div style={{ ...stickyLabel, height: 30, display: 'flex', alignItems: 'center', color: '#7E7864', fontSize: 10 }}>Task</div>
            <div style={{ position: 'relative', width: trackW }}>
              {ticks.map((n, i) => {
                const dt = new Date(n * MS)
                const dow = dt.getUTCDay()
                const isToday = n === todayN
                return (
                  <div key={i} style={{ position: 'absolute', left: i * DAY_W, width: DAY_W, height: 30, borderLeft: `1px solid rgba(229,212,194,${dow === 1 ? 0.14 : 0.05})`, textAlign: 'center', boxSizing: 'border-box', background: isToday ? 'rgba(212,184,90,0.10)' : dow === 0 || dow === 6 ? 'rgba(0,0,0,0.12)' : undefined }}>
                    <div style={{ fontFamily: FAMILY, fontSize: 9, color: isToday ? '#D4B85A' : '#7E7864', lineHeight: '14px', marginTop: 2 }}>{dt.getUTCDate()}</div>
                    <div style={{ fontFamily: FAMILY, fontSize: 7, color: '#5E5848', lineHeight: '8px' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'][dow]}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* rows */}
          {placed.length === 0 ? (
            <div style={{ padding: '20px 14px', fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }}>No dated tasks yet — add a start/due date to a card to place it here.</div>
          ) : placed.map(p => {
            const { start, due } = liveDates(p)
            return (
              <div key={p.task.id} style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid rgba(229,212,194,0.05)' }}>
                <div style={{ ...stickyLabel, height: ROW_H, display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => onOpenCard(p.task)} title={p.task.title}>
                  <span style={{ fontFamily: FAMILY, fontSize: 11, color: '#E5D4C2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.task.title}</span>
                </div>
                <div style={{ position: 'relative', width: trackW, height: ROW_H }}>
                  {/* today line */}
                  <div style={{ position: 'absolute', left: xOf(todayN) + DAY_W / 2, top: 0, bottom: 0, width: 1, background: 'rgba(212,184,90,0.35)' }} />

                  {p.kind === 'bar' && start != null && due != null ? (() => {
                    const left = xOf(start)
                    const w = Math.max(DAY_W, (due - start + 1) * DAY_W)
                    const wide = w >= 28
                    return (
                      <div
                        onPointerDown={e => onDown(e, p, 'move')}
                        onPointerMove={onMove}
                        onPointerUp={e => onUp(e, p)}
                        style={{ position: 'absolute', left, top: (ROW_H - 18) / 2, width: w, height: 18, background: drag?.id === p.task.id ? '#E0C56A' : '#D4B85A', borderRadius: 5, cursor: canEdit ? 'grab' : 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', touchAction: 'none', overflow: 'hidden' }}
                        title={`${fmtDay(start)} – ${fmtDay(due)}`}
                      >
                        {wide && canEdit && <div onPointerDown={e => onDown(e, p, 'resize-start')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: EDGE, cursor: 'col-resize', background: 'rgba(5,46,32,0.28)', touchAction: 'none' }} />}
                        <span style={{ display: 'block', padding: '0 12px', fontFamily: FAMILY, fontSize: 10, color: '#052E20', lineHeight: '18px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{p.task.title}</span>
                        {wide && canEdit && <div onPointerDown={e => onDown(e, p, 'resize-due')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: EDGE, cursor: 'col-resize', background: 'rgba(5,46,32,0.28)', touchAction: 'none' }} />}
                      </div>
                    )
                  })() : (() => {
                    const dayN = (p.kind === 'ms-due' ? due : start)!
                    const cx = xOf(dayN) + DAY_W / 2
                    return (
                      <div
                        onPointerDown={e => onDown(e, p, 'move-ms')}
                        onPointerMove={onMove}
                        onPointerUp={e => onUp(e, p)}
                        style={{ position: 'absolute', left: cx - 9, top: (ROW_H - 16) / 2, width: 16, height: 16, background: drag?.id === p.task.id ? '#9Fd29F' : '#7AB07A', transform: 'rotate(45deg)', borderRadius: 3, cursor: canEdit ? 'grab' : 'pointer', touchAction: 'none' }}
                        title={`${p.task.title} — ${fmtDay(dayN)}${p.kind === 'ms-start' ? ' (start)' : ''}`}
                      />
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* unscheduled tray — visible, but honestly not placed (no date to place them on) */}
      {unscheduled.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: FAMILY, fontSize: 10, color: '#7E7864', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Unscheduled · {unscheduled.length}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unscheduled.map(t => (
              <button key={t.id} onClick={() => onOpenCard(t)} style={{ background: 'rgba(229,212,194,0.06)', border: '1px dashed rgba(229,212,194,0.18)', borderRadius: 6, color: '#E5D4C2', fontFamily: FAMILY, fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>
                {t.title}
              </button>
            ))}
          </div>
          <p style={{ fontFamily: FAMILY, fontSize: 10, color: '#7E7864', marginTop: 6, opacity: 0.7 }}>No start or due date — open a card to give it dates and place it on the timeline.</p>
        </div>
      )}
    </div>
  )
}

const stickyLabel: React.CSSProperties = {
  position: 'sticky', left: 0, zIndex: 2, width: LABEL_W, flex: `0 0 ${LABEL_W}px`,
  background: '#052E20', borderRight: '1px solid rgba(229,212,194,0.12)', padding: '0 12px', boxSizing: 'border-box',
}
