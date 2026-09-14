'use client'

// Admin → Member Cards
//
// HID-mode card reader. The Tagtix CK06 (and most cheap USB NFC readers) emulate
// a keyboard: when a card is tapped, the reader "types" the UID followed by Enter.
// We listen globally for keypresses, accumulate the buffer, and treat any
// alphanumeric run terminated by Enter (or 250ms of silence) as a UID.
//
// Two ways in (2026-09-14): TAP a card (the original flow), or CHOOSE a member
// from the list at the bottom. Member-first exists because Quick Reference was
// retired — it read a Google Sheet the database replaced — and it was the only
// place staff could top up a member who hadn't brought their card, link a card
// after choosing the member, or see/edit a card's expiry. Those jobs live here
// now, against the same /api/admin/cards/* routes it used.

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/admin-lang'

// The credit account on screen. card_uid is null when the card was unlinked
// but credit was kept; expires_at null means it never expires.
interface CardLink {
  member_number: string
  card_uid: string | null
  credit_vnd: number
  expires_at: string | null
  linked_at: string | null
}
interface RosterMember {
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
const btnSmall: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.15)',
  borderRadius: 4, padding: '4px 12px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
}

// An account past its expires_at still shows its balance, struck through, so
// staff can see what lapsed rather than a misleading zero.
const isExpired = (expiresAt: string | null | undefined) => !!expiresAt && new Date(expiresAt) < new Date()

