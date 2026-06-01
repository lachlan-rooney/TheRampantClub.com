'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { OCCASIONS, OCCASION_LABELS, CATEGORIES, CATEGORY_LABELS, formatVnd, type Occasion, type Category } from '@/lib/gifting'
import { vnDateString } from '@/lib/datetime'

// Per-member gifting panel. Drops into the MIS member profile.
// Surfaces the budget bar, this-year's gifts, and a collapsible inline
// "Log a gift" form with photo upload.

interface Summary {
  member_no: string
  annual_budget_vnd: number
  spent_vnd: number
  gift_count: number
  window_start: string | null
  window_end: string | null
  annual_dues_vnd: number
  gifting_pct: number
}

interface Gift {
  id: string
  gift_date: string
  occasion: string
  category: string | null
  description: string
  source: string | null
  cost_vnd: number
  expected_value: string | null
  given_by: string | null
  photo_url: string | null
  created_at: string
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function GiftingPanel({ memberNo, memberName }: { memberNo: string; memberName: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [thisYearGifts, setThisYearGifts] = useState<Gift[]>([])
  const [allGifts, setAllGifts] = useState<Gift[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [photoCache, setPhotoCache] = useState<Record<string, { url: string; expires: number }>>({})

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/gifts/summary?member_no=${encodeURIComponent(memberNo)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setSummary(d.summary)
        setThisYearGifts(d.this_year_gifts || [])
        setAllGifts(d.all_gifts || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [memberNo])
  useEffect(() => { load() }, [load])

  // Hydrate signed read URLs for any gift photos.
  useEffect(() => {
    const all = showAll ? allGifts : thisYearGifts
    const now = Date.now()
    const need = all.filter(g => g.photo_url && (!photoCache[g.photo_url] || photoCache[g.photo_url].expires < now))
    if (need.length === 0) return
    need.forEach(async g => {
      try {
        const r = await fetch(`/api/admin/gifts/photo-upload?path=${encodeURIComponent(g.photo_url!)}`)
        const j = await r.json()
        if (j.url) setPhotoCache(c => ({ ...c, [g.photo_url!]: { url: j.url, expires: Date.now() + 50 * 60 * 1000 } }))
      } catch { /* ignore */ }
    })
  }, [thisYearGifts, allGifts, showAll, photoCache])

  if (loading) return null

  const hasBudget = summary && summary.annual_budget_vnd > 0
  const spent = Number(summary?.spent_vnd || 0)
  const budget = Number(summary?.annual_budget_vnd || 0)
  const remaining = Math.max(0, budget - spent)
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
  const giftsToShow = showAll ? allGifts : thisYearGifts

  return (
    <div style={panel}>
      <div style={panelHeader}>
        <div style={panelLabel}>Gifting · Unreasonable Hospitality</div>
        <button onClick={() => setFormOpen(o => !o)} style={addBtn}>
          {formOpen ? 'Cancel' : '＋ Log a gift'}
        </button>
      </div>

      {!summary ? (
        <div style={emptyHint}>No member record found.</div>
      ) : !hasBudget ? (
        <div style={noBudgetBox}>
          No gifting budget configured for this tier ({summary.gifting_pct}% of {formatVnd(summary.annual_dues_vnd)}).
          Either set tier dues + gifting % in <a href="/admin/tier-budgets" style={linkStyle}>tier budgets</a>, or accept that this member has no automatic budget allocation.
        </div>
      ) : (
        <>
          {/* Budget strip */}
          <div style={budgetGrid}>
            <Stat label="Annual budget" value={formatVnd(budget)} color="#D4B85A" />
            <Stat label="Spent this cycle" value={formatVnd(spent)} color={spent > 0 ? '#7AB07A' : '#B2AA98'} sub={`${pct}% used · ${summary.gift_count} ${summary.gift_count === 1 ? 'gift' : 'gifts'}`} />
            <Stat label="Remaining" value={formatVnd(remaining)} color="#E5D4C2" />
          </div>

          {/* Progress bar + window */}
          <div style={progressBlock}>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${pct}%`, background: summary.gift_count === 0 ? '#C27070' : '#7AB07A' }} />
            </div>
            <div style={progressMeta}>
              Cycle: {summary.window_start} → {summary.window_end}
              {summary.gift_count === 0 && <span style={{ color: '#C27070', marginLeft: 8 }}>· no gifts yet this cycle</span>}
            </div>
          </div>
        </>
      )}

      {/* Inline log form */}
      {formOpen && (
        <LogGiftInline
          memberNo={memberNo}
          memberName={memberName}
          onCancel={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load() }}
        />
      )}

      {/* Gift list */}
      {(thisYearGifts.length > 0 || allGifts.length > 0) && (
        <>
          <div style={listHeader}>
            <div style={listTitle}>
              {showAll ? 'All gifts on file' : 'Gifts this cycle'}
              <span style={countBadge}>{giftsToShow.length}</span>
            </div>
            {allGifts.length > thisYearGifts.length && (
              <button onClick={() => setShowAll(s => !s)} style={tinyBtn}>
                {showAll ? 'Just this cycle' : `Show all ${allGifts.length}`}
              </button>
            )}
          </div>
          {giftsToShow.length === 0 ? (
            <div style={emptyHint}>No gifts in the current cycle.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {giftsToShow.map(g => {
                const photoUrl = g.photo_url ? photoCache[g.photo_url]?.url || null : null
                return (
                  <div key={g.id} style={giftRow}>
                    {photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt="" style={giftPhoto} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={occPill}>{OCCASION_LABELS[g.occasion as Occasion] || g.occasion}</span>
                        {g.category && <span style={catPill}>{CATEGORY_LABELS[g.category as Category] || g.category}</span>}
                        <span style={costChip}>{formatVnd(g.cost_vnd)}</span>
                        <span style={{ marginLeft: 'auto', fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#7E7864' }}>
                          {g.gift_date}
                        </span>
                      </div>
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
      )}
    </div>
  )
}

// ── LogGiftInline ─────────────────────────────────────────────────────
function LogGiftInline({ memberNo, memberName, onCancel, onSaved }: {
  memberNo: string
  memberName: string
  onCancel: () => void
  onSaved: () => void
}) {
  const [giftDate, setGiftDate] = useState(vnDateString())
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
  const uploadIdRef = useRef(0)

  const choosePhoto = async (file: File) => {
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoPath(null)
    await uploadPhoto(file)
  }

  const uploadPhoto = async (file: File) => {
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
      if (myId === uploadIdRef.current) setPhotoPath(j.path)
    } catch (e) {
      if (myId === uploadIdRef.current) setError(`Photo upload failed: ${(e as Error).message}`)
    } finally {
      if (myId === uploadIdRef.current) setUploadingPhoto(false)
    }
  }

  const submit = async () => {
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

  void photoFile  // keep the prop wired even if we don't render the File itself
  return (
    <div style={formBlock}>
      <div style={formTitle}>Log a gift for {memberName}</div>
      {error && <div style={errorBox}>{error}</div>}

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
          <input type="number" min={0} step={50000} value={costVnd} onChange={e => setCostVnd(e.target.value)} placeholder="e.g. 1500000" style={inputStyle} />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={editLabel}>What was the gift? *</div>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Hand-written birthday card with a bottle of Hibiki 17" style={inputStyle} />
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={editLabel}>Source / supplier</div>
        <input value={source} onChange={e => setSource(e.target.value)} placeholder="Optional — vendor name" style={inputStyle} />
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={editLabel}>Why we did this</div>
        <textarea
          value={expectedValue}
          onChange={e => setExpectedValue(e.target.value)}
          rows={2}
          placeholder="Strengthen Bowmore-club affinity. Recover from the music incident."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
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
            <div style={hintText}>{uploadingPhoto ? 'Uploading…' : photoPath ? 'Uploaded' : 'Waiting…'}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={submitting || uploadingPhoto} style={btnPrimary}>
          {submitting ? 'Saving…' : 'Save gift'}
        </button>
        <button onClick={onCancel} style={btnGhost}>Cancel</button>
      </div>
    </div>
  )
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={statTile}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color }}>{value}</div>
      {sub && <div style={statSub}>{sub}</div>}
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────
const panel: React.CSSProperties = {
  marginBottom: 32, padding: 22,
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10,
}
const panelHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 14, gap: 12, flexWrap: 'wrap',
}
const panelLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const addBtn: React.CSSProperties = {
  border: 'none', borderRadius: 6, padding: '8px 14px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.06em', cursor: 'pointer',
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
}
const noBudgetBox: React.CSSProperties = {
  padding: '12px 14px',
  background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.65, opacity: 0.85,
}
const linkStyle: React.CSSProperties = {
  color: '#7AB07A', textDecoration: 'underline', textDecorationStyle: 'dotted',
}
const budgetGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 10, marginBottom: 14,
}
const statTile: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8, padding: '12px 14px',
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
const progressBlock: React.CSSProperties = {
  marginBottom: 16,
}
const progressTrack: React.CSSProperties = {
  height: 4, background: 'rgba(229,212,194,0.08)', borderRadius: 2, overflow: 'hidden',
}
const progressFill: React.CSSProperties = {
  height: '100%', transition: 'width 0.4s ease',
}
const progressMeta: React.CSSProperties = {
  marginTop: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const listHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: 18, marginBottom: 10, gap: 12,
}
const listTitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase',
  display: 'flex', alignItems: 'center', gap: 6,
}
const countBadge: React.CSSProperties = {
  background: 'rgba(212,184,90,0.20)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 10,
  padding: '0 7px', fontSize: 9, fontWeight: 600,
}
const tinyBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4,
  padding: '4px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, cursor: 'pointer', letterSpacing: '0.06em',
}
const giftRow: React.CSSProperties = {
  display: 'flex', gap: 12, padding: 12,
  background: 'rgba(5,46,32,0.4)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 6,
}
const giftPhoto: React.CSSProperties = {
  width: 80, height: 80, objectFit: 'cover', borderRadius: 4,
  border: '1px solid rgba(229,212,194,0.10)', flexShrink: 0,
}
const occPill: React.CSSProperties = {
  background: 'rgba(212,184,90,0.16)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 3,
  padding: '2px 7px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
}
const catPill: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '2px 7px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
}
const costChip: React.CSSProperties = {
  background: 'rgba(122,176,122,0.10)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 3,
  padding: '2px 7px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, fontWeight: 600,
}
const giftDescription: React.CSSProperties = {
  marginTop: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', lineHeight: 1.5,
}
const giftMeta: React.CSSProperties = {
  marginTop: 3,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.04em',
}
const whyBox: React.CSSProperties = {
  marginTop: 6, padding: '4px 8px',
  background: 'rgba(212,184,90,0.06)',
  borderLeft: '2px solid #D4B85A', borderRadius: 3,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', lineHeight: 1.55, fontStyle: 'italic',
}
const whyLabel: React.CSSProperties = { fontStyle: 'normal', fontWeight: 600, opacity: 0.7 }
const emptyHint: React.CSSProperties = {
  padding: '12px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.5, fontStyle: 'italic',
}
const formBlock: React.CSSProperties = {
  marginTop: 14, padding: 16,
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 8,
}
const formTitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase',
  marginBottom: 12,
}
const metaGrid: React.CSSProperties = {
  display: 'grid', gap: 10,
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
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
  padding: '10px 18px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 18px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
}
const errorBox: React.CSSProperties = {
  marginBottom: 12, padding: '8px 12px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
