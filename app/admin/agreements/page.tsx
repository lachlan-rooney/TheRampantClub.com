'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { ConfirmModal, useToast, type ConfirmTone } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'

// Per-kind copy for the destructive-action confirm modal.
const AGREEMENT_CONFIRM: Record<'invitation_delete' | 'agreement_delete' | 'invitation_revoke', {
  tone: ConfirmTone; eyebrow: string; title: string; body: string; confirm: string
}> = {
  invitation_delete: {
    tone: 'info', eyebrow: 'CONFIRM', title: 'Delete invitation?',
    body: "Removes the signing record. If the recipient hasn't signed yet, their link will no longer resolve.",
    confirm: 'Delete invitation',
  },
  agreement_delete: {
    tone: 'danger', eyebrow: '⚠ PERMANENT', title: 'Delete signed agreement?',
    body: 'Destroys the signed legal record AND the originating invitation. The signed PDF in storage is NOT touched, but its index entry is gone. Cannot be undone.',
    confirm: 'Delete legal record',
  },
  invitation_revoke: {
    tone: 'danger', eyebrow: '⚠ PERMANENT', title: 'Revoke signing link?',
    body: "The existing URL stops working immediately and CANNOT be un-revoked. You'll need to generate a new link if the prospect still wants to sign.",
    confirm: 'Revoke',
  },
}

interface Invitation {
  id: string
  token: string
  full_name: string | null
  email: string | null
  category: string | null
  status: string
  created_at: string
  expires_at: string
  viewed_at: string | null
  view_count: number | null
  last_reminded_at: string | null
  reminder_count: number | null
  revoked_at: string | null
}

interface SignedAgreement {
  id: string
  invitation_id: string
  full_name: string
  email: string
  mobile: string
  category: string
  date_of_birth: string | null
  nationality: string | null
  home_address: string | null
  company_name: string | null
  profession: string | null
  signed_pdf_url: string | null
  signed_at: string
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
  padding: '10px 14px', fontFamily: "'Google Sans Code', 'DM Mono', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
}
const btnStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none',
  borderRadius: 6, padding: '10px 24px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 12,
}

