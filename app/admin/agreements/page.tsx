'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

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

  const deleteInvitation = async (id: string) => {
    if (!window.confirm('Delete this invitation?')) return
    await supabase.from('signing_invitations').delete().eq('id', id)
    load()
  }

  const deleteAgreement = async (id: string, invitationId: string) => {
    if (!window.confirm('Delete this signed agreement? This cannot be undone.')) return
    await supabase.from('signed_agreements').delete().eq('id', id)
    await supabase.from('signing_invitations').delete().eq('id', invitationId)
    load()
  }

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
      alert('Could not generate download link')
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
    if (r.ok) { load() } else {
      const d = await r.json().catch(() => ({}))
      alert(`Reminder failed: ${d.error || r.statusText}`)
    }
  }

  const revokeInvitation = async (id: string) => {
    if (!window.confirm('Revoke this signing link? The existing URL will stop working immediately.')) return
    setBusyId(id)
    const r = await fetch('/api/admin/agreements/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: id }),
    })
    setBusyId(null)
    if (r.ok) load()
    else {
      const d = await r.json().catch(() => ({}))
      alert(`Revoke failed: ${d.error || r.statusText}`)
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
          Agreements
        </h1>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)} style={btnStyle}>+ Generate Signing Link</button>
        )}
      </div>

      {/* Generate signing link */}
      {showCreate && (
        <div style={{ padding: 24, background: 'rgba(229,212,194,0.03)', borderRadius: 8, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            Generate Signing Link
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Prospect Name *</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
                <option value="legacy" style={{ background: '#052E20' }}>Legacy</option>
                <option value="pioneer" style={{ background: '#052E20' }}>Pioneer</option>
                <option value="corporate" style={{ background: '#052E20' }}>Corporate</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={generateLink} style={btnStyle}>Generate</button>
            <button onClick={() => { setShowCreate(false); setGeneratedLink('') }} style={{ ...btnStyle, opacity: 0.5 }}>Cancel</button>
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
                {copied ? 'Copied' : 'Copy'}
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
          placeholder="Search name, email, or category…"
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
      <h2 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500, color: '#E5D4C2', marginBottom: 16 }}>
        Invitations
      </h2>
      {visibleInvitations.length === 0 ? (
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98', marginBottom: 32 }}>No matching invitations</p>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {visibleInvitations.map(inv => (
            <div key={inv.id} style={{
              padding: '14px 0', borderBottom: '1px solid rgba(229,212,194,0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#E5D4C2',
                  background: statusColor(inv.status), borderRadius: 4, padding: '2px 8px',
                }}>{inv.status}</span>
                <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>
                  {inv.full_name || '—'}
                </span>
                <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98' }}>
                  {inv.email}
                </span>
                <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', opacity: 0.5 }}>
                  {inv.category}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {inv.viewed_at && (
                  <span title={`First viewed ${formatDate(inv.viewed_at)}`} style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#7AB07A' }}>
                    viewed{(inv.view_count ?? 0) > 1 ? ` ×${inv.view_count}` : ''}
                  </span>
                )}
                {inv.last_reminded_at && (
                  <span title={`Last reminded ${formatDate(inv.last_reminded_at)}`} style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', opacity: 0.8 }}>
                    reminded {relative(inv.last_reminded_at)}
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
                    >Copy Link</button>
                    <button
                      onClick={() => sendReminder(inv.id)}
                      disabled={busyId === inv.id}
                      style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#D4B85A', cursor: 'pointer' }}
                    >{busyId === inv.id ? 'Sending…' : 'Send Reminder'}</button>
                    <button
                      onClick={() => revokeInvitation(inv.id)}
                      disabled={busyId === inv.id}
                      style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B45656', opacity: 0.7, cursor: 'pointer' }}
                    >Revoke</button>
                  </>
                )}
                <button
                  onClick={() => deleteInvitation(inv.id)}
                  style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.25, cursor: 'pointer' }}
                >Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signed agreements */}
      <h2 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500, color: '#E5D4C2', marginBottom: 16 }}>
        Signed Agreements
      </h2>
      {visibleAgreements.length === 0 ? (
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98' }}>No matching agreements</p>
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
                    fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#E5D4C2',
                    background: 'rgba(94,102,80,0.4)', borderRadius: 4, padding: '2px 8px',
                  }}>signed</span>
                  <span style={{ fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2' }}>
                    {agr.full_name}
                  </span>
                  <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98' }}>
                    {agr.email}
                  </span>
                  <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', opacity: 0.5 }}>
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
                    ['Mobile', agr.mobile],
                    ['Date of Birth', agr.date_of_birth],
                    ['Nationality', agr.nationality],
                    ['Home Address', agr.home_address],
                    ['Company', agr.company_name],
                    ['Profession', agr.profession],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', opacity: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
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
                        Download Signed PDF
                      </button>
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                    <button
                      onClick={() => deleteAgreement(agr.id, agr.invitation_id)}
                      style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.3, cursor: 'pointer' }}
                    >
                      Delete Agreement
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
