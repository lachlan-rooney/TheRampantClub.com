import type { Lang } from '@/lib/lang'
import type { OpsVisualState } from './status'

// TRC Operations Hub — THE WORDS THE HUB SAYS ABOUT ITSELF, in both languages.
//
// Owner, 2026-10-01: "check the boards, the board names, tasks and headers do
// not toggle. Sort it out… Everything on every page must completely 180 from
// english to VN when toggled."
//
// Two of those three were plain bugs: whole components had been written with no
// `t()` at all (the Gantt and the Activity feed), and a handful of buttons —
// "+ Card", "Gantt", "Today" — were typed straight into the markup. Those are
// fixed where they stand.
//
// This file is for the third kind, the one that is not a missing `t()`: words
// that live in the DATABASE but are not anybody's writing.
//
// ── A COLUMN NAME IS A SYSTEM WORD WEARING A DATA COSTUME ─────────────────
// Backlog / In progress / Blocked / Done are rows in board_columns, inserted by
// ops_create_project on every board that has ever been made. Nobody chose them
// and they are identical everywhere, so they are interface, and interface
// translates. They are matched case-insensitively and trimmed, and ANYTHING NOT
// IN THE LIST IS SHOWN EXACTLY AS TYPED — a column somebody renamed to "Waiting
// on Vinamilk" is that person's words, and inventing Vietnamese for it would be
// worse than leaving it alone.
//
// ── WHAT THIS FILE DELIBERATELY DOES NOT DO ──────────────────────────────
// It does not touch BOARD NAMES or TASK TITLES. "MILK LOVES MALT · Vinamilk ×
// Duncan Taylor · 13 Nov" and "Fit-out complete and the shop snagged" are
// content: written by a person, stored once, with no Vietnamese ever written
// for them. A machine guess in the middle of an operations board is worse than
// English — somebody acts on it. Giving those a second language means a
// name_vn column and a person filling it in, which is a decision, not a bug.

export const OPS_STATUS_LABELS_VN: Record<OpsVisualState, string> = {
  done: 'Đã xong', overdue: 'Quá hạn', due_soon: 'Sắp đến hạn', upcoming: 'Sắp tới', lapsed: 'Bỏ lỡ',
}

const OPS_STATUS_LABELS_EN: Record<OpsVisualState, string> = {
  done: 'Done', overdue: 'Overdue', due_soon: 'Due soon', upcoming: 'Upcoming', lapsed: 'Lapsed',
}

export function statusLabel(state: OpsVisualState, lang: Lang): string {
  return (lang === 'vn' ? OPS_STATUS_LABELS_VN : OPS_STATUS_LABELS_EN)[state]
}

// The four columns ops_create_project makes. Keyed lower-case; the lookup
// trims and lower-cases before asking.
const COLUMN_VN: Record<string, string> = {
  'backlog': 'Chờ làm',
  'in progress': 'Đang làm',
  'blocked': 'Đang vướng',
  'done': 'Đã xong',
  // Two spellings seen on older boards, same four meanings.
  'to do': 'Cần làm',
  'in review': 'Đang duyệt',
}

/** A board column's name, translated if it is one of the system four, and
 *  returned untouched if somebody renamed it to their own words. */
export function columnLabel(name: string, lang: Lang): string {
  if (lang !== 'vn') return name
  return COLUMN_VN[name.trim().toLowerCase()] ?? name
}

// The priority words, which are a fixed vocabulary in the same way.
const PRIORITY_VN: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
}
export function priorityLabel(p: string, lang: Lang): string {
  if (lang !== 'vn') return p
  return PRIORITY_VN[p.trim().toLowerCase()] ?? p
}
