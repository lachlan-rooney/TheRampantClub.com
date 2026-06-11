// TRC Operations Hub — notification rendering (Phase 6).
// Renders from the notification's snapshotted metadata (same principle as the feed).

export interface OpsNotification {
  id: string
  recipient: string
  type: string
  event_id: string | null
  metadata: Record<string, unknown>
  read: boolean
  read_at: string | null
  email_status: string
  created_at: string
}

const q = (s: unknown) => (typeof s === 'string' && s ? `“${s}”` : 'a card')
const fmtDate = (s: unknown) => {
  if (typeof s !== 'string' || !s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function describeNotification(n: OpsNotification): string {
  const m = n.metadata || {}
  switch (n.type) {
    case 'task_assigned':  return `You were assigned ${q(m.title)}`
    case 'task_completed': return `${q(m.title)} was completed`
    case 'task_due_soon':  return `${q(m.title)} is due tomorrow`
    case 'shift_assigned': return `You're on the ${fmtDate(m.shift_date)} ${m.shift_name || ''} shift`.trim()
    case 'shift_updated':  return `Your ${fmtDate(m.shift_date)} ${m.shift_name || ''} shift changed`.trim()
    case 'shift_removed':  return `Your ${fmtDate(m.shift_date)} ${m.shift_name || ''} shift was removed`.trim()
    // Social (S1 concierge + S2 reserve). Generic labels — never the message body.
    case 'concierge_message':     return 'A member wrote in to The Club'
    case 'concierge_reply':       return 'The Club replied'
    case 'introduction_request':  return 'A member would like an introduction'
    case 'introduction_accepted': return 'An introduction was accepted'
    default:               return n.type.replace(/_/g, ' ')
  }
}

export function notificationLink(n: OpsNotification): string {
  const link = (n.metadata || {}).link
  return typeof link === 'string' ? link : '/admin/ops'
}

export function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return 'just now'
  const m = Math.floor(secs / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
