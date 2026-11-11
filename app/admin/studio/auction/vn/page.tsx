'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/admin/dialogs'
import { AUCTION_STRINGS } from '@/lib/studio/auction'

// ═══════════════════════════════════════════════════════════════════════════
// EVERY VIETNAMESE STRING IN THE AUCTION, BESIDE ITS ENGLISH.
// ───────────────────────────────────────────────────────────────────────────
// One screen, one pass, no hunting. This renders lib/studio/auction's string
// table directly — which is the reason that table exists. A sentence written
// inline in a component would not appear here, and would therefore never be
// checked; every string the auction can show, including the validation
// messages and the email subjects, is in that object for exactly this reason.
//
// THE VIETNAMESE IS A MACHINE DRAFT until somebody marks it read. The auction
// admin shows a banner saying so, and the sensible order is: read this, send
// any corrections back, then publish.
// ═══════════════════════════════════════════════════════════════════════════

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const MUTED = '#B2AA98'
const DIM = '#7E7864'
const GOLD = '#D4B85A'
const SAGE = '#7AB07A'

// The order the guest meets them, with a heading before each run.
const GROUPS: { title: string; note: string; keys: (keyof typeof AUCTION_STRINGS)[] }[] = [
  { title: 'The banner, above the works', note: 'The first thing a guest reads.',
    keys: ['banner_eyebrow', 'banner_lead', 'banner_sold', 'banner_sold_one', 'lot_bid_count', 'lot_bid_count_one', 'banner_closes', 'banner_announce', 'banner_jump'] },
  { title: 'The countdown', note: 'Assembled from two parts — "2d 6h", "14m 09s". The units are what need checking.',
    keys: ['banner_left', 'cd_days', 'cd_hours', 'cd_mins', 'cd_secs'] },
  { title: 'Under each work', note: 'The label a guest reads standing in front of the painting.',
    keys: ['lot_starting', 'lot_highest', 'lot_none', 'lot_reserve_met', 'lot_reserve_not_met',
           'lot_closes', 'lot_cta', 'lot_price', 'lot_sold', 'lot_enquire',
           'lot_you_leading', 'lot_you_outbid', 'lot_bid_again', 'lot_donation'] },
  { title: 'The bid form', note: 'Field labels and the two buttons.',
    keys: ['form_title', 'form_name', 'form_email', 'form_phone', 'form_amount', 'form_min',
           'form_submit', 'form_submitting', 'form_cancel'] },
  { title: 'The terms and the two boxes', note: 'The most important lines on the page — a bid is a commitment, and the terms sentence is stored verbatim with every bid.',
    keys: ['form_terms', 'form_prevails', 'form_share_box', 'form_news_box'] },
  { title: 'Asking about a priced work', note: 'The four works that carry a price rather than a bid.',
    keys: ['enq_title', 'enq_message', 'enq_terms', 'enq_submit', 'enq_submitting',
           'enq_ok_title', 'enq_ok_line'] },
  { title: 'When something is wrong', note: 'Said plainly, never in error-speak.',
    keys: ['err_name', 'err_email', 'err_amount', 'err_low', 'err_closed', 'err_busy',
           'err_failed', 'err_enq_failed', 'err_state', 'err_confirm_big', 'loading'] },
  { title: 'Afterwards', note: 'The confirmation on screen, and the closed state.',
    keys: ['ok_title', 'ok_line', 'ok_leading', 'ok_not_leading', 'ok_email', 'ok_email_failed', 'ok_outbid_note',
           'ok_again', 'ok_back', 'closed_title', 'closed_line', 'credit'] },
  { title: 'Emails', note: 'Sent in the language the bidder was using when they bid.',
    keys: ['mail_confirm_subject', 'mail_confirm_lead', 'mail_confirm_terms', 'mail_confirm_when',
           'mail_outbid_subject', 'mail_outbid_lead', 'mail_outbid_cta',
           'mail_result_subject', 'mail_result_won', 'mail_result_lost_with_price',
           'mail_result_lost_no_price', 'mail_result_unsold'] },
]

