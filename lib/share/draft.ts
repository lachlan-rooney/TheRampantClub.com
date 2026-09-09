// ═══════════════════════════════════════════════════════════════════════════
// THE SHARE DRAFT — a Zalo/WhatsApp message built from an entry's own fields.
// ───────────────────────────────────────────────────────────────────────────
// A DRAFTING AID. Nothing here sends, posts, schedules or touches a messaging
// API. It produces text; a person reads it and presses send in their own app.
//
// PRIVACY BY CONSTRUCTION, not by remembering. ShareInput is the ONLY way text
// gets in, and it has no field for a member name, an attendee, a signup count or
// an internal note. The dangerous fields cannot be passed, so they cannot leak:
//   · calendar_entries.attendee   — prompted with "e.g. Mr Nguyen (member)"
//   · calendar_entries.description — the internal operational note
//   · fixtures.description         — member-visible, but see NOTE below
//   · any signup count or roster
//
// NOTE on descriptions: a fixture's description IS member-visible (it renders on
// What's On), so one line of it is allowed — passed as `blurb`, deliberately a
// different field name from `description` so nobody wires the calendar's
// staff-only note into it by autocomplete.
//
// PLAIN TEXT ONLY. WhatsApp understands *bold*; Zalo does not, and asterisks
// arrive as asterisks. Structure comes from line breaks and one emoji.
import { isSport } from '@/lib/fixtures'

/** One emoji, at the head. Mapped from `type` so staff learn to recognise them,
 *  never generated per event. */
// TODO (Miss Châu, or whoever runs the padel side): padel is 🏓 as a placeholder
// — the sport is played with a solid paddle, so it reads as "paddle" rather than
// as table tennis. It shared 🎾 with tennis, which defeats the point of the map:
// two sports on one glyph is not recognition. The right answer is whatever reads
// as padel to a VIETNAMESE member, and they are the audience, not me. One line.
export const TYPE_EMOJI: Record<string, string> = {
  golf: '⛳', tennis: '🎾', padel: '🏓', hash: '🏃',
  dinner: '🍽️', tasting: '🥃', social: '🥂', other: '✨',
  // calendar_entries.kind — only the member-visible kinds can ever reach here
  supplier: '🥃', event: '✨', meeting: '✨', reminder: '✨',
}
export const emojiFor = (type: string | null | undefined): string =>
  TYPE_EMOJI[(type || 'other').toLowerCase()] || TYPE_EMOJI.other

export interface ShareInput {
  type: string | null            // fixtures.type or calendar_entries.kind
  title: string
  title_vn?: string | null
  /** Member-visible blurb ONLY. Never a staff-only description. */
  blurb?: string | null
  blurb_vn?: string | null
  /** ISO instant (fixtures) or a date + optional time (calendar entries). */
  date: string
  time?: string | null
  /** A room, or an external venue. */
  where?: string | null
  capped?: boolean
  url?: string | null
}

export interface Draft { en: string; vn: string; vnComplete: boolean; missing: string[] }

const VN_TZ = 'Asia/Ho_Chi_Minh'
const fmtDate = (iso: string, lang: 'en' | 'vn') =>
  new Date(iso).toLocaleDateString(lang === 'vn' ? 'vi-VN' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', timeZone: VN_TZ })
const fmtTime = (iso: string, lang: 'en' | 'vn') =>
  new Date(iso).toLocaleTimeString(lang === 'vn' ? 'vi-VN' : 'en-GB',
    { hour: 'numeric', minute: '2-digit', hour12: lang === 'en', timeZone: VN_TZ })

/** One line of a blurb — the first sentence or paragraph, never the whole thing.
 *  A long message is truncated in a chat preview and the important line falls
 *  below the fold. */
const oneLine = (s: string | null | undefined): string | null => {
  if (!s) return null
  const first = s.split(/\n\s*\n|\n/)[0].trim()
  if (!first) return null
  return first.length > 160 ? first.slice(0, 157).trimEnd() + '…' : first
}

export function buildDraft(e: ShareInput): Draft {
  const emoji = emojiFor(e.type)
  const missing: string[] = []
  if (!e.title_vn) missing.push('title_vn')

  const line = (lang: 'en' | 'vn') => {
    const when = e.time
      ? `${fmtDate(e.date, lang)} · ${e.time.slice(0, 5)}`
      : `${fmtDate(e.date, lang)} · ${fmtTime(e.date, lang)}`
    const title = lang === 'vn' ? (e.title_vn || e.title) : e.title
    const blurb = oneLine(lang === 'vn' ? (e.blurb_vn || e.blurb) : e.blurb)

    const out = [`${emoji} ${title}`, when]
    if (e.where) out.push(e.where)
    if (blurb) out.push('', blurb)
    if (e.capped) {
      // DELIBERATELY NO NUMBER. "6 seats" is true when written and wrong an hour
      // later, and the message lives in that group chat forever.
      out.push('', lang === 'vn'
        ? 'Số lượng có hạn — vui lòng đăng ký trên cổng hội viên.'
        : 'Places are limited — sign up on the member portal.')
    }
    if (e.url) out.push('', e.url)
    return out.join('\n')
  }

  return { en: line('en'), vn: line('vn'), vnComplete: missing.length === 0, missing }
}

/** Whether an entry may be shared at all. A staff-only entry gets NO box — every
 *  private booking in the data is titled with a member's name, so a share box on
 *  one is a one-tap route to putting that name in a group chat. */
export const isShareable = (visibility: string | null | undefined): boolean =>
  visibility === 'member'

export { isSport }
