'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { POPUP_STRINGS } from '@/lib/popup/strings'

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 9 · EVERY VIETNAMESE STRING IN THE POP-UP, BESIDE ITS ENGLISH.
// ───────────────────────────────────────────────────────────────────────────
// One screen, one pass, no hunting. It renders lib/popup/strings directly —
// which is the reason that table exists. A sentence written inline in a
// component would not appear here and would therefore never be checked.
//
// ⚠ THE GUARD AT THE BOTTOM IS THE POINT OF THE PAGE, not a nicety. The groups
// below are hand-ordered, so a string added to the table tomorrow would simply
// not appear — and a sentence nobody can see is a sentence nobody reviews.
// Anything missing is NAMED here, loudly, rather than discovered by a guest.
//
// THE VIETNAMESE IS A MACHINE DRAFT until a native speaker has read it.
// ═══════════════════════════════════════════════════════════════════════════

type K = keyof typeof POPUP_STRINGS

const GROUPS: { title: string; note: string; keys: K[] }[] = [
  { title: '1 · Choosing a time', note: 'The first screen on the phone. Most guests see this and the confirmation and nothing else.',
    keys: ['k_title', 'k_lead', 'k_places_one', 'k_places', 'k_full', 'k_waitlist',
           'k_none_left', 'k_paused', 'k_soonest', 'k_full_heading'] },
  { title: '2 · Who they are', note: 'Taken by a member of staff holding the phone, usually reading it aloud.',
    keys: ['k_your_details', 'k_name', 'k_email', 'k_email_hint', 'k_party',
           'k_party_one', 'k_party_n', 'k_back', 'k_next'] },
  { title: '3 · Checking, then confirming', note: 'The typo catcher. The email is read back large — and a wrong one never costs a place.',
    keys: ['k_check', 'k_check_email', 'k_confirm', 'k_edit', 'k_working'] },
  { title: 'The guarantee', note: 'The screen that gets turned round and shown to the guest. The most important words in the whole build.',
    keys: ['k_done_title', 'k_done_come', 'k_done_early', 'k_done_mail', 'k_done_nomail', 'k_done_again'] },
  { title: 'The waiting list', note: 'It must be unmistakable that this is NOT a ticket.',
    keys: ['k_wait_title', 'k_wait_line', 'k_wait_note'] },
  { title: 'Consent and the privacy line', note: 'Stored verbatim with the booking. A consent record that cannot say what was agreed to is not evidence of anything.',
    keys: ['k_consent', 'k_privacy', 'k_privacy_link'] },
  { title: 'When something is wrong', note: 'Said plainly to somebody standing there, never in error-speak.',
    keys: ['k_err_name', 'k_err_email', 'k_err_full', 'k_err_toobig', 'k_err_dup',
           'k_err_dup_ask', 'k_err_started', 'k_err_offline', 'k_err_offline_ask'] },
  { title: 'The staff menu, behind the PIN', note: 'Only staff read these — and the people holding these phones read Vietnamese first.',
    keys: ['k_pin_title', 'k_continue', 'k_menu_sub', 'k_menu_signup', 'k_menu_door'] },
  { title: 'The home screen', note: 'The first thing a staff member sees. If this is not plain, nothing else matters.',
    keys: ['h_signed_in', 'h_signup', 'h_scan', 'h_signout', 'h_practice', 'h_practice_sub',
           'h_who', 'h_your_pin', 'h_start', 'h_someone_else', 'h_done', 'h_back_home'] },
  { title: 'The slot list', note: 'Read at arm\u2019s length, with somebody waiting.',
    keys: ['s_places', 's_one_place', 's_full', 's_next_free', 's_running', 's_waitlist_btn',
           's_choose', 's_how_many', 's_confirm_btn', 's_emailed', 's_not_emailed',
           's_email_failed', 's_show_guest', 's_their_code'] },
  { title: 'The scan screen', note: 'Two ways in besides the camera.',
    keys: ['sc_type', 'sc_byname', 'sc_let_in', 'sc_code_label', 'sc_ask_name',
           'sc_ask_sub', 'sc_confirm_in', 'sc_no_code', 'sc_too_many'] },
  { title: 'Which evening this phone is on', note: '⚠ The owner held a practice ticket on a phone set to the real evening and every message misled him. These say which list is being used.',
    keys: ['m_practice', 'm_not_open', 'm_open', 'm_paused', 'm_not_open_lead', 'm_not_open_sub',
           'm_wrong_event_practice', 'm_wrong_event_real', 'm_no_code_on'] },
  { title: 'Fixing a booking', note: 'Correcting a name, an email, a party size or a time from the phone — none of which could be done from anywhere before today.',
    keys: ['f_fix', 'f_title', 'f_name', 'f_email', 'f_people', 'f_time', 'f_save', 'f_resend',
           'f_cancel_b', 'f_cancel_sure', 'f_cancel_yes', 'f_cancel_no', 'f_saved', 'f_saved_sent',
           'f_sent', 'f_cancelled', 'f_nothing', 'f_no_email', 'f_already_in', 'f_dupe',
           'f_full_here', 'f_try_these', 'f_codes_same'] },
  { title: 'What a button says while it works', note: 'Every press changes the label at once and ends in a result. Nothing fails silently.',
    keys: ['b_working', 'b_saving', 'b_admitting', 'b_looking', 'b_signing_in',
           'b_failed', 'b_try_again', 'b_walkup_ok', 'b_walkup_over', 'b_walkup_toobig'] },

  { title: 'The door · signing in', note: 'On the phone at the entrance.',
    keys: ['d_title', 'd_who', 'd_your_pin', 'd_open', 'd_someone_else', 'd_wrong_pin'] },
  { title: 'The door · the bar across the top', note: 'Who is on, what is running, and whether this phone is actually connected.',
    keys: ['d_in_now', 'd_next', 'd_no_session', 'd_offline', 'd_to_send'] },
  { title: 'The door · finding somebody', note: 'Scan, type the code, or search the name.',
    keys: ['d_scan', 'd_type_code', 'd_go', 'd_find', 'd_matches', 'd_match_one',
           'd_cam_none', 'd_cam_fail', 'd_close', 'd_cam_aim', 'd_cam_asking',
           'd_cam_denied', 'd_cam_denied_ios', 'd_cam_none_found', 'd_cam_starting',
           'd_cam_type'] },
  { title: 'The door · the list', note: 'Every line a member of staff reads while somebody waits in front of them.',
    keys: ['d_nobody', 'd_admit', 'd_undo', 'd_in_count', 'd_walkup', 'd_back_signup',
           'd_finished', 'd_never_came', 'd_hide', 'd_show', 'd_cap', 'd_over_by',
           'd_waiting_n', 'd_party_of', 'd_one_person', 'd_waiting_list', 'd_is_walkup',
           'd_in_at', 'd_offline_tag'] },
  { title: 'The door · what a scan says', note: 'Ten answers, every one read ALOUD to a guest. These matter more than anything else on the door.',
    keys: ['d_s_valid', 'd_s_queued', 'd_s_used', 'd_s_used_by', 'd_s_early', 'd_s_early_sub',
           'd_s_late', 'd_s_waiting', 'd_s_waiting_sub', 'd_s_cancelled', 'd_s_unknown',
           'd_s_wrong', 'd_s_wrong_sub', 'd_s_malformed', 'd_s_in_of', 'd_s_wrong_row'] },
  { title: 'The door · how many came, and walk-ups', note: 'A party of three where two turn up is the commonest thing a door sees.',
    keys: ['d_how_many', 'd_cancel', 'd_walk_title', 'd_walk_sub', 'd_walk_name',
           'd_walk_go', 'd_walk_anyway', 'd_walk_full', 'd_walk_full_sub'] },
  { title: 'The door · no signal', note: 'What staff read when the pocket router drops. It has to be calm and it has to be true.',
    keys: ['d_off_title', 'd_off_sub', 'd_bad_title', 'd_bad_sub'] },

  { title: 'Email · the ticket', note: 'Sent the moment a place is taken, in the language the guest signed up in.',
    keys: ['mail_ticket_subject', 'mail_ticket_booked', 'mail_ticket_lead', 'mail_ticket_date',
           'mail_ticket_people_one', 'mail_ticket_people', 'mail_ticket_arrive',
           'mail_ticket_when', 'mail_ticket_show', 'mail_ticket_doorcode_lead',
           'mail_ticket_shot', 'mail_ticket_code', 'mail_ticket_where'] },
  { title: 'Email · the waiting list', note: 'It must say plainly that it is not a ticket.',
    keys: ['mail_wait_subject', 'mail_wait_lead', 'mail_wait_not'] },
  { title: 'Email · the time moved', note: 'The new time is the subject line, because that is all anybody reads in a crowd.',
    keys: ['mail_shift_subject', 'mail_shift_lead', 'mail_shift_was', 'mail_shift_now', 'mail_shift_same'] },
  { title: 'Email · a note from the club', note: 'The wrapper. The body is typed by whoever sends it.',
    keys: ['mail_msg_subject'] },
  { title: 'Email · a place has opened', note: 'Sent the instant the cap is raised and somebody is promoted off the waiting list.',
    keys: ['mail_promoted_subject', 'mail_promoted_lead'] },
  { title: 'Email · ten minutes to go', note: 'Never sent for a session that has started.',
    keys: ['mail_rem_subject', 'mail_rem_lead', 'mail_rem_where'] },
  { title: 'Email · the morning after', note: 'Only the wrapper and the unsubscribe. ⚠ THE BODY IS THE OWNER’S AND IS NOT WRITTEN ANYWHERE IN THE CODE.',
    keys: ['mail_fu_hello', 'mail_fu_unsub', 'mail_fu_unsub_link', 'mail_fu_test'] },
]

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2', MUTED = '#B2AA98', DIM = '#7E7864', GOLD = '#D4B85A', RED = '#C27070'

