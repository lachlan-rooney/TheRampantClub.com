import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/admin'

// ═══════════════════════════════════════════════════════════════════════════
// THE GUEST LIST, AS A FILE
// ───────────────────────────────────────────────────────────────────────────
// GET /api/admin/popup/export?kind=all
// GET /api/admin/popup/export?kind=consented
//
// Admin-gated, and every download is written to popup_exports first. See the
// header of db/popup_exports.sql for why: once this file is on a laptop it is
// past every control in here, so the register is the only thing left that can
// still answer "who took a copy".
//
// ⚠ IF THE REGISTER CANNOT BE WRITTEN, NOTHING IS SENT. A download that was
//   not recorded is precisely what the register exists to prevent, so a
//   failure to record is a failure to export — not a warning beside a file
//   that downloaded anyway.
//
// ⚠ "AGREED TO HEAR FROM THE CLUB" IS NOT THE TICK ON ITS OWN. A guest who
//   ticked the box in November and unsubscribed from the follow-up in
//   December has withdrawn it. The consented file honours that; the full file
//   says so in the consent column rather than quietly showing `yes`.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const SLUG = process.env.POPUP_SLUG || 'palace-2026-11-13'
const svc = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

/** RFC 4180: a field carrying a comma, a quote or a newline is quoted and its
 *  quotes doubled. Guest names carry commas more often than anyone expects.
 *
 *  ⚠ AND A FIELD THAT STARTS WITH = OR @ IS DEFUSED. Those are how a
 *  spreadsheet is told "this is a formula", and every value in this file was
 *  typed by somebody at a door. `+` and `-` are deliberately NOT on that list:
 *  +84901234567 is a real phone number and mangling it to protect against a
 *  risk nobody here is running would be the worse trade.
 *
 *  ⚠ A LEADING ZERO IS NOT PROTECTED, on purpose. 0901234567 is correct in the
 *  file; Excel may show it as 901234567 on import, which is Excel's import
 *  dialog to fix (choose Text for that column). The alternative — wrapping it
 *  in ="..." — is itself a formula, and writing a formula into a file to stop
 *  formulas is not a trade worth making. */
