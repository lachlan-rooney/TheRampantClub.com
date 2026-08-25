// TRC Operations Hub — activity-feed rendering (Phase 2).
//
// describeEvent renders the human line PURELY from the event's snapshotted
// metadata — it never touches live tables. That's the whole point: the feed is
// a historical record, so a later rename/delete must not change what an old line
// says. (Live lookups are only allowed for an optional "jump to the task if it
// still exists" link — never for the text here.)

import type { ActivityEvent } from './types'

const q = (s: unknown) => (s == null || s === '' ? '—' : `“${s}”`)
const str = (s: unknown, fallback = 'someone') => (typeof s === 'string' && s ? s : fallback)
const fmtDate = (s: unknown) => {
  if (typeof s !== 'string' || !s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
const vnd = (n: unknown) => `${new Intl.NumberFormat('en-US').format(Number(n) || 0)} ₫`

// The predicate — what the actor did. The actor name is rendered separately
// (also from the snapshot: metadata.actor_name).
export function describeEvent(ev: ActivityEvent): string {
  const m = ev.metadata || {}
  const title = m.title as string | undefined
  switch (`${ev.object_type}:${ev.verb}`) {
    case 'project:created':        return `created board ${q(m.name)}`
    case 'project:archived':       return `archived board ${q(m.name)}`
    case 'project:member_added':   return `added ${str(m.member_name)} as ${str(m.role, 'member')}`
    case 'project:member_removed': return `removed ${str(m.member_name)}`
    case 'column:created':         return `added column ${q(m.name)}`
    case 'column:updated':         return m.old_name ? `renamed column ${q(m.old_name)} → ${q(m.name)}` : `renamed a column to ${q(m.name)}`
    case 'column:reordered':       return `reordered ${str(m.column_name, 'a column')}`
    case 'task:created':           return m.from_template
                                            ? `materialised ${q(title)}${m.column_name ? ` in ${m.column_name}` : ''}`
                                            : `created ${q(title)}${m.column_name ? ` in ${m.column_name}` : ''}`
    case 'task:updated':           return `edited ${q(title)}`
    case 'task:moved':             return `moved ${q(title)} from ${str(m.from_column_name, '—')} to ${str(m.to_column_name, '—')}`
    case 'task:assigned':          return m.assignee_name ? `assigned ${q(title)} to ${str(m.assignee_name)}` : `unassigned ${q(title)}`
    case 'task:completed':         return `completed ${q(title)}`
    case 'task:rescheduled':       return m.start_date
                                            ? `rescheduled ${q(title)} → ${fmtDate(m.start_date)}–${fmtDate(m.due_date)}`
                                            : `rescheduled ${q(title)} → due ${fmtDate(m.due_date)}`
    case 'task:deleted':           return `deleted ${q(title)}`
    case 'task:lapsed':            return `${q(title)} lapsed${m.due_date ? ` — was due ${fmtDate(m.due_date)}` : ''}`
    case 'template:created':       return `created recurring template ${q(title)}`
    case 'template:updated':       return `updated recurring template ${q(title)}`
    case 'shift:assigned':         return `assigned ${str(m.member_name)} to the ${fmtDate(m.shift_date)} ${str(m.shift_name, 'shift')} shift`
    case 'shift:updated':          return `updated the ${fmtDate(m.shift_date)} ${str(m.shift_name, 'shift')} shift → ${str(m.member_name)}`
    case 'shift:removed':          return `removed ${str(m.member_name)} from the ${fmtDate(m.shift_date)} ${str(m.shift_name, 'shift')} shift`
    case 'task:linked':            return `linked ${q(m.linked_label)} to a card`
    case 'task:unlinked':          return `unlinked ${q(m.linked_label)} from a card`
    // Membership finance
    case 'membership:payment_recorded': return `recorded ${vnd(m.amount_vnd)} from ${str(m.member_name)} (${str(m.receipt_no, '—')}) — paid through ${fmtDate(m.end_date)}`
    case 'membership:payment_voided':   return `voided ${str(m.receipt_no, 'a receipt')} for ${str(m.member_name)}${m.reason ? ` — ${m.reason}` : ''}`
    case 'membership:activated':        return `activated ${str(m.member_name)}’s membership — through ${fmtDate(m.end_date)}`
    case 'membership:lapsed':           return `membership for ${str(m.member_no, 'a member')} lapsed`
    default:                       return `${ev.verb} ${ev.object_type}`
  }
}

export function actorName(ev: ActivityEvent): string {
  return str((ev.metadata || {}).actor_name, 'Someone')
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
