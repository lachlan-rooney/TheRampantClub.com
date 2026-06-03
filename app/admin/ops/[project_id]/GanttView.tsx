'use client'

import { useMemo, useRef } from 'react'
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
// Live drag is held in a REF and applied imperatively to ONE element — no React
// state, so pointermove never re-renders the Gantt (that was the lag). The bar
// follows the pointer in raw pixels via transform/width (smooth); we snap to the
// day grid only on drop (that fixes the jump). One reschedule write on drop.
type DragState = {
  taskId: string; mode: DragMode; kind: Kind; el: HTMLElement
  downX: number; baseLeft: number; baseWidth: number; baseTransform: string
  baseStart: number | null; baseDue: number | null; moved: boolean
}

export default function GanttView({ tasks, project, canEdit, onOpenCard, onReschedule }: {
  tasks: Task[]
  project: Project | null
  canEdit: boolean
  onOpenCard: (t: Task) => void
  onReschedule: (taskId: string, start: string | null, due: string | null) => void
}) {
  const dragRef = useRef<DragState | null>(null)

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

  const todayN = toDays(vnDateString())
  const { axisStart, totalDays } = useMemo(() => {
    let lo: number, hi: number
    if (project?.start_date && project?.target_date) { lo = toDays(project.start_date); hi = toDays(project.target_date) }
    else if (placed.length) {
      const ds = placed.flatMap(p => [p.start, p.due].filter((x): x is number => x != null))
      lo = Math.min(...ds); hi = Math.max(...ds)
    } else { lo = todayN - 7; hi = todayN + 28 }
    lo = Math.min(lo, todayN); hi = Math.max(hi, todayN)
    return { axisStart: lo - PAD, totalDays: (hi - lo) + 1 + PAD * 2 }
  }, [project, placed, todayN])

  const xOf = (dayN: number) => (dayN - axisStart) * DAY_W
  const trackW = totalDays * DAY_W

  // ── imperative drag (no re-render until drop) ──
  const onDown = (e: React.PointerEvent, p: Placed, mode: DragMode) => {
    if (!canEdit) { onOpenCard(p.task); return }
    e.stopPropagation()
    const el = (mode === 'move' || mode === 'move-ms') ? e.currentTarget as HTMLElement : (e.currentTarget as HTMLElement).parentElement as HTMLElement
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      taskId: p.task.id, mode, kind: p.kind, el,
      downX: e.clientX,
      baseLeft: el.offsetLeft, baseWidth: el.offsetWidth,
      baseTransform: mode === 'move-ms' ? 'rotate(45deg)' : '',   // diamonds keep their rotation
      baseStart: p.start, baseDue: p.due, moved: false,
    }
    el.style.willChange = 'transform, width'
    el.style.zIndex = '5'
  }
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dpx = e.clientX - d.downX
    if (Math.abs(dpx) > 3) d.moved = true
    // raw-pixel follow — smooth; snapping waits for drop
    if (d.mode === 'move' || d.mode === 'move-ms') {
      d.el.style.transform = `translateX(${dpx}px) ${d.baseTransform}`.trim()
    } else if (d.mode === 'resize-start') {
      const leftDelta = Math.min(dpx, d.baseWidth - DAY_W)   // can't cross due (min 1 day)
      d.el.style.left = `${d.baseLeft + leftDelta}px`
      d.el.style.width = `${d.baseWidth - leftDelta}px`
    } else if (d.mode === 'resize-due') {
      d.el.style.width = `${Math.max(d.baseWidth + dpx, DAY_W)}px`
    }
  }
  const onUp = (e: React.PointerEvent, p: Placed) => {
    const d = dragRef.current
    if (!d) return
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    dragRef.current = null
    d.el.style.willChange = ''
    d.el.style.zIndex = ''

    if (!d.moved) {                          // a click, not a drag — reset any nudge, open the card
      d.el.style.transform = d.baseTransform; d.el.style.left = `${d.baseLeft}px`; d.el.style.width = `${d.baseWidth}px`
      onOpenCard(p.task); return
    }

    const snap = Math.round((e.clientX - d.downX) / DAY_W)   // snap to whole days ON DROP
    let nStart = d.baseStart, nDue = d.baseDue
    if (d.mode === 'move') { nStart = (d.baseStart ?? 0) + snap; nDue = (d.baseDue ?? 0) + snap }
    else if (d.mode === 'resize-start') { nStart = Math.min((d.baseStart ?? 0) + snap, d.baseDue ?? 0) }
    else if (d.mode === 'resize-due') { nDue = Math.max((d.baseDue ?? 0) + snap, d.baseStart ?? 0) }
    else if (d.mode === 'move-ms') { if (d.baseDue != null) nDue = d.baseDue + snap; else nStart = (d.baseStart ?? 0) + snap }

    // Land the element on the snapped grid position NOW (no flash), restore base
    // transform; React's re-render from the new dates sets the same left/width.
    d.el.style.transform = d.baseTransform
    if (d.kind === 'bar' && nStart != null && nDue != null) {
      d.el.style.left = `${xOf(nStart)}px`; d.el.style.width = `${Math.max(DAY_W, (nDue - nStart + 1) * DAY_W)}px`
    } else {
      const dayN = (nDue ?? nStart)!; d.el.style.left = `${xOf(dayN) + DAY_W / 2 - 9}px`
    }
    onReschedule(p.task.id, nStart != null ? fromDays(nStart) : null, nDue != null ? fromDays(nDue) : null)
  }

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
                const dt = new Date(n * MS); const dow = dt.getUTCDay(); const isToday = n === todayN
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
          ) : placed.map(p => (
            <div key={p.task.id} style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid rgba(229,212,194,0.05)' }}>
              <div style={{ ...stickyLabel, height: ROW_H, display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => onOpenCard(p.task)} title={p.task.title}>
                <span style={{ fontFamily: FAMILY, fontSize: 11, color: '#E5D4C2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.task.title}</span>
              </div>
              <div style={{ position: 'relative', width: trackW, height: ROW_H }}>
                <div style={{ position: 'absolute', left: xOf(todayN) + DAY_W / 2, top: 0, bottom: 0, width: 1, background: 'rgba(212,184,90,0.35)' }} />

                {p.kind === 'bar' && p.start != null && p.due != null ? (() => {
                  const left = xOf(p.start); const w = Math.max(DAY_W, (p.due - p.start + 1) * DAY_W); const wide = w >= 28
                  return (
                    <div
                      onPointerDown={e => onDown(e, p, 'move')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)}
                      style={{ position: 'absolute', left, top: (ROW_H - 18) / 2, width: w, height: 18, background: '#D4B85A', borderRadius: 5, cursor: canEdit ? 'grab' : 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', touchAction: 'none', overflow: 'hidden' }}
                      title={`${fmtDay(p.start)} – ${fmtDay(p.due)}`}
                    >
                      {wide && canEdit && <div onPointerDown={e => onDown(e, p, 'resize-start')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: EDGE, cursor: 'col-resize', background: 'rgba(5,46,32,0.28)', touchAction: 'none' }} />}
                      <span style={{ display: 'block', padding: '0 12px', fontFamily: FAMILY, fontSize: 10, color: '#052E20', lineHeight: '18px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{p.task.title}</span>
                      {wide && canEdit && <div onPointerDown={e => onDown(e, p, 'resize-due')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: EDGE, cursor: 'col-resize', background: 'rgba(5,46,32,0.28)', touchAction: 'none' }} />}
                    </div>
                  )
                })() : (() => {
                  const dayN = (p.kind === 'ms-due' ? p.due : p.start)!; const cx = xOf(dayN) + DAY_W / 2
                  return (
                    <div
                      onPointerDown={e => onDown(e, p, 'move-ms')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)}
                      style={{ position: 'absolute', left: cx - 9, top: (ROW_H - 16) / 2, width: 16, height: 16, background: '#7AB07A', transform: 'rotate(45deg)', borderRadius: 3, cursor: canEdit ? 'grab' : 'pointer', touchAction: 'none' }}
                      title={`${p.task.title} — ${fmtDay(dayN)}${p.kind === 'ms-start' ? ' (start)' : ''}`}
                    />
                  )
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>

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