const esc = (v: unknown) => {
  const s0 = v == null ? '' : String(v)
  const s = /^[=@]/.test(s0) ? `'${s0}` : s0
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const VN = (iso: string | null, opts: Intl.DateTimeFormatOptions) =>
  iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', ...opts }).format(new Date(iso)) : ''

type Row = {
  name: string
  email: string | null
  email_key: string | null
  phone: string | null
  consent_phone: boolean | null
  party_size: number
  status: string
  lang: string
  taken_by: string | null
  source: string
  consent_marketing: boolean
  admitted_at: string | null
  popup_sessions: { starts_at: string; ends_at: string } | null
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Staff only.' }, { status: 403 })

  const kind = req.nextUrl.searchParams.get('kind') === 'consented' ? 'consented' : 'all'
  // ⚠ WHICH EVENING. The run sheet never passes this — its two buttons always
  //   mean Friday. It exists so the practice evening can be exported while
  //   rehearsing, and so this route can be proved end to end without putting
  //   a single fixture row on the real guest list. The register records the
  //   event either way, so a practice download is never mistaken for a real
  //   one when somebody reads the log back.
  const slug = (req.nextUrl.searchParams.get('event') || SLUG).slice(0, 80)

  // Who is asking. Both the id and the address: the id is the truth, the
  // address is what still means something if the account is renamed later.
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()

  const a = svc()
  const { data: ev } = await a.from('popup_events').select('id, slug, event_date, title_en, is_practice').eq('slug', slug).maybeSingle()
  if (!ev) return NextResponse.json({ error: `There is no evening called “${slug}”.` }, { status: 404 })

  // ── READING EVERY BOOKING, NOT THE FIRST THOUSAND ──────────────────────
  // ⚠ PostgREST CAPS A SELECT AT 1000 ROWS and says nothing about it. That
  //   silent cap has already cost this codebase a recommender that ignored a
  //   quarter of the library. An export that quietly stops at a thousand
  //   guests would be worse: it reads as the complete list.
  const PAGE = 500
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await a.from('popup_bookings')
      .select('name, email, email_key, phone, consent_phone, party_size, status, lang, taken_by, source, consent_marketing, admitted_at, popup_sessions!inner(starts_at, ends_at)')
      .eq('event_id', ev.id)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const page = (data || []) as unknown as Row[]
    rows.push(...page)
    if (page.length < PAGE) break
  }

  // Every withdrawal, whichever evening it was made on. An unsubscribe is a
  // statement about the club, not about one pop-up.
  const { data: unsubs } = await a.from('popup_unsubscribes').select('email_key')
  const gone = new Set((unsubs || []).map(u => u.email_key))

  const now = Date.now()
  // ⚠ FIVE WORDS, AND FOUR OF THEM ARE NOT IN THE STATUS COLUMN. The table
  //   stores confirmed / waiting / cancelled. "Admitted" is a timestamp, and
  //   "no-show" is the absence of one after the session has finished — it
  //   cannot be known before then, and a guest whose session is still to come
  //   is not a no-show, they are confirmed.
  const state = (r: Row) => {
    if (r.status === 'cancelled') return 'cancelled'
    if (r.status === 'waiting') return 'waiting'
    if (r.admitted_at) return 'admitted'
    if (r.popup_sessions && +new Date(r.popup_sessions.ends_at) < now) return 'no-show'
    return 'confirmed'
  }
  const consent = (r: Row) =>
    !r.consent_marketing ? 'no'
      : (r.email_key && gone.has(r.email_key)) ? 'yes (unsubscribed since)'
      : 'yes'

  const wanted = kind === 'consented'
    // A consented list exists to be written to. A row with no address cannot
    // be, and a withdrawal is a withdrawal.
    ? rows.filter(r => r.consent_marketing && r.email && !(r.email_key && gone.has(r.email_key)))
    : rows

  const header = ['Name', 'Email', 'Phone', 'Party size', 'Session', 'Status', 'Language',
                  'Taken by', 'Agreed to hear from the club', 'Agreed to phone or Zalo']
  const body = wanted.map(r => [
    r.name,
    r.email ?? '',
    r.phone ?? '',
    r.party_size,
    r.popup_sessions ? `${VN(r.popup_sessions.starts_at, { day: '2-digit', month: 'short' })} ${VN(r.popup_sessions.starts_at, { hour: '2-digit', minute: '2-digit', hour12: false })}` : '',
    state(r),
    r.lang === 'vn' ? 'Vietnamese' : 'English',
    // A booking taken on the public page was taken by nobody; saying so beats
    // an empty cell that reads like a missing record.
    r.taken_by || (r.source === 'public' ? 'public page' : ''),
    consent(r),
    r.consent_phone ? 'yes' : 'no',
  ].map(esc).join(','))

  // ── THE REGISTER, BEFORE THE FILE ──────────────────────────────────────
  const { error: logErr } = await a.from('popup_exports').insert({
    event_id: ev.id, kind, rows_out: body.length,
    by_id: user?.id ?? null, by_email: user?.email ?? null,
  })
  if (logErr) {
    return NextResponse.json({
      error: /popup_exports/.test(logErr.message)
        ? 'The download register is missing — run db/popup_exports.sql first. Nothing has been exported.'
        : `The download could not be recorded, so nothing was exported: ${logErr.message}`,
    }, { status: 500 })
  }

  // ⚠ THE BYTE ORDER MARK IS NOT DECORATION. Without it Excel on Windows
  //   reads the file as the local code page and every Vietnamese name in it
  //   turns to mojibake — Nguyễn becomes NguyÃªÌƒn — which looks like our
  //   data is wrong rather than their importer.
  const csv = '﻿' + [header.join(','), ...body].join('\r\n')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
  // A practice file says so in its own name, so it cannot be handed on as the
  // real guest list by somebody who only ever sees the filename.
  const name = `${ev.is_practice ? 'practice-' : ''}${kind === 'consented' ? 'consented' : 'all-guests'}`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rampant-popup-${name}-${today}.csv"`,
      // Never let a proxy or a browser keep a copy of a guest list.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Rows': String(body.length),
    },
  })
}
