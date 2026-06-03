'use client'

import { useMemo, useRef, useState } from 'react'
import { vnDateString } from '@/lib/datetime'
import type { Task, Project } from '@/lib/ops/types'

const FAMILY = "'Google Sans Code', monospace"
const LABEL_W = 190       // sticky task-name column (also the MOVE handle)
const ROW_H = 34
const EDGE = 8            // resize grab-zone width
const PAST_PAD = 21       // days of headroom before the earliest known date
const FUTURE_PAD = 150    // days of empty future to scroll/drag into (the timeline isn't capped at the last item)

// Scale-aware: one px-per-day per zoom. All geometry is expressed in dayWidth,
// and the drag math is Δdays = round(Δpx / dayWidth) — so the same code is crisp
// at every zoom.
const ZOOMS = ['day', 'week', 'month'] as const
type Zoom = typeof ZOOMS[number]
const DAY_W: Record<Zoom, number> = { day: 28, week: 8, month: 3 }
const RESIZE_UNIT: Record<Zoom, number> = { day: 1, week: 7, month: 30 }   // resize snaps to the visible granularity

// ── date math in whole UTC days (no TZ drift) ──
const MS = 86400000
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const toDays = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / MS) }
const fromDays = (n: number) => new Date(n * MS).toISOString().slice(0, 10)
const fmtDay = (n: number) => new Date(n * MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

type Kind = 'bar' | 'ms-due' | 'ms-start'
type Placed = { task: Task; kind: Kind; start: number | null; due: number | null }
type DragMode = 'move' | 'resize-start' | 'resize-due' | 'move-ms'
type DragState = {
  taskId: string; mode: DragMode; kind: Kind; el: HTMLElement
  downX: number; baseLeft: number; baseWidth: number; baseTransform: string
  baseStart: number | null; baseDue: number | null; moved: boolean; unit: number
}

export default function GanttView({ tasks, project, canEdit, onOpenCard, onReschedule }: {
  tasks: Task[]
  project: Project | null
  canEdit: boolean
  onOpenCard: (t: Task) => void
  onReschedule: (taskId: string, start: string | null, due: string | null) => void
}) {
  const [zoom, setZoom] = useState<Zoom>('day')
  const dayWidth = DAY_W[zoom]
  const dragRef = useRef<DragState | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollByCols = (dir: -1 | 1) => scrollRef.current?.scrollBy({ left: dir * Math.round(scrollRef.current.clientWidth * 0.7), behavior: 'smooth' })

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
    // Gather every known date (board window + task starts/dues + today), then pad
    // GENEROUSLY — especially into the future — so the timeline always has empty
    // room to drag a task forward into, not just up to the last existing item.
    const cand: number[] = [todayN]
    if (project?.start_date) cand.push(toDays(project.start_date))
    if (project?.target_date) cand.push(toDays(project.target_date))
    for (const p of placed) { if (p.start != null) cand.push(p.start); if (p.due != null) cand.push(p.due) }
    const lo = Math.min(...cand) - PAST_PAD
    const hi = Math.max(...cand) + FUTURE_PAD
    return { axisStart: lo, totalDays: (hi - lo) + 1 }
  }, [project, placed, todayN])

  const xOf = (dayN: number) => (dayN - axisStart) * dayWidth
  const trackW = totalDays * dayWidth

  // adaptive header columns (day | week | month) — rebuilt only on zoom/axis change
  const segments = useMemo(() => {
    const segs: { left: number; width: number; main: string; sub: string; today: boolean }[] = []
    if (zoom === 'day') {
      for (let i = 0; i < totalDays; i++) {
        const n = axisStart + i; const dt = new Date(n * MS)
        segs.push({ left: i * dayWidth, width: dayWidth, main: String(dt.getUTCDate()), sub: WD[dt.getUTCDay()], today: n === todayN })
      }
    } else if (zoom === 'week') {
      let i = 0
      while (i < totalDays) {
        const n = axisStart + i; const dt = new Date(n * MS); const dow = (dt.getUTCDay() + 6) % 7  // 0 = Monday
        const span = Math.min(7 - dow, totalDays - i)
        segs.push({ left: i * dayWidth, width: span * dayWidth, main: `${dt.getUTCDate()} ${MON[dt.getUTCMonth()]}`, sub: 'wk', today: todayN >= n && todayN < n + span })
        i += span
      }
    } else {
      let i = 0
      while (i < totalDays) {
        const n = axisStart + i; const dt = new Date(n * MS); const y = dt.getUTCFullYear(); const m = dt.getUTCMonth()
        const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
        const span = Math.min(daysInMonth - dt.getUTCDate() + 1, totalDays - i)
        segs.push({ left: i * dayWidth, width: span * dayWidth, main: MON[m], sub: String(y), today: todayN >= n && todayN < n + span })
        i += span
      }
    }
    return segs
  }, [zoom, axisStart, totalDays, dayWidth, todayN])

  // ── imperative drag (no re-render until drop) ──
  const beginDrag = (e: React.PointerEvent, p: Placed, mode: DragMode, el: HTMLElement) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      taskId: p.task.id, mode, kind: p.kind, el, downX: e.clientX,
      baseLeft: el.offsetLeft, baseWidth: el.offsetWidth,
      baseTransform: p.kind === 'bar' ? '' : 'rotate(45deg)',
      baseStart: p.start, baseDue: p.due, moved: false, unit: RESIZE_UNIT[zoom],
    }
    el.style.willChange = 'transform, width, left'
    el.style.zIndex = '5'
  }
  // Reschedule is done ONLY on the bar / diamond / edges — the name is just a
  // label (click to open). It never slides the dates horizontally.
  const onDownEl = (e: React.PointerEvent, p: Placed, mode: DragMode) => {
    if (!canEdit) { onOpenCard(p.task); return }
    e.stopPropagation()
    const el = (mode === 'resize-start' || mode === 'resize-due') ? (e.currentTarget as HTMLElement).parentElement as HTMLElement : e.currentTarget as HTMLElement
    beginDrag(e, p, mode, el)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return
    const dpx = e.clientX - d.downX
    if (Math.abs(dpx) > 3) d.moved = true
    if (d.mode === 'move' || d.mode === 'move-ms') {
      d.el.style.transform = `translateX(${dpx}px) ${d.baseTransform}`.trim()
    } else if (d.mode === 'resize-start') {
      const leftDelta = Math.min(dpx, d.baseWidth - dayWidth)   // can't cross due (min 1 cell)
      d.el.style.left = `${d.baseLeft + leftDelta}px`
      d.el.style.width = `${d.baseWidth - leftDelta}px`
    } else if (d.mode === 'resize-due') {
      d.el.style.width = `${Math.max(d.baseWidth + dpx, dayWidth)}px`
    }
  }
  const onUp = (e: React.PointerEvent, p: Placed) => {
    const d = dragRef.current; if (!d) return
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    dragRef.current = null
    d.el.style.willChange = ''; d.el.style.zIndex = ''

    if (!d.moved) {
      d.el.style.transform = d.baseTransform; d.el.style.left = `${d.baseLeft}px`; d.el.style.width = `${d.baseWidth}px`
      onOpenCard(p.task); return
    }

    const rawDays = (e.clientX - d.downX) / dayWidth
    const moveSnap = Math.round(rawDays)                          // move = day granularity at any zoom
    const resizeSnap = Math.round(rawDays / d.unit) * d.unit      // resize = visible granularity (day/week/month)
    let nStart = d.baseStart, nDue = d.baseDue
    if (d.mode === 'move') { nStart = (d.baseStart ?? 0) + moveSnap; nDue = (d.baseDue ?? 0) + moveSnap }
    else if (d.mode === 'move-ms') { if (d.baseDue != null) nDue = d.baseDue + moveSnap; else nStart = (d.baseStart ?? 0) + moveSnap }
    else if (d.mode === 'resize-start') { nStart = Math.min((d.baseStart ?? 0) + resizeSnap, d.baseDue ?? 0) }
    else if (d.mode === 'resize-due') { nDue = Math.max((d.baseDue ?? 0) + resizeSnap, d.baseStart ?? 0) }

    // land on the snapped position now (no flash); React re-render matches it
    d.el.style.transform = d.baseTransform
    if (d.kind === 'bar' && nStart != null && nDue != null) {
      d.el.style.left = `${xOf(nStart)}px`; d.el.style.width = `${Math.max(dayWidth, (nDue - nStart + 1) * dayWidth)}px`
    } else {
      const dayN = (nDue ?? nStart)!; d.el.style.left = `${xOf(dayN) + dayWidth / 2 - 9}px`
    }
    onReschedule(p.task.id, nStart != null ? fromDays(nStart) : null, nDue != null ? fromDays(nDue) : null)
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <p style={{ fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', margin: 0, flex: 1, minWidth: 240 }}>
          {canEdit ? 'Drag a task name to reschedule (slides both dates); drag a bar edge to resize; drag a diamond to move its date.' : 'Read-only.'}
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => scrollByCols(-1)} style={navBtn} title="Scroll back">‹</button>
          <button onClick={() => scrollRef.current?.scrollTo({ left: LABEL_W + xOf(todayN) - scrollRef.current.clientWidth / 2, behavior: 'smooth' })} style={navBtn} title="Jump to today">Today</button>
          <button onClick={() => scrollByCols(1)} style={navBtn} title="Scroll forward">›</button>
        </div>
        <div style={{ display: 'flex', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 6, overflow: 'hidden' }}>
          {ZOOMS.map(z => (
            <button key={z} onClick={() => setZoom(z)} style={{ ...zoomBtn, background: zoom === z ? 'rgba(212,184,90,0.18)' : 'transparent', color: zoom === z ? '#D4B85A' : '#B2AA98' }}>
              {z[0].toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} style={{ overflowX: 'auto', border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8 }}>
        <div style={{ width: LABEL_W + trackW, minWidth: '100%' }}>
          {/* header */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(229,212,194,0.12)', height: 30 }}>
            <div style={{ ...stickyLabel, height: 30, display: 'flex', alignItems: 'center', color: '#7E7864', fontSize: 10 }}>Task</div>
            <div style={{ position: 'relative', width: trackW }}>
              {segments.map((s, i) => (
                <div key={i} style={{ position: 'absolute', left: s.left, width: s.width, height: 30, borderLeft: '1px solid rgba(229,212,194,0.08)', textAlign: 'center', boxSizing: 'border-box', background: s.today ? 'rgba(212,184,90,0.10)' : undefined, overflow: 'hidden' }}>
                  <div style={{ fontFamily: FAMILY, fontSize: 9, color: s.today ? '#D4B85A' : '#7E7864', lineHeight: '14px', marginTop: 2, whiteSpace: 'nowrap' }}>{s.main}</div>
                  <div style={{ fontFamily: FAMILY, fontSize: 7, color: '#5E5848', lineHeight: '8px' }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* rows */}
          {placed.length === 0 ? (
            <div style={{ padding: '20px 14px', fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }}>No dated tasks yet — add a start/due date to a card to place it here.</div>
          ) : placed.map(p => (
            <div key={p.task.id} style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid rgba(229,212,194,0.05)' }}>
              {/* NAME = plain label · click to open (NOT a drag handle) */}
              <div
                onClick={() => onOpenCard(p.task)}
                style={{ ...stickyLabel, height: ROW_H, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                title={p.task.title}
              >
                <span style={{ fontFamily: FAMILY, fontSize: 11, color: '#E5D4C2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.task.title}</span>
              </div>
              <div style={{ position: 'relative', width: trackW, height: ROW_H }}>
                <div style={{ position: 'absolute', left: xOf(todayN) + dayWidth / 2, top: 0, bottom: 0, width: 1, background: 'rgba(212,184,90,0.35)' }} />

                {p.kind === 'bar' && p.start != null && p.due != null ? (() => {
                  const left = xOf(p.start); const w = Math.max(dayWidth, (p.due - p.start + 1) * dayWidth); const wide = w >= 2 * EDGE + 12
                  return (
                    <div onPointerDown={e => onDownEl(e, p, 'move')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)} style={{ position: 'absolute', left, top: (ROW_H - 18) / 2, width: w, height: 18, background: '#D4B85A', borderRadius: 5, boxShadow: '0 1px 3px rgba(0,0,0,0.3)', overflow: 'hidden', cursor: canEdit ? 'grab' : 'pointer', touchAction: 'none' }} title={`${fmtDay(p.start)} – ${fmtDay(p.due)}`}>
                      {wide && canEdit && <div onPointerDown={e => onDownEl(e, p, 'resize-start')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: EDGE, cursor: 'col-resize', background: 'rgba(5,46,32,0.30)', touchAction: 'none' }} title="Drag to change start" />}
                      <span style={{ display: 'block', padding: '0 12px', fontFamily: FAMILY, fontSize: 10, color: '#052E20', lineHeight: '18px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{zoom === 'day' ? p.task.title : ''}</span>
                      {wide && canEdit && <div onPointerDown={e => onDownEl(e, p, 'resize-due')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: EDGE, cursor: 'col-resize', background: 'rgba(5,46,32,0.30)', touchAction: 'none' }} title="Drag to change due" />}
                    </div>
                  )
                })() : (() => {
                  const dayN = (p.kind === 'ms-due' ? p.due : p.start)!; const cx = xOf(dayN) + dayWidth / 2
                  return (
                    <div onPointerDown={e => onDownEl(e, p, 'move-ms')} onPointerMove={onMove} onPointerUp={e => onUp(e, p)} style={{ position: 'absolute', left: cx - 9, top: (ROW_H - 16) / 2, width: 16, height: 16, background: '#7AB07A', transform: 'rotate(45deg)', borderRadius: 3, cursor: canEdit ? 'grab' : 'pointer', touchAction: 'none' }} title={`${p.task.title} — ${fmtDay(dayN)}${p.kind === 'ms-start' ? ' (start)' : ''}`} />
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
              <button key={t.id} onClick={() => onOpenCard(t)} style={{ background: 'rgba(229,212,194,0.06)', border: '1px dashed rgba(229,212,194,0.18)', borderRadius: 6, color: '#E5D4C2', fontFamily: FAMILY, fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>{t.title}</button>
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
const zoomBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: '5px 12px', fontFamily: FAMILY, fontSize: 10, letterSpacing: '0.04em', cursor: 'pointer' }
const navBtn: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 6, color: '#B2AA98', fontFamily: FAMILY, fontSize: 11, padding: '5px 11px', cursor: 'pointer' }