export default function AuctionVnReview() {
  const { showToast, toastNode } = useToast()
  const [auctionId, setAuctionId] = useState<string | null>(null)
  const [reviewedAt, setReviewedAt] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/studio', { cache: 'no-store' }).then(r => r.json()).then(async j => {
      const live = (j.collaborations || []).find((c: { status: string }) => c.status === 'live')
      if (!live) return
      const r = await fetch(`/api/admin/studio/auction?collaboration=${live.id}`, { cache: 'no-store' })
      const a = await r.json()
      if (a.auction) { setAuctionId(a.auction.id); setReviewedAt(a.auction.vn_reviewed_at) }
    }).catch(() => { /* the mark-read button simply stays disabled */ })
  }, [])

  const total = GROUPS.reduce((n, g) => n + g.keys.length, 0)
  // ⚠ THE GUARD ON THIS PAGE'S OWN PROMISE. The groups above are hand-ordered,
  // so a string added to the table later would simply not appear here — and a
  // sentence nobody can see is a sentence nobody reviews. Anything missing is
  // named on the page rather than discovered by a guest.
  const listed = new Set(GROUPS.flatMap(g => g.keys as string[]))
  const unlisted = (Object.keys(AUCTION_STRINGS) as string[]).filter(k => !listed.has(k))

  const markRead = async () => {
    if (!auctionId) return
    const r = await fetch('/api/admin/studio/auction', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auction_id: auctionId, fields: { vn_reviewed_at: new Date().toISOString() } }),
    })
    if (!r.ok) { showToast('Could not record that.', 'error'); return }
    setReviewedAt(new Date().toISOString())
    showToast('Marked as checked by a native speaker.')
  }

  const copyAll = async () => {
    const lines = GROUPS.flatMap(g => [
      `## ${g.title}`,
      ...g.keys.map(k => `${k}\nEN: ${AUCTION_STRINGS[k].en}\nVN: ${AUCTION_STRINGS[k].vn}\n`),
    ]).join('\n')
    try { await navigator.clipboard.writeText(lines); showToast(`All ${total} strings copied.`) }
    catch { showToast('Could not reach the clipboard — select and copy by hand.', 'error') }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: CREAM, margin: 0 }}>Vietnamese — the auction</h1>
        <Link href="/admin/studio/auction" style={link}>← The auction</Link>
      </div>
      <p style={lede}>
        Every string the auction can show, in the order a guest meets them — {total} of them, including
        the validation messages and the email subjects. The Vietnamese is <strong>a machine draft</strong>.
        Have a native speaker read this page, send corrections back, then publish.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={copyAll} style={btnQuiet}>Copy all {total} as text</button>
        <button onClick={markRead} disabled={!auctionId} style={reviewedAt ? btnQuiet : btnGo}>
          {reviewedAt ? 'Mark as checked again' : 'Mark as checked by a native speaker'}
        </button>
        {reviewedAt && (
          <span style={{ fontFamily: MONO, fontSize: 11, color: SAGE }}>
            Checked {new Date(reviewedAt).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })}
          </span>
        )}
      </div>

      {unlisted.length > 0 && (
        <div style={{ ...note, borderLeftColor: '#C27070', background: 'rgba(194,112,112,0.07)' }}>
          <strong style={{ color: '#C27070' }}>
            {unlisted.length} string{unlisted.length === 1 ? '' : 's'} are in the auction but not on this page:
          </strong>{' '}
          <code style={code}>{unlisted.join(', ')}</code>. Add them to a group in{' '}
          <code style={code}>app/admin/studio/auction/vn/page.tsx</code> before publishing — a sentence
          that is not here is a sentence no native speaker has read.
        </div>
      )}

      <div style={note}>
        Corrections come back to a developer: these sentences live in{' '}
        <code style={code}>lib/studio/auction.ts</code>, not in the database, because a validation
        message that can be edited at runtime is a validation message that can be emptied at runtime.
        Mark the page checked here; the text itself changes in a deploy.
      </div>

      {GROUPS.map(g => (
        <section key={g.title}>
          <div style={sectionLabel}>{g.title}</div>
          <p style={{ ...lede, margin: '0 0 10px' }}>{g.note}</p>
          {g.keys.map(k => (
            <div key={k} style={row}>
              <div style={keyCol}>{k}</div>
              <div style={enCol}>{AUCTION_STRINGS[k].en}</div>
              <div style={vnCol}>{AUCTION_STRINGS[k].vn}</div>
            </div>
          ))}
        </section>
      ))}

      <p style={{ ...lede, marginTop: 24 }}>
        <strong>{'{amount}'}</strong>, <strong>{'{min}'}</strong>, <strong>{'{time}'}</strong>,{' '}
        <strong>{'{date}'}</strong> and <strong>{'{title}'}</strong> are filled in when the line is
        shown. They must survive translation exactly as written, braces and all — a renamed token
        prints as literal text to the guest.
      </p>
      {toastNode}
    </>
  )
}

const lede: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: MUTED, opacity: .85, lineHeight: 1.7, maxWidth: 760, margin: '0 0 18px' }
const note: React.CSSProperties = { padding: '12px 14px', background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.16)', borderLeft: `2px solid ${GOLD}`, borderRadius: 4, fontFamily: MONO, fontSize: 11, color: MUTED, lineHeight: 1.7, marginBottom: 18, maxWidth: 860 }
const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: GOLD, letterSpacing: '0.20em', textTransform: 'uppercase', marginTop: 26, marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${GOLD}` }
const row: React.CSSProperties = { display: 'flex', gap: 16, alignItems: 'flex-start', padding: '11px 0', borderTop: '1px solid rgba(229,212,194,0.08)', flexWrap: 'wrap' }
const keyCol: React.CSSProperties = { flex: '0 0 190px', fontFamily: MONO, fontSize: 10, color: DIM, letterSpacing: '.04em', paddingTop: 2 }
const enCol: React.CSSProperties = { flex: '1 1 280px', fontFamily: MONO, fontSize: 12, color: CREAM, lineHeight: 1.7 }
const vnCol: React.CSSProperties = { flex: '1 1 280px', fontFamily: MONO, fontSize: 12, color: GOLD, lineHeight: 1.7 }
const btnGo: React.CSSProperties = { background: '#5E8A5E', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 16px', fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '.06em', cursor: 'pointer' }
const btnQuiet: React.CSSProperties = { background: 'transparent', color: MUTED, border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4, padding: '9px 16px', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', cursor: 'pointer' }
const link: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: GOLD, textDecoration: 'none', letterSpacing: '.06em', borderBottom: '1px solid rgba(212,184,90,0.35)' }
const code: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, color: GOLD }
