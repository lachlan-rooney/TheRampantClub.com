'use client'

// Admin → Member Cards
//
// HID-mode card reader. The Tagtix CK06 (and most cheap USB NFC readers) emulate
// a keyboard: when a card is tapped, the reader "types" the UID followed by Enter.
// We listen globally for keypresses, accumulate the buffer, and treat any
// alphanumeric run terminated by Enter (or 250ms of silence) as a UID.

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/admin-lang'

interface CardLink {
  member_number: string
  card_uid: string
  credit_vnd: number
  linked_at: string
}
interface SheetMember {
  member_number: string
  full_name: string
  tier: string
  card_uid: string | null
  credit_vnd: number
}
interface Transaction {
  id: string
  amount_vnd: number
  kind: 'topup' | 'charge' | 'adjust' | 'refund'
  note: string | null
  staff_email: string | null
  balance_after_vnd: number
  created_at: string
}

const fmt = (vnd: number) => new Intl.NumberFormat('en-US').format(vnd) + ' ₫'

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
  padding: '8px 12px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
}
const btnStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none',
  borderRadius: 6, padding: '8px 18px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
}
const btnPrimary: React.CSSProperties = { ...btnStyle, background: '#5E6650' }
const btnDanger: React.CSSProperties = { ...btnStyle, background: 'rgba(180, 70, 70, 0.2)' }

