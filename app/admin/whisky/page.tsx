'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Whisky } from '@/lib/types'

// Admin / Whisky Library
//
// Catalogue + bar-stock fill tracking. Each whisky row has an inline fill
// % that staff update on their weekly bar walk; every update writes a
// history entry with the admin's identity, and the page renders both a
// per-row sparkline and an expandable "Inventory trend" graph at the top.
//
// The fill controls live alongside the existing catalogue editor (name /
// distillery / region etc) so a single page does both jobs — no context
// switch between "stock count" and "edit metadata".

const REGIONS = ['Highland', 'Speyside', 'Islay', 'Lowland', 'Campbeltown', 'Islands', 'Japan', 'Ireland', 'Australia', 'Canada', 'China', 'Czechia', 'England', 'France', 'Germany', 'India', 'Mexico', 'Netherlands', 'New Zealand', 'Poland', 'Sweden', 'Switzerland', 'Taiwan', 'USA', 'Vietnam', 'Wales', 'Other'] as const

interface FillHistoryRow {
  id: string
  whisky_id: string
  fill_pct: number
  previous_fill_pct: number | null
  updated_by_email: string | null
  note: string | null
  created_at: string
}

export default function AdminWhisky() {
  const [whiskies, setWhiskies] = useState<Whisky[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Whisky | null>(null)
  const [name, setName] = useState('')
  const [distillery, setDistillery] = useState('')
  const [region, setRegion] = useState('')
  const [caskType, setCaskType] = useState('')
  const [age, setAge] = useState('')
  const [abv, setAbv] = useState('')
  const [tastingNotes, setTastingNotes] = useState('')
  const [committeesPick, setCommitteesPick] = useState(false)
  const [inStock, setInStock] = useState(true)

  // Fill UI state — separate from the catalogue editor so staff can update
  // stock without opening the full edit form.
  const [fillEditing, setFillEditing] = useState<string | null>(null)  // whisky id
  const [draftFill, setDraftFill] = useState<number>(100)
  const [draftNote, setDraftNote] = useState<string>('')
  const [saving, setSaving] = useState<string | null>(null)

  // Expanded rows — click anywhere on the whisky's title strip to reveal
  // its tasting notes inline. A Set so multiple rows can be open at once.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Filter + sort — easier to scan a long catalogue when you're hunting
  // for "the things that need a refill" specifically. The search is
  // multi-token AND-match across every field a staffer might reach for
  // (name, distillery, region, cask type, age, ABV, tasting notes).
  const [filterText, setFilterText] = useState('')
  const [showOnlyLow, setShowOnlyLow] = useState(false)
  const [showOnlyInStock, setShowOnlyInStock] = useState(false)
  const [showOnlyMissingNotes, setShowOnlyMissingNotes] = useState(false)

  // Global trend graph — loaded on demand (the user asked for "upon
  // request" so we don't pay the query cost on every page mount).
  const [trendOpen, setTrendOpen] = useState(false)
  const [history, setHistory] = useState<FillHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const supabase = createBrowserSupabaseClient()

  const load = useCallback(async () => {
    const { data } = await supabase.from('whiskies').select('*').order('name')
    if (data) setWhiskies(data as Whisky[])
  }, [supabase])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setName(''); setDistillery(''); setRegion(''); setCaskType(''); setAge(''); setAbv('')
    setTastingNotes(''); setCommitteesPick(false); setInStock(true)
    setEditing(null); setShowForm(false)
  }

  const startEdit = (w: Whisky) => {
    setName(w.name); setDistillery(w.distillery || ''); setRegion(w.region || '')
    setCaskType(w.cask_type || ''); setAge(w.age || ''); setAbv(w.abv || '')
    setTastingNotes(w.tasting_notes || ''); setCommitteesPick(w.committees_pick); setInStock(w.in_stock)
    setEditing(w); setShowForm(true)
  }

  const handleSubmit = async () => {
    const payload = {
      name, distillery: distillery || null, region: region || null,
      cask_type: caskType || null, age: age || null, abv: abv || null,
      tasting_notes: tastingNotes || null, committees_pick: committeesPick, in_stock: inStock,
    }
    if (editing) {
      await supabase.from('whiskies').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('whiskies').insert(payload)
    }
    resetForm(); load()
  }

  const toggleField = async (id: string, field: 'in_stock' | 'committees_pick', current: boolean) => {
    await supabase.from('whiskies').update({ [field]: !current }).eq('id', id)
    setWhiskies(prev => prev.map(w => w.id === id ? { ...w, [field]: !current } : w))
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this whisky?')) return
    await supabase.from('whiskies').delete().eq('id', id)
    load()
  }

  const startFillEdit = (w: Whisky) => {
    setFillEditing(w.id)
    setDraftFill(w.current_fill_pct ?? 100)
    setDraftNote('')
  }

  const cancelFillEdit = () => {
    setFillEditing(null)
    setDraftNote('')
  }

  const saveFill = async (w: Whisky) => {
    setSaving(w.id)
    try {
      const r = await fetch(`/api/admin/whiskies/fill?id=${encodeURIComponent(w.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fill_pct: draftFill, note: draftNote || undefined }),
      })
      const j = await r.json()
      if (!r.ok) { alert(j.error || 'Failed to save fill'); return }
      // Optimistic merge — the API echo gives us the canonical timestamp
      // and admin email so the audit attribution updates immediately.
      setWhiskies(prev => prev.map(x => x.id === w.id ? {
        ...x,
        current_fill_pct:        j.fill_pct,
        last_fill_updated_at:    j.last_fill_updated_at ?? new Date().toISOString(),
        last_fill_updated_email: j.last_fill_updated_email ?? x.last_fill_updated_email,
      } : x))
      if (j.history) {
        setHistory(prev => [j.history as FillHistoryRow, ...prev])
      }
      cancelFillEdit()
    } finally {
      setSaving(null)
    }
  }

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    setHistoryError(null)
    try {
      const r = await fetch('/api/admin/whiskies/fill', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'failed')
      setHistory(j.history || [])
    } catch (e) {
      setHistoryError((e as Error).message)
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  // Load the full fill history once on mount so the per-row sparklines
  // are populated immediately after a reload. Previously history only
  // loaded when the user opened the global trend graph, which made the
  // sparklines disappear on refresh.
  useEffect(() => { loadHistory() }, [loadHistory])

  const openTrend = () => {
    setTrendOpen(true)
    if (history.length === 0 && !loadingHistory) loadHistory()
  }

  const filtered = useMemo(() => {
    const tokens = filterText.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return whiskies.filter(w => {
      if (showOnlyLow && (w.current_fill_pct ?? 100) > 25) return false
      if (showOnlyInStock && !w.in_stock) return false
      if (showOnlyMissingNotes && !!(w.tasting_notes && w.tasting_notes.trim().length > 0)) return false
      if (tokens.length === 0) return true
      // Match every token in the haystack independently. A staff member
      // can type "islay 10" or "smoky speyside" and get the union of
      // attributes hit, not a brittle single-substring lookup that only
      // checked name/distillery/region.
      const hay = [
        w.name, w.distillery, w.region,
        w.cask_type, w.age, w.abv,
        w.tasting_notes,
      ].filter(Boolean).join(' ').toLowerCase()
      return tokens.every(t => hay.includes(t))
    })
  }, [whiskies, filterText, showOnlyLow, showOnlyInStock, showOnlyMissingNotes])

  const lowCount = useMemo(() => whiskies.filter(w => (w.current_fill_pct ?? 100) <= 25).length, [whiskies])
  const inStockCount = useMemo(() => whiskies.filter(w => w.in_stock).length, [whiskies])
  const missingNotesCount = useMemo(
    () => whiskies.filter(w => !w.tasting_notes || w.tasting_notes.trim().length === 0).length,
    [whiskies]
  )

  // CSV export — current inventory report. Downloads what the user is
  // CURRENTLY looking at (after filter / sort), not always the full
  // catalogue, so "low fill only" + export gives them just the refill list.
  const exportCsv = () => {
    const rows = filtered
    const header = [
      'name', 'distillery', 'region', 'age', 'abv', 'cask_type',
      'in_stock', 'committees_pick',
      'current_fill_pct', 'last_fill_updated_at', 'last_fill_updated_email',
      'tasting_notes',
    ]
    const esc = (v: unknown) => {
      if (v == null) return ''
      const s = String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const lines = [header.join(',')]
    for (const w of rows) {
      lines.push([
        esc(w.name), esc(w.distillery), esc(w.region), esc(w.age), esc(w.abv), esc(w.cask_type),
        esc(w.in_stock ? 'yes' : 'no'),
        esc(w.committees_pick ? 'yes' : 'no'),
        esc(w.current_fill_pct ?? ''),
        esc(w.last_fill_updated_at ?? ''),
        esc(w.last_fill_updated_email ?? ''),
        esc(w.tasting_notes),
      ].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `trc-whisky-inventory-${stamp}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Per-whisky history slices for sparklines. Indexed once per history
  // refresh so each row render is O(1).
  const historyByWhisky = useMemo(() => {
    const m = new Map<string, FillHistoryRow[]>()
    for (const h of history) {
      if (!m.has(h.whisky_id)) m.set(h.whisky_id, [])
      m.get(h.whisky_id)!.push(h)
    }
    return m
  }, [history])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={pageTitle}>Whisky Library</h1>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>+ New Whisky</button>
        )}
      </div>

      <div style={subline}>
        Catalogue + open-bottle fill tracking. Click a fill cell to update — every change is logged with your name and time, and the trend graph reads the same audit trail.
      </div>

      {/* ── Stat strip ─────────────────────────────────────────────────── */}
      <div style={statStrip}>
        <Stat label="Whiskies"        value={whiskies.length} />
        <Stat label="In stock"        value={inStockCount} color="#7AB07A" />
        <Stat label="Low fill (≤25%)" value={lowCount} color={lowCount > 0 ? '#C27070' : '#7E7864'} />
        <Stat label="No tasting notes" value={missingNotesCount} color={missingNotesCount > 0 ? '#D4B85A' : '#7E7864'} />
        <button onClick={exportCsv} style={exportBtn} title="Export the currently-filtered list as CSV">
          ⤓ Export CSV
        </button>
        <button onClick={openTrend} style={trendBtn}>
          {trendOpen ? '↓' : '↑'} Inventory trend
        </button>
      </div>

      {/* ── Global trend graph (lazy-loaded) ──────────────────────────── */}
      {trendOpen && (
        <div style={trendBlock}>
          {loadingHistory ? (
            <div style={emptyText}>Loading history…</div>
          ) : historyError ? (
            <div style={{ ...emptyText, color: '#C27070' }}>{historyError}</div>
          ) : history.length === 0 ? (
            <div style={emptyText}>No fill updates logged yet. The graph will populate as staff record weekly fills.</div>
          ) : (
            <TrendGraph history={history} whiskies={whiskies} />
          )}
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div style={filterRow}>
        <input
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Search across name, distillery, region, cask, age, ABV, tasting notes…"
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        />
        <button onClick={() => setShowOnlyLow(v => !v)} style={{ ...chip, ...(showOnlyLow ? chipActive : null) }}>
          ≤25% only
        </button>
        <button onClick={() => setShowOnlyInStock(v => !v)} style={{ ...chip, ...(showOnlyInStock ? chipActive : null) }}>
          in stock only
        </button>
        <button onClick={() => setShowOnlyMissingNotes(v => !v)} style={{ ...chip, ...(showOnlyMissingNotes ? chipActive : null) }}>
          no notes yet
        </button>
        {(filterText || showOnlyLow || showOnlyInStock || showOnlyMissingNotes) && (
          <button
            onClick={() => { setFilterText(''); setShowOnlyLow(false); setShowOnlyInStock(false); setShowOnlyMissingNotes(false) }}
            style={{ ...chip, color: '#E58F4A' }}
          >
            clear ({filtered.length} / {whiskies.length})
          </button>
        )}
      </div>

      {/* ── New / edit form (unchanged from before) ───────────────────── */}
      {showForm && (
        <div style={editBlock}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {editing ? `Editing: ${editing.name}` : 'New Whisky'}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Distillery</label>
              <input style={inputStyle} value={distillery} onChange={e => setDistillery(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Region</label>
              <select style={inputStyle} value={region} onChange={e => setRegion(e.target.value)}>
                <option value="">Select…</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Cask Type</label>
              <input style={inputStyle} value={caskType} onChange={e => setCaskType(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Age</label>
              <input style={inputStyle} value={age} onChange={e => setAge(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ABV</label>
              <input style={inputStyle} value={abv} onChange={e => setAbv(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tasting Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={tastingNotes} onChange={e => setTastingNotes(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={committeesPick} onChange={e => setCommitteesPick(e.target.checked)} /> Committee&rsquo;s Pick
            </label>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} /> In Stock
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSubmit} style={btnStyle}>{editing ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} style={{ ...btnStyle, opacity: 0.5 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Whisky list with fill column ─────────────────────────────── */}
      <div>
        {filtered.map(w => {
          const fill = w.current_fill_pct ?? 100
          const isEditingFill = fillEditing === w.id
          const wHistory = historyByWhisky.get(w.id) || []
          const sparkPoints = wHistory.slice(0, 12).reverse()  // oldest → newest in the spark
          return (
            <div key={w.id} style={whiskyRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => toggleExpanded(w.id)}
                  style={whiskyTitleBtn}
                  title={expandedIds.has(w.id) ? 'Hide tasting notes' : 'Show tasting notes'}
                >
                  <span style={{ ...expandCaret, transform: expandedIds.has(w.id) ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
                  <span style={whiskyName}>{w.name}</span>
                  {(!w.tasting_notes || w.tasting_notes.trim().length === 0) && (
                    <span style={missingNotesBadge} title="No tasting notes yet — click Edit to add them">
                      ⓘ no notes
                    </span>
                  )}
                  {w.distillery && <span style={whiskySub}>· {w.distillery}</span>}
                  {w.region && <span style={regionPill}>{w.region}</span>}
                </button>
                {w.last_fill_updated_at && (
                  <div style={fillAuditLine}>
                    Last fill: {w.last_fill_updated_email || 'unknown'} · {timeAgo(w.last_fill_updated_at)}
                  </div>
                )}
                {expandedIds.has(w.id) && (
                  <div style={notesBlock}>
                    {w.tasting_notes && w.tasting_notes.trim().length > 0 ? (
                      <>
                        <div style={notesProse}>{w.tasting_notes}</div>
                        <div style={notesAttribution}>
                          {w.tasting_notes_source === 'human'
                            ? 'Entered manually by the team'
                            : w.tasting_notes_source?.startsWith('claude-auto-backfill-')
                              ? `Auto-backfilled · confidence ${w.tasting_notes_confidence ?? '—'}${w.tasting_notes_generated_at ? ' · ' + new Date(w.tasting_notes_generated_at).toLocaleDateString() : ''}`
                              : w.tasting_notes_source
                                ? `Source: ${w.tasting_notes_source}`
                                : null}
                        </div>
                      </>
                    ) : (
                      <div style={notesEmpty}>No tasting notes recorded yet. Click <strong>Edit</strong> on this row to add them.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Fill — inline editable. Click to open slider; saves with note. */}
              <div style={fillCell}>
                {isEditingFill ? (
                  <div style={fillEditor}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="range" min={0} max={100} step={5}
                        value={draftFill}
                        onChange={e => setDraftFill(Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ ...fillPctText, color: fillColor(draftFill), width: 42, textAlign: 'right' }}>
                        {draftFill}%
                      </span>
                    </div>
                    <input
                      value={draftNote}
                      onChange={e => setDraftNote(e.target.value)}
                      placeholder="Optional note (e.g. opened new bottle)"
                      style={{ ...inputStyle, fontSize: 11, padding: '6px 10px' }}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={cancelFillEdit} style={tinyBtn}>cancel</button>
                      <button onClick={() => saveFill(w)} disabled={saving === w.id} style={{ ...tinyBtnPrimary, opacity: saving === w.id ? 0.5 : 1 }}>
                        {saving === w.id ? 'saving…' : 'save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startFillEdit(w)} style={fillDisplayBtn} title="Click to update fill %">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ ...fillPctText, color: fillColor(fill) }}>{fill}%</div>
                      <div style={fillBarTrack}>
                        <div style={{ ...fillBarFill, width: `${fill}%`, background: fillColor(fill) }} />
                      </div>
                      {sparkPoints.length >= 2 && (
                        <Sparkline points={sparkPoints} width={80} height={24} />
                      )}
                    </div>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => toggleField(w.id, 'committees_pick', w.committees_pick)}
                  style={{ ...rowBtn, color: w.committees_pick ? '#E5D4C2' : '#B2AA98', opacity: w.committees_pick ? 1 : 0.4 }}
                >
                  ◆ Pick
                </button>
                <button
                  onClick={() => toggleField(w.id, 'in_stock', w.in_stock)}
                  style={{ ...rowBtn, background: w.in_stock ? 'rgba(94,102,80,0.3)' : 'rgba(229,212,194,0.06)', padding: '2px 10px', borderRadius: 4 }}
                >
                  {w.in_stock ? 'In Stock' : 'Out'}
                </button>
                <button onClick={() => startEdit(w)} style={{ ...rowBtn, opacity: 0.5 }}>Edit</button>
                <button onClick={() => handleDelete(w.id)} style={{ ...rowBtn, opacity: 0.5 }}>Delete</button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={emptyText}>No whiskies match this filter.</div>
        )}
      </div>
    </>
  )
}

// ─── Trend graph ─────────────────────────────────────────────────────────────

function TrendGraph({ history, whiskies }: { history: FillHistoryRow[]; whiskies: Whisky[] }) {
  // Per-whisky lines. We only plot whiskies that have ≥2 history points so
  // the chart isn't a forest of stubs.
  const whiskyName = useMemo(() => {
    const m = new Map<string, string>()
    for (const w of whiskies) m.set(w.id, w.name)
    return m
  }, [whiskies])

  const seriesById = useMemo(() => {
    const m = new Map<string, FillHistoryRow[]>()
    for (const h of [...history].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (!m.has(h.whisky_id)) m.set(h.whisky_id, [])
      m.get(h.whisky_id)!.push(h)
    }
    return [...m.entries()]
      .filter(([, rows]) => rows.length >= 2)
      .map(([id, rows]) => ({ id, name: whiskyName.get(id) || '(unknown)', rows }))
  }, [history, whiskyName])

  // SVG canvas — fixed aspect, 30-day window (or whatever the data covers).
  const W = 880, H = 280, padL = 36, padR = 16, padT = 16, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const allDates = history.map(h => +new Date(h.created_at))
  if (allDates.length === 0) return <div style={emptyText}>No data.</div>
  const minT = Math.min(...allDates)
  const maxT = Math.max(...allDates)
  const tSpan = Math.max(1, maxT - minT)

  const xAt = (iso: string) => padL + ((+new Date(iso) - minT) / tSpan) * innerW
  const yAt = (pct: number) => padT + (1 - pct / 100) * innerH

  // Hover state — highlights one series at a time so a 30-line chart stays
  // readable.
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Stable colour from id hash so a whisky keeps its line colour across
  // page reloads (gold-family palette to match the brand).
  const colourOf = (id: string) => {
    let h = 0
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) & 0xffff
    const hue = (h % 60) - 30  // -30..30 around gold (~45°)
    return `hsl(${45 + hue}, 60%, 60%)`
  }

  return (
    <div>
      <div style={{ ...miniLabel, marginBottom: 8 }}>
        FILL % OVER TIME · {seriesById.length} whisk{seriesById.length === 1 ? 'y' : 'ies'} with ≥2 updates · {history.length} total updates
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Y axis grid + labels (0/25/50/75/100) */}
        {[0, 25, 50, 75, 100].map(pct => (
          <g key={pct}>
            <line
              x1={padL} x2={W - padR}
              y1={yAt(pct)} y2={yAt(pct)}
              stroke="rgba(229,212,194,0.08)" strokeWidth={1} strokeDasharray={pct === 0 ? undefined : '2 4'}
            />
            <text
              x={padL - 6} y={yAt(pct) + 3}
              textAnchor="end"
              fontFamily="'Google Sans Code', monospace" fontSize={9} fill="#7E7864"
            >
              {pct}%
            </text>
          </g>
        ))}

        {/* X axis date ticks (oldest / newest) */}
        <text x={padL} y={H - 10} fontFamily="'Google Sans Code', monospace" fontSize={9} fill="#7E7864">
          {new Date(minT).toLocaleDateString()}
        </text>
        <text x={W - padR} y={H - 10} fontFamily="'Google Sans Code', monospace" fontSize={9} fill="#7E7864" textAnchor="end">
          {new Date(maxT).toLocaleDateString()}
        </text>

        {/* Lines */}
        {seriesById.map(s => {
          const colour = colourOf(s.id)
          const path = s.rows.map((h, i) =>
            `${i === 0 ? 'M' : 'L'} ${xAt(h.created_at)} ${yAt(h.fill_pct)}`
          ).join(' ')
          const isHover = hoveredId === s.id
          return (
            <g key={s.id} onMouseEnter={() => setHoveredId(s.id)} onMouseLeave={() => setHoveredId(null)} style={{ cursor: 'pointer' }}>
              <path
                d={path}
                fill="none"
                stroke={colour}
                strokeWidth={isHover ? 2.4 : 1.4}
                opacity={hoveredId == null || isHover ? 0.95 : 0.18}
              />
              {s.rows.map(h => (
                <circle
                  key={h.id}
                  cx={xAt(h.created_at)} cy={yAt(h.fill_pct)}
                  r={isHover ? 3 : 2} fill={colour}
                  opacity={hoveredId == null || isHover ? 1 : 0.18}
                >
                  <title>{`${s.name}\n${h.fill_pct}% · ${new Date(h.created_at).toLocaleString()}${h.updated_by_email ? `\nby ${h.updated_by_email}` : ''}${h.note ? `\n"${h.note}"` : ''}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={legendWrap}>
        {seriesById.map(s => {
          const colour = colourOf(s.id)
          const dim = hoveredId != null && hoveredId !== s.id
          return (
            <button
              key={s.id}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ ...legendItem, opacity: dim ? 0.3 : 1 }}
            >
              <span style={{ ...legendSwatch, background: colour }} />
              {s.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ points, width, height }: {
  points: FillHistoryRow[]
  width: number
  height: number
}) {
  if (points.length < 2) return null
  const minP = 0, maxP = 100
  const xAt = (i: number) => (i / (points.length - 1)) * (width - 4) + 2
  const yAt = (pct: number) => height - 2 - ((pct - minP) / (maxP - minP)) * (height - 4)
  const path = points.map((h, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(h.fill_pct)}`).join(' ')
  const last = points[points.length - 1].fill_pct
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0 }}>
      <path d={path} fill="none" stroke={fillColor(last)} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── helpers + styles ───────────────────────────────────────────────────────

function fillColor(pct: number): string {
  if (pct <= 25) return '#C27070'
  if (pct <= 50) return '#D4B85A'
  return '#7AB07A'
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString()
}

const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const subline: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.8, lineHeight: 1.7, marginBottom: 18, maxWidth: 760,
}
const statStrip: React.CSSProperties = {
  display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap',
}
const statTile: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 6, padding: '10px 14px',
  minWidth: 120,
}
const statLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const statValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 600,
  marginTop: 2,
}
function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={statTile}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: color || '#E5D4C2' }}>{value}</div>
    </div>
  )
}

const trendBtn: React.CSSProperties = {
  background: 'rgba(212,184,90,0.10)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 6,
  padding: '10px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.08em',
  cursor: 'pointer',
}
const exportBtn: React.CSSProperties = {
  marginLeft: 'auto',
  background: 'rgba(122,176,122,0.10)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.35)', borderRadius: 6,
  padding: '10px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.08em',
  cursor: 'pointer',
}
const trendBlock: React.CSSProperties = {
  marginBottom: 18, padding: 16,
  background: 'rgba(5,46,32,0.6)',
  border: '1px solid rgba(212,184,90,0.25)',
  borderRadius: 8,
}

const filterRow: React.CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap',
}
const chip: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '8px 12px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
}
const chipActive: React.CSSProperties = {
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)',
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.1)', borderRadius: 8,
  padding: '10px 14px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  width: '100%', boxSizing: 'border-box', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
}
const btnStyle: React.CSSProperties = {
  background: 'rgba(229,212,194,0.1)', color: '#E5D4C2', border: 'none',
  borderRadius: 6, padding: '10px 24px', cursor: 'pointer',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
}
const editBlock: React.CSSProperties = {
  padding: 24, background: 'rgba(229,212,194,0.03)',
  borderRadius: 8, marginBottom: 22,
  display: 'flex', flexDirection: 'column', gap: 16,
}

const whiskyRow: React.CSSProperties = {
  padding: '14px 0', borderBottom: '1px solid rgba(229,212,194,0.08)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
}
const whiskyName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, color: '#E5D4C2',
}
const whiskySub: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98',
}
// Whole-title click target — the entire name strip is the disclosure
// affordance so staff don't have to hunt for a tiny chevron.
const whiskyTitleBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  width: '100%', textAlign: 'left',
  background: 'transparent', border: 'none', padding: 0,
  cursor: 'pointer', color: 'inherit',
}
const expandCaret: React.CSSProperties = {
  display: 'inline-block',
  color: '#7E7864', fontSize: 10,
  transition: 'transform 0.18s ease',
}
// Inline tasting-notes block — soft card under the row when expanded.
const notesBlock: React.CSSProperties = {
  marginTop: 8, padding: '10px 14px',
  background: 'rgba(5,46,32,0.45)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderLeft: '2px solid rgba(212,184,90,0.40)',
  borderRadius: 6,
}
const notesProse: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', lineHeight: 1.65, letterSpacing: '0.01em',
  whiteSpace: 'pre-wrap',
}
const notesAttribution: React.CSSProperties = {
  marginTop: 8, paddingTop: 6,
  borderTop: '1px solid rgba(229,212,194,0.08)',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.06em', textTransform: 'uppercase',
}
const notesEmpty: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', fontStyle: 'italic', lineHeight: 1.6,
}
// Small gold badge that surfaces on rows with no tasting notes — staff
// can scan the catalogue and see at a glance which ones still need
// manual entry after the backfill round.
const missingNotesBadge: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A',
  background: 'rgba(212,184,90,0.10)',
  border: '1px solid rgba(212,184,90,0.40)',
  borderRadius: 4, padding: '2px 7px',
  letterSpacing: '0.06em', textTransform: 'uppercase',
  cursor: 'help',
}
const regionPill: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#E5D4C2', background: 'rgba(229,212,194,0.1)',
  borderRadius: 4, padding: '2px 8px',
}
const fillAuditLine: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.04em', marginTop: 2,
}

const fillCell: React.CSSProperties = {
  flex: '0 0 auto', minWidth: 240,
}
const fillDisplayBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 6, padding: '8px 12px', cursor: 'pointer',
  width: '100%', textAlign: 'left',
}
const fillPctText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 13,
  letterSpacing: '0.04em', fontWeight: 600,
}
const fillBarTrack: React.CSSProperties = {
  flex: 1, height: 6, borderRadius: 3,
  background: 'rgba(229,212,194,0.08)', overflow: 'hidden',
}
const fillBarFill: React.CSSProperties = {
  height: '100%', transition: 'width 0.25s ease',
}
const fillEditor: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  padding: 10,
  background: 'rgba(212,184,90,0.08)',
  border: '1px solid rgba(212,184,90,0.35)',
  borderRadius: 6,
}
const tinyBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.16)', borderRadius: 4,
  padding: '4px 10px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  cursor: 'pointer',
}
const tinyBtnPrimary: React.CSSProperties = {
  ...tinyBtn,
  background: 'rgba(94,102,80,0.55)', color: '#E5D4C2',
  borderColor: 'rgba(94,102,80,0.7)',
}

const rowBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#E5D4C2',
}

const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}

const miniLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase',
}
const legendWrap: React.CSSProperties = {
  marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8,
}
const legendItem: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 4, padding: '4px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#E5D4C2',
  cursor: 'pointer',
}
const legendSwatch: React.CSSProperties = {
  display: 'inline-block', width: 10, height: 2, borderRadius: 1,
}
