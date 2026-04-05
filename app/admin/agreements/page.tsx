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

  const getPdfUrl = (filename: string | null) => {
    if (!filename) return null
    const { data } = supabase.storage.from('signed-agreements').getPublicUrl(filename)
    return data?.publicUrl
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

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

      {/* Pending invitations */}
      <h2 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500, color: '#E5D4C2', marginBottom: 16 }}>
        Pending Invitations
      </h2>
      {invitations.filter(i => i.status === 'pending').length === 0 ? (
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98', marginBottom: 32 }}>No pending invitations</p>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {invitations.filter(i => i.status === 'pending').map(inv => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.5 }}>
                  {formatDate(inv.created_at)}
                </span>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/sign/${inv.token}`
                    navigator.clipboard.writeText(link)
                  }}
                  style={{ background: 'none', border: 'none', fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#E5D4C2', opacity: 0.5, cursor: 'pointer' }}
                >
                  Copy Link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signed agreements */}
      <h2 style={{ fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500, color: '#E5D4C2', marginBottom: 16 }}>
        Signed Agreements
      </h2>
      {agreements.length === 0 ? (
        <p style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98' }}>No signed agreements yet</p>
      ) : (
        <div>
          {agreements.map(agr => (
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
                      <a
                        href={getPdfUrl(agr.signed_pdf_url) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...btnStyle, display: 'inline-block', textDecoration: 'none', fontSize: 10, padding: '8px 16px',
                        }}
                      >
                        Download Signed PDF
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
