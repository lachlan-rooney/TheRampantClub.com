'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import { closeLabel, money, stampLabel, timeLeft } from '@/lib/studio/auction'

// ═══════════════════════════════════════════════════════════════════════════
// THE SILENT AUCTION — the inside.
// ───────────────────────────────────────────────────────────────────────────
// The only surface anywhere that shows a reserve or a bidder. Everything here
// is read through /api/admin/studio/auction, which checks isAdmin() on every
// handler; the public page cannot reach any of it, because the tables grant
// anon nothing at all.
//
// ── ENGLISH ONLY, DELIBERATELY ────────────────────────────────────────────
// The guest-facing auction is fully bilingual. This screen is not: the owner
// and the staff who use it work in English, and a half-translated admin is
// worse than an English one. The Vietnamese that the PUBLIC sees is reviewed
// on its own screen — the link at the top.
// ═══════════════════════════════════════════════════════════════════════════

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const MUTED = '#B2AA98'
const DIM = '#7E7864'
const GOLD = '#D4B85A'
const SAGE = '#7AB07A'
const RUST = '#C27070'

interface Piece { id: string; title_en: string | null; title_vn: string | null; year: string | null; sort: number; image_path: string | null }
interface Bid {
  id: string; amount_usd: number; bidder_name: string; bidder_email: string; bidder_phone: string | null
  lang: string; share_price_consent: boolean; news_consent: boolean; created_at: string
  void: boolean; void_reason: string | null; confirmation_sent_at: string | null
}
interface Enquiry {
  id: string; name: string; email: string; phone: string | null; message: string | null
  lang: string; handled_at: string | null; created_at: string
}
interface Lot {
  id: string; piece_id: string; sort: number; title_vn: string | null
  kind: 'sale' | 'auction'; status: 'draft' | 'live' | 'sold'
  price_usd: number | null; price_note_en: string | null; price_note_vn: string | null
  starting_bid_usd: number | null; step_usd: number | null; reserve_usd: number | null
  donation_pct: number | null; donation_org: string | null
  sold_price_usd: number | null; sold_to: string | null; sold_on: string | null; sold_note: string | null
  closes_at: string | null
  piece: Piece | null; bids: Bid[]; enquiries: Enquiry[]
  bid_count: number; highest_usd: number | null
  leader: Bid | null; winner_shares_price: boolean | null; reserve_met: boolean
}
interface Auction {
  id: string; collaboration_id: string; closes_at: string; announce_at: string
  published: boolean; min_step_usd: number; confirm_multiple: number; vn_reviewed_at: string | null
}
interface Collab { id: string; slug: string; artist_name: string; title_en: string | null; status: string }

