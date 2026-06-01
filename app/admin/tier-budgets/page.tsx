'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatVnd } from '@/lib/gifting'

// Admin / House / Tier Budgets
//
// Per-tier annual dues + gifting %. Drives every member's gifting
// budget via members.tier → tier_budgets.

interface TierBudget {
  tier: string
  annual_dues_vnd: number
  gifting_pct: number
  notes: string | null
  updated_at: string
}

export default function TierBudgetsPage() {
  const [tiers, setTiers] = useState<TierBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, Partial<TierBudget>>>({})
  const [savingTier, setSavingTier] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/tier-budgets', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setTiers(d.tiers || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const setDraft = (tier: string, partial: Partial<TierBudget>) => {
    setDrafts(d => ({ ...d, [tier]: { ...(d[tier] || {}), ...partial } }))
  }

  const save = async (tier: string) => {
    const d = drafts[tier]
    if (!d) return
    setSavingTier(tier); setError(null)
    try {
      const r = await fetch(`/api/admin/tier-budgets/${encodeURIComponent(tier)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Save failed')
      setDrafts(prev => { const next = { ...prev }; delete next[tier]; return next })
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingTier(null)
    }
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>House · Settings</div>
        <h1 style={pageTitle}>Tier Budgets</h1>
        <p style={lede}>
          Annual dues and gifting percentage per membership tier. Each member&apos;s annual gifting budget is computed live as <Code>annual_dues × gifting_pct</Code>. The budget year runs from the member&apos;s previous anniversary to the next.
        </p>
        <p style={{ ...lede, marginTop: 8 }}>
          The founder/GM owns this page — change the dues when contracts change, dial the gifting % up or down (10–15% is the recommended band) when calibrating the &quot;invisible love&quot; budget.
        </p>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tiers.map(t => {
            const d = drafts[t.tier] || {}
            const dues = d.annual_dues_vnd ?? t.annual_dues_vnd
            const pct  = d.gifting_pct ?? t.gifting_pct
            const computed = Math.floor(Number(dues) * Number(pct) / 100)
            const dirty = drafts[t.tier] != null
            return (
              <div key={t.tier} style={tierCard}>
                <div style={tierHeader}>
                  <div style={tierName}>{t.tier}</div>
                  <div style={budgetSummary}>
                    Annual gifting budget · <span style={budgetValue}>{formatVnd(computed)}</span>
                  </div>
                </div>

                <div style={tierGrid}>
                  <div>
                    <div style={editLabel}>Annual dues (VND)</div>
                    <input
                      type="number" min={0} step={100000}
                      value={dues}
                      onChange={e => setDraft(t.tier, { annual_dues_vnd: Number(e.target.value) })}
                      style={inputStyle}
                    />
                    <div style={hintText}>{formatVnd(dues)}</div>
                  </div>
                  <div>
                    <div style={editLabel}>Gifting %</div>
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={pct}
                      onChange={e => setDraft(t.tier, { gifting_pct: Number(e.target.value) })}
                      style={inputStyle}
                    />
                    <div style={hintText}>10–15% recommended</div>
                  </div>
                  <div>
                    <div style={editLabel}>Notes</div>
                    <input
                      value={d.notes ?? t.notes ?? ''}
                      onChange={e => setDraft(t.tier, { notes: e.target.value })}
                      placeholder="Optional context"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {dirty && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => save(t.tier)} disabled={savingTier === t.tier} style={btnPrimary}>
                      {savingTier === t.tier ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setDrafts(prev => { const next = { ...prev }; delete next[t.tier]; return next })}
                      style={btnGhost}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ ...hintRow, marginTop: 22 }}>
        Adjusting a tier changes <strong style={{ color: '#E5D4C2' }}>every member&apos;s</strong> live gifting budget for the current cycle.
        <Link href="/admin/gifts" style={{ ...linkStyle, marginLeft: 8 }}>Open the gifts ledger →</Link>
      </div>
    </>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code style={codeStyle}>{children}</code>
}

const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 30, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const tierCard: React.CSSProperties = {
  padding: 18,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8,
}
const tierHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  gap: 14, marginBottom: 14, flexWrap: 'wrap',
}
const tierName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 22, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const budgetSummary: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const budgetValue: React.CSSProperties = {
  color: '#D4B85A', fontWeight: 600, fontSize: 13,
}
const tierGrid: React.CSSProperties = {
  display: 'grid', gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
const hintRow: React.CSSProperties = {
  padding: '10px 14px',
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.18)',
  borderLeft: '2px solid #D4B85A', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', lineHeight: 1.55,
}
const linkStyle: React.CSSProperties = {
  color: '#7AB07A', textDecoration: 'underline', textDecorationStyle: 'dotted',
}
const codeStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.6)', padding: '2px 6px', borderRadius: 4,
  border: '1px solid rgba(229,212,194,0.10)',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#D4B85A',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
