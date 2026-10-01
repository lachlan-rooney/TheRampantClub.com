import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { inQuietHours } from './notify-dispatch'

// THE MORNING LIST — what is yours, due or late, in one email.
//
// Owner, 2026-10-01: "so we can send them email reminders of tasks needing done
// on the boards."
//
// ── WHY THIS IS NOT THE EXISTING NOTIFICATION FLUSH ────────────────────────
// notifications.recipient is a LOGIN; tasks.assignee is a TEAM MEMBER. Two of
// fifteen team members have a login, so ops_generate_due_soon falls back to the
// board owner and every task_due_soon email ever sent has gone to one address.
// db/staff_emails.sql explains the join in full. This reads the team member's
// own address and skips the join, which is the only way floor staff — who have
// PINs and not logins — can be reached at all.
//
// ── ONE EMAIL, NOT ONE PER TASK ────────────────────────────────────────────
// Bình has fifty-six open tasks. An email per task is a filter rule within a
// week, and then nothing is read. One email a day, with everything late at the
// top and everything due today and tomorrow under it, is a list somebody works
// from. Somebody with nothing due gets nothing at all: an email that says "you
// have no tasks" teaches people to ignore the sender.
//
// ── ONCE A DAY, WHATEVER PRESSES IT ────────────────────────────────────────
// last_digest_on is stamped with the VN date before anything else, so the cron
// running twice, or an admin pressing "send now" after it, cannot send the same
// person the same list again. `force` exists for the preview button and sends
// to one named person only.
//
// ── IT STANDS DOWN RATHER THAN THROWING ────────────────────────────────────
// If db/staff_emails.sql has not been run, the select fails and this returns
// { ran: false, reason } instead of taking the whole 09:00 cron down with it.

const FROM = 'The Rampant Club <ops@therampantclub.com>'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://therampantclub.com'

export type DigestResult = {
  ran: boolean
  reason?: string
  considered: number
  sent: number
  skipped: number
  failed: number
  people: { name: string; late: number; today: number; soon: number; outcome: string }[]
}

type Member = { id: string; display_name: string; email: string | null; email_reminders: boolean; last_digest_on: string | null; active: boolean }
type Row = { id: string; title: string; due_date: string; project_id: string; priority: string | null }