export default function AuctionAdmin() {
  const { showToast, toastNode } = useToast()
  const [collabs, setCollabs] = useState<Collab[]>([])
  const [sel, setSel] = useState<string>('')
  const [auction, setAuction] = useState<Auction | null>(null)
  const [lots, setLots] = useState<Lot[]>([])
  const [feed, setFeed] = useState<(Bid & { title: string })[]>([])
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState<string>(new Date().toISOString())
  const [voidTarget, setVoidTarget] = useState<Bid | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/admin/studio', { cache: 'no-store' }).then(r => r.json()).then(j => {
      const list: Collab[] = j.collaborations || []
      setCollabs(list)
      setSel(prev => prev || (list.find(c => c.status === 'live') || list[0])?.id || '')
    }).catch(() => { /* the picker just stays empty */ })
  }, [])

  const load = useCallback(async () => {
    if (!sel) return
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/studio/auction?collaboration=${sel}`, { cache: 'no-store' })
      const j = await r.json()
      setMissing(!!j.missing)
      setAuction(j.auction || null)
      setLots(j.lots || [])
      setFeed(j.feed || [])
      setNow(j.now || new Date().toISOString())
    } finally { setLoading(false) }
  }, [sel])
  useEffect(() => { load() }, [load])

  // The page keeps itself current while somebody watches the last minutes.
  useEffect(() => {
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const patchAuction = async (fields: Record<string, unknown>) => {
    if (!auction) return
    const r = await fetch('/api/admin/studio/auction', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auction_id: auction.id, fields }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { showToast(j.error || 'Could not save.', 'error'); return false }
    await load(); return true
  }
  const patchLot = async (id: string, fields: Record<string, unknown>) => {
    const r = await fetch('/api/admin/studio/auction', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lot_id: id, fields }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { showToast(j.error || 'Could not save.', 'error'); return }
    await load()
  }

  const doVoid = async () => {
    if (!voidTarget) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/studio/auction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void', bid_id: voidTarget.id, reason: voidReason }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); showToast(j.error || 'Could not void.', 'error'); return }
      setVoidTarget(null); setVoidReason('')
      showToast('Bid voided. It no longer counts towards the current highest.')
      await load()
    } finally { setBusy(false) }
  }

  const markEnquiry = async (id: string, handled: boolean) => {
    const r = await fetch('/api/admin/studio/auction', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: handled ? 'handled' : 'unhandled', enquiry_id: id }),
    })
    if (!r.ok) { showToast('Could not record that.', 'error'); return }
    await load()
  }

  const auctionLots = useMemo(() => lots.filter(l => l.kind === 'auction'), [lots])
  const pricedLots = useMemo(() => lots.filter(l => l.kind === 'sale' && l.status !== 'draft'), [lots])
  const openEnquiries = useMemo(
    () => lots.flatMap(l => l.enquiries || []).filter(e => !e.handled_at).length, [lots])
  const closed = auction ? Date.parse(now) >= Date.parse(auction.closes_at) : false
  // THE REMINDER. From the announcement hour, the admin says the draft is
  // ready to read — nothing is ever sent without somebody pressing Send.
  const announceDue = auction ? Date.parse(now) >= Date.parse(auction.announce_at) : false

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: CREAM, margin: 0 }}>Silent auction</h1>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
          <Link href="/admin/studio/auction/vn" style={linkStyle}>Vietnamese review →</Link>
          <Link href="/admin/studio" style={linkStyle}>The Studio →</Link>
        </div>
      </div>
      <p style={lede}>
        Bidders and reserves are visible here and nowhere else. The public page is served by a
        function that has no reserve and no bidder in it at all.
      </p>

      {missing && (
        <div style={{ ...warnBox, borderLeftColor: RUST }}>
          <strong style={{ color: RUST }}>The auction tables are not there yet.</strong><br />
          Run <code style={code}>db/studio_auction.sql</code> in the Supabase SQL editor, then reload this page.
        </div>
      )}

      {collabs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 22px' }}>
          {collabs.map(c => (
            <button key={c.id} onClick={() => setSel(c.id)}
                    style={{ ...tab, ...(c.id === sel ? tabOn : null) }}>
              {c.title_en || c.artist_name}{c.status === 'live' ? ' · live' : ''}
            </button>
          ))}
        </div>
      )}

      {loading && !auction && <div style={quiet}>Reading the room…</div>}

      {!loading && !missing && !auction && (
        <div style={warnBox}>
          No auction row for this exhibition. The seed block in{' '}
          <code style={code}>db/studio_auction.sql</code> creates one for the <em>live</em> exhibition only —
          run that block again with this one live, or insert a row by hand.
        </div>
      )}

      {auction && (
        <>
          {/* ══ THE SWITCH AND THE CLOCK ═══════════════════════════════ */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={sectionLabel}>Publication</div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: auction.published ? SAGE : MUTED }}>
                  {auction.published
                    ? 'Live — the auction block is on the public guide.'
                    : 'Not published — guests see no auction at all.'}
                </div>
                {!auction.published && (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: DIM, marginTop: 6, maxWidth: 560, lineHeight: 1.7 }}>
                    Publishing is refused until at least one work is set to Auction + Live and every
                    auction work has a starting bid — a bid form with no floor accepts US$1.
                  </div>
                )}
              </div>
              <button
                onClick={async () => {
                  const ok = await patchAuction({ published: !auction.published })
                  if (ok) showToast(auction.published ? 'Auction hidden from the public page.' : 'Auction published.')
                }}
                style={auction.published ? btnQuiet : btnGo}>
                {auction.published ? 'Unpublish' : 'Publish the auction'}
              </button>
            </div>

            <div style={{ height: 1, background: 'rgba(229,212,194,0.08)', margin: '18px 0' }} />

            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
              <Field label="Bidding closes" hint={closeLabel('en', auction.closes_at)}>
                <input type="datetime-local" style={input}
                       defaultValue={toLocalInput(auction.closes_at)}
                       onBlur={e => patchAuction({ closes_at: fromLocalInput(e.target.value) })} />
              </Field>
              <Field label="Winners announced" hint={closeLabel('en', auction.announce_at)}>
                <input type="datetime-local" style={input}
                       defaultValue={toLocalInput(auction.announce_at)}
                       onBlur={e => patchAuction({ announce_at: fromLocalInput(e.target.value) })} />
              </Field>
              <Field label="Minimum step (US$)" hint="The smallest raise over the current highest.">
                <input type="number" min={1} style={input} defaultValue={auction.min_step_usd}
                       onBlur={e => patchAuction({ min_step_usd: Math.max(1, Number(e.target.value) || 1) })} />
              </Field>
              <Field label="Ask to confirm above" hint={`× the current highest. Now ${auction.confirm_multiple}×.`}>
                <input type="number" min={2} step={1} style={input} defaultValue={auction.confirm_multiple}
                       onBlur={e => patchAuction({ confirm_multiple: Math.max(2, Number(e.target.value) || 5) })} />
              </Field>
            </div>

            {/* ⚠ THE DATETIME FIELD IS THE BROWSER'S LOCAL TIME. On a laptop
                set to Ho Chi Minh they are the same; on one set to London they
                are not, and seven hours would vanish silently. The line under
                each field prints the instant back in Ho Chi Minh time, which
                is the only reading that matters. */}
            <div style={{ fontFamily: MONO, fontSize: 10, color: DIM, marginTop: 12, lineHeight: 1.7 }}>
              The two fields above use <em>this computer&apos;s</em> timezone. The grey line under each one
              shows what the guest will be told, in Ho Chi Minh time — read that, not the box.
            </div>
          </div>

          {/* ══ THE ANNOUNCEMENT REMINDER ═════════════════════════════ */}
          {announceDue && (
            <div style={{ ...warnBox, borderLeftColor: GOLD, marginTop: 16 }}>
              <strong style={{ color: GOLD }}>The results draft is ready to read.</strong><br />
              It was due at {closeLabel('en', auction.announce_at)}. Nothing has been sent and nothing
              will be: open the draft, read every line, and press Send yourself.
              <div style={{ marginTop: 10 }}>
                <Link href="/admin/studio/auction/announce" style={linkStyle}>Open the announcement draft →</Link>
              </div>
            </div>
          )}

          {/* ══ THE RESULTS, ONCE IT HAS CLOSED ═══════════════════════ */}
          {closed && auctionLots.length > 0 && (
            <div style={{ ...panel, marginTop: 16 }}>
              <div style={sectionLabel}>Results — the {auctionLots.length} together</div>
              {auctionLots.map(l => (
                <div key={l.id} style={resultRow}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontFamily: SERIF, fontSize: 16, color: CREAM }}>
                      {l.piece?.title_en || 'Untitled'}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, color: DIM, marginTop: 3 }}>
                      {l.bid_count} bid{l.bid_count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ flex: '0 0 190px', fontFamily: MONO, fontSize: 11.5, color: MUTED }}>
                    {l.leader ? <>Winner: <span style={{ color: CREAM }}>{l.leader.bidder_name}</span></> : 'No bids'}
                  </div>
                  <div style={{ flex: '0 0 110px', fontFamily: MONO, fontSize: 12, color: CREAM, textAlign: 'right' }}>
                    {money(l.highest_usd)}
                  </div>
                  <div style={{ flex: '0 0 130px', textAlign: 'right' }}>
                    <span style={{ ...pill, color: l.reserve_met ? SAGE : RUST, borderColor: (l.reserve_met ? SAGE : RUST) + '55' }}>
                      {l.reserve_met ? 'reserve met' : 'reserve not met'}
                    </span>
                  </div>
                  {/* THE WINNER'S CHOICE, beside the result, so the draft
                      holds no surprises when it is read. */}
                  <div style={{ flex: '0 0 210px', textAlign: 'right', fontFamily: MONO, fontSize: 10.5, color: DIM }}>
                    {l.leader
                      ? (l.winner_shares_price
                          ? 'winner allows the price to be shared'
                          : 'winner did NOT allow the price — others are told only that it was won')
                      : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ THE ONE SCREEN ════════════════════════════════════════
              Everything at a glance before any of it can be edited: the
              auction works with where they stand, then the priced ones with
              their enquiries. The editors are below; this is the view for
              standing in the room with a tablet. */}
          {auctionLots.length > 0 && (
            <div style={{ ...panel, marginTop: 16 }}>
              <div style={{ ...sectionLabel, marginTop: 0 }}>
                In the auction — {auctionLots.length}
              </div>
              {auctionLots.map(l => {
                const left = timeLeft('en', l.closes_at || auction.closes_at, Date.parse(now))
                return (
                  <div key={l.id} style={resultRow}>
                    <div style={{ flex: 1, minWidth: 150, fontFamily: SERIF, fontSize: 16, color: CREAM }}>
                      {l.piece?.title_en || 'Untitled'}
                      {l.status !== 'live' && (
                        <span style={{ ...pill, color: MUTED, borderColor: 'rgba(229,212,194,0.25)', marginLeft: 8 }}>{l.status}</span>
                      )}
                    </div>
                    <div style={{ flex: '0 0 104px', fontFamily: MONO, fontSize: 12.5, color: CREAM, textAlign: 'right' }}>
                      {l.highest_usd != null ? money(l.highest_usd) : <span style={{ color: DIM }}>no bids</span>}
                    </div>
                    <div style={{ flex: '0 0 62px', fontFamily: MONO, fontSize: 10.5, color: DIM, textAlign: 'right' }}>
                      {l.bid_count} bid{l.bid_count === 1 ? '' : 's'}
                    </div>
                    {/* ⚠ THE ONLY SCREEN IN THE PRODUCT THAT PRINTS A RESERVE. */}
                    <div style={{ flex: '0 0 96px', fontFamily: MONO, fontSize: 11, color: GOLD, textAlign: 'right' }}>
                      {l.reserve_usd != null ? money(l.reserve_usd) : '—'}
                    </div>
                    <div style={{ flex: '0 0 124px', textAlign: 'right' }}>
                      <span style={{ ...pill, color: l.reserve_met ? SAGE : RUST, borderColor: (l.reserve_met ? SAGE : RUST) + '55' }}>
                        {l.reserve_met ? 'reserve met' : 'not met'}
                      </span>
                    </div>
                    <div style={{ flex: '0 0 110px', fontFamily: MONO, fontSize: 10.5, color: left ? MUTED : RUST, textAlign: 'right' }}>
                      {left ? `${left} left` : 'closed'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {pricedLots.length > 0 && (
            <div style={panel}>
              <div style={{ ...sectionLabel, marginTop: 0 }}>
                Priced — {pricedLots.length}
                {openEnquiries > 0 && (
                  <span style={{ ...pill, color: GOLD, borderColor: GOLD + '55', marginLeft: 10 }}>
                    {openEnquiries} enquiry{openEnquiries === 1 ? '' : ' / enquiries'} to answer
                  </span>
                )}
              </div>
              {pricedLots.map(l => (
                <div key={l.id} style={resultRow}>
                  <div style={{ flex: 1, minWidth: 150, fontFamily: SERIF, fontSize: 16, color: CREAM }}>
                    {l.piece?.title_en || 'Untitled'}
                  </div>
                  <div style={{ flex: '0 0 120px', fontFamily: MONO, fontSize: 12.5, color: CREAM, textAlign: 'right' }}>
                    {l.status === 'sold' ? money(l.sold_price_usd ?? l.price_usd) : money(l.price_usd)}
                  </div>
                  <div style={{ flex: '0 0 92px', fontFamily: MONO, fontSize: 10.5, color: DIM, textAlign: 'right' }}>
                    {(l.enquiries || []).length} enq.
                  </div>
                  <div style={{ flex: '0 0 150px', textAlign: 'right' }}>
                    {l.status === 'sold'
                      ? <>
                          <span style={{ ...pill, color: SAGE, borderColor: SAGE + '55' }}>sold</span>
                          <button style={{ ...mini, marginLeft: 8 }} onClick={() => patchLot(l.id, { status: 'live' })}>
                            unmark
                          </button>
                        </>
                      : <button style={mini} onClick={() => patchLot(l.id, { status: 'sold' })}>mark sold</button>}
                  </div>
                </div>
              ))}
              <div style={{ fontFamily: MONO, fontSize: 10, color: DIM, marginTop: 10, lineHeight: 1.7 }}>
                A sold work shows the word Sold and nothing else — no price and no enquiry control. The
                figure it went for is withheld by the database, not hidden by the page.
              </div>
            </div>
          )}

          {/* ══ THE FEED — for watching during the opening ═════════════ */}
          {feed.length > 0 && (
            <div style={panel}>
              <div style={{ ...sectionLabel, marginTop: 0 }}>Every bid, newest first</div>
              {feed.slice(0, 40).map(b => (
                <div key={b.id} style={{ ...bidRow, opacity: b.void ? .45 : 1 }}>
                  <span style={{ flex: '0 0 86px', fontFamily: MONO, fontSize: 12, color: CREAM,
                                 textDecoration: b.void ? 'line-through' : 'none' }}>
                    {money(b.amount_usd)}
                  </span>
                  <span style={{ flex: '1 1 150px', fontFamily: SERIF, fontSize: 14, color: CREAM }}>{b.title}</span>
                  <span style={{ flex: '0 0 150px', fontFamily: MONO, fontSize: 11, color: MUTED }}>{b.bidder_name}</span>
                  <span style={{ flex: '0 0 170px', fontFamily: MONO, fontSize: 10, color: DIM, textAlign: 'right' }}>
                    {stampLabel('en', b.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ══ THE WORKS, ONE BY ONE ═════════════════════════════════ */}
          <div style={sectionLabel}>The works — {lots.length} on the wall</div>
          {lots.length === 0 && (
            <div style={warnBox}>
              No lots. Run the seed block at the foot of <code style={code}>db/studio_auction.sql</code>.
            </div>
          )}

          {lots.map(l => (
            <div key={l.id} style={panel}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {l.piece?.image_path && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={l.piece.image_path} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, flex: 'none' }} />
                )}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: DIM, letterSpacing: '.12em' }}>
                    #{(l.piece?.sort ?? 0) + 1} · anchor <code style={code}>#piece-{(l.piece?.sort ?? 0) + 1}</code>
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: 19, color: CREAM, marginTop: 4 }}>
                    {l.piece?.title_en || 'Untitled'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: DIM, marginTop: 2 }}>
                    {l.piece?.year || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['sale', 'auction'] as const).map(k => (
                    <button key={k} onClick={() => patchLot(l.id, { kind: k })}
                            style={{ ...chip, ...(l.kind === k ? chipOn : null) }}>{k}</button>
                  ))}
                  {(['draft', 'live', 'sold'] as const).map(s => (
                    <button key={s} onClick={() => patchLot(l.id, { status: s })}
                            style={{ ...chip, ...(l.status === s ? chipOn : null) }}>{s}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginTop: 14 }}>
                <Field label="Vietnamese title (optional)" hint="Titles are proper names; leave blank to print the English.">
                  <input style={input} defaultValue={l.title_vn || ''}
                         onBlur={e => patchLot(l.id, { title_vn: e.target.value.trim() || null })} />
                </Field>
                {l.kind === 'sale' ? (
                  <>
                    <Field label="Price (US$)" hint="Shown under the work. Withheld once it is marked sold.">
                      <input type="number" min={1} style={input} defaultValue={l.price_usd ?? ''}
                             onBlur={e => patchLot(l.id, { price_usd: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                    <Field label="Price note" hint='e.g. "Sold as a pair". Shown beside the figure.'>
                      <input style={input} defaultValue={l.price_note_en || ''}
                             onBlur={e => patchLot(l.id, { price_note_en: e.target.value.trim() || null })} />
                    </Field>
                    <Field label="Price note · Vietnamese" hint="Leave blank to print the English.">
                      <input style={input} defaultValue={l.price_note_vn || ''}
                             onBlur={e => patchLot(l.id, { price_note_vn: e.target.value.trim() || null })} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Starting bid (US$)" hint="The floor. The first bid must reach it.">
                      <input type="number" min={1} style={input} defaultValue={l.starting_bid_usd ?? ''}
                             onBlur={e => patchLot(l.id, { starting_bid_usd: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                    {/* PER WORK. The small canvas does not raise in the same
                        steps as the large ones; blank falls back to the
                        auction-wide figure above. */}
                    <Field label="Step for this work (US$)"
                           hint={`Every later bid must clear the highest by this. Blank = ${money(auction.min_step_usd)}.`}>
                      <input type="number" min={1} style={input} defaultValue={l.step_usd ?? ''}
                             onBlur={e => patchLot(l.id, { step_usd: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                    <Field label="Reserve (US$) — never public" hint="Guests see met or not met, never the number.">
                      <input type="number" min={1} style={{ ...input, borderColor: 'rgba(212,184,90,0.35)' }}
                             defaultValue={l.reserve_usd ?? ''}
                             onBlur={e => patchLot(l.id, { reserve_usd: e.target.value ? Number(e.target.value) : null })} />
                    </Field>
                  </>
                )}
              </div>

              {/* ══ THE DONATION SHARE ══════════════════════════════
                  Set a percentage and the guide states the figure under the
                  work. Leave it blank and the work keeps the sentence it
                  already has — "a significant portion", which is what you say
                  before the share is decided. The two are never shown
                  together: one of them would be out of date. */}
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginTop: 12 }}>
                <Field label="Donation share (%)"
                       hint={l.donation_pct && l.donation_org
                         ? `Public: "${l.donation_pct}% of the price this work reaches is donated to ${l.donation_org}."`
                         : 'Blank — the work keeps its existing beneficiary sentence.'}>
                  <input type="number" min={1} max={100} step={1} style={input} defaultValue={l.donation_pct ?? ''}
                         onBlur={e => patchLot(l.id, { donation_pct: e.target.value ? Number(e.target.value) : null })} />
                </Field>
                <Field label="Donated to" hint="The name as it should read in both languages.">
                  <input style={input} defaultValue={l.donation_org || ''}
                         onBlur={e => patchLot(l.id, { donation_org: e.target.value.trim() || null })} />
                </Field>
              </div>

              {/* ══ THE SALE RECORD, once a work is sold ════════════
                  None of this is public: the guest sees the word Sold. It is
                  here so the club knows what went where, and the buyer's name
                  is in no API response anywhere. */}
              {l.status === 'sold' && (
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                              marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(229,212,194,0.08)' }}>
                  <Field label="Sold for (US$)" hint="Never shown to the public.">
                    <input type="number" min={1} style={input} defaultValue={l.sold_price_usd ?? ''}
                           onBlur={e => patchLot(l.id, { sold_price_usd: e.target.value ? Number(e.target.value) : null })} />
                  </Field>
                  <Field label="Buyer" hint="Private. Admin only, by design.">
                    <input style={input} defaultValue={l.sold_to || ''}
                           onBlur={e => patchLot(l.id, { sold_to: e.target.value.trim() || null })} />
                  </Field>
                  <Field label="Date sold">
                    <input type="date" style={input} defaultValue={l.sold_on || ''}
                           onBlur={e => patchLot(l.id, { sold_on: e.target.value || null })} />
                  </Field>
                  <Field label="Note" hint="Anything worth remembering about the sale.">
                    <input style={input} defaultValue={l.sold_note || ''}
                           onBlur={e => patchLot(l.id, { sold_note: e.target.value.trim() || null })} />
                  </Field>
                </div>
              )}

              {/* ══ ENQUIRIES on a priced work ══════════════════════ */}
              {l.kind === 'sale' && (l.enquiries || []).length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(229,212,194,0.08)' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: DIM, letterSpacing: '.12em', textTransform: 'uppercase' }}>
                    Enquiries — newest first
                  </span>
                  {(l.enquiries || []).map(e => (
                    <div key={e.id} style={{ ...bidRow, opacity: e.handled_at ? .5 : 1 }}>
                      <span style={{ flex: '1 1 150px', fontFamily: MONO, fontSize: 11.5, color: CREAM }}>{e.name}</span>
                      <span style={{ flex: '0 0 230px', fontFamily: MONO, fontSize: 10.5, color: MUTED, wordBreak: 'break-all' }}>
                        {e.email}{e.phone ? ` · ${e.phone}` : ''}
                      </span>
                      <span style={{ flex: '0 0 170px', fontFamily: MONO, fontSize: 10, color: DIM }}>
                        {stampLabel('en', e.created_at)}
                      </span>
                      <span style={{ flex: '0 0 46px', fontFamily: MONO, fontSize: 9.5, color: DIM, textAlign: 'right' }}>
                        {e.lang.toUpperCase()}
                      </span>
                      <span style={{ flex: '0 0 86px', textAlign: 'right' }}>
                        <button style={mini} onClick={() => markEnquiry(e.id, !e.handled_at)}>
                          {e.handled_at ? 'reopen' : 'answered'}
                        </button>
                      </span>
                      {e.message && (
                        <span style={{ flex: '1 0 100%', fontFamily: MONO, fontSize: 10.5, color: MUTED,
                                       paddingTop: 4, whiteSpace: 'pre-wrap' }}>
                          {e.message}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ══ THE BIDS ════════════════════════════════════════ */}
              {l.kind === 'auction' && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(229,212,194,0.08)' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: DIM, letterSpacing: '.12em', textTransform: 'uppercase' }}>
                      Bids — newest first
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: CREAM }}>
                      {l.highest_usd != null ? `Leader ${money(l.highest_usd)}` : 'No bids yet'}
                    </span>
                    <span style={{ ...pill, color: l.reserve_met ? SAGE : RUST, borderColor: (l.reserve_met ? SAGE : RUST) + '55' }}>
                      {l.reserve_met ? 'reserve met' : 'reserve not met'}
                    </span>
                  </div>

                  {l.bids.length === 0 && <div style={quiet}>Nothing yet.</div>}

                  {l.bids.map(bd => {
                    const isLeader = l.leader?.id === bd.id
                    return (
                      <div key={bd.id} style={{ ...bidRow, opacity: bd.void ? 0.45 : 1 }}>
                        <span style={{ flex: '0 0 96px', fontFamily: MONO, fontSize: 12.5, color: bd.void ? MUTED : CREAM, textDecoration: bd.void ? 'line-through' : 'none' }}>
                          {money(bd.amount_usd)}
                        </span>
                        <span style={{ flex: 1, minWidth: 150, fontFamily: MONO, fontSize: 11.5, color: CREAM }}>
                          {bd.bidder_name}
                          {isLeader && !bd.void && <span style={{ ...pill, color: GOLD, borderColor: GOLD + '55', marginLeft: 8 }}>leader</span>}
                        </span>
                        <span style={{ flex: '0 0 230px', fontFamily: MONO, fontSize: 10.5, color: MUTED, wordBreak: 'break-all' }}>
                          {bd.bidder_email}{bd.bidder_phone ? ` · ${bd.bidder_phone}` : ''}
                        </span>
                        <span style={{ flex: '0 0 170px', fontFamily: MONO, fontSize: 10, color: DIM }}>
                          {stampLabel('en', bd.created_at)}
                        </span>
                        <span style={{ flex: '0 0 92px', fontFamily: MONO, fontSize: 9.5, color: DIM, textAlign: 'right' }}>
                          {bd.lang.toUpperCase()}
                          {bd.share_price_consent ? ' · shares' : ' · private'}
                          {!bd.confirmation_sent_at && <span style={{ color: RUST }}> · no email</span>}
                        </span>
                        <span style={{ flex: '0 0 70px', textAlign: 'right' }}>
                          {bd.void
                            ? <button style={mini} onClick={async () => {
                                await fetch('/api/admin/studio/auction', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'unvoid', bid_id: bd.id }) })
                                await load()
                              }}>restore</button>
                            : <button style={{ ...mini, color: RUST, borderColor: RUST + '55' }}
                                      onClick={() => { setVoidTarget(bd); setVoidReason('') }}>void</button>}
                        </span>
                        {bd.void && bd.void_reason && (
                          <span style={{ flex: '1 0 100%', fontFamily: MONO, fontSize: 10, color: DIM, paddingTop: 4 }}>
                            voided — {bd.void_reason}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <ConfirmModal
        open={!!voidTarget}
        eyebrow="⚠ THE PUBLIC FIGURE WILL CHANGE"
        title="Void this bid?"
        subject={voidTarget ? `${money(voidTarget.amount_usd)} — ${voidTarget.bidder_name}` : undefined}
        body={
          <>
            It drops out of the current highest immediately and out of the ranking. Nothing is deleted:
            the bid, who voided it and why all stay on the record.
            <input style={{ ...input, marginTop: 12, width: '100%' }} placeholder="Why? (stored on the bid)"
                   value={voidReason} onChange={e => setVoidReason(e.target.value)} />
          </>
        }
        confirmLabel="Void the bid"
        busyLabel="Voiding…"
        busy={busy}
        onCancel={() => setVoidTarget(null)}
        onConfirm={doVoid}
      />
      {toastNode}
    </>
  )
}

// ⚠ datetime-local speaks the BROWSER's timezone and has no offset in it. These
// two convert through the local clock on purpose and the UI prints the result
// back in Ho Chi Minh time beneath the field — the round trip that silently ate
// seven hours on the shift rota is the same shape of bug.
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: MUTED, marginBottom: 5 }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, color: DIM, marginTop: 4, lineHeight: 1.6 }}>{hint}</span>}
    </label>
  )
}

const lede: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: MUTED, opacity: .85, lineHeight: 1.7, maxWidth: 720, margin: '0 0 18px' }
const quiet: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: MUTED, opacity: .6, fontStyle: 'italic', padding: '10px 0' }
const panel: React.CSSProperties = { padding: 18, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8, marginBottom: 14 }
const sectionLabel: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: GOLD, letterSpacing: '0.20em', textTransform: 'uppercase', marginTop: 22, marginBottom: 12, paddingLeft: 10, borderLeft: `2px solid ${GOLD}` }
const warnBox: React.CSSProperties = { padding: '12px 14px', background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.16)', borderLeft: `2px solid ${GOLD}`, borderRadius: 4, fontFamily: MONO, fontSize: 11, color: MUTED, lineHeight: 1.7, marginBottom: 14 }
const input: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: CREAM, border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8, padding: '9px 12px', fontFamily: MONO, fontSize: 12, boxSizing: 'border-box', outline: 'none', width: '100%' }
const tab: React.CSSProperties = { background: 'transparent', color: MUTED, border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4, padding: '7px 13px', fontFamily: MONO, fontSize: 11, cursor: 'pointer' }
const tabOn: React.CSSProperties = { color: CREAM, background: 'rgba(212,184,90,0.10)', borderColor: GOLD }
const chip: React.CSSProperties = { background: 'transparent', color: MUTED, border: '1px solid rgba(229,212,194,0.18)', borderRadius: 999, padding: '4px 11px', fontFamily: MONO, fontSize: 10, letterSpacing: '.06em', cursor: 'pointer' }
const chipOn: React.CSSProperties = { color: '#052E20', background: GOLD, borderColor: GOLD, fontWeight: 600 }
const pill: React.CSSProperties = { borderRadius: 999, border: '1px solid', padding: '2px 8px', fontFamily: MONO, fontSize: 8.5, letterSpacing: '.08em', textTransform: 'uppercase' }
const mini: React.CSSProperties = { background: 'transparent', color: MUTED, border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4, padding: '3px 8px', fontFamily: MONO, fontSize: 9.5, cursor: 'pointer' }
const btnGo: React.CSSProperties = { background: '#5E8A5E', color: '#fff', border: 'none', borderRadius: 4, padding: '9px 18px', fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '.06em', cursor: 'pointer' }
const btnQuiet: React.CSSProperties = { background: 'transparent', color: MUTED, border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4, padding: '9px 18px', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', cursor: 'pointer' }
const linkStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: GOLD, textDecoration: 'none', letterSpacing: '.06em', borderBottom: '1px solid rgba(212,184,90,0.35)' }
const code: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, color: GOLD }
const resultRow: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 0', borderTop: '1px solid rgba(229,212,194,0.08)' }
const bidRow: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '9px 0', borderTop: '1px solid rgba(229,212,194,0.06)' }