export default function AdminCards() {
  const { t } = useLang()
  const [uid, setUid] = useState<string | null>(null)
  const [link, setLink] = useState<CardLink | null>(null)
  const [member, setMember] = useState<Record<string, string> | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [members, setMembers] = useState<SheetMember[]>([])
  const [pickerNumber, setPickerNumber] = useState('')
  const [topupAmount, setTopupAmount] = useState('')
  const [chargeAmount, setChargeAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [listening, setListening] = useState(true)
  const [orphans, setOrphans] = useState<{ member_number: string; card_uid: string | null; credit_vnd: number; expires_at: string | null; updated_at: string }[]>([])
  const [showOrphans, setShowOrphans] = useState(false)

  const bufferRef = useRef('')
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  const loadMembers = async () => {
    const r = await fetch('/api/admin/cards/members', { cache: 'no-store' })
    const d = await r.json()
    setMembers(d.members || [])
  }
  const loadOrphans = async () => {
    const r = await fetch('/api/admin/cards/orphans')
    const d = await r.json()
    setOrphans(d.orphans || [])
  }
  useEffect(() => { loadMembers(); loadOrphans() }, [])

  // Confirm-modal state — three destructive paths route through it:
  //   • purge  → wipe credit account + transaction history (most destructive)
  //   • unlink → release a card from its member (moderate; balance kept)
  //   • relink → reassign a card from one member to another (moderate)
  const [confirmModal, setConfirmModal] = useState<
    | { kind: 'purge'; memberNumber: string; memberName: string }
    | { kind: 'unlink'; uid: string; memberName: string }
    | { kind: 'relink'; uid: string; fromName: string; fromBalance: number; toNumber: string; toName: string }
    | null
  >(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const closeConfirm = () => { if (!confirmBusy) setConfirmModal(null) }

  const purgeAccount = (memberNumber: string) => {
    const memberName = members.find(m => m.member_number === memberNumber)?.full_name || memberNumber
    setConfirmModal({ kind: 'purge', memberNumber, memberName })
  }

  const runPurge = async (memberNumber: string) => {
    setBusy(true)
    const r = await fetch('/api/admin/cards/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_number: memberNumber }),
    })
    setBusy(false)
    if (r.ok) {
      showToast(t('Account purged', 'Đã xóa tài khoản'))
      loadOrphans(); loadMembers()
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`${t('Purge failed', 'Xóa thất bại')}: ${d.error || r.statusText}`)
    }
  }

  // Card-reader keystroke listener
  useEffect(() => {
    const ALNUM = /^[0-9A-Za-z]$/
    const flush = () => {
      const buf = bufferRef.current
      bufferRef.current = ''
      flushTimerRef.current = null
      if (!buf || buf.length < 4) return
      handleScan(buf.toUpperCase())
    }
    const onKey = (e: KeyboardEvent) => {
      if (!listening) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Enter') {
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
        flush()
        return
      }
      if (e.key.length === 1 && ALNUM.test(e.key)) {
        bufferRef.current += e.key
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
        flushTimerRef.current = setTimeout(flush, 250)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

  const handleScan = async (scannedUid: string) => {
    setUid(scannedUid)
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/cards/lookup?uid=${encodeURIComponent(scannedUid)}`)
      const d = await r.json()
      setLink(d.link || null)
      setMember(d.member || null)
      setTxs(d.transactions || [])
      setPickerNumber('')

      // Log presence so the members portal "X in clubhouse" is live.
      if (d.link?.member_number) {
        fetch('/api/admin/cards/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_number: d.link.member_number }),
        }).catch(() => {})
      }
    } catch {
      showToast(t('Lookup failed', 'Tra cứu thất bại'))
    } finally {
      setBusy(false)
    }
  }

  const linkCard = async () => {
    if (!uid || !pickerNumber) return
    // Confirm before stealing a card from another member.
    const currentOwner = members.find(m => m.card_uid === uid && m.member_number !== pickerNumber)
    if (currentOwner) {
      setConfirmModal({
        kind: 'relink',
        uid,
        fromName:    `${currentOwner.full_name} (${currentOwner.member_number})`,
        fromBalance: currentOwner.credit_vnd,
        toNumber:    pickerNumber,
        toName:      members.find(m => m.member_number === pickerNumber)?.full_name || pickerNumber,
      })
      return
    }
    await doLinkCard(uid, pickerNumber)
  }

  const doLinkCard = async (linkUid: string, memberNumber: string) => {
    setBusy(true)
    const r = await fetch('/api/admin/cards/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: linkUid, member_number: memberNumber }),
    })
    setBusy(false)
    if (r.ok) {
      showToast(t('Card linked', 'Đã liên kết thẻ'))
      handleScan(linkUid)
      loadMembers()
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`${t('Link failed', 'Liên kết thất bại')}: ${d.error || r.statusText}`)
    }
  }

  const unlinkCard = () => {
    if (!uid) return
    const owner = members.find(m => m.card_uid === uid)
    setConfirmModal({
      kind: 'unlink',
      uid,
      memberName: owner ? `${owner.full_name} (${owner.member_number})` : t('unknown member', 'thành viên không xác định'),
    })
  }

  const doUnlinkCard = async (unlinkUid: string) => {
    setBusy(true)
    const r = await fetch('/api/admin/cards/link', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: unlinkUid }),
    })
    setBusy(false)
    if (r.ok) {
      showToast(t('Card unlinked', 'Đã hủy liên kết thẻ'))
      handleScan(unlinkUid)
      loadMembers()
    }
  }

  const runConfirm = async () => {
    if (!confirmModal) return
    setConfirmBusy(true)
    try {
      if (confirmModal.kind === 'purge') {
        await runPurge(confirmModal.memberNumber)
      } else if (confirmModal.kind === 'unlink') {
        await doUnlinkCard(confirmModal.uid)
      } else if (confirmModal.kind === 'relink') {
        await doLinkCard(confirmModal.uid, confirmModal.toNumber)
      }
      setConfirmModal(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  const transact = async (kind: 'topup' | 'charge', amountStr: string) => {
    if (!link) return
    const amt = parseInt(amountStr.replace(/[^0-9]/g, ''))
    if (!amt || amt <= 0) { showToast(t('Enter an amount', 'Nhập số tiền')); return }
    setBusy(true)
    const r = await fetch('/api/admin/cards/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_number: link.member_number,
        kind,
        amount_vnd: amt,
        note: note || null,
      }),
    })
    setBusy(false)
    if (r.ok) {
      const d = await r.json()
      showToast(kind === 'topup' ? `${t('Topped up', 'Đã nạp')} ${fmt(amt)}` : `${t('Charged', 'Đã trừ')} ${fmt(amt)}`)
      setLink(l => l ? { ...l, credit_vnd: d.balance_vnd } : l)
      setTopupAmount(''); setChargeAmount(''); setNote('')
      // Refresh history
      if (uid) {
        const lr = await fetch(`/api/admin/cards/lookup?uid=${encodeURIComponent(uid)}`)
        const ld = await lr.json()
        setTxs(ld.transactions || [])
      }
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`${t('Failed', 'Thất bại')}: ${d.error || r.statusText}`)
    }
  }

  const reset = () => {
    setUid(null); setLink(null); setMember(null); setTxs([]); setPickerNumber('')
    setTopupAmount(''); setChargeAmount(''); setNote('')
  }

  return (
    <>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 8 }}>
        {t('Member Cards', 'Thẻ hội viên')}
      </h1>
      <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 24, lineHeight: 1.6, maxWidth: 640 }}>
        {t('Tap a member card on the USB reader to view balance, top up, or charge. Cards link to members from the Google Sheet roster by Member No.', 'Chạm thẻ hội viên lên đầu đọc USB để xem số dư, nạp tiền hoặc trừ tiền. Thẻ được liên kết với hội viên từ danh sách Google Sheet theo Số hội viên.')}
      </p>

      {/* Listening pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', marginBottom: 24,
        background: 'rgba(229,212,194,0.04)',
        border: '1px solid rgba(229,212,194,0.08)',
        borderRadius: 8, justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: listening ? '#7AB07A' : '#B2AA98',
            boxShadow: listening ? '0 0 8px #7AB07A' : 'none',
          }} />
          <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#E5D4C2' }}>
            {listening ? t('Listening for card taps', 'Đang chờ chạm thẻ') : t('Paused', 'Đã tạm dừng')}
          </span>
        </div>
        <button onClick={() => setListening(l => !l)} style={btnStyle}>
          {listening ? t('Pause', 'Tạm dừng') : t('Resume', 'Tiếp tục')}
        </button>
      </div>

      {!uid ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          background: 'rgba(229,212,194,0.04)',
          border: '1px dashed rgba(229,212,194,0.15)',
          borderRadius: 12,
        }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', opacity: 0.8, marginBottom: 8 }}>
            {t('Place a card on the reader', 'Đặt thẻ lên đầu đọc')}
          </div>
          <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', opacity: 0.7 }}>
            {t('Make sure this page has focus, then tap.', 'Đảm bảo trang này đang được chọn, rồi chạm thẻ.')}
          </div>
        </div>
      ) : (
        <div style={{
          padding: 24,
          background: 'rgba(229,212,194,0.04)',
          border: '1px solid rgba(229,212,194,0.1)',
          borderRadius: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <label style={labelStyle}>{t('Card UID', 'Mã UID thẻ')}</label>
              <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 20, color: '#E5D4C2', letterSpacing: '0.05em' }}>
                {uid}
              </div>
            </div>
            <button onClick={reset} style={btnStyle}>{t('Clear', 'Xóa')}</button>
          </div>

          {link ? (
            <>
              {/* Member + balance */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>{t('Linked member', 'Hội viên liên kết')}</label>
                  {member ? (
                    <>
                      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 20, color: '#E5D4C2', marginBottom: 4 }}>
                        {member['Full Name']}
                      </div>
                      <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98' }}>
                        {member['Member No.']} · {member['Tier']}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2', marginBottom: 4 }}>
                        {t('Member', 'Hội viên')} {link.member_number}
                      </div>
                      <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#D4B85A' }}>
                        {t('Sheet lookup failed — name unavailable', 'Tra cứu bảng tính thất bại — không có tên')}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ ...labelStyle, textAlign: 'right' }}>{t('Credit balance', 'Số dư tín dụng')}</label>
                  <div style={{
                    fontFamily: "'Rampant Sans', serif", fontSize: 32,
                    color: link.credit_vnd > 0 ? '#7AB07A' : link.credit_vnd < 0 ? '#B45656' : '#E5D4C2',
                  }}>
                    {fmt(link.credit_vnd)}
                  </div>
                </div>
              </div>

              {/* Top up + charge */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>{t('Top up (VND)', 'Nạp tiền (VND)')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text" inputMode="numeric"
                      style={inputStyle}
                      placeholder={t('e.g. 500000', 'ví dụ 500000')}
                      value={topupAmount}
                      onChange={e => setTopupAmount(e.target.value)}
                    />
                    <button
                      onClick={() => transact('topup', topupAmount)}
                      disabled={busy || !topupAmount}
                      style={btnPrimary}
                    >{t('Top up', 'Nạp tiền')}</button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{t('Charge (VND)', 'Trừ tiền (VND)')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text" inputMode="numeric"
                      style={inputStyle}
                      placeholder={t('e.g. 120000', 'ví dụ 120000')}
                      value={chargeAmount}
                      onChange={e => setChargeAmount(e.target.value)}
                    />
                    <button
                      onClick={() => transact('charge', chargeAmount)}
                      disabled={busy || !chargeAmount}
                      style={btnDanger}
                    >{t('Charge', 'Trừ tiền')}</button>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>{t('Note (optional, attached to next transaction)', 'Ghi chú (tùy chọn, đính kèm giao dịch tiếp theo)')}</label>
                <input
                  style={inputStyle}
                  placeholder={t('e.g. Kitchen — 2 drams Lagavulin', 'ví dụ Bếp — 2 ly Lagavulin')}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              {/* Quick presets */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                {[100000, 200000, 500000, 1000000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(String(amt))}
                    style={{ ...btnStyle, fontSize: 10, padding: '6px 12px' }}
                  >+ {fmt(amt)}</button>
                ))}
              </div>

              {/* Transaction history */}
              {txs.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t('Recent transactions', 'Giao dịch gần đây')}</label>
                  <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 6, padding: '4px 0' }}>
                    {txs.map(t => (
                      <div key={t.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', borderTop: '1px solid rgba(229,212,194,0.04)',
                        fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                      }}>
                        <div style={{ color: '#B2AA98', minWidth: 100 }}>
                          {new Date(t.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        <div style={{
                          color: t.amount_vnd > 0 ? '#7AB07A' : '#E5D4C2',
                          fontWeight: 600, minWidth: 110, textAlign: 'right',
                        }}>
                          {t.amount_vnd > 0 ? '+' : ''}{fmt(t.amount_vnd)}
                        </div>
                        <div style={{ flex: 1, color: '#B2AA98', textAlign: 'right', paddingLeft: 12, fontSize: 10 }}>
                          {t.note || t.kind}
                          {t.staff_email && <span style={{ opacity: 0.5 }}> · {t.staff_email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={unlinkCard} disabled={busy} style={btnDanger}>{t('Unlink card', 'Hủy liên kết thẻ')}</button>
            </>
          ) : (
            <div>
              <label style={labelStyle}>{t("This card isn't linked yet", 'Thẻ này chưa được liên kết')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <select
                  value={pickerNumber}
                  onChange={e => setPickerNumber(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 280 }}
                >
                  <option value="">{t('— select member to link —', '— chọn hội viên để liên kết —')}</option>
                  {members.map((m, i) => (
                    <option key={`${m.member_number}-${i}`} value={m.member_number}>
                      {m.member_number} · {m.full_name} ({m.tier})
                      {m.card_uid ? ` · ${t('already has card', 'đã có thẻ')}` : m.credit_vnd > 0 ? ` · ${fmt(m.credit_vnd)} ${t('credit preserved', 'tín dụng được giữ lại')}` : ''}
                    </option>
                  ))}
                </select>
                <button onClick={linkCard} disabled={!pickerNumber || busy} style={btnPrimary}>
                  {busy ? t('Linking…', 'Đang liên kết…') : t('Link', 'Liên kết')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Orphan accounts — credit on members no longer in the sheet */}
      {orphans.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <button
            onClick={() => setShowOrphans(s => !s)}
            style={{
              background: 'rgba(212,184,90,0.12)', color: '#D4B85A',
              border: '1px solid rgba(212,184,90,0.3)', borderRadius: 6,
              padding: '8px 14px', cursor: 'pointer',
              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
            }}
          >
            {showOrphans ? '▾' : '▸'} {orphans.length} {t('orphan account', 'tài khoản mồ côi')}{orphans.length === 1 ? '' : t('s', '')} {t('(member no longer in sheet)', '(hội viên không còn trong bảng tính)')}
          </button>
          {showOrphans && (
            <div style={{
              marginTop: 12, padding: 16,
              background: 'rgba(212,184,90,0.04)',
              border: '1px solid rgba(212,184,90,0.15)', borderRadius: 8,
            }}>
              {orphans.map(o => (
                <div key={o.member_number} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderTop: '1px solid rgba(212,184,90,0.1)',
                  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, gap: 16, flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ color: '#E5D4C2' }}>{t('Member', 'Hội viên')} {o.member_number}</div>
                    <div style={{ color: '#B2AA98', opacity: 0.7, fontSize: 10 }}>
                      {o.card_uid ? `${t('card', 'thẻ')} ${o.card_uid}` : t('no card', 'không có thẻ')}
                      {' · '}{t('updated', 'cập nhật')} {new Date(o.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ color: o.credit_vnd > 0 ? '#7AB07A' : '#B2AA98', minWidth: 120, textAlign: 'right' }}>
                    {fmt(o.credit_vnd)}
                  </div>
                  <button
                    onClick={() => purgeAccount(o.member_number)}
                    disabled={busy}
                    style={{ background: 'rgba(180, 70, 70, 0.2)', color: '#E5D4C2', border: 'none', borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10 }}
                  >{t('Purge', 'Xóa')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, right: 32,
          background: '#28483C', color: '#E5D4C2',
          padding: '10px 16px', borderRadius: 6,
          fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}

      {/* ── Confirm modal (branded, replaces native window.confirm) ──── */}
      {confirmModal && (() => {
        const config = (() => {
          if (confirmModal.kind === 'purge') return {
            title:    t('Purge credit account?', 'Xóa tài khoản tín dụng?'),
            severity: 'red' as const,
            subject:  `${confirmModal.memberName} (${confirmModal.memberNumber})`,
            body:     t('Permanently deletes the credit account row AND all transaction history. The audit trail is GONE. Cannot be undone.', 'Xóa vĩnh viễn dòng tài khoản tín dụng VÀ toàn bộ lịch sử giao dịch. Nhật ký kiểm tra sẽ MẤT. Không thể hoàn tác.'),
            confirm:  t('Purge account', 'Xóa tài khoản'),
            eyebrow:  `⚠ ${t('PERMANENT', 'VĨNH VIỄN')}`,
          }
          if (confirmModal.kind === 'unlink') return {
            title:    t('Unlink card?', 'Hủy liên kết thẻ?'),
            severity: 'amber' as const,
            subject:  `${t('Card', 'Thẻ')} ${confirmModal.uid} · ${confirmModal.memberName}`,
            body:     t("The card stops resolving to the member. The member's credit balance is preserved — re-linking the same card later restores access.", 'Thẻ sẽ ngừng liên kết với hội viên. Số dư tín dụng của hội viên được giữ lại — liên kết lại chính thẻ đó sau này sẽ khôi phục quyền truy cập.'),
            confirm:  t('Unlink', 'Hủy liên kết'),
            eyebrow:  t('CONFIRM', 'XÁC NHẬN'),
          }
          return {  // relink
            title:    t('Reassign card to another member?', 'Gán lại thẻ cho hội viên khác?'),
            severity: 'amber' as const,
            subject:  `${t('Card', 'Thẻ')} ${confirmModal.uid}: ${confirmModal.fromName} → ${confirmModal.toName} (${confirmModal.toNumber})`,
            body:     `${confirmModal.fromName}${t("'s credit balance", ' — số dư tín dụng')} (${fmt(confirmModal.fromBalance)}) ${t('stays on their account. The card just stops resolving to them.', 'vẫn nằm trên tài khoản của họ. Thẻ chỉ ngừng liên kết với họ.')}`,
            confirm:  t('Reassign', 'Gán lại'),
            eyebrow:  t('CONFIRM', 'XÁC NHẬN'),
          }
        })()
        const tone = config.severity === 'red'
          ? { border: '#C27070', accent: '#C27070', confirmBg: '#C27070', confirmFg: '#FFFFFF' }
          : { border: '#D4B85A', accent: '#D4B85A', confirmBg: '#D4B85A', confirmFg: '#052E20' }
        return (
          <>
            <div style={cardsConfirmBackdrop} onClick={closeConfirm} />
            <div style={{ ...cardsConfirmModalBox, borderColor: tone.border, borderLeft: `3px solid ${tone.accent}` }} role="dialog">
              <div style={{ ...cardsConfirmEyebrow, color: tone.accent }}>{config.eyebrow}</div>
              <div style={cardsConfirmTitle}>{config.title}</div>
              <div style={cardsConfirmSubject}>{config.subject}</div>
              <p style={cardsConfirmBody}>{config.body}</p>
              <div style={cardsConfirmActions}>
                <button onClick={closeConfirm} disabled={confirmBusy} style={cardsConfirmCancelBtn}>{t('Cancel', 'Hủy')}</button>
                <button
                  onClick={runConfirm}
                  disabled={confirmBusy}
                  style={{ ...cardsConfirmGoBtn, background: tone.confirmBg, color: tone.confirmFg, opacity: confirmBusy ? 0.5 : 1 }}
                >
                  {confirmBusy ? t('Working…', 'Đang xử lý…') : config.confirm}
                </button>
              </div>
            </div>
          </>
        )
      })()}
    </>
  )
}

// ── Confirm modal styles (scoped, named cardsConfirm* to not collide) ──
const cardsConfirmBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300,
}
const cardsConfirmModalBox: React.CSSProperties = {
  position: 'fixed',
  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(520px, 92vw)',
  background: '#0A3526',
  border: '1px solid rgba(212,184,90,0.45)',
  borderRadius: 8,
  padding: '22px 24px',
  zIndex: 301,
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
}
const cardsConfirmEyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
  marginBottom: 8,
}
const cardsConfirmTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18,
  color: '#E5D4C2', letterSpacing: '0.02em', marginBottom: 6,
}
const cardsConfirmSubject: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', marginBottom: 12,
}
const cardsConfirmBody: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.65, marginBottom: 14,
}
const cardsConfirmActions: React.CSSProperties = {
  display: 'flex', gap: 10, justifyContent: 'flex-end',
}
const cardsConfirmCancelBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4,
  padding: '8px 16px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const cardsConfirmGoBtn: React.CSSProperties = {
  border: 'none', borderRadius: 4,
  padding: '8px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  cursor: 'pointer',
}