export default function PopupVn() {
  const [copied, setCopied] = useState(false)
  const all = Object.keys(POPUP_STRINGS) as K[]
  const listed = useMemo(() => new Set(GROUPS.flatMap(g => g.keys as string[])), [])
  const unlisted = all.filter(k => !listed.has(k))
  const total = all.length

  // ⚠ A SECOND GUARD: a VN that is missing, or identical to the English, has
  // not been translated — it has been skipped. Both are named.
  const gaps = all.filter(k => {
    const v = POPUP_STRINGS[k] as { en: string; vn: string }
    return !v.vn || !v.vn.trim() || v.vn.trim() === v.en.trim()
  })

  const copyAll = async () => {
    const lines = GROUPS.flatMap(g => [
      `## ${g.title}`,
      ...g.keys.map(k => {
        const v = POPUP_STRINGS[k] as { en: string; vn: string }
        return `${k}\nEN: ${v.en}\nVN: ${v.vn}\n`
      }),
    ]).join('\n')
    try { await navigator.clipboard.writeText(lines); setCopied(true); setTimeout(() => setCopied(false), 2500) }
    catch { /* select and copy by hand */ }
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: CREAM, margin: 0 }}>Vietnamese — the pop-up</h1>
        <Link href="/admin/popup" style={link}>← Run sheet</Link>
      </div>
      <p style={lede}>
        Every string the pop-up can show, in the order it is met — {total} of them, including the door,
        the refusals and the email subjects. The Vietnamese is <strong style={{ color: GOLD }}>a machine
        draft</strong>. Have a native speaker read this page and send corrections back.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={copyAll} style={btn}>{copied ? `Copied all ${total}` : `Copy all ${total} as text`}</button>
        <span style={{ fontFamily: MONO, fontSize: 11, color: gaps.length ? GOLD : '#7FA86B' }}>
          {gaps.length ? `${gaps.length} still read the same in both languages` : 'every string has its own Vietnamese'}
        </span>
      </div>

      {unlisted.length > 0 && (
        <div style={{ ...note, borderLeftColor: RED, background: 'rgba(194,112,112,0.08)' }}>
          <strong style={{ color: RED }}>
            {unlisted.length} string{unlisted.length === 1 ? '' : 's'} exist that this page does not show.
          </strong>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.8 }}>
            Add {unlisted.map(k => <code key={k} style={code}>{k}</code>)} to a group in
            app/admin/popup/vn/page.tsx. A sentence that is not on this page is a sentence nobody reviews.
          </div>
        </div>
      )}

      {GROUPS.map(g => (
        <section key={g.title} style={{ marginBottom: 30 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 16, color: CREAM, margin: '0 0 3px' }}>{g.title}</h2>
          <p style={{ fontFamily: MONO, fontSize: 11, color: DIM, margin: '0 0 12px', lineHeight: 1.6, maxWidth: '74ch' }}>{g.note}</p>
          {g.keys.map(k => {
            const v = POPUP_STRINGS[k] as { en: string; vn: string }
            if (!v) return (
              <div key={k} style={{ ...rowStyle, borderLeft: `3px solid ${RED}` }}>
                <code style={code}>{k}</code>
                <span style={{ fontFamily: MONO, fontSize: 12, color: RED }}>no such string — this group names a key that does not exist</span>
              </div>
            )
            const same = !v.vn?.trim() || v.vn.trim() === v.en.trim()
            return (
              <div key={k} style={{ ...rowStyle, borderLeft: `3px solid ${same ? GOLD : 'transparent'}` }}>
                <code style={code}>{k}</code>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 5 }}>
                  <div>
                    <div style={tag}>EN</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: CREAM, lineHeight: 1.6 }}>{v.en}</div>
                  </div>
                  <div>
                    <div style={{ ...tag, color: same ? GOLD : DIM }}>VN{same ? ' — not translated' : ''}</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: same ? GOLD : CREAM, lineHeight: 1.6 }}>{v.vn || '—'}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ))}

      <div style={note}>
        <strong style={{ color: CREAM }}>What is deliberately not here.</strong>
        <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 1.8 }}>
          The run sheet, the reconciliation screen and the printable sheets are in English only, like the
          rest of the admin — they are read at a desk by whoever is running the evening, not on the floor.
          The sign-up phone and the door are both bilingual, because the people holding those read
          Vietnamese first. The body of the follow-up email is not in the code at all: it is the
          owner&rsquo;s, written in the admin, in both languages.
        </div>
      </div>
    </div>
  )
}

const lede: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: MUTED, lineHeight: 1.8, maxWidth: '80ch', margin: '8px 0 18px' }
const rowStyle: React.CSSProperties = { padding: '10px 0 10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 2 }
const code: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: DIM, letterSpacing: '.06em', marginRight: 6 }
const tag: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '.18em', color: DIM, marginBottom: 3 }
const note: React.CSSProperties = { borderLeft: `3px solid ${GOLD}`, background: 'rgba(212,184,90,0.06)', padding: '14px 16px', borderRadius: 4, marginBottom: 22 }
const btn: React.CSSProperties = { minHeight: 36, padding: '0 16px', borderRadius: 5, border: `1px solid ${CREAM}2e`, background: 'transparent', color: CREAM, fontFamily: MONO, fontSize: 12, cursor: 'pointer' }
const link: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: GOLD, textDecoration: 'none' }
