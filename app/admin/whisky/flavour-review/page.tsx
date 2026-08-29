'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useToast } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'

// Flavour review queue (confirmed=false) — machine proposes, human ratifies
// (mirrors the MIS preference-candidate queue). Two queues:
//   • Radar spokes  — whisky_flavour_intensities (the family intensities the
//     match maths actually consumes). The Compass migration re-queued every
//     split-routed + additive spoke here, so this is where the 200-odd migrated
//     rows land. The family filter + "confirm all shown" let you ratify a whole
//     family at once — an evening, not a week.
//   • Descriptors   — whisky_flavour_tags (the tier-2 detail tail).
// The engine + radar consume ONLY confirmed=true rows, so these are invisible to
// members until confirmed. Confirm → confirmed=true; Reject → row deleted.
// Writes go directly under admin RLS (curation, not activity-spine grain).

const FAMILY = "'Google Sans Code', monospace"
type Mode = 'spokes' | 'tags'

interface Cat { slug: string; name: string }
interface IntRow {
  id: string; category_slug: string; intensity: number; confidence: number; evidence: string | null
  whisky: { name: string; tasting_notes: string | null } | null
  category: Cat | null
}
interface TagRow {
  id: string; confidence: number; evidence: string | null
  whisky: { name: string; tasting_notes: string | null } | null
  descriptor: { name: string; category: Cat | null } | null
}

