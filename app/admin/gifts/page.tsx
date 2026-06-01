'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { OCCASIONS, OCCASION_LABELS, CATEGORIES, CATEGORY_LABELS, formatVnd, percentUsed, type Occasion, type Category } from '@/lib/gifting'
import { vnDateString } from '@/lib/datetime'

// Admin / Intelligence / Gifts
//
// Org-wide gifting ledger. Filters by occasion / category / member.
// Add-new form supports photo upload via the signed-URL flow.

interface Gift {
  id: string
  member_no: string
  gift_date: string
  occasion: string
  category: string | null
  description: string
  source: string | null
  cost_vnd: number
  expected_value: string | null
  given_by: string | null
  notes: string | null
  photo_url: string | null
  created_at: string
  member: { member_no: string; full_name: string; tier: string } | null
}

interface MemberLite {
  member_no: string
  full_name: string
  tier: string
  email: string | null
}

interface OrgSummary {
  totals: {
    members: number
    total_annual_budget_vnd: number
    total_spent_vnd: number
    remaining_vnd: number
    pct_used: number
  }
  unloved: Array<{ member_no: string; full_name: string; tier: string; annual_budget_vnd: number; window_end: string | null }>
  by_occasion_90d: Array<{ occasion: string; total: number }>
  by_category_90d: Array<{ category: string; total: number }>
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function GiftsPage() {
  const [gifts, setGifts] = useState<Gift[]>([])
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [members, setMembers] = useState<MemberLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [occFilter, setOccFilter] = useState<string>('all')
  // Signed URLs from the server expire in 1h; cache each one with its own
  // soft expiry so a long-lived session refreshes them.
  const [photoCache, setPhotoCache] = useState<Record<string, { url: string; expires: number }>>({})

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (occFilter !== 'all') params.set('occasion', occFilter)
    Promise.all([
      fetch(`/api/admin/gifts?${params}`, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/gifts/summary', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([g, s]) => {
      setGifts(g.gifts || [])
      setSummary(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [occFilter])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/admin/mis/members', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.members) setMembers(d.members.map((m: { member_no: string; full_name: string; tier: string; email: string | null }) => ({
          member_no: m.member_no, full_name: m.full_name, tier: m.tier, email: m.email,
        })))
      })
  }, [])

  // Fetch signed read URLs for any gift photos lazily. We re-fetch entries
  // whose soft expiry has passed (signed URLs are valid for 1h server-side,
  // so we refresh after 50 minutes to stay ahead of token expiry).
  useEffect(() => {
    const now = Date.now()
    const need = gifts.filter(g => g.photo_url && (!photoCache[g.photo_url] || photoCache[g.photo_url].expires < now))
    if (need.length === 0) return
    need.forEach(async g => {
      try {
        const r = await fetch(`/api/admin/gifts/photo-upload?path=${encodeURIComponent(g.photo_url!)}`)
        const j = await r.json()
        if (j.url) setPhotoCache(c => ({ ...c, [g.photo_url!]: { url: j.url, expires: Date.now() + 50 * 60 * 1000 } }))
      } catch { /* ignore */ }
    })
  }, [gifts, photoCache])

  return (
    <>
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Intelligence · Member Experience</div>
          <h1 style={pageTitle}>Gifting</h1>
          <p style={lede}>
            Unreasonable Hospitality — the small, thoughtful gestures that make a member feel cared for. The budget is set by tier ({' '}
            <Link href="/admin/tier-budgets" style={linkStyle}>tier budgets →</Link>{' '}
            ) and runs anniversary to anniversary. Each gift carries a cost, a source, and the &quot;why&quot; we did it.
          </p>
        </div>
        <button onClick={() => setShowAdd(s => !s)} style={btnPrimary}>
          {showAdd ? 'Cancel' : '＋ Log a gift'}
        </button>
      </div>

      {/* Org-wide budget strip */}
      {summary && (
        <div style={strip}>
          <StatTile label="Active members" value={String(summary.totals.members)} color="#E5D4C2" />
          <StatTile label="Annual budget" value={formatVnd(summary.totals.total_annual_budget_vnd)} color="#D4B85A" />
          <StatTile label="Spent" value={formatVnd(summary.totals.total_spent_vnd)} color="#7AB07A" sub={`${summary.totals.pct_used}% used`} />
          <StatTile label="Remaining" value={formatVnd(summary.totals.remaining_vnd)} color="#9E8FC4" />
          <StatTile
            label="Unloved members"
            value={String(summary.unloved.length)}
            color={summary.unloved.length > 0 ? '#C27070' : '#7AB07A'}
            sub={summary.unloved.length > 0 ? 'no gift this year yet' : 'everyone has received something'}
          />
        </div>
      )}

      {/* Unloved alarm */}
      {summary && summary.unloved.length > 0 && (
        <div style={alarmBox}>
          <div style={alarmHeader}>Members with budget but no gift this year</div>
          <div style={unlovedRow}>
            {summary.unloved.map(u => (
              <Link key={u.member_no} href={`/admin/mis/${u.member_no}`} style={unlovedChip}>
                <strong style={{ color: '#E5D4C2' }}>{u.full_name}</strong>
                <span style={{ color: '#B2AA98', fontSize: 10, marginLeft: 6 }}>{u.tier} · {formatVnd(u.annual_budget_vnd)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <AddGiftForm
          members={members}
          onCancel={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}

      {/* Filters */}
      <div style={filterRow}>
        <button onClick={() => setOccFilter('all')} style={{ ...filterChip, ...(occFilter === 'all' ? filterChipActive : null) }}>All</button>
        {OCCASIONS.map(o => (
          <button key={o} onClick={() => setOccFilter(o)} style={{ ...filterChip, ...(occFilter === o ? filterChipActive : null) }}>
            {OCCASION_LABELS[o]}
          </button>
        ))}
      </div>

      {/* Ledger */}
      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : gifts.length === 0 ? (
        <div style={emptyBlock}>
          {occFilter === 'all' ? 'No gifts logged yet.' : `No ${OCCASION_LABELS[occFilter as Occasion] || occFilter} gifts.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {gifts.map(g => {
            const photoUrl = g.photo_url ? photoCache[g.photo_url]?.url || null : null
            return (
              <div key={g.id} style={giftCard}>
                {photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" style={giftPhoto} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={occasionPill}>{OCCASION_LABELS[g.occasion as Occasion] || g.occasion}</span>
                    {g.category && <span style={categoryPill}>{CATEGORY_LABELS[g.category as Category] || g.category}</span>}
                    <span style={costChip}>{formatVnd(g.cost_vnd)}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864' }}>
                      {g.gift_date}
                    </span>
                  </div>
                  <Link href={`/admin/mis/${g.member_no}`} style={giftMember}>
                    {g.member?.full_name || g.member_no}
                  </Link>
                  <div style={giftDescription}>{g.description}</div>
                  {g.source && <div style={giftMeta}>via {g.source}</div>}
                  {g.expected_value && (
                    <div style={whyBox}>
                      <span style={whyLabel}>Why · </span>{g.expected_value}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── AddGiftForm ───────────────────────────────────────────────────────
function AddGiftForm({ members, onCancel, onSaved }: { members: MemberLite[]; onCancel: () => void; onSaved: () => void }) {
  const today = vnDateString()
  const [memberQuery, setMemberQuery] = useState('')
  const [memberNo, setMemberNo] = useState('')
  const [giftDate, setGiftDate] = useState(today)
  const [occasion, setOccasion] = useState<Occasion>('thoughtful')
  const [category, setCategory] = useState<Category | ''>('')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('')
  const [costVnd, setCostVnd] = useState('')
  const [expectedValue, setExpectedValue] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Each photo upload bumps this counter. The in-flight upload checks
  // its own id against the latest before setting photoPath — if the user
  // picked a newer file mid-upload, the stale upload's result is dropped.
  const uploadIdRef = useRef(0)

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members.slice(0, 10)
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.member_no.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [members, memberQuery])

  const selectedMember = useMemo(() => members.find(m => m.member_no === memberNo) || null, [members, memberNo])

  const choosePhoto = async (file: File) => {
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    // Clear any previous upload so the gift won't save the wrong path if
    // the user picked a new file before the previous one finished.
    setPhotoPath(null)
    if (!memberNo) return  // wait until a member is picked
    await uploadPhoto(file)
  }

  const uploadPhoto = useCallback(async (file: File) => {
    if (!memberNo) return
    const myId = ++uploadIdRef.current
    setUploadingPhoto(true); setError(null)
    try {
      const r = await fetch('/api/admin/gifts/photo-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no: memberNo, filename: file.name }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not get upload URL')
      const { error: upErr } = await sb.storage.from('gift-photos').uploadToSignedUrl(j.path, j.token, file)
      if (upErr) throw upErr
      // If a newer upload has started while we were in flight, drop this
      // result rather than overwriting the newer photo's path.
      if (myId === uploadIdRef.current) setPhotoPath(j.path)
    } catch (e) {
      if (myId === uploadIdRef.current) setError(`Photo upload failed: ${(e as Error).message}`)
    } finally {
      if (myId === uploadIdRef.current) setUploadingPhoto(false)
    }
  }, [memberNo])

  // If user picks the member after choosing the photo, upload it now.
  useEffect(() => {
    if (photoFile && memberNo && !photoPath && !uploadingPhoto) {
      uploadPhoto(photoFile)
    }
  }, [photoFile, memberNo, photoPath, uploadingPhoto, uploadPhoto])

  const submit = async () => {
    if (!memberNo) { setError('Pick a member.'); return }
    if (!description.trim()) { setError('Description required.'); return }
    if (!costVnd) { setError('Cost required.'); return }
    setSubmitting(true); setError(null)
    try {
      const r = await fetch('/api/admin/gifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_no: memberNo,
          gift_date: giftDate,
          occasion,
          category: category || null,
          description,
          source: source || null,
          cost_vnd: Number(costVnd),
          expected_value: expectedValue || null,
          photo_url: photoPath || null,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={addBlock}>
      <div style={addHeader}>Log a gift</div>
      {error && <div style={errorBox}>{error}</div>}

      <div style={fieldRow}>
        <div style={editLabel}>Member *</div>
        {selectedMember ? (
          <div style={selectedMemberRow}>
            <div>
              <strong>{selectedMember.full_name}</strong>
              <span style={{ marginLeft: 8, color: '#B2AA98', fontSize: 11 }}>{selectedMember.member_no} · {selectedMember.tier}</span>
            </div>
            <button onClick={() => { setMemberNo(''); setMemberQuery('') }} style={tinyBtn}>Change</button>
          </div>
        ) : (
          <>
            <input value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Search…" style={inputStyle} />
            <div style={memberList}>
              {filteredMembers.map(m => (
                <button key={m.member_no} onClick={() => setMemberNo(m.member_no)} style={memberRow}>
                  <span>{m.full_name}</span>
                  <span style={{ color: '#B2AA98', fontSize: 11 }}>{m.member_no} · {m.tier}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={metaGrid}>
        <div>
          <div style={editLabel}>Date *</div>
          <input type="date" value={giftDate} onChange={e => setGiftDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={editLabel}>Occasion *</div>
          <select value={occasion} onChange={e => setOccasion(e.target.value as Occasion)} style={inputStyle}>
            {OCCASIONS.map(o => <option key={o} value={o}>{OCCASION_LABELS[o]}</option>)}
          </select>
        </div>
        <div>
          <div style={editLabel}>Category</div>
          <select value={category} onChange={e => setCategory(e.target.value as Category | '')} style={inputStyle}>
            <option value="">—</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <div style={editLabel}>Cost (VND) *</div>
          <input
            type="number" min={0} step={50000}
            value={costVnd}
            onChange={e => setCostVnd(e.target.value)}
            placeholder="e.g. 1500000"
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ ...fieldRow, marginTop: 10 }}>
        <div style={editLabel}>What was the gift? *</div>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Hand-written birthday card with a bottle of Hibiki 17"
          style={inputStyle}
        />
      </div>

      <div style={{ ...fieldRow, marginTop: 10 }}>
        <div style={editLabel}>Source / supplier</div>
        <input value={source} onChange={e => setSource(e.target.value)} placeholder="Optional — vendor name" style={inputStyle} />
      </div>

      <div style={{ ...fieldRow, marginTop: 10 }}>
        <div style={editLabel}>Why we did this</div>
        <textarea
          value={expectedValue}
          onChange={e => setExpectedValue(e.target.value)}
          rows={2}
          placeholder="The reasoning. Strengthen Bowmore-club affinity. Thank-you for the Mike Tran intro. Recover from the music incident."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Photo */}
      <div style={{ ...fieldRow, marginTop: 10 }}>
        <div style={editLabel}>Photo (optional)</div>
        <input
          type="file"
          accept="image/*"
          onChange={e => { const f = e.target.files?.[0]; if (f) choosePhoto(f) }}
          style={{ ...inputStyle, padding: 6 }}
        />
        {photoPreview && (
          <div style={{ marginTop: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="" style={previewImg} />
            <div style={hintText}>
              {uploadingPhoto ? 'Uploading…' : photoPath ? 'Uploaded' : memberNo ? 'Ready to upload' : 'Pick a member to enable upload'}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button onClick={submit} disabled={submitting || uploadingPhoto || !memberNo} style={{ ...btnPrimary, opacity: !memberNo ? 0.4 : 1 }}>
          {submitting ? 'Saving…' : 'Save gift'}
        </button>
        <button onClick={onCancel} style={btnGhost}>Cancel</button>
      </div>
    </div>
  )
}

// ── small components ──────────────────────────────────────────────────
function StatTile({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={statTile}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color }}>{value}</div>
      {sub && <div style={statSub}>{sub}</div>}
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────
const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 20, marginBottom: 20,
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const linkStyle: React.CSSProperties = {
  color: '#7AB07A', textDecoration: 'underline', textDecorationStyle: 'dotted',
}
const strip: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 10, marginBottom: 16,
}
const statTile: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8, padding: '14px 16px',
}
const statLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const statValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 22, fontWeight: 600,
  marginTop: 4,
}
const statSub: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', marginTop: 2, letterSpacing: '0.04em',
}
const alarmBox: React.CSSProperties = {
  marginBottom: 16, padding: 14,
  background: 'rgba(194,112,112,0.08)', border: '1px solid rgba(194,112,112,0.25)',
  borderLeft: '3px solid #C27070', borderRadius: 6,
}
const alarmHeader: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#C27070', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 8,
}
const unlovedRow: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6,
}
const unlovedChip: React.CSSProperties = {
  padding: '6px 10px', textDecoration: 'none',
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
const filterRow: React.CSSProperties = {
  display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap',
}
const filterChip: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  cursor: 'pointer',
}
const filterChipActive: React.CSSProperties = {
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)',
}
const giftCard: React.CSSProperties = {
  display: 'flex', gap: 14, padding: 14,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8,
}
const giftPhoto: React.CSSProperties = {
  width: 100, height: 100, objectFit: 'cover', borderRadius: 6,
  border: '1px solid rgba(229,212,194,0.10)', flexShrink: 0,
}
const occasionPill: React.CSSProperties = {
  background: 'rgba(212,184,90,0.16)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 3,
  padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}
const categoryPill: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.04em',
}
const costChip: React.CSSProperties = {
  background: 'rgba(122,176,122,0.10)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 3,
  padding: '2px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, fontWeight: 600,
}
const giftMember: React.CSSProperties = {
  display: 'block', marginTop: 6,
  fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
  color: '#E5D4C2', textDecoration: 'none',
}
const giftDescription: React.CSSProperties = {
  marginTop: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', lineHeight: 1.55,
}
const giftMeta: React.CSSProperties = {
  marginTop: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.04em',
}
const whyBox: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px',
  background: 'rgba(212,184,90,0.06)',
  borderLeft: '2px solid #D4B85A', borderRadius: 3,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', lineHeight: 1.55, fontStyle: 'italic',
}
const whyLabel: React.CSSProperties = { fontStyle: 'normal', fontWeight: 600, opacity: 0.7 }
const addBlock: React.CSSProperties = {
  padding: 18, marginBottom: 18,
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 8,
}
const addHeader: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 14,
}
const fieldRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const memberList: React.CSSProperties = {
  marginTop: 6, maxHeight: 200, overflowY: 'auto',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
}
const memberRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  width: '100%', padding: '10px 12px',
  background: 'transparent', border: 'none',
  borderBottom: '1px solid rgba(229,212,194,0.06)',
  color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  cursor: 'pointer', textAlign: 'left',
}
const selectedMemberRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 12px',
  background: 'rgba(122,176,122,0.10)',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 6,
  color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 12,
}
const tinyBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4,
  padding: '4px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, cursor: 'pointer',
}
const metaGrid: React.CSSProperties = {
  display: 'grid', gap: 10, marginTop: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
}
const previewImg: React.CSSProperties = {
  maxWidth: 200, maxHeight: 200, borderRadius: 6,
  border: '1px solid rgba(229,212,194,0.10)',
}
const hintText: React.CSSProperties = {
  marginTop: 4, fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.7,
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
  textDecoration: 'none', textAlign: 'center',
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '12px 22px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const emptyBlock: React.CSSProperties = {
  padding: '60px 20px', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98',
  background: 'rgba(229,212,194,0.02)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 8,
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
// percentUsed not used in this file yet, but kept available for future per-member panel reuse
void percentUsed
