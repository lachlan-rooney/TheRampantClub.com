'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import { money } from '@/lib/studio/auction'

// ═══════════════════════════════════════════════════════════════════════════
// THE ANNOUNCEMENT DRAFT. Read it, edit it, then send it yourself.
// ───────────────────────────────────────────────────────────────────────────
// No cron sends this and there is no scheduled-send switch to set and forget.
// The auction screen puts up a reminder from the announcement hour; this page
// is where a person reads every line and presses Send.
// ═══════════════════════════════════════════════════════════════════════════

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const MUTED = '#B2AA98'
const DIM = '#7E7864'
const GOLD = '#D4B85A'
const SAGE = '#7AB07A'
const RUST = '#C27070'

interface Letter { to: string; name: string; lang: string; kind: 'winner' | 'other'; lot_title: string; subject: string; body: string }
interface Summary { lot_id: string; title: string; winner_name: string | null; amount: number | null; reserve_met: boolean; winner_shares_price: boolean | null; entrants: number }

export default function AnnouncePage() {
  const { showToast, toastNode } = useToast()
  const [collab, setCollab] = useState('')
  const [letters, setLetters] = useState<Letter[]>([])
  const [lots, setLots] = useState<Summary[]>([])
  const [closed, setClosed] = useState(false)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/admin/studio/auction/announce?collaboration=${id}`, { cache: 'no-store' })
    const j = await r.json()
    if (!r.ok) { showToast(j.error || 'Could not build the draft.', 'error'); setLoaded(true); return }
    setLetters(j.letters || []); setLots(j.lots || []); setClosed(!!j.closed); setLoaded(true)
  }, [showToast])

  useEffect(() => {
    fetch('/api/admin/studio', { cache: 'no-store' }).then(r => r.json()).then(j => {
      const live = (j.collaborations || []).find((c: { status: string }) => c.status === 'live')
      if (live) { setCollab(live.id); load(live.id) } else setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [load])

  const send = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/studio/auction/announce', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaboration: collab, confirm: typed, edits }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { showToast(j.error || 'Not sent.', 'error'); return }
      setConfirm(false)
      showToast(j.failed ? `Sent ${j.sent}, ${j.failed} failed.` : `Sent to ${j.sent} entrant${j.sent === 1 ? '' : 's'}.`,
                j.failed ? 'error' : 'info')
      await load(collab)
    } finally { setBusy(false) }
  }

  const winners = letters.filter(l => l.kind === 'winner')
  const others = letters.filter(l => l.kind === 'other')

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: CREAM, margin: 0 }}>The announcement</h1>
        <Link href="/admin/studio/auction" style={link}>← The auction</Link>
      </div>
      <p style={lede}>
        A draft, built from the bids as they stand. Nothing is sent by a timer and nothing is sent until
        you press Send and type the confirmation. Winners get their own letter; everyone else is told the
        work has been won, <strong>never by whom</strong>.
      </p>

      {!closed && loaded && (
        <div style={{ ...warn, borderLeftColor: RUST }}>
          <strong style={{ color: RUST }}>Bidding has not closed.</strong> You can read the draft, but
          sending is refused — announcing a price while bidding is open hands the losing bidders a number
          to beat.
        </div>
      )}

      {/* ══ THE THREE RESULTS TOGETHER ══════════════════════════════ */}
      {lots.length > 0 && (
        <>
          <div style={sectionLabel}>The results</div>
          {lots.map(l => (
            <div key={l.lot_id} style={row}>
              <div style={{ flex: 1, minWidth: 170, fontFamily: SERIF, fontSize: 17, color: CREAM }}>{l.title}</div>
              <div style={{ flex: '0 0 190px', fontFamily: MONO, fontSize: 11.5, color: MUTED }}>
                {l.winner_name ? <>Winner: <span style={{ color: CREAM }}>{l.winner_name}</span></> : 'No bids'}
              </div>
              <div style={{ flex: '0 0 100px', fontFamily: MONO, fontSize: 12, color: CREAM, textAlign: 'right' }}>
                {money(l.amount)}
              </div>
              <div style={{ flex: '0 0 130px', textAlign: 'right' }}>
                <span style={{ ...pill, color: l.reserve_met ? SAGE : RUST, borderColor: (l.reserve_met ? SAGE : RUST) + '55' }}>
                  {l.reserve_met ? 'reserve met' : 'reserve not met'}
                </span>
              </div>
              {/* WHAT THE OTHER LETTER WILL SAY, decided by the winner's box. */}
              <div style={{ flex: '1 0 100%', fontFamily: MONO, fontSize: 10.5, color: DIM, paddingTop: 4 }}>
                {l.winner_name == null
                  ? 'No letters for this work.'
                  : l.winner_shares_price
                    ? `Winner allowed the price to be shared — the other ${Math.max(0, l.entrants - 1)} will be told it went for ${money(l.amount)}.`
                    : `Winner did NOT allow the price — the other ${Math.max(0, l.entrants - 1)} are told only that it has been won.`}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ══ EVERY LETTER ════════════════════════════════════════════ */}
      <div style={sectionLabel}>The letters — {letters.length}</div>
      {loaded && letters.length === 0 && <div style={quiet}>Nobody has bid, so there is nothing to announce.</div>}

      {[['Winners', winners], ['Everyone else', others]].map(([title, list]) => {
        const items = list as Letter[]
        if (!items.length) return null
        return (
          <section key={title as string}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: DIM, letterSpacing: '.16em', textTransform: 'uppercase', margin: '18px 0 8px' }}>
              {title as string} — {items.length}
            </div>
            {items.map(L => {
              const key = `${L.to.toLowerCase()}::${L.lot_title}`
              return (
                <div key={key + L.kind} style={letterBox}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: CREAM }}>{L.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED }}>{L.to}</span>
                    <span style={{ ...pill, color: GOLD, borderColor: GOLD + '55' }}>{L.lang.toUpperCase()}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: DIM }}>{L.subject}</span>
                  </div>
                  <textarea
                    style={textarea}
                    defaultValue={L.body}
                    onBlur={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              )
            })}
          </section>
        )
      })}

      {letters.length > 0 && (
        <button onClick={() => { setTyped(''); setConfirm(true) }} disabled={!closed} style={closed ? btnGo : btnOff}>
          Send {letters.length} letter{letters.length === 1 ? '' : 's'}
        </button>
      )}

      <ConfirmModal
        open={confirm}
        eyebrow="⚠ THIS LEAVES THE BUILDING"
        title={`Send ${letters.length} letters?`}
        body={
          <>
            Every entrant is emailed once per work they bid on, in the language they bid in. The winner&apos;s
            name is in no letter but their own. Type <strong>SEND-{letters.length}</strong> to confirm —
            the count has to match, so a list that changed since you read it cannot go by accident.
            <input style={inputStyle} value={typed} onChange={e => setTyped(e.target.value)}
                   placeholder={`SEND-${letters.length}`} />
          </>
        }
        confirmLabel="Send now"
        busyLabel="Sending…"
        busy={busy}
        tone="danger"
        onCancel={() => setConfirm(false)}
        onConfirm={send}
      />
      {toastNode}
    </>
  )
}

const lede: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: MUTED, opacity: .85, lineHeight: 1.7, maxWidth: 760, margin: '0 0 18px' }
const quiet: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: MUTED, opacity: .6, fontStyle: 'italic', padding: '12px 0' }
const warn: React.CSSProperties = { padding: '12px 14px', background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.16)', borderLeft: `2px solid ${GOLD}`, borderRadius: 4, fontFamily: MONO, fontSize: 11, color: MUTED, lineHeight: 1.7, marginBottom: 16, maxWidth: 820 }
const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: GOLD, letterSpacing: '0.20em', textTransform: 'uppercase', marginTop: 26, marginBottom: 10, paddingLeft: 10, borderLeft: `2px solid ${GOLD}` }
const row: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid rgba(229,212,194,0.08)' }
const pill: React.CSSProperties = { borderRadius: 999, border: '1px solid', padding: '2px 8px', fontFamily: MONO, fontSize: 8.5, letterSpacing: '.08em', textTransform: 'uppercase' }
const letterBox: React.CSSProperties = { padding: 14, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8, marginBottom: 10 }
const textarea: React.CSSProperties = { width: '100%', minHeight: 72, boxSizing: 'border-box', background: 'rgba(229,212,194,0.06)', color: CREAM, border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6, padding: '10px 12px', fontFamily: MONO, fontSize: 12, lineHeight: 1.7, outline: 'none', resize: 'vertical' }
const inputStyle: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: CREAM, border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '10px 12px', fontFamily: MONO, fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none', marginTop: 12 }
const btnGo: React.CSSProperties = { background: '#C27070', color: '#fff', border: 'none', borderRadius: 4, padding: '11px 22px', fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '.06em', cursor: 'pointer', marginTop: 20 }
const btnOff: React.CSSProperties = { ...btnGo, background: 'transparent', color: MUTED, border: '1px solid rgba(229,212,194,0.20)', cursor: 'default', opacity: .5 }
const link: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: GOLD, textDecoration: 'none', letterSpacing: '.06em', borderBottom: '1px solid rgba(212,184,90,0.35)' }
