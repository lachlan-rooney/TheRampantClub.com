'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useToast } from '@/components/admin/dialogs'

// Flavour-tag review queue — the 0.6-0.7 descriptor tail (confirmed=false).
// Machine proposes, human ratifies (mirrors the MIS preference-candidate queue):
// the engine + radar consume ONLY confirmed=true descriptors, so these are
// invisible to consumers until a human confirms. Confirm → confirmed=true
// (trusted); Reject → row deleted. Writes go directly under admin RLS (this is
// curation, not activity-spine grain — same convention as the roster).

const FAMILY = "'Google Sans Code', monospace"

interface Row {
  id: string
  confidence: number
  evidence: string | null
  whisky: { name: string; tasting_notes: string | null } | null
  descriptor: { name: string; category: { name: string } | null } | null
}

export default function FlavourReviewPage() {
  const supabase = createBrowserSupabaseClient()
  const { showToast, toastNode } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('whisky_flavour_tags')
      .select('id, confidence, evidence, whisky:whiskies(name, tasting_notes), descriptor:flavour_descriptors(name, category:flavour_categories(name))')
      .eq('confirmed', false)
      .order('confidence', { ascending: false })
    setRows((data || []) as unknown as Row[])
    setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const confirm = async (r: Row) => {
    setBusyId(r.id)
    const { error } = await supabase.from('whisky_flavour_tags').update({ confirmed: true }).eq('id', r.id)
    setBusyId(null)
    if (error) { showToast(error.message, 'error'); return }
    setRows(prev => prev.filter(x => x.id !== r.id))
    showToast('Confirmed — now trusted.')
  }
  const reject = async (r: Row) => {
    setBusyId(r.id)
    const { error } = await supabase.from('whisky_flavour_tags').delete().eq('id', r.id)
    setBusyId(null)
    if (error) { showToast(error.message, 'error'); return }
    setRows(prev => prev.filter(x => x.id !== r.id))
    showToast('Rejected — removed.')
  }

  // Highlight the evidence phrase inside the prose so the reviewer sees the match.
  const highlight = (prose: string | null, ev: string | null) => {
    if (!prose) return <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No tasting notes.</span>
    if (!ev) return prose
    const i = prose.toLowerCase().indexOf(ev.toLowerCase().slice(0, 24))
    if (i < 0) return prose
    return <>{prose.slice(0, i)}<mark style={{ background: 'rgba(212,184,90,0.25)', color: '#E5D4C2', padding: '0 2px', borderRadius: 2 }}>{prose.slice(i, i + ev.length)}</mark>{prose.slice(i + ev.length)}</>
  }

  return (
    <>
      <Link href="/admin/whisky" style={backLink}>← Whisky library</Link>
      <div style={{ margin: '8px 0 4px' }}>
        <div style={eyebrow}>Whisky · Flavour foundation</div>
        <h1 style={pageTitle}>Flavour-tag review</h1>
      </div>
      <p style={lede}>
        Proposed flavour descriptors in the uncertain band (confidence 0.60–0.70). The radar and the
        future recommendation engine ignore these until you confirm. Check the tag against its evidence
        phrase and the original notes, then confirm (trust it) or reject (remove it).
      </p>

      {loading ? (
        <div style={emptyText}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={emptyText}>Nothing to review — the queue is clear.</div>
      ) : (
        <>
          <div style={{ ...metaText, margin: '14px 0' }}>{rows.length} tag{rows.length === 1 ? '' : 's'} awaiting review</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map(r => (
              <div key={r.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 14 }}>{r.whisky?.name || '—'}</span>
                    <span style={{ ...metaText, marginLeft: 10 }}>
                      {r.descriptor?.category?.name || '—'} › <span style={{ color: '#D4B85A' }}>{r.descriptor?.name || '—'}</span>
                    </span>
                  </div>
                  <span style={confPill}>conf {Number(r.confidence).toFixed(2)}</span>
                </div>
                <div style={evidenceRow}>evidence: <span style={{ color: '#E5D4C2' }}>“{r.evidence || '—'}”</span></div>
                <div style={proseRow}>{highlight(r.whisky?.tasting_notes || null, r.evidence)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => confirm(r)} disabled={busyId === r.id} style={confirmBtn}>✓ Confirm</button>
                  <button onClick={() => reject(r)} disabled={busyId === r.id} style={rejectBtn}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {toastNode}
    </>
  )
}

const eyebrow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }
const backLink: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', textDecoration: 'none', opacity: 0.7 }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', margin: 0 }
const lede: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 720, margin: '8px 0 0' }
const metaText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98' }
const card: React.CSSProperties = { padding: 14, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.08)', borderRadius: 8 }
const confPill: React.CSSProperties = { fontFamily: FAMILY, fontSize: 10, color: '#D4B85A', background: 'rgba(212,184,90,0.12)', padding: '2px 8px', borderRadius: 10 }
const evidenceRow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', marginTop: 8 }
const proseRow: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', opacity: 0.85, lineHeight: 1.6, marginTop: 6, padding: '8px 10px', background: 'rgba(5,46,32,0.4)', borderRadius: 6 }
const confirmBtn: React.CSSProperties = { background: 'rgba(122,176,122,0.15)', color: '#7AB07A', border: '1px solid rgba(122,176,122,0.4)', borderRadius: 5, padding: '6px 14px', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
const rejectBtn: React.CSSProperties = { background: 'transparent', color: '#C27070', border: '1px solid rgba(194,112,112,0.4)', borderRadius: 5, padding: '6px 14px', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
const emptyText: React.CSSProperties = { padding: '40px 0', textAlign: 'center', fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.6, fontStyle: 'italic' }