export function vnToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
}
function vnPlusDays(n: number): string {
  const d = new Date(Date.now() + n * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
}

/**
 * Send each staff member their own list of late / due-today / due-tomorrow
 * board tasks.
 *
 * @param only  one team_member id — the preview button. Ignores last_digest_on.
 */
export async function sendStaffTaskDigest(
  sb: SupabaseClient,
  opts: { only?: string; force?: boolean } = {},
): Promise<DigestResult> {
  const out: DigestResult = { ran: true, considered: 0, sent: 0, skipped: 0, failed: 0, people: [] }

  // Quiet hours apply to the daily run but not to a person pressing a button
  // and waiting to see whether it worked.
  if (!opts.force && inQuietHours()) return { ...out, ran: false, reason: 'quiet hours' }

  let q = sb.from('team_members')
    .select('id, display_name, email, email_reminders, last_digest_on, active')
    .eq('active', true)
    .not('email', 'is', null)
  if (opts.only) q = sb.from('team_members')
    .select('id, display_name, email, email_reminders, last_digest_on, active')
    .eq('id', opts.only)

  const { data: staffRows, error: staffErr } = await q
  if (staffErr) {
    // Same two spellings as the write path: Postgres says "column … does not
    // exist", PostgREST says PGRST204 / "schema cache".
    const missing = staffErr.code === 'PGRST204' || /column .* does not exist/i.test(staffErr.message)
      || /schema cache/i.test(staffErr.message) || /does not exist/i.test(staffErr.message)
    return { ...out, ran: false, reason: missing ? 'db/staff_emails.sql has not been run yet' : staffErr.message }
  }
  const staff = (staffRows || []) as Member[]
  out.considered = staff.length
  if (!staff.length) return out

  const today = vnToday()
  const soon = vnPlusDays(1)

  // ACTIVE BOARDS ONLY — the same scoping the sidebar badge learned. The
  // Rampant Cup still holds 183 cards dated May; a digest counting those is a
  // digest nobody believes twice.
  const { data: live } = await sb.from('projects').select('id, name').is('deleted_at', null).eq('status', 'active')
  const boards = new Map((live || []).map((p: { id: string; name: string }) => [p.id, p.name]))
  if (!boards.size) return out

  const ids = staff.map(s => s.id)
  const { data: taskRows } = await sb.from('tasks')
    .select('id, title, due_date, project_id, priority, assignee')
    .eq('status', 'open')
    .in('assignee', ids)
    .in('project_id', [...boards.keys()])
    .lte('due_date', soon)
    .order('due_date')

  const byPerson = new Map<string, Row[]>()
  for (const t of (taskRows || []) as (Row & { assignee: string })[]) {
    if (!t.due_date) continue
    const list = byPerson.get(t.assignee) || []
    list.push(t)
    byPerson.set(t.assignee, list)
  }

  const apiKey = process.env.RESEND_API_KEY
  const resend = apiKey ? new Resend(apiKey) : null

  for (const person of staff) {
    const mine = byPerson.get(person.id) || []
    const late = mine.filter(t => t.due_date < today)
    const due = mine.filter(t => t.due_date === today)
    const next = mine.filter(t => t.due_date === soon)
    const note = (outcome: string) =>
      out.people.push({ name: person.display_name, late: late.length, today: due.length, soon: next.length, outcome })

    if (!person.email) { out.skipped++; note('no address'); continue }
    if (!opts.force && !person.email_reminders) { out.skipped++; note('reminders off'); continue }
    if (!opts.force && person.last_digest_on === today) { out.skipped++; note('already sent today'); continue }
    // NOTHING DUE IS NOT AN EMAIL.
    if (!mine.length) { out.skipped++; note('nothing due'); continue }
    if (!resend) { out.skipped++; note('RESEND_API_KEY not set'); continue }

    // Stamped BEFORE sending. A send that throws halfway is better repeated
    // tomorrow than repeated in four minutes by a retry nobody is watching.
    if (!opts.force) await sb.from('team_members').update({ last_digest_on: today }).eq('id', person.id)

    const { subject, html } = render(person.display_name, late, due, next, boards)
    try {
      const { error } = await resend.emails.send({ from: FROM, to: person.email, subject, html })
      if (error) throw new Error(typeof error === 'string' ? error : JSON.stringify(error))
      out.sent++; note('sent')
    } catch (e) {
      out.failed++; note('failed: ' + (e instanceof Error ? e.message : String(e)).slice(0, 120))
    }
  }

  return out
}

// ── THE EMAIL ───────────────────────────────────────────────────────────────
// Dark, like every club email — reference_email_dark_palette: they are SENT
// dark so that no client inverts them, and the cream-tile version was tried and
// is worse. Bilingual in the one place it costs nothing: the headings. The task
// titles are written on the board in whatever language they were written in,
// and translating them here would invent work nobody assigned.

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

function render(
  name: string, late: Row[], due: Row[], next: Row[], boards: Map<string, string>,
): { subject: string; html: string } {
  const n = late.length + due.length + next.length
  const subject = late.length
    ? `${late.length} late · ${n} on your list — The Rampant Club`
    : `${n} on your list today — The Rampant Club`

  const block = (titleEn: string, titleVn: string, rows: Row[], tone: string) => {
    if (!rows.length) return ''
    return `
      <div style="margin:0 0 26px">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${tone};margin-bottom:10px">
          ${esc(titleEn)} <span style="color:#7E7864">· ${esc(titleVn)}</span>
        </div>
        ${rows.map(r => `
          <div style="border-top:1px solid rgba(229,212,194,0.14);padding:11px 0">
            <a href="${SITE}/admin/ops/${r.project_id}?task=${r.id}"
               style="color:#E5D4C2;text-decoration:none;font-size:15px;line-height:1.45">${esc(r.title)}</a>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#7E7864;margin-top:5px">
              ${esc(boards.get(r.project_id) || 'Board')} · ${esc(r.due_date)}${r.priority && r.priority !== 'normal' ? ' · ' + esc(r.priority) : ''}
            </div>
          </div>`).join('')}
      </div>`
  }

  const html = `
    <div style="background:#052E20;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;color:#E5D4C2">
      <div style="max-width:560px;margin:0 auto">
        <div style="font-size:10px;letter-spacing:.2em;color:#7E7864;text-transform:uppercase;margin-bottom:18px">The Rampant Club · Operations</div>
        <div style="font-size:21px;line-height:1.3;color:#E5D4C2;margin-bottom:6px">${esc(name)}</div>
        <div style="font-size:12px;line-height:1.7;color:#B2AA98;margin-bottom:30px">
          What is on your boards today. <span style="color:#7E7864">Những việc trên bảng của bạn hôm nay.</span>
        </div>
        ${block('Late', 'Quá hạn', late, '#C9705B')}
        ${block('Due today', 'Đến hạn hôm nay', due, '#D4B85A')}
        ${block('Tomorrow', 'Ngày mai', next, '#B2AA98')}
        <a href="${SITE}/admin/ops/timeline"
           style="display:inline-block;background:#D4B85A;color:#052E20;text-decoration:none;font-size:13px;font-weight:bold;padding:11px 20px;border-radius:8px;margin-top:6px">
          Open your boards →
        </a>
        <div style="margin-top:28px;font-size:10px;line-height:1.8;color:#7E7864">
          Sent once each morning, and only when something is due.<br>
          Chỉ gửi mỗi sáng một lần, và chỉ khi có việc đến hạn.
        </div>
      </div>
    </div>`
  return { subject, html }
}
