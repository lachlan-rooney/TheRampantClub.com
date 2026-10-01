// TRC Operations Hub — activity-feed rendering (Phase 2).
//
// describeEvent renders the human line PURELY from the event's snapshotted
// metadata — it never touches live tables. That's the whole point: the feed is
// a historical record, so a later rename/delete must not change what an old line
// says. (Live lookups are only allowed for an optional "jump to the task if it
// still exists" link — never for the text here.)

import type { ActivityEvent } from './types'
import type { Lang } from '@/lib/lang'
import { columnLabel } from './labels'

// ── BOTH LANGUAGES (2026-10-01) ────────────────────────────────────────────
// Owner: "Everything on every page must completely 180 from english to VN when
// toggled." The feed was thirty English sentences, so the Activity page did not
// move at all when somebody switched.
//
// What stays in whatever language it was written in: the QUOTED parts. A card
// called “Fit-out complete and the shop snagged” is somebody's words, recorded
// at the moment it happened, and the feed is a historical record — translating
// the quote would make the record say something nobody wrote.

const q = (s: unknown) => (s == null || s === '' ? '—' : `“${s}”`)
const str = (s: unknown, fallback = 'someone') => (typeof s === 'string' && s ? s : fallback)
const fmtDate = (s: unknown, lang: Lang = 'en') => {
  if (typeof s !== 'string' || !s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(s)
    : d.toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
// A COLUMN NAME INSIDE A SENTENCE is the same system word as the column header
// above the cards — "moved X from Backlog to In progress" was still reading
// half-English on a Vietnamese feed. Translated through the same function, so a
// column somebody renamed stays exactly as they typed it, here too.
const col = (x: unknown, lang: Lang) => (typeof x === 'string' && x ? columnLabel(x, lang) : '')
const vnd = (n: unknown) => `${new Intl.NumberFormat('en-US').format(Number(n) || 0)} ₫`

// The predicate — what the actor did. The actor name is rendered separately
// (also from the snapshot: metadata.actor_name).
export function describeEvent(ev: ActivityEvent, lang: Lang = 'en'): string {
  const m = ev.metadata || {}
  const title = m.title as string | undefined
  const vn = lang === 'vn'
  const pick = (en: string, v: string) => (vn ? v : en)
  const d = (x: unknown) => fmtDate(x, lang)
  switch (`${ev.object_type}:${ev.verb}`) {
    case 'project:created':        return pick(`created board ${q(m.name)}`, `đã tạo bảng ${q(m.name)}`)
    case 'project:archived':       return pick(`archived board ${q(m.name)}`, `đã lưu trữ bảng ${q(m.name)}`)
    case 'project:updated':        return pick(`edited board ${q(m.name)}`, `đã sửa bảng ${q(m.name)}`)
    case 'project:member_added':   return pick(`added ${str(m.member_name)} as ${str(m.role, 'member')}`, `đã thêm ${str(m.member_name)} làm ${str(m.role, 'thành viên')}`)
    case 'project:member_removed': return pick(`removed ${str(m.member_name)}`, `đã gỡ ${str(m.member_name)}`)
    case 'column:created':         return pick(`added column ${q(m.name)}`, `đã thêm cột ${q(m.name)}`)
    case 'column:updated':         return m.old_name
                                            ? pick(`renamed column ${q(m.old_name)} → ${q(m.name)}`, `đã đổi tên cột ${q(m.old_name)} → ${q(m.name)}`)
                                            : pick(`renamed a column to ${q(m.name)}`, `đã đổi tên một cột thành ${q(m.name)}`)
    case 'column:reordered':       return pick(`reordered ${col(m.column_name, lang) || 'a column'}`, `đã sắp xếp lại ${col(m.column_name, lang) || 'một cột'}`)
    case 'task:created':           return m.from_template
                                            ? pick(`materialised ${q(title)}${m.column_name ? ` in ${col(m.column_name, lang)}` : ''}`,
                                                   `đã tạo từ mẫu ${q(title)}${m.column_name ? ` trong ${col(m.column_name, lang)}` : ''}`)
                                            : pick(`created ${q(title)}${m.column_name ? ` in ${col(m.column_name, lang)}` : ''}`,
                                                   `đã tạo ${q(title)}${m.column_name ? ` trong ${col(m.column_name, lang)}` : ''}`)
    case 'task:updated':           return pick(`edited ${q(title)}`, `đã sửa ${q(title)}`)
    case 'task:moved':             return pick(`moved ${q(title)} from ${col(m.from_column_name, lang) || '—'} to ${col(m.to_column_name, lang) || '—'}`,
                                               `đã chuyển ${q(title)} từ ${col(m.from_column_name, lang) || '—'} sang ${col(m.to_column_name, lang) || '—'}`)
    case 'task:assigned':          return m.assignee_name
                                            ? pick(`assigned ${q(title)} to ${str(m.assignee_name)}`, `đã giao ${q(title)} cho ${str(m.assignee_name)}`)
                                            : pick(`unassigned ${q(title)}`, `đã bỏ người phụ trách ${q(title)}`)
    case 'task:completed':         return pick(`completed ${q(title)}`, `đã hoàn thành ${q(title)}`)
    case 'task:rescheduled':       return m.start_date
                                            ? pick(`rescheduled ${q(title)} → ${d(m.start_date)}–${d(m.due_date)}`,
                                                   `đã dời lịch ${q(title)} → ${d(m.start_date)}–${d(m.due_date)}`)
                                            : pick(`rescheduled ${q(title)} → due ${d(m.due_date)}`,
                                                   `đã dời lịch ${q(title)} → hạn ${d(m.due_date)}`)
    case 'task:deleted':           return pick(`deleted ${q(title)}`, `đã xóa ${q(title)}`)
    case 'task:lapsed':            return m.due_date
                                            ? pick(`${q(title)} lapsed — was due ${d(m.due_date)}`, `${q(title)} đã bỏ lỡ — hạn là ${d(m.due_date)}`)
                                            : pick(`${q(title)} lapsed`, `${q(title)} đã bỏ lỡ`)
    case 'template:created':       return pick(`created recurring template ${q(title)}`, `đã tạo mẫu định kỳ ${q(title)}`)
    case 'template:updated':       return pick(`updated recurring template ${q(title)}`, `đã cập nhật mẫu định kỳ ${q(title)}`)
    case 'shift:assigned':         return pick(`assigned ${str(m.member_name)} to the ${d(m.shift_date)} ${str(m.shift_name, 'shift')} shift`,
                                               `đã xếp ${str(m.member_name)} vào ca ${str(m.shift_name, '')} ngày ${d(m.shift_date)}`)
    case 'shift:updated':          return pick(`updated the ${d(m.shift_date)} ${str(m.shift_name, 'shift')} shift → ${str(m.member_name)}`,
                                               `đã cập nhật ca ${str(m.shift_name, '')} ngày ${d(m.shift_date)} → ${str(m.member_name)}`)
    case 'shift:removed':          return pick(`removed ${str(m.member_name)} from the ${d(m.shift_date)} ${str(m.shift_name, 'shift')} shift`,
                                               `đã gỡ ${str(m.member_name)} khỏi ca ${str(m.shift_name, '')} ngày ${d(m.shift_date)}`)
    case 'task:linked':            return pick(`linked ${q(m.linked_label)} to a card`, `đã liên kết ${q(m.linked_label)} với một thẻ`)
    case 'task:unlinked':          return pick(`unlinked ${q(m.linked_label)} from a card`, `đã bỏ liên kết ${q(m.linked_label)} khỏi một thẻ`)
    // Membership finance
    case 'membership:payment_recorded': return pick(`recorded ${vnd(m.amount_vnd)} from ${str(m.member_name)} (${str(m.receipt_no, '—')}) — paid through ${d(m.end_date)}`,
                                                    `đã ghi nhận ${vnd(m.amount_vnd)} từ ${str(m.member_name)} (${str(m.receipt_no, '—')}) — đã đóng đến ${d(m.end_date)}`)
    case 'membership:payment_voided':   return pick(`voided ${str(m.receipt_no, 'a receipt')} for ${str(m.member_name)}${m.reason ? ` — ${m.reason}` : ''}`,
                                                    `đã hủy ${str(m.receipt_no, 'một biên nhận')} của ${str(m.member_name)}${m.reason ? ` — ${m.reason}` : ''}`)
    case 'membership:activated':        return pick(`activated ${str(m.member_name)}\u2019s membership — through ${d(m.end_date)}`,
                                                    `đã kích hoạt tư cách hội viên của ${str(m.member_name)} — đến ${d(m.end_date)}`)
    case 'membership:lapsed':           return pick(`membership for ${str(m.member_no, 'a member')} lapsed`,
                                                    `tư cách hội viên của ${str(m.member_no, 'một hội viên')} đã hết hạn`)
    default:                       return `${ev.verb} ${ev.object_type}`
  }
}

export function actorName(ev: ActivityEvent, lang: Lang = 'en'): string {
  return str((ev.metadata || {}).actor_name, lang === 'vn' ? 'Ai đó' : 'Someone')
}

export function timeAgo(iso: string, lang: Lang = 'en'): string {
  const vn = lang === 'vn'
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return vn ? 'vừa xong' : 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return vn ? `${mins} phút trước` : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return vn ? `${hrs} giờ trước` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return vn ? `${days} ngày trước` : `${days}d ago`
  return new Date(iso).toLocaleDateString(vn ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