export default function AgreementsPage() {
  const { t } = useLang()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [agreements, setAgreements] = useState<SignedAgreement[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('legacy')
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'signed' | 'revoked' | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'legacy' | 'pioneer' | 'corporate'>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const supabase = createBrowserSupabaseClient()

  const load = async () => {
    const [{ data: inv }, { data: agr }] = await Promise.all([
      supabase.from('signing_invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('signed_agreements').select('*').order('signed_at', { ascending: false }),
    ])
    if (inv) setInvitations(inv)
    if (agr) setAgreements(agr)
  }

  useEffect(() => { load() }, [])

  // Confirm-modal state — three destructive paths route through one
  // branded modal: delete invitation (low stakes), delete signed
  // agreement (high stakes, legal record), revoke invitation (locks
  // out a live URL). Tone is severity-coded.
  const [confirmModal, setConfirmModal] = useState<{
    kind: 'invitation_delete' | 'agreement_delete' | 'invitation_revoke'
    id: string
    invitationId?: string
    label: string  // human-readable subject (the name / email being affected)
  } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const requestDeleteInvitation = (id: string, label: string) => {
    setConfirmModal({ kind: 'invitation_delete', id, label })
  }
  const requestDeleteAgreement = (id: string, invitationId: string, label: string) => {
    setConfirmModal({ kind: 'agreement_delete', id, invitationId, label })
  }
  const requestRevokeInvitation = (id: string, label: string) => {
    setConfirmModal({ kind: 'invitation_revoke', id, label })
  }
  const closeConfirm = () => { if (!confirmBusy) setConfirmModal(null) }
  const runConfirm = async () => {
    if (!confirmModal) return
    setConfirmBusy(true)
    try {
      if (confirmModal.kind === 'invitation_delete') {
        await supabase.from('signing_invitations').delete().eq('id', confirmModal.id)
        load()
      } else if (confirmModal.kind === 'agreement_delete') {
        await supabase.from('signed_agreements').delete().eq('id', confirmModal.id)
        if (confirmModal.invitationId) {
          await supabase.from('signing_invitations').delete().eq('id', confirmModal.invitationId)
        }
        load()
      } else if (confirmModal.kind === 'invitation_revoke') {
        const r = await fetch('/api/admin/agreements/revoke', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitation_id: confirmModal.id }),
        })
        if (r.ok) load()
        else {
          const d = await r.json().catch(() => ({}))
          showToast(`${t('Revoke failed', 'Thu hồi thất bại')}: ${d.error || r.statusText}`, 'error')
          return
        }
      }
      setConfirmModal(null)
    } finally {
      setConfirmBusy(false)
    }
  }

  // Toast for non-blocking notices (replaces alert()).
  const { showToast, toastNode } = useToast()

  const generateLink = async () => {
    if (!name || !email) return
    const token = crypto.randomUUID()
    await supabase.from('signing_invitations').insert({
      token,
      full_name: name,
      email,
      category,
    })
    const baseUrl = window.location.origin
    const link = `${baseUrl}/sign/${token}`
    setGeneratedLink(link)
    setName('')
    setEmail('')
    load()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadPdf = async (filename: string | null) => {
    if (!filename) return
    const { data, error } = await supabase.storage.from('signed_agreements').createSignedUrl(filename, 60)
    if (error || !data?.signedUrl) {
      showToast(t('Could not generate download link', 'Không thể tạo liên kết tải xuống'), 'error')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const relative = (d: string | null) => {
    if (!d) return null
    const ms = Date.now() - new Date(d).getTime()
    const mins = Math.round(ms / 60_000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.round(hrs / 24)
    return `${days}d ago`
  }

  const sendReminder = async (id: string) => {
    setBusyId(id)
    const r = await fetch('/api/admin/agreements/remind', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: id }),
    })
    setBusyId(null)
    if (r.ok) { showToast(t('Reminder sent.', 'Đã gửi nhắc.'), 'info'); load() } else {
      const d = await r.json().catch(() => ({}))
      showToast(`${t('Reminder failed', 'Gửi nhắc thất bại')}: ${d.error || r.statusText}`, 'error')
    }
  }

  const matchesSearch = (...fields: (string | null | undefined)[]) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return fields.some(f => (f || '').toLowerCase().includes(q))
  }
  const matchesCategory = (cat: string | null | undefined) =>
    categoryFilter === 'all' || cat === categoryFilter

  const visibleInvitations = invitations.filter(i =>
    (statusFilter === 'all' ? i.status !== 'signed' : i.status === statusFilter) &&
    matchesSearch(i.full_name, i.email, i.category) &&
    matchesCategory(i.category)
  )
  const visibleAgreements = agreements.filter(a =>
    matchesSearch(a.full_name, a.email, a.category) &&
    matchesCategory(a.category)
  )

  const statusColor = (s: string) => {
    if (s === 'signed') return 'rgba(94,102,80,0.4)'
    if (s === 'pending') return 'rgba(201,168,76,0.3)'
    return 'rgba(178,170,152,0.2)'
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em' }}>
          {t('Agreements', 'Thỏa thuận')}
        </h1>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)} style={btnStyle}>{t('+ Generate Signing Link', '+ Tạo liên kết ký')}</button>
        )}
      </div>

      {/* Generate signing link */}
      {showCreate && (
        <div style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {t('Generate Signing Link', 'Tạo liên kết ký')}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Prospect Name *', 'Tên khách mời *')}</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder={t('Full name', 'Họ và tên')} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Email *', 'Email *')}</label>
              <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Category', 'Danh mục')}</label>
              <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
                <option value="legacy" style={{ background: '#052E20' }}>{t('Legacy', 'Di sản')}</option>
                <option value="pioneer" style={{ background: '#052E20' }}>{t('Pioneer', 'Tiên phong')}</option>
                <option value="corporate" style={{ background: '#052E20' }}>{t('Corporate', 'Doanh nghiệp')}</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={generateLink} style={btnStyle}>{t('Generate', 'Tạo')}</button>
            <button onClick={() => { setShowCreate(false); setGeneratedLink('') }} style={{ ...btnStyle, opacity: 0.5 }}>{t('Cancel', 'Hủy')}</button>
          </div>
          {generatedLink && (
            <div style={{
              padding: '14px 18px', background: 'rgba(229,212,194,0.06)', borderRadius: 6,
              border: '1px solid rgba(229,212,194,0.1)', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <code style={{
                fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2',
                flex: 1, wordBreak: 'break-all',
              }}>
                {generatedLink}
              </code>
              <button onClick={copyLink} style={{ ...btnStyle, padding: '6px 16px', fontSize: 10 }}>
                {copied ? t('Copied', 'Đã sao chép') : t('Copy', 'Sao chép')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search name, email, or category…', 'Tìm tên, email hoặc danh mục…')}
          style={{ ...inputStyle, flex: 1, minWidth: 240, maxWidth: 380 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'pending', 'signed', 'revoked'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              fontFamily: "'Google Sans Code', monospace", fontSize: 10,
              padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
              background: statusFilter === s ? 'rgba(229,212,194,0.14)' : 'transparent',
              border: statusFilter === s ? '1px solid rgba(229,212,194,0.4)' : '1px solid rgba(229,212,194,0.15)',
              color: statusFilter === s ? '#E5D4C2' : '#B2AA98',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>{s}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'legacy', 'pioneer', 'corporate'] as const).map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)} style={{
              fontFamily: "'Google Sans Code', monospace", fontSize: 10,
              padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
              background: categoryFilter === c ? 'rgba(212,184,90,0.18)' : 'transparent',
              border: categoryFilter === c ? '1px solid rgba(212,184,90,0.5)' : '1px solid rgba(229,212,194,0.15)',
              color: categoryFilter === c ? '#D4B85A' : '#B2AA98',
              letterSpacing: '0.06em', textTransform: 'capitalize',
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Pending / revoked invitations */}
      <h2 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500, color: '#E5D4C2', marginBottom: 16 }}>
        {t('Invitations', 'Lời mời')}
      </h2>
      {visibleInvitations.length === 0 ? (
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98', marginBottom: 32 }}>{t('No matching invitations', 'Không có lời mời phù hợp')}</p>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {visibleInvitations.map(inv => (
            <div key={inv.id} style={{
              padding: '14px 0', borderBottom: '1px solid rgba(229,212,194,0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#E5D4C2',
                  background: statusColor(inv.status), borderRadius: 4, padding: '2px 8px',
                }}>{inv.status}</span>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>
                  {inv.full_name || '—'}
                </span>
                <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98' }}>
                  {inv.email}
                </span>
                <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.5 }}>
                  {inv.category}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {inv.viewed_at && (
                  <span title={`${t('First viewed', 'Xem lần đầu')} ${formatDate(inv.viewed_at)}`} style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#7AB07A' }}>
                    {t('viewed', 'đã xem')}{(inv.view_count ?? 0) > 1 ? ` ×${inv.view_count}` : ''}
                  </span>
                )}
                {inv.last_reminded_at && (
                  <span title={`${t('Last reminded', 'Nhắc lần cuối')} ${formatDate(inv.last_reminded_at)}`} style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', opacity: 0.8 }}>
                    {t('reminded', 'đã nhắc')} {relative(inv.last_reminded_at)}
                  </span>
                )}
                <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.5 }}>
                  {formatDate(inv.created_at)}
                </span>
                {inv.status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/sign/${inv.token}`
                        navigator.clipboard.writeText(link)
                      }}
                      style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.6, cursor: 'pointer' }}
                    >{t('Copy Link', 'Sao chép liên kết')}</button>
                    <button
                      onClick={() => sendReminder(inv.id)}
                      disabled={busyId === inv.id}
                      style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', cursor: 'pointer' }}
                    >{busyId === inv.id ? t('Sending…', 'Đang gửi…') : t('Send Reminder', 'Gửi nhắc')}</button>
                    <button
                      onClick={() => requestRevokeInvitation(inv.id, `${inv.full_name} (${inv.email})`)}
                      disabled={busyId === inv.id}
                      style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B45656', opacity: 0.7, cursor: 'pointer' }}
                    >{t('Revoke', 'Thu hồi')}</button>
                  </>
                )}
                <button
                  onClick={() => requestDeleteInvitation(inv.id, `${inv.full_name} (${inv.email})`)}
                  style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.25, cursor: 'pointer' }}
                >{t('Delete', 'Xóa')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signed agreements */}
      <h2 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500, color: '#E5D4C2', marginBottom: 16 }}>
        {t('Signed Agreements', 'Thỏa thuận đã ký')}
      </h2>
      {visibleAgreements.length === 0 ? (
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98' }}>{t('No matching agreements', 'Không có thỏa thuận phù hợp')}</p>
      ) : (
        <div>
          {visibleAgreements.map(agr => (
            <div key={agr.id} style={{ borderBottom: '1px solid rgba(229,212,194,0.08)' }}>
              <div
                onClick={() => setExpandedId(expandedId === agr.id ? null : agr.id)}
                style={{
                  padding: '14px 0', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#E5D4C2',
                    background: 'rgba(94,102,80,0.4)', borderRadius: 4, padding: '2px 8px',
                  }}>{t('signed', 'đã ký')}</span>
                  <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>
                    {agr.full_name}
                  </span>
                  <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98' }}>
                    {agr.email}
                  </span>
                  <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.5 }}>
                    {agr.category}
                  </span>
                </div>
                <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.5 }}>
                  {formatDate(agr.signed_at)}
                </span>
              </div>

              {expandedId === agr.id && (
                <div style={{
                  padding: '0 0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '10px 24px',
                }}>
                  {[
                    [t('Mobile', 'Điện thoại'), agr.mobile],
                    [t('Date of Birth', 'Ngày sinh'), agr.date_of_birth],
                    [t('Nationality', 'Quốc tịch'), agr.nationality],
                    [t('Home Address', 'Địa chỉ nhà'), agr.home_address],
                    [t('Company', 'Công ty'), agr.company_name],
                    [t('Profession', 'Nghề nghiệp'), agr.profession],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {label}
                      </div>
                      <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#E5D4C2' }}>
                        {value || '—'}
                      </div>
                    </div>
                  ))}
                  {agr.signed_pdf_url && (
                    <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                      <button
                        onClick={() => downloadPdf(agr.signed_pdf_url)}
                        style={{
                          ...btnStyle, fontSize: 10, padding: '8px 16px',
                        }}
                      >
                        {t('Download Signed PDF', 'Tải PDF đã ký')}
                      </button>
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                    <button
                      onClick={() => requestDeleteAgreement(agr.id, agr.invitation_id, agr.full_name || agr.email || agr.id)}
                      style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.3, cursor: 'pointer' }}
                    >
                      {t('Delete Agreement', 'Xóa thỏa thuận')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmModal}
        tone={confirmModal ? AGREEMENT_CONFIRM[confirmModal.kind].tone : 'danger'}
        eyebrow={confirmModal ? AGREEMENT_CONFIRM[confirmModal.kind].eyebrow : ''}
        title={confirmModal ? AGREEMENT_CONFIRM[confirmModal.kind].title : ''}
        subject={confirmModal?.label}
        body={confirmModal ? AGREEMENT_CONFIRM[confirmModal.kind].body : ''}
        confirmLabel={confirmModal ? AGREEMENT_CONFIRM[confirmModal.kind].confirm : ''}
        busy={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runConfirm}
      />

      {toastNode}
    </>
  )
}