export default function FlavourReviewPage() {
  const { t } = useLang()
  const supabase = createBrowserSupabaseClient()
  const { showToast, toastNode } = useToast()
  const [mode, setMode] = useState<Mode>('spokes')
  const [intRows, setIntRows] = useState<IntRow[]>([])
  const [tagRows, setTagRows] = useState<TagRow[]>([])
  const [family, setFamily] = useState('')            // '' = all families
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [ints, tags] = await Promise.all([
      supabase.from('whisky_flavour_intensities')
        .select('id, category_slug, intensity, confidence, evidence, whisky:whiskies(name, tasting_notes), category:flavour_categories(slug, name)')
        .eq('confirmed', false).order('category_slug', { ascending: true }).order('confidence', { ascending: false }),
      supabase.from('whisky_flavour_tags')
        .select('id, confidence, evidence, whisky:whiskies(name, tasting_notes), descriptor:flavour_descriptors(name, category:flavour_categories(slug, name))')
        .eq('confirmed', false).order('confidence', { ascending: false }),
    ])
    setIntRows((ints.data || []) as unknown as IntRow[])
    setTagRows((tags.data || []) as unknown as TagRow[])
    setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const table = () => (mode === 'spokes' ? 'whisky_flavour_intensities' : 'whisky_flavour_tags')
  const famOf = (r: IntRow | TagRow): Cat | null => mode === 'spokes' ? (r as IntRow).category : (r as TagRow).descriptor?.category || null

  // Families present in the current queue, with counts → the batch filter.
  const families = useMemo(() => {
    const src = mode === 'spokes' ? intRows : tagRows
    const m = new Map<string, { name: string; n: number }>()
    for (const r of src) { const c = famOf(r); if (!c) continue; const e = m.get(c.slug) || { name: c.name, n: 0 }; e.n++; m.set(c.slug, e) }
    return [...m.entries()].map(([slug, v]) => ({ slug, ...v })).sort((a, b) => a.name.localeCompare(b.name))
  }, [mode, intRows, tagRows])  // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const src: (IntRow | TagRow)[] = mode === 'spokes' ? intRows : tagRows
    return family ? src.filter(r => famOf(r)?.slug === family) : src
  }, [mode, family, intRows, tagRows])  // eslint-disable-line react-hooks/exhaustive-deps

  const dropLocal = (id: string) => {
    if (mode === 'spokes') setIntRows(p => p.filter(x => x.id !== id))
    else setTagRows(p => p.filter(x => x.id !== id))
  }

  const confirm = async (id: string) => {
    setBusyId(id)
    const { error } = await supabase.from(table()).update({ confirmed: true }).eq('id', id)
    setBusyId(null)
    if (error) { showToast(error.message, 'error'); return }
    dropLocal(id); showToast(t('Confirmed — now trusted.', 'Đã xác nhận — nay được tin dùng.'))
  }
  const reject = async (id: string) => {
    setBusyId(id)
    const { error } = await supabase.from(table()).delete().eq('id', id)
    setBusyId(null)
    if (error) { showToast(error.message, 'error'); return }
    dropLocal(id); showToast(t('Rejected — removed.', 'Đã từ chối — đã loại bỏ.'))
  }
  const confirmAllShown = async () => {
    const ids = shown.map(r => r.id)
    if (!ids.length) return
    setBulkBusy(true)
    const { error } = await supabase.from(table()).update({ confirmed: true }).in('id', ids)
    setBulkBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    const set = new Set(ids)
    if (mode === 'spokes') setIntRows(p => p.filter(x => !set.has(x.id)))
    else setTagRows(p => p.filter(x => !set.has(x.id)))
    showToast(t(`Confirmed ${ids.length} — now trusted.`, `Đã xác nhận ${ids.length} — nay được tin dùng.`))
  }

  // Highlight the evidence phrase inside the prose so the reviewer sees the match.
  const highlight = (prose: string | null, ev: string | null) => {
    if (!prose) return <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('No tasting notes.', 'Không có ghi chú nếm.')}</span>
    if (!ev) return prose
    const i = prose.toLowerCase().indexOf(ev.toLowerCase().slice(0, 24))
    if (i < 0) return prose
    return <>{prose.slice(0, i)}<mark style={{ background: 'rgba(212,184,90,0.25)', color: '#E5D4C2', padding: '0 2px', borderRadius: 2 }}>{prose.slice(i, i + ev.length)}</mark>{prose.slice(i + ev.length)}</>
  }

  const intCount = intRows.length, tagCount = tagRows.length

  return (
    <>
      <Link href="/admin/whisky" style={backLink}>{t('← Whisky library', '← Thư viện whisky')}</Link>
      <div style={{ margin: '8px 0 4px' }}>
        <div style={eyebrow}>{t('Whisky · Flavour foundation', 'Whisky · Nền tảng hương vị')}</div>
        <h1 style={pageTitle}>{t('Flavour review', 'Duyệt hương vị')}</h1>
      </div>
      <p style={lede}>
        {t('Proposed rows the engine ignores until you ratify them. Radar spokes are the family intensities matching runs on (the Compass migration re-queued every split-routed & additive spoke here); descriptors are the tier-2 detail. Check each against its evidence phrase, then confirm or reject — or filter to a family and confirm the whole batch.', 'Các hàng đề xuất mà bộ máy bỏ qua cho đến khi bạn phê duyệt. Nan radar là cường độ họ hương vị mà việc so khớp sử dụng; mô tả là chi tiết cấp hai. Đối chiếu từng mục với cụm bằng chứng, rồi xác nhận hoặc từ chối — hoặc lọc theo một họ và xác nhận cả loạt.')}
      </p>

      {/* queue tabs */}
      <div style={{ display: 'flex', gap: 8, margin: '16px 0 6px' }}>
        <button onClick={() => { setMode('spokes'); setFamily('') }} style={mode === 'spokes' ? tabOn : tabOff}>
          {t('Radar spokes', 'Nan radar')} · {intCount}
        </button>
        <button onClick={() => { setMode('tags'); setFamily('') }} style={mode === 'tags' ? tabOn : tabOff}>
          {t('Descriptors', 'Mô tả')} · {tagCount}
        </button>
      </div>

      {/* family filter + batch confirm */}
      {!loading && (mode === 'spokes' ? intCount : tagCount) > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '10px 0 4px' }}>
          <select value={family} onChange={e => setFamily(e.target.value)} style={selectBox}>
            <option value="">{t('All families', 'Tất cả họ')} ({(mode === 'spokes' ? intCount : tagCount)})</option>
            {families.map(f => <option key={f.slug} value={f.slug}>{f.name} ({f.n})</option>)}
          </select>
          <button onClick={confirmAllShown} disabled={bulkBusy || !shown.length} style={{ ...bulkBtn, opacity: bulkBusy || !shown.length ? 0.5 : 1 }}>
            {bulkBusy ? t('Confirming…', 'Đang xác nhận…') : t(`✓ Confirm all shown (${shown.length})`, `✓ Xác nhận tất cả (${shown.length})`)}
          </button>
        </div>
      )}

      {loading ? (
        <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
      ) : shown.length === 0 ? (
        <div style={emptyText}>{t('Nothing to review — the queue is clear.', 'Không có gì để duyệt — hàng chờ đã trống.')}</div>
      ) : (
        <>
          <div style={{ ...metaText, margin: '14px 0' }}>{shown.length} {t('awaiting review', 'đang chờ duyệt')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shown.map(r => {
              const isSpoke = mode === 'spokes'
              const cat = famOf(r)
              const detail = isSpoke
                ? <span style={{ color: '#D4B85A' }}>{t('intensity', 'cường độ')} {(r as IntRow).intensity}/4</span>
                : <><span>{cat?.name || '—'} › </span><span style={{ color: '#D4B85A' }}>{(r as TagRow).descriptor?.name || '—'}</span></>
              return (
                <div key={r.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ color: '#E5D4C2', fontFamily: FAMILY, fontSize: 14 }}>{r.whisky?.name || '—'}</span>
                      <span style={{ ...metaText, marginLeft: 10 }}>{isSpoke ? <span style={{ color: '#7AB07A' }}>{cat?.name || '—'}</span> : null} {detail}</span>
                    </div>
                    <span style={confPill}>{t('conf', 'độ tin')} {Number(r.confidence).toFixed(2)}</span>
                  </div>
                  <div style={evidenceRow}>{t('evidence', 'bằng chứng')}: <span style={{ color: '#E5D4C2' }}>“{r.evidence || '—'}”</span></div>
                  <div style={proseRow}>{highlight(r.whisky?.tasting_notes || null, r.evidence)}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => confirm(r.id)} disabled={busyId === r.id} style={confirmBtn}>{t('✓ Confirm', '✓ Xác nhận')}</button>
                    <button onClick={() => reject(r.id)} disabled={busyId === r.id} style={rejectBtn}>{t('✕ Reject', '✕ Từ chối')}</button>
                  </div>
                </div>
              )
            })}
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
const tabOn: React.CSSProperties = { background: 'rgba(212,184,90,0.16)', color: '#D4B85A', border: '1px solid rgba(212,184,90,0.45)', borderRadius: 6, padding: '7px 14px', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
const tabOff: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.14)', borderRadius: 6, padding: '7px 14px', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
const selectBox: React.CSSProperties = { background: 'rgba(5,46,32,0.6)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '7px 10px', fontFamily: FAMILY, fontSize: 11 }
const bulkBtn: React.CSSProperties = { background: 'rgba(122,176,122,0.18)', color: '#7AB07A', border: '1px solid rgba(122,176,122,0.45)', borderRadius: 6, padding: '7px 14px', fontFamily: FAMILY, fontSize: 11, cursor: 'pointer' }