export default function AdminCards() {
  const { t } = useLang()
  // What the panel is about: a tapped card (uid) or a member chosen from the
  // list (focusNumber). A tap always wins — it clears focusNumber — so the
  // tap-first flow behaves exactly as it did before member-first existed.
  const [uid, setUid] = useState<string | null>(null)
  const [focusNumber, setFocusNumber] = useState<string | null>(null)
  const [link, setLink] = useState<CardLink | null>(null)
  const [member, setMember] = useState<Record<string, string> | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [members, setMembers] = useState<RosterMember[]>([])
  // Member-first linking: while set, the next tap links to this member instead
  // of looking the card up.
  const [linkTarget, setLinkTarget] = useState<string | null>(null)
  const [editingExpiry, setEditingExpiry] = useState(false)
  const [expiryDraft, setExpiryDraft] = useState('')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pickerNumber, setPickerNumber] = useState('')
  const [topupAmount, setTopupAmount] = useState('')
  const [chargeAmount, setChargeAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [listening, setListening] = useState(true)
  const [orphans, setOrphans] = useState<{ member_number: string; card_uid: string | null; credit_vnd: number; expires_at: string | null; updated_at: string }[]>([])
  const [showOrphans, setShowOrphans] = useState(false)
  const [cardSearch, setCardSearch] = useState('')

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

  // Card-reader keystroke listener. It calls through handleScanRef because the
  // listener is only re-bound when `listening` flips, and a tap now has to see
  // the CURRENT linkTarget and roster (for the relink warning), not the ones
  // captured when the listener was attached.
  const handleScanRef = useRef<(scannedUid: string) => void>(() => {})
  useEffect(() => {
    const ALNUM = /^[0-9A-Za-z]$/
    const flush = () => {
      const buf = bufferRef.current
      bufferRef.current = ''
      flushTimerRef.current = null
      if (!buf || buf.length < 4) return
      handleScanRef.current(buf.toUpperCase())
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
    // Member-first link: staff chose the member, then pressed "Tap card to
    // link". The tap is the card for THAT member, not a lookup.
    if (linkTarget) {
      const target = linkTarget
      setLinkTarget(null)
      requestLink(scannedUid, target)
      return
    }
    setUid(scannedUid)
    setFocusNumber(null)
    setEditingExpiry(false); setExpiryDraft('')
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

  handleScanRef.current = handleScan

  // Member-first: load a member's credit account without their card. by-member
  // returns the card row without member_number, so it's stitched back on.
  const loadMemberAccount = async (memberNumber: string) => {
    const r = await fetch(`/api/admin/cards/by-member?member_number=${encodeURIComponent(memberNumber)}`, { cache: 'no-store' })
    const d = await r.json()
    setLink(d.card ? { ...d.card, member_number: memberNumber } : null)
    setTxs(d.transactions || [])
  }

  const selectMember = async (m: RosterMember) => {
    setUid(null); setPickerNumber(''); setLinkTarget(null)
    setEditingExpiry(false); setExpiryDraft('')
    setTopupAmount(''); setChargeAmount(''); setNote('')
    setFocusNumber(m.member_number)
    setMember({ 'Full Name': m.full_name, 'Member No.': m.member_number, 'Tier': m.tier })
    setLink(null); setTxs([])
    // The list sits below the panel; bring the panel into view.
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setBusy(true)
    try { await loadMemberAccount(m.member_number) }
    catch { showToast(t('Lookup failed', 'Tra cứu thất bại')) }
    finally { setBusy(false) }
  }

  const linkCard = async () => {
    if (!uid || !pickerNumber) return
    await requestLink(uid, pickerNumber)
  }

  // Both link paths (tap→pick member, member→tap card) come through here so
  // the relink warning guards each of them.
  const requestLink = async (linkUid: string, memberNumber: string) => {
    // Confirm before stealing a card from another member.
    const currentOwner = members.find(m => m.card_uid === linkUid && m.member_number !== memberNumber)
    if (currentOwner) {
      setConfirmModal({
        kind: 'relink',
        uid: linkUid,
        fromName:    `${currentOwner.full_name} (${currentOwner.member_number})`,
        fromBalance: currentOwner.credit_vnd,
        toNumber:    memberNumber,
        toName:      members.find(m => m.member_number === memberNumber)?.full_name || memberNumber,
      })
      return
    }
    await doLinkCard(linkUid, memberNumber)
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
      showToast(`${t('Card linked', 'Đã liên kết thẻ')}: ${linkUid}`)
      // Stay on the member if staff came in member-first; otherwise show the
      // card as the tap flow always has.
      if (focusNumber === memberNumber) await loadMemberAccount(memberNumber)
      else handleScan(linkUid)
      loadMembers()
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`${t('Link failed', 'Liên kết thất bại')}: ${d.error || r.statusText}`)
    }
  }

  const unlinkCard = () => {
    // The card on screen: the tapped one, or the member's own card member-first.
    const cardUid = link?.card_uid || uid
    if (!cardUid) return
    const owner = members.find(m => m.card_uid === cardUid)
    setConfirmModal({
      kind: 'unlink',
      uid: cardUid,
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
      if (focusNumber) await loadMemberAccount(focusNumber)
      else handleScan(unlinkUid)
      loadMembers()
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`${t('Unlink failed', 'Hủy liên kết thất bại')}: ${d.error || r.statusText}`)
    }
  }

  // Expiry — lifted from Quick Reference. A bare YYYY-MM-DD is stored by the
  // route as end-of-day Saigon time; null clears it (never expires).
  const saveExpiry = async (value: string | null) => {
    if (!link) return
    setBusy(true)
    const r = await fetch('/api/admin/cards/expiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_number: link.member_number, expires_at: value }),
    })
    setBusy(false)
    if (r.ok) {
      const d = await r.json()
      setLink(l => l ? { ...l, expires_at: d.expires_at } : l)
      setEditingExpiry(false); setExpiryDraft('')
      showToast(d.expires_at
        ? `${t('Expiry set to', 'Đã đặt hết hạn thành')} ${new Date(d.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
        : t('Expiry cleared', 'Đã xóa ngày hết hạn'))
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`${t('Failed to save expiry', 'Lưu ngày hết hạn thất bại')}: ${d.error || r.statusText}`)
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
      // Refresh history (and the list's balances, which the relink warning reads)
      if (focusNumber) {
        const br = await fetch(`/api/admin/cards/by-member?member_number=${encodeURIComponent(focusNumber)}`, { cache: 'no-store' })
        const bd = await br.json()
        setTxs(bd.transactions || [])
      } else if (uid) {
        const lr = await fetch(`/api/admin/cards/lookup?uid=${encodeURIComponent(uid)}`)
        const ld = await lr.json()
        setTxs(ld.transactions || [])
      }
      loadMembers()
    } else {
      const d = await r.json().catch(() => ({}))
      showToast(`${t('Failed', 'Thất bại')}: ${d.error || r.statusText}`)
    }
  }

  const reset = () => {
    setUid(null); setLink(null); setMember(null); setTxs([]); setPickerNumber('')
    setTopupAmount(''); setChargeAmount(''); setNote('')
    setFocusNumber(null); setLinkTarget(null); setEditingExpiry(false); setExpiryDraft('')
  }

  return (
    <>
      <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', marginBottom: 8 }}>
        {t('Member Cards', 'Thẻ hội viên')}
      </h1>
      <p style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 24, lineHeight: 1.6, maxWidth: 640 }}>
        {t('Tap a member card on the USB reader to view balance, top up, or charge — or choose a member from the list below if they don’t have their card. Cards link to members in the members roster by Member No.', 'Chạm thẻ hội viên lên đầu đọc USB để xem số dư, nạp tiền hoặc trừ tiền — hoặc chọn hội viên trong danh sách bên dưới nếu họ không mang thẻ. Thẻ được liên kết với hội viên trong danh sách hội viên theo Số hội viên.')}
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

      <div ref={panelRef} style={{ scrollMarginTop: 24 }} />
      {!uid && !focusNumber ? (
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
              {uid ? (
                <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 20, color: '#E5D4C2', letterSpacing: '0.05em' }}>
                  {uid}
                </div>
              ) : link?.card_uid ? (
                <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 20, color: '#E5D4C2', letterSpacing: '0.05em' }}>
                  {link.card_uid}
                </div>
              ) : (
                <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: link ? '#D4B85A' : '#B2AA98', marginTop: 4 }}>
                  {busy && !link ? t('Loading…', 'Đang tải…') : link ? t('Unlinked — credit preserved', 'Đã hủy liên kết — tín dụng được giữ lại') : t('No card linked', 'Chưa liên kết thẻ')}
                </div>
              )}
            </div>
            <button onClick={reset} style={btnStyle}>{t('Clear', 'Xóa')}</button>
          </div>

          {/* Member-first link: listen for the next tap and give it to this member */}
          {focusNumber && !link?.card_uid && !(busy && !link) && (
            linkTarget ? (
              <div style={{
                padding: '14px 16px', marginBottom: 24,
                background: 'rgba(122,176,122,0.08)',
                border: '1px dashed rgba(122,176,122,0.4)', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#E5D4C2' }}>
                  {t('Listening… tap a card on the reader to link it to', 'Đang chờ… chạm thẻ lên đầu đọc để liên kết với')} {member?.['Full Name'] || focusNumber}.
                </span>
                <button onClick={() => setLinkTarget(null)} style={btnStyle}>{t('Cancel', 'Hủy')}</button>
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                {!link && (
                  <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 10 }}>
                    <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2', marginRight: 10 }}>{member?.['Full Name'] || focusNumber}</span>
                    {focusNumber}{member?.['Tier'] ? ` · ${member['Tier']}` : ''} · {t('no credit account yet — link a card to open one', 'chưa có tài khoản tín dụng — liên kết thẻ để mở')}
                  </div>
                )}
                <button
                  // Linking needs the reader, so un-pause it rather than leave staff tapping into a paused page.
                  onClick={() => { setListening(true); setLinkTarget(focusNumber) }}
                  disabled={busy}
                  style={btnPrimary}
                >{link ? t('Tap card to relink', 'Chạm thẻ để liên kết lại') : t('Tap card to link', 'Chạm thẻ để liên kết')}</button>
              </div>
            )
          )}

          {link ? (
            <>
              {/* Member + balance */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>{uid ? t('Linked member', 'Hội viên liên kết') : t('Member', 'Hội viên')}</label>
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
                        {t('Not in the members roster — name unavailable', 'Không có trong danh sách hội viên — không có tên')}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <label style={{ ...labelStyle, textAlign: 'right' }}>{t('Credit balance', 'Số dư tín dụng')}</label>
                  <div style={{
                    fontFamily: "'Rampant Sans', serif", fontSize: 32,
                    color: isExpired(link.expires_at) ? '#B2AA98' : link.credit_vnd > 0 ? '#7AB07A' : link.credit_vnd < 0 ? '#B45656' : '#E5D4C2',
                    textDecoration: isExpired(link.expires_at) ? 'line-through' : 'none',
                    opacity: isExpired(link.expires_at) ? 0.5 : 1,
                  }}>
                    {fmt(link.credit_vnd)}
                  </div>
                  {isExpired(link.expires_at) && (
                    <div style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B45656', letterSpacing: '0.06em' }}>
                      {t('EXPIRED', 'ĐÃ HẾT HẠN')}
                    </div>
                  )}
                </div>
              </div>

              {/* Expiry — shown for every account, tapped or chosen */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '12px 0', marginBottom: 20,
                borderTop: '1px solid rgba(229,212,194,0.06)', borderBottom: '1px solid rgba(229,212,194,0.06)',
                fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
              }}>
                <span style={{ color: '#B2AA98', opacity: 0.7 }}>{t('Expires:', 'Hết hạn:')}</span>
                {!editingExpiry ? (
                  <>
                    <span style={{ color: isExpired(link.expires_at) ? '#B45656' : '#E5D4C2' }}>
                      {link.expires_at
                        ? new Date(link.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        : t('Never', 'Không bao giờ')}
                    </span>
                    <button
                      onClick={() => { setExpiryDraft(link.expires_at ? link.expires_at.slice(0, 10) : ''); setEditingExpiry(true) }}
                      style={btnSmall}
                    >{t('Edit', 'Sửa')}</button>
                  </>
                ) : (
                  <>
                    <input
                      type="date"
                      value={expiryDraft}
                      onChange={e => setExpiryDraft(e.target.value)}
                      style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: 11 }}
                    />
                    <button onClick={() => saveExpiry(expiryDraft || null)} disabled={busy} style={{ ...btnSmall, background: '#5E6650', color: '#E5D4C2', border: 'none' }}>{t('Save', 'Lưu')}</button>
                    <button onClick={() => { setEditingExpiry(false); setExpiryDraft('') }} style={btnSmall}>{t('Cancel', 'Hủy')}</button>
                    {link.expires_at && (
                      <button
                        onClick={() => saveExpiry(null)}
                        disabled={busy}
                        style={{ ...btnSmall, color: '#B45656', border: '1px solid rgba(180,86,86,0.4)' }}
                      >{t('Clear (no expiry)', 'Xóa (không hết hạn)')}</button>
                    )}
                  </>
                )}
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

              {link.card_uid && (
                <button onClick={unlinkCard} disabled={busy} style={btnDanger}>{t('Unlink card', 'Hủy liên kết thẻ')}</button>
              )}
            </>
          ) : uid ? (
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
          ) : null}
        </div>
      )}

      {/* Orphan accounts — credit on members no longer in the members roster */}
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
            {showOrphans ? '▾' : '▸'} {orphans.length} {t('orphan account', 'tài khoản mồ côi')}{orphans.length === 1 ? '' : t('s', '')} {t('(member no longer in the roster)', '(hội viên không còn trong danh sách)')}
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

      {/* All member cards — every member with their number, card status + balance */}
      <div style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, color: '#E5D4C2' }}>
            {t('All member cards', 'Tất cả thẻ hội viên')} <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11, color: '#B2AA98' }}>· {members.length}</span>
          </div>
          <input
            value={cardSearch} onChange={e => setCardSearch(e.target.value)}
            placeholder={t('Search name or number…', 'Tìm tên hoặc số…')}
            style={{ background: 'rgba(5,46,32,0.5)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 7, padding: '8px 12px', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, outline: 'none', minWidth: 200 }}
          />
        </div>
        <div style={{ border: '1px solid rgba(229,212,194,0.08)', borderRadius: 10, overflow: 'hidden' }}>
          {members
            .filter(m => { const q = cardSearch.trim().toLowerCase(); return !q || `${m.member_number} ${m.full_name}`.toLowerCase().includes(q) })
            .sort((a, b) => a.member_number.localeCompare(b.member_number, undefined, { numeric: true }))
            .map(m => (
              // Choosing a row opens the member-first panel above — the way to
              // serve a member who hasn't got their card with them.
              <div
                key={m.member_number}
                role="button" tabIndex={0}
                onClick={() => selectMember(m)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectMember(m) } }}
                title={t('Open this member’s card account', 'Mở tài khoản thẻ của hội viên này')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', borderTop: '1px solid rgba(229,212,194,0.06)', flexWrap: 'wrap',
                  cursor: 'pointer',
                  background: focusNumber === m.member_number ? 'rgba(212,184,90,0.08)' : 'transparent',
                  borderLeft: `2px solid ${focusNumber === m.member_number ? '#D4B85A' : 'transparent'}`,
                }}
              >
                <span style={{ minWidth: 52, fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98' }}>{m.member_number.replace(/^TRC-M/i, '#')}</span>
                <span style={{ flex: 1, minWidth: 120, fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>{m.full_name || '—'}{m.tier ? <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 9, color: '#7E7864' }}> · {m.tier}</span> : null}</span>
                <span style={{ fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: m.card_uid ? '#D4B85A' : '#7E7864' }}>
                  {m.card_uid ? `${t('card', 'thẻ')} ${m.card_uid}` : t('no card linked', 'chưa gắn thẻ')}
                </span>
                <span style={{ minWidth: 100, textAlign: 'right', fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: m.credit_vnd > 0 ? '#7AB07A' : '#B2AA98' }}>{fmt(m.credit_vnd)}</span>
              </div>
            ))}
          {members.length === 0 && <div style={{ padding: 16, fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12, color: '#B2AA98', opacity: 0.6 }}>{t('No members.', 'Không có hội viên.')}</div>}
        </div>
      </div>

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
