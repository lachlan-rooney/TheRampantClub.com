// TRC Operations Hub — ONE status vocabulary, shared by the board and the Gantt.
//
// Both views import these colours + this state helper, so a task that's overdue-red
// on the board is the same red on the Gantt. Change a colour here once → both move
// together (drift is structurally impossible).

import { vnDateString } from '@/lib/datetime'

export type OpsVisualState = 'done' | 'overdue' | 'due_soon' | 'upcoming' | 'lapsed'

// These ARE the board's existing status hexes (not new invented colours), plus the
// one genuinely-new state, due_soon amber (between upcoming-gold and overdue-red).
export const OPS_STATUS_COLORS: Record<OpsVisualState, string> = {
  done:     '#7AB07A',   // green — finished, recedes
  overdue:  '#C27070',   // red — the board's overdue red, the alarm
  due_soon: '#E0934A',   // amber — new: within DUE_SOON_DAYS, early warning
  upcoming: '#D4B85A',   // gold — the default
  lapsed:   '#7E7864',   // grey — missed/closed historical fact (recurring carry-over)
}

export const OPS_STATUS_LABELS: Record<OpsVisualState, string> = {
  done: 'Done', overdue: 'Overdue', due_soon: 'Due soon', upcoming: 'Upcoming', lapsed: 'Lapsed',
}

export const DUE_SOON_DAYS = 3

interface StatusTask {
  status?: string | null
  completed_at?: string | null
  due_date?: string | null
}

// Precedence matters: lapsed → done → overdue → due_soon → upcoming.
// lapsed and done both come BEFORE overdue, so a completed-or-missed task whose
// due date is in the past reads as done/grey, NOT as red "act now". The overdue
// branch then mirrors the board's exact rule: due_date < today (VN) and not
// done/lapsed (already handled above).
export function taskVisualState(task: StatusTask, today: string = vnDateString()): OpsVisualState {
  if (task.status === 'lapsed') return 'lapsed'
  if (task.completed_at || task.status === 'done') return 'done'
  const due = task.due_date
  if (!due) return 'upcoming'
  if (due < today) return 'overdue'
  if (due <= addDays(today, DUE_SOON_DAYS)) return 'due_soon'
  return 'upcoming'
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
