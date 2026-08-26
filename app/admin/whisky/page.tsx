'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useToast } from '@/components/admin/dialogs'
import WhiskyFlavourPanel from '@/components/whisky/WhiskyFlavourPanel'
import { useLang } from '@/lib/admin-lang'
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
  const { t } = useLang()
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
  // Deep-link from an Ops Hub card link (?focus=<whisky id>) → expand + scroll + ring.
  const [focusId, setFocusId] = useState<string | null>(null)
  useEffect(() => { setFocusId(new URLSearchParams(window.location.search).get('focus')) }, [])
  useEffect(() => {
    if (!focusId || whiskies.length === 0) return
    setExpandedIds(prev => new Set(prev).add(focusId))
    const el = document.getElementById(`whisky-${focusId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusId, whiskies.length])
  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Stocktake mode ──────────────────────────────────────────────────
  // When active: a snapshot of each whisky's pre-stocktake fill is held
  // so the report can show before → after. Reviewed whiskies sink to the
  // bottom of the list, dimmed, until the session is finished and the
  // alphabetical order is restored.
  const [stocktakeMode, setStocktakeMode] = useState(false)
  const [stocktakeStartedAt, setStocktakeStartedAt] = useState<string | null>(null)
  const [stocktakeBefore, setStocktakeBefore] = useState<Map<string, number | null>>(new Map())
  // For each reviewed whisky: { fillBefore, fillAfter, changed, note? }
  const [stocktakeReviewed, setStocktakeReviewed] = useState<Map<string, {
    fillBefore: number | null; fillAfter: number; changed: boolean; note: string | null
  }>>(new Map())

  const startStocktake = () => {
    const snap = new Map<string, number | null>()
    for (const w of whiskies) snap.set(w.id, w.current_fill_pct ?? null)
    setStocktakeBefore(snap)
    setStocktakeReviewed(new Map())
    setStocktakeStartedAt(new Date().toISOString())
    setStocktakeMode(true)
  }

  // Modal-driven cancel — branded confirmation, not the OS-native dialog
  // that breaks the visual frame. Same posture as the delete modal but
  // amber (judgment-level decision) rather than red (destructive).
  const [stocktakeCancelOpen, setStocktakeCancelOpen] = useState(false)
  const cancelStocktake = () => setStocktakeCancelOpen(true)
  const confirmCancelStocktake = () => {
    setStocktakeMode(false)
    setStocktakeBefore(new Map())
    setStocktakeReviewed(new Map())
    setStocktakeStartedAt(null)
    setStocktakeCancelOpen(false)
  }
  const dismissCancelStocktake = () => setStocktakeCancelOpen(false)

  // Non-blocking toast for friendly notices (replaces alert()).
  const { showToast, toastNode } = useToast()

  // Auto-marks a whisky as reviewed during stocktake. Called from the
  // fill-save flow and from the explicit "no change" button.
  const markReviewed = useCallback((w: Whisky, fillAfter: number, changed: boolean, note: string | null) => {
    setStocktakeReviewed(prev => {
      const next = new Map(prev)
      next.set(w.id, {
        fillBefore: stocktakeBefore.get(w.id) ?? null,
        fillAfter,
        changed,
        note,
      })
      return next
    })
  }, [stocktakeBefore])

  const finishStocktake = async () => {
    if (stocktakeReviewed.size === 0) {
      showToast(t('No whiskies reviewed yet — mark at least one before finishing.', 'Chưa kiểm kê chai nào — hãy đánh dấu ít nhất một chai trước khi kết thúc.'), 'warn')
      return
    }
    // Detailed report CSV.
    const reviewed = [...stocktakeReviewed.entries()]
    const byId = new Map(whiskies.map(w => [w.id, w]))
    const esc = (v: unknown) => {
      if (v == null) return ''
      const s = String(v)
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const lines = [
      'name,distillery,region,fill_before_pct,fill_after_pct,delta_pct,changed,note,reviewed_at',
    ]
    const finishedAt = new Date().toISOString()
    for (const [id, r] of reviewed) {
      const w = byId.get(id)
      if (!w) continue
      const delta = (r.fillBefore == null) ? r.fillAfter : (r.fillAfter - r.fillBefore)
      lines.push([
        esc(w.name), esc(w.distillery), esc(w.region),
        esc(r.fillBefore ?? ''), esc(r.fillAfter), esc(delta),
        esc(r.changed ? 'yes' : 'no'),
        esc(r.note ?? ''),
        esc(finishedAt),
      ].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = finishedAt.slice(0, 10)
    a.href = url
    a.download = `trc-stocktake-${stamp}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Persist a session row so the history panel reflects it. Failure
    // here is non-fatal — the CSV is already downloaded — but log a
    // toast so staff know to retry or note it.
    try {
      const summary = reviewed
        .map(([id, r]) => {
          const w = byId.get(id)
          if (!w) return null
          return { id, name: w.name, fill_before: r.fillBefore, fill_after: r.fillAfter, changed: r.changed }
        })
        .filter((x): x is { id: string; name: string; fill_before: number | null; fill_after: number; changed: boolean } => x !== null)
      const resp = await fetch('/api/admin/whiskies/stocktake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          started_at: stocktakeStartedAt,
          finished_by: null,  // server uses session email; finished_by is room for a written name later
          total_catalogue_count: whiskies.length,
          summary,
        }),
      })
      if (resp.ok) {
        showToast(t('Stocktake session saved.', 'Đã lưu phiên kiểm kê.'), 'info')
        loadStocktakeHistory()
      } else {
        const j = await resp.json().catch(() => ({}))
        showToast(`${t('Stocktake CSV downloaded; session save failed:', 'Đã tải CSV kiểm kê; lưu phiên thất bại:')} ${j.error || resp.status}`, 'warn')
      }
    } catch (e) {
      showToast(`${t('Stocktake CSV downloaded; session save failed:', 'Đã tải CSV kiểm kê; lưu phiên thất bại:')} ${(e as Error).message}`, 'warn')
    }

    // Reset state.
    setStocktakeMode(false)
    setStocktakeBefore(new Map())
    setStocktakeReviewed(new Map())
    setStocktakeStartedAt(null)
  }

  // Stocktake history — last 20 sessions, loaded once on mount and after
  // each new finish so the panel is always current.
  interface StocktakeSession {
    id: string
    started_at: string
    finished_at: string
    finished_by: string | null
    finished_by_email: string | null
    reviewed_count: number
    changed_count: number
    unchanged_count: number
    total_catalogue_count: number
  }
  const [stocktakeHistory, setStocktakeHistory] = useState<StocktakeSession[]>([])
  const loadStocktakeHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/whiskies/stocktake?limit=20', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      if (Array.isArray(j.sessions)) setStocktakeHistory(j.sessions)
    } catch { /* */ }
  }, [])
  useEffect(() => { loadStocktakeHistory() }, [loadStocktakeHistory])

  // "Confirm unchanged" — staff visually verified the bottle and the
  // level is the same. Marks reviewed without a DB write.
  const confirmUnchanged = (w: Whisky) => {
    markReviewed(w, w.current_fill_pct ?? 100, false, 'confirmed unchanged')
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
    // Stamp tasting_notes_source = 'human' whenever notes are non-empty
    // — without this, rows entered via this form land with source=null,
    // which the backfill script treats as "queue for AI overwrite"
    // (the skip-rule only spares 'human' and 'claude-auto-backfill-%').
    const notesTrimmed = tastingNotes.trim()
    const hasNotes = notesTrimmed.length > 0
    const payload: Record<string, unknown> = {
      name, distillery: distillery || null, region: region || null,
      cask_type: caskType || null, age: age || null, abv: abv || null,
      tasting_notes: hasNotes ? notesTrimmed : null,
      committees_pick: committeesPick, in_stock: inStock,
      tasting_notes_source:       hasNotes ? 'human' : null,
      tasting_notes_confidence:   null,
      tasting_notes_generated_at: null,
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

  // ── Bulk-select mode ──────────────────────────────────────────────────
  // Toggling on shows a checkbox on each row + a sticky action bar at
  // the bottom. Bulk actions apply to the SELECTED subset, not the
  // whole filtered list — so you can filter to "Islay", then untick the
  // one you don't want changed, and the bulk op skips it. Selection
  // clears on mode exit or on successful bulk apply.
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const enterBulkMode = () => { setBulkMode(true); setSelectedIds(new Set()) }
  const exitBulkMode  = () => { setBulkMode(false); setSelectedIds(new Set()) }
  const selectAllFiltered = () => setSelectedIds(new Set(filtered.map(w => w.id)))
  const clearSelection    = () => setSelectedIds(new Set())

  const bulkPatch = async (patch: Partial<Whisky>) => {
    if (selectedIds.size === 0) return
    setBulkBusy(true)
    try {
      const ids = [...selectedIds]
      const { error } = await supabase.from('whiskies').update(patch).in('id', ids)
      if (error) { showToast(`${t('Bulk update failed:', 'Cập nhật hàng loạt thất bại:')} ${error.message}`, 'warn'); return }
      // Optimistic local merge so the UI reflects it immediately.
      setWhiskies(prev => prev.map(w => selectedIds.has(w.id) ? { ...w, ...patch } as Whisky : w))
      clearSelection()
    } finally {
      setBulkBusy(false)
    }
  }

  // Delete is a hard CASCADE: removing a whisky also removes its
  // whisky_fill_history rows (FK has on delete cascade) and any future
  // tasting-note audit trail. A single window.confirm is too easy to
  // dismiss-then-regret, so the actual delete requires the user to type
  // the exact whisky name into a modal — same pattern GitHub uses for
  // repo deletion.
  const [deleteTarget, setDeleteTarget] = useState<Whisky | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const openDelete = (w: Whisky) => {
    setDeleteTarget(w)
    setDeleteConfirmText('')
  }
  const closeDelete = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteConfirmText('')
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteConfirmText.trim() !== deleteTarget.name) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('whiskies').delete().eq('id', deleteTarget.id)
      if (error) { showToast(`${t('Delete failed:', 'Xóa thất bại:')} ${error.message}`, 'warn'); return }
      setDeleteTarget(null)
      setDeleteConfirmText('')
      load()
    } finally {
      setDeleting(false)
    }
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
      if (!r.ok) { showToast(j.error || t('Failed to save fill', 'Lưu mức rót thất bại'), 'warn'); return }
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
      // Stocktake bookkeeping — record the before/after if we're in a
      // session. saveFill works exactly the same whether stocktake is on
      // or off; the only side effect is the row sinking to the bottom.
      if (stocktakeMode) {
        const before = stocktakeBefore.get(w.id) ?? (w.current_fill_pct ?? null)
        markReviewed(w, draftFill, before !== draftFill, draftNote || null)
      }
      cancelFillEdit()
    } finally {
      setSaving(null)
    }
  }

  // Inline catalogue-metadata edits (name, distillery, region, cask, age,
  // ABV, tasting notes). One field at a time, save on blur, optimistic
  // local update. Whisky_fill_history only tracks fill changes; metadata
  // edits hit the table directly.
  const patchMetadata = async (id: string, field: keyof Whisky, value: string | null) => {
    // Optimistic local update first.
    setWhiskies(prev => prev.map(x => x.id === id ? { ...x, [field]: value } as Whisky : x))
    const payload: Record<string, unknown> = { [field]: value }
    // Tasting notes coming from the inline editor are by definition a
    // human edit; stamp the source so the auto-backfill never overrides.
    if (field === 'tasting_notes') {
      payload.tasting_notes_source = value && value.trim().length > 0 ? 'human' : null
      payload.tasting_notes_confidence = null
      payload.tasting_notes_generated_at = null
      setWhiskies(prev => prev.map(x => x.id === id ? {
        ...x,
        tasting_notes_source: payload.tasting_notes_source as string | null,
        tasting_notes_confidence: null,
        tasting_notes_generated_at: null,
      } : x))
    }
    const { error } = await supabase.from('whiskies').update(payload).eq('id', id)
    if (error) { showToast(`${t('Save failed:', 'Lưu thất bại:')} ${error.message}`, 'warn'); load() }
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

  const toggleTrend = () => {
    // Lazy-load history the first time it's opened; clicking again closes it.
    if (!trendOpen && history.length === 0 && !loadingHistory) loadHistory()
    setTrendOpen(o => !o)
  }

  const filtered = useMemo(() => {
    const tokens = filterText.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const matching = whiskies.filter(w => {
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
    // Stocktake mode rearranges the list: unreviewed first (alphabetical),
    // reviewed sink to the bottom (still alphabetical, dimmed in the UI).
    // Normal mode = catalogue load order (already name-sorted by the
    // supabase query).
    if (!stocktakeMode) return matching
    const unreviewed: Whisky[] = []
    const reviewed: Whisky[] = []
    for (const w of matching) {
      if (stocktakeReviewed.has(w.id)) reviewed.push(w); else unreviewed.push(w)
    }
    return [...unreviewed, ...reviewed]
  }, [whiskies, filterText, showOnlyLow, showOnlyInStock, showOnlyMissingNotes, stocktakeMode, stocktakeReviewed])

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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rc-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      ` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={pageTitle}>{t('Whisky Library', 'Thư viện Whisky')}</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href="/admin/whisky/flavour-review" style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#D4B85A', textDecoration: 'none', border: '1px solid rgba(212,184,90,0.35)', borderRadius: 6, padding: '7px 12px' }}>{t('Flavour review →', 'Duyệt hương vị →')}</a>
          {!showForm && (
            <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle}>{t('+ New Whisky', '+ Whisky mới')}</button>
          )}
        </div>
      </div>

      <div style={subline}>
        {t('Catalogue + open-bottle fill tracking. Click a fill cell to update — every change is logged with your name and time, and the trend graph reads the same audit trail.', 'Danh mục + theo dõi mức rót của chai đã mở. Nhấn vào ô mức rót để cập nhật — mỗi thay đổi đều được ghi lại kèm tên và thời gian của bạn, và biểu đồ xu hướng đọc từ cùng nhật ký này.')}
      </div>

      {/* ── Stat strip ─────────────────────────────────────────────────── */}
      <div style={statStrip}>
        <Stat label={t('Whiskies', 'Số whisky')}        value={whiskies.length} />
        <Stat label={t('In stock', 'Còn hàng')}        value={inStockCount} color="#7AB07A" />
        <Stat label={t('Low fill (≤25%)', 'Sắp hết (≤25%)')} value={lowCount} color={lowCount > 0 ? '#C27070' : '#7E7864'} />
        <Stat label={t('No tasting notes', 'Chưa có ghi chú nếm')} value={missingNotesCount} color={missingNotesCount > 0 ? '#D4B85A' : '#7E7864'} />
        {!stocktakeMode && !bulkMode && (
          <button onClick={startStocktake} style={stocktakeStartBtn} title={t('Begin a stocktake session — reviewed whiskies sink to the bottom; finish to log a full report.', 'Bắt đầu phiên kiểm kê — các chai đã kiểm sẽ dồn xuống cuối; kết thúc để ghi lại báo cáo đầy đủ.')}>
            {t('☑ Start stocktake', '☑ Bắt đầu kiểm kê')}
          </button>
        )}
        {!stocktakeMode && (
          <button
            onClick={bulkMode ? exitBulkMode : enterBulkMode}
            style={{ ...stocktakeStartBtn, color: bulkMode ? '#E58F4A' : '#7AB07A', borderColor: bulkMode ? 'rgba(229,143,74,0.45)' : 'rgba(122,176,122,0.45)' }}
            title={t("Multi-select rows and apply changes (in-stock, committee's pick, region) in one go.", 'Chọn nhiều dòng và áp dụng thay đổi (còn hàng, lựa chọn của hội đồng, vùng) cùng lúc.')}
          >
            {bulkMode ? t('✕ Exit bulk', '✕ Thoát hàng loạt') : t('☐ Bulk edit', '☐ Sửa hàng loạt')}
          </button>
        )}
        <button onClick={exportCsv} style={exportBtn} title={t('Export the currently-filtered list as CSV', 'Xuất danh sách đang lọc ra CSV')}>
          {t('⤓ Export CSV', '⤓ Xuất CSV')}
        </button>
        <button onClick={toggleTrend} style={trendBtn}>
          {trendOpen ? '↓' : '↑'} {t('Inventory trend', 'Xu hướng tồn kho')}
        </button>
      </div>

      {/* ── Stocktake banner ─────────────────────────────────────────── */}
      {stocktakeMode && (
        <div style={stocktakeBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={stocktakeChip}>{t('STOCKTAKE LIVE', 'ĐANG KIỂM KÊ')}</span>
            <span style={{ color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 12 }}>
              <strong style={{ color: '#7AB07A' }}>{stocktakeReviewed.size}</strong>
              <span style={{ color: '#7E7864' }}> / {whiskies.length} {t('reviewed', 'đã kiểm')}</span>
              {stocktakeStartedAt && (
                <span style={{ color: '#7E7864', marginLeft: 12 }}>· {t('started', 'bắt đầu')} {timeAgo(stocktakeStartedAt, t)}</span>
              )}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={cancelStocktake} style={stocktakeCancelBtn}>{t('Cancel', 'Hủy')}</button>
              <button onClick={finishStocktake} style={stocktakeFinishBtn} disabled={stocktakeReviewed.size === 0}>
                {t('Finish & download report', 'Kết thúc & tải báo cáo')}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 6, fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', letterSpacing: '0.04em' }}>
            {t('Update a fill or click', 'Cập nhật mức rót hoặc nhấn')} <strong>{t('✓ unchanged', '✓ không đổi')}</strong> {t("on each whisky as you check it. Reviewed rows sink to the bottom of the list (dimmed) so you can see what's left.", 'trên mỗi chai khi bạn kiểm tra. Các dòng đã kiểm sẽ dồn xuống cuối danh sách (mờ đi) để bạn thấy còn lại những gì.')}
          </div>
        </div>
      )}

      {/* ── Global trend graph (lazy-loaded) ──────────────────────────── */}
      {trendOpen && (
        <div style={trendBlock}>
          {loadingHistory ? (
            <div style={emptyText}>{t('Loading history…', 'Đang tải lịch sử…')}</div>
          ) : historyError ? (
            <div style={{ ...emptyText, color: '#C27070' }}>{historyError}</div>
          ) : history.length === 0 ? (
            <div style={emptyText}>{t('No fill updates logged yet. The graph will populate as staff record weekly fills.', 'Chưa ghi nhận cập nhật mức rót nào. Biểu đồ sẽ hiện dần khi nhân viên ghi mức rót hàng tuần.')}</div>
          ) : (
            <TrendGraph history={history} whiskies={whiskies} />
          )}
        </div>
      )}

      {/* ── Recent stocktakes (last 20) ─────────────────────────────── */}
      {stocktakeHistory.length > 0 && (
        <div style={stocktakeHistoryBlock}>
          <div style={{ ...miniLabel, marginBottom: 8 }}>
            {t('Recent stocktakes', 'Kiểm kê gần đây')} · {stocktakeHistory.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {stocktakeHistory.map(s => {
              const finishedDate = new Date(s.finished_at)
              const durationMin = Math.max(0, Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000))
              return (
                <div key={s.id} style={stocktakeHistoryRow}>
                  <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2', minWidth: 200 }}>
                    {finishedDate.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98' }}>
                    {t('by', 'bởi')} {s.finished_by_email || s.finished_by || t('unknown', 'không rõ')}
                  </span>
                  <span style={{ ...stocktakeHistoryChip('#7AB07A') }}>
                    {s.reviewed_count} {t('reviewed', 'đã kiểm')}
                  </span>
                  {s.changed_count > 0 && (
                    <span style={{ ...stocktakeHistoryChip('#D4B85A') }}>
                      {s.changed_count} {t('changed', 'đã đổi')}
                    </span>
                  )}
                  <span style={{ ...stocktakeHistoryChip('#7E7864') }}>
                    {Math.round(100 * s.reviewed_count / Math.max(1, s.total_catalogue_count))}% {t('of catalogue', 'của danh mục')}
                  </span>
                  {durationMin > 0 && (
                    <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#7E7864', marginLeft: 'auto' }}>
                      {durationMin}{t('m session', 'phút/phiên')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div style={filterRow}>
        <input
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder={t('Search across name, distillery, region, cask, age, ABV, tasting notes…', 'Tìm theo tên, nhà chưng cất, vùng, thùng, tuổi, độ cồn, ghi chú nếm…')}
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        />
        <button onClick={() => setShowOnlyLow(v => !v)} style={{ ...chip, ...(showOnlyLow ? chipActive : null) }}>
          {t('≤25% only', 'chỉ ≤25%')}
        </button>
        <button onClick={() => setShowOnlyInStock(v => !v)} style={{ ...chip, ...(showOnlyInStock ? chipActive : null) }}>
          {t('in stock only', 'chỉ còn hàng')}
        </button>
        <button onClick={() => setShowOnlyMissingNotes(v => !v)} style={{ ...chip, ...(showOnlyMissingNotes ? chipActive : null) }}>
          {t('no notes yet', 'chưa có ghi chú')}
        </button>
        {(filterText || showOnlyLow || showOnlyInStock || showOnlyMissingNotes) && (
          <button
            onClick={() => { setFilterText(''); setShowOnlyLow(false); setShowOnlyInStock(false); setShowOnlyMissingNotes(false) }}
            style={{ ...chip, color: '#E58F4A' }}
          >
            {t('clear', 'xóa lọc')} ({filtered.length} / {whiskies.length})
          </button>
        )}
      </div>

      {/* ── New / edit form (unchanged from before) ───────────────────── */}
      {showForm && (
        <div style={editBlock}>
          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 16, color: '#E5D4C2' }}>
            {editing ? `${t('Editing:', 'Đang sửa:')} ${editing.name}` : t('New Whisky', 'Whisky mới')}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Name', 'Tên')}</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Distillery', 'Nhà chưng cất')}</label>
              <input style={inputStyle} value={distillery} onChange={e => setDistillery(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Region', 'Vùng')}</label>
              <select style={inputStyle} value={region} onChange={e => setRegion(e.target.value)}>
                <option value="">{t('Select…', 'Chọn…')}</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Cask Type', 'Loại thùng')}</label>
              <input style={inputStyle} value={caskType} onChange={e => setCaskType(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('Age', 'Tuổi')}</label>
              <input style={inputStyle} value={age} onChange={e => setAge(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('ABV', 'Độ cồn')}</label>
              <input style={inputStyle} value={abv} onChange={e => setAbv(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t('Tasting Notes', 'Ghi chú nếm')}</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={tastingNotes} onChange={e => setTastingNotes(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={committeesPick} onChange={e => setCommitteesPick(e.target.checked)} /> {t('Committee’s Pick', 'Lựa chọn của hội đồng')}
            </label>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} /> {t('In Stock', 'Còn hàng')}
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleSubmit} style={btnStyle}>{editing ? t('Update', 'Cập nhật') : t('Create', 'Tạo mới')}</button>
            <button onClick={resetForm} style={{ ...btnStyle, opacity: 0.5 }}>{t('Cancel', 'Hủy')}</button>
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
          const isReviewed = stocktakeMode && stocktakeReviewed.has(w.id)
          const isSelected = bulkMode && selectedIds.has(w.id)
          const isFocused = focusId === w.id
          return (
            <div key={w.id} id={`whisky-${w.id}`} style={{ ...whiskyRow, ...(isReviewed ? reviewedRow : null), ...(isSelected ? bulkSelectedRow : null), ...(isFocused ? { outline: '2px solid #9E8FC4', outlineOffset: 2, borderRadius: 4 } : null) }}>
              {bulkMode && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelected(w.id)}
                  style={{ marginRight: 10, marginTop: 6, cursor: 'pointer', accentColor: '#7AB07A', flexShrink: 0 }}
                  aria-label={`${t('Select', 'Chọn')} ${w.name}`}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => toggleExpanded(w.id)}
                  style={whiskyTitleBtn}
                  title={expandedIds.has(w.id) ? t('Hide details', 'Ẩn chi tiết') : t('Show details + tasting notes', 'Xem chi tiết + ghi chú nếm')}
                >
                  <span style={{ ...expandCaret, transform: expandedIds.has(w.id) ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
                  <span style={whiskyName}>{w.name}</span>
                  {(!w.tasting_notes || w.tasting_notes.trim().length === 0) && (
                    <span style={missingNotesBadge} title={t('No tasting notes yet — expand to add them', 'Chưa có ghi chú nếm — mở rộng để thêm')}>
                      {t('ⓘ no notes', 'ⓘ chưa có ghi chú')}
                    </span>
                  )}
                  {isReviewed && <span style={reviewedBadge}>{t('✓ reviewed', '✓ đã kiểm')}</span>}
                  {w.distillery && <span style={whiskySub}>· {w.distillery}</span>}
                  {w.region && <span style={regionPill}>{w.region}</span>}
                </button>
                {w.last_fill_updated_at && (
                  <div style={fillAuditLine}>
                    {t('Last fill:', 'Rót lần cuối:')} {w.last_fill_updated_email || t('unknown', 'không rõ')} · {timeAgo(w.last_fill_updated_at, t)}
                  </div>
                )}
                {expandedIds.has(w.id) && (
                  <div style={notesBlock}>
                    {/* Inline catalogue-metadata editors */}
                    <div style={inlineFieldGrid}>
                      <InlineField label={t('Name', 'Tên')}       value={w.name}              onSave={v => patchMetadata(w.id, 'name', v)} />
                      <InlineField label={t('Distillery', 'Nhà chưng cất')} value={w.distillery || ''}  onSave={v => patchMetadata(w.id, 'distillery', v || null)} />
                      <InlineField label={t('Region', 'Vùng')}     value={w.region || ''}      onSave={v => patchMetadata(w.id, 'region', v || null)} select={REGIONS as readonly string[]} />
                      <InlineField label={t('Cask type', 'Loại thùng')}  value={w.cask_type || ''}   onSave={v => patchMetadata(w.id, 'cask_type', v || null)} />
                      <InlineField label={t('Age', 'Tuổi')}        value={w.age || ''}         onSave={v => patchMetadata(w.id, 'age', v || null)} />
                      <InlineField label={t('ABV', 'Độ cồn')}        value={w.abv || ''}         onSave={v => patchMetadata(w.id, 'abv', v || null)} />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ ...labelStyle, marginBottom: 6 }}>{t('Tasting notes', 'Ghi chú nếm')}</div>
                      <textarea
                        defaultValue={w.tasting_notes || ''}
                        onBlur={e => {
                          const v = e.target.value.trim()
                          if (v !== (w.tasting_notes || '')) patchMetadata(w.id, 'tasting_notes', v || null)
                        }}
                        rows={4}
                        placeholder={t('Nose: … Palate: … Finish: …', 'Hương: … Vị: … Hậu vị: …')}
                        style={{ ...inputStyle, resize: 'vertical', fontSize: 12 }}
                      />
                      <div style={notesAttribution}>
                        {w.tasting_notes_source === 'human'
                          ? t('Entered manually by the team', 'Nhập thủ công bởi đội ngũ')
                          : w.tasting_notes_source?.startsWith('claude-auto-backfill-')
                            ? `${t('Auto-backfilled · confidence', 'Tự động điền · độ tin cậy')} ${w.tasting_notes_confidence ?? '—'}${w.tasting_notes_generated_at ? ' · ' + new Date(w.tasting_notes_generated_at).toLocaleDateString() : ''} ${t('— editing will re-stamp as human-curated', '— chỉnh sửa sẽ được đánh dấu lại là do người biên soạn')}`
                            : w.tasting_notes && w.tasting_notes.trim().length > 0
                              ? null
                              : t('No tasting notes recorded yet — type to add', 'Chưa ghi nhận ghi chú nếm nào — gõ để thêm')}
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <WhiskyFlavourPanel whiskyId={w.id} whiskyName={w.name} />
                    </div>
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
                      placeholder={t('Optional note (e.g. opened new bottle)', 'Ghi chú tùy chọn (vd: mở chai mới)')}
                      style={{ ...inputStyle, fontSize: 11, padding: '6px 10px' }}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={cancelFillEdit} style={tinyBtn}>{t('cancel', 'hủy')}</button>
                      <button onClick={() => saveFill(w)} disabled={saving === w.id} style={{ ...tinyBtnPrimary, opacity: saving === w.id ? 0.5 : 1 }}>
                        {saving === w.id ? t('saving…', 'đang lưu…') : t('save', 'lưu')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startFillEdit(w)} style={fillDisplayBtn} title={t('Click to update fill %', 'Nhấn để cập nhật mức rót %')}>
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
                  {t('◆ Pick', '◆ Chọn')}
                </button>
                <button
                  onClick={() => toggleField(w.id, 'in_stock', w.in_stock)}
                  style={{ ...rowBtn, background: w.in_stock ? 'rgba(94,102,80,0.3)' : 'rgba(229,212,194,0.06)', padding: '2px 10px', borderRadius: 4 }}
                >
                  {w.in_stock ? t('In Stock', 'Còn hàng') : t('Out', 'Hết')}
                </button>
                {stocktakeMode && !isReviewed && (
                  <button
                    onClick={() => confirmUnchanged(w)}
                    style={{ ...rowBtn, color: '#7AB07A', fontWeight: 600 }}
                    title={t('Mark this whisky as reviewed without changing its fill', 'Đánh dấu chai này đã kiểm mà không thay đổi mức rót')}
                  >
                    {t('✓ unchanged', '✓ không đổi')}
                  </button>
                )}
                <button onClick={() => startEdit(w)} style={{ ...rowBtn, opacity: 0.5 }}>{t('Edit', 'Sửa')}</button>
                <button onClick={() => openDelete(w)} style={{ ...rowBtn, opacity: 0.5 }}>{t('Delete', 'Xóa')}</button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={emptyText}>{t('No whiskies match this filter.', 'Không có whisky nào khớp bộ lọc này.')}</div>
        )}
      </div>

      {/* ── Stocktake cancel confirmation (branded, replaces window.confirm) ── */}
      {stocktakeCancelOpen && (
        <>
          <div style={deleteBackdrop} onClick={dismissCancelStocktake} />
          <div style={cancelModal} role="dialog" aria-labelledby="cancel-title">
            <div style={{ ...miniLabel, color: '#D4B85A', marginBottom: 8 }} id="cancel-title">{t('CANCEL STOCKTAKE', 'HỦY KIỂM KÊ')}</div>
            <div style={cancelHeadline}>{t('End this session without saving a report?', 'Kết thúc phiên này mà không lưu báo cáo?')}</div>
            <div style={deleteBodyText}>
              <strong style={{ color: '#E5D4C2' }}>{stocktakeReviewed.size}</strong> {stocktakeReviewed.size === 1 ? t('whisky has', 'chai whisky đã') : t('whiskies have', 'chai whisky đã')} {t('been reviewed so far. Fill updates already saved during the session', 'được kiểm cho đến giờ. Các cập nhật mức rót đã lưu trong phiên')} <strong>{t('stay in the database', 'vẫn còn trong cơ sở dữ liệu')}</strong> {t('(they are real audit-trail writes). The only thing you lose by cancelling is the session report CSV.', '(chúng là các bản ghi nhật ký thật). Thứ duy nhất mất khi hủy là tệp CSV báo cáo của phiên.')}
            </div>
            <div style={deleteBodyText}>
              {t('If you want the report, click', 'Nếu bạn muốn báo cáo, hãy nhấn')} <strong>{t('Finish & download', 'Kết thúc & tải về')}</strong> {t('instead.', 'thay vào đó.')}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={dismissCancelStocktake} style={deleteCancelBtn}>{t('Keep going', 'Tiếp tục')}</button>
              <button onClick={confirmCancelStocktake} style={cancelConfirmBtn}>{t('End session', 'Kết thúc phiên')}</button>
            </div>
          </div>
        </>
      )}

      {toastNode}

      {/* ── Delete confirmation modal ──────────────────────────────────
          Hard-delete cascades to whisky_fill_history, so the user has to
          type the exact whisky name to enable the Delete button. Same
          pattern GitHub uses for repository deletion. */}
      {deleteTarget && (
        <>
          <div style={deleteBackdrop} onClick={closeDelete} />
          <div style={deleteModal} role="dialog" aria-labelledby="delete-title">
            <div style={{ ...miniLabel, color: '#C27070', marginBottom: 8 }} id="delete-title">{t('⚠ PERMANENT DELETE', '⚠ XÓA VĨNH VIỄN')}</div>
            <div style={deleteWhiskyName}>{deleteTarget.name}</div>
            {deleteTarget.distillery && (
              <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98', marginBottom: 12 }}>
                {deleteTarget.distillery}{deleteTarget.region ? ` · ${deleteTarget.region}` : ''}
              </div>
            )}
            <div style={deleteBodyText}>
              {t('This removes the whisky from the catalogue. It also', 'Thao tác này xóa whisky khỏi danh mục. Nó cũng')} <strong>{t('cascades', 'xóa lan')}</strong>{t(': all of its fill-history audit rows are deleted (every weekly stocktake update, every staff edit). Locker contents that reference this whisky by name will not be touched, but they will no longer link to a real catalogue entry.', ': toàn bộ nhật ký lịch sử mức rót của nó bị xóa (mọi cập nhật kiểm kê hàng tuần, mọi chỉnh sửa của nhân viên). Nội dung tủ rượu tham chiếu whisky này theo tên sẽ không bị đụng đến, nhưng sẽ không còn liên kết tới một mục danh mục thật.')}
            </div>
            <div style={deleteBodyText}>
              {t('To confirm, type the whisky’s name exactly:', 'Để xác nhận, hãy gõ chính xác tên của whisky:')}
            </div>
            <input
              autoFocus
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={deleteTarget.name}
              style={{ ...inputStyle, fontSize: 12 }}
              onKeyDown={e => {
                if (e.key === 'Enter' && deleteConfirmText.trim() === deleteTarget.name) confirmDelete()
                if (e.key === 'Escape') closeDelete()
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={closeDelete} disabled={deleting} style={deleteCancelBtn}>{t('Cancel', 'Hủy')}</button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmText.trim() !== deleteTarget.name || deleting}
                style={{
                  ...deleteConfirmBtn,
                  opacity: (deleteConfirmText.trim() === deleteTarget.name && !deleting) ? 1 : 0.35,
                  cursor: (deleteConfirmText.trim() === deleteTarget.name && !deleting) ? 'pointer' : 'not-allowed',
                }}
              >
                {deleting ? t('Deleting…', 'Đang xóa…') : t('Delete permanently', 'Xóa vĩnh viễn')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Bulk action bar ────────────────────────────────────────────
          Sticky at the bottom of the viewport while bulk mode is on.
          Counts the selected subset, offers select-all-filtered + clear,
          then the actual bulk operations. Each op writes via the same
          patch path (PATCH whiskies WHERE id IN (...)) so the audit
          trail and RLS rules are identical to a single-row edit. */}
      {bulkMode && (
        <div style={bulkBar} role="region" aria-label={t('Bulk edit actions', 'Thao tác sửa hàng loạt')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={bulkCountText}>
              <strong>{selectedIds.size}</strong> {t('selected', 'đã chọn')}
              <span style={{ color: '#7E7864', marginLeft: 6 }}>/ {filtered.length} {t('in view', 'trong khung nhìn')}</span>
            </span>
            <button onClick={selectAllFiltered} style={bulkChip} disabled={selectedIds.size === filtered.length}>
              {t('Select all in view', 'Chọn tất cả trong khung nhìn')}
            </button>
            <button onClick={clearSelection} style={bulkChip} disabled={selectedIds.size === 0}>
              {t('Clear', 'Bỏ chọn')}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <button
              onClick={() => bulkPatch({ in_stock: true })}
              disabled={selectedIds.size === 0 || bulkBusy}
              style={bulkActionBtn}
              title={t('Mark all selected as in stock', 'Đánh dấu tất cả mục đã chọn là còn hàng')}
            >
              {t('✓ Mark in stock', '✓ Đánh dấu còn hàng')}
            </button>
            <button
              onClick={() => bulkPatch({ in_stock: false })}
              disabled={selectedIds.size === 0 || bulkBusy}
              style={bulkActionBtn}
              title={t('Mark all selected as out of stock', 'Đánh dấu tất cả mục đã chọn là hết hàng')}
            >
              {t('✕ Mark out of stock', '✕ Đánh dấu hết hàng')}
            </button>
            <button
              onClick={() => bulkPatch({ committees_pick: true })}
              disabled={selectedIds.size === 0 || bulkBusy}
              style={bulkActionBtn}
              title={t("Add committee's pick to all selected", 'Thêm lựa chọn của hội đồng cho tất cả mục đã chọn')}
            >
              {t('◆ Add pick', '◆ Thêm lựa chọn')}
            </button>
            <button
              onClick={() => bulkPatch({ committees_pick: false })}
              disabled={selectedIds.size === 0 || bulkBusy}
              style={bulkActionBtn}
              title={t("Remove committee's pick from all selected", 'Bỏ lựa chọn của hội đồng khỏi tất cả mục đã chọn')}
            >
              {t('◇ Remove pick', '◇ Bỏ lựa chọn')}
            </button>
            <select
              onChange={e => { if (e.target.value) bulkPatch({ region: e.target.value }); e.target.value = '' }}
              disabled={selectedIds.size === 0 || bulkBusy}
              style={bulkActionSelect}
              defaultValue=""
              aria-label={t('Bulk set region', 'Đặt vùng hàng loạt')}
            >
              <option value="" disabled>{t('Set region…', 'Đặt vùng…')}</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Inline metadata editor ──────────────────────────────────────────────────
// Single field that swaps to an input/select on click and saves on blur.
// Used inside the expand panel for the catalogue's editable columns.

function InlineField({ label, value, onSave, select }: {
  label: string
  value: string
  onSave: (v: string) => void
  select?: readonly string[]
}) {
  const { t } = useLang()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={inlineFieldDisplay}
        title={t('Click to edit', 'Nhấn để sửa')}
      >
        <div style={inlineFieldLabel}>{label}</div>
        <div style={{ ...inlineFieldValue, color: value ? '#E5D4C2' : '#7E7864', fontStyle: value ? 'normal' : 'italic' }}>
          {value || t('— add —', '— thêm —')}
        </div>
      </button>
    )
  }

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== (value || '').trim()) onSave(trimmed)
  }

  return (
    <div style={inlineFieldDisplay}>
      <div style={inlineFieldLabel}>{label}</div>
      {select ? (
        <select
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }}
        >
          <option value="">—</option>
          {select.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : (
        <input
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }}
        />
      )}
    </div>
  )
}

// ─── Trend graph ─────────────────────────────────────────────────────────────

function TrendGraph({ history, whiskies }: { history: FillHistoryRow[]; whiskies: Whisky[] }) {
  const { t } = useLang()
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
      .map(([id, rows]) => ({ id, name: whiskyName.get(id) || t('(unknown)', '(không rõ)'), rows }))
  }, [history, whiskyName])

  // SVG canvas — fixed aspect, 30-day window (or whatever the data covers).
  const W = 880, H = 280, padL = 36, padR = 16, padT = 16, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const allDates = history.map(h => +new Date(h.created_at))
  if (allDates.length === 0) return <div style={emptyText}>{t('No data.', 'Không có dữ liệu.')}</div>
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
        {t('FILL % OVER TIME', 'MỨC RÓT % THEO THỜI GIAN')} · {seriesById.length} whisk{seriesById.length === 1 ? 'y' : 'ies'} {t('with ≥2 updates', 'có ≥2 cập nhật')} · {history.length} {t('total updates', 'tổng số cập nhật')}
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
                  <title>{`${s.name}\n${h.fill_pct}% · ${new Date(h.created_at).toLocaleString()}${h.updated_by_email ? `\n${t('by', 'bởi')} ${h.updated_by_email}` : ''}${h.note ? `\n"${h.note}"` : ''}`}</title>
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

function timeAgo(iso: string, t: (en: string, vi: string) => string): string {
  const ts = new Date(iso).getTime()
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('just now', 'vừa xong')
  if (mins < 60) return `${mins}${t('m ago', ' phút trước')}`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}${t('h ago', ' giờ trước')}`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}${t('d ago', ' ngày trước')}`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}${t('w ago', ' tuần trước')}`
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
// Delete confirmation modal — type-the-name pattern. Same vocabulary
// the GitHub repo-delete uses; matches user expectation that "this is a
// big deal, you need to commit".
const deleteBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300,
}
const deleteModal: React.CSSProperties = {
  position: 'fixed',
  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(520px, 92vw)',
  background: '#0A3526',
  border: '1px solid rgba(194,112,112,0.45)',
  borderLeft: '3px solid #C27070',
  borderRadius: 8,
  padding: '22px 24px',
  zIndex: 301,
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
}
const deleteWhiskyName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18,
  color: '#E5D4C2', letterSpacing: '0.02em',
  marginBottom: 2,
}
const deleteBodyText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', lineHeight: 1.65, marginBottom: 10,
}
// Stocktake-cancel modal — amber-toned (judgment call, not destructive)
// so it doesn't share the delete modal's red emergency vocabulary. Same
// position + frame as the delete modal so the visual posture is
// consistent.
const cancelModal: React.CSSProperties = {
  position: 'fixed',
  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 'min(480px, 92vw)',
  background: '#0A3526',
  border: '1px solid rgba(212,184,90,0.45)',
  borderLeft: '3px solid #D4B85A',
  borderRadius: 8,
  padding: '22px 24px',
  zIndex: 301,
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
}
const cancelHeadline: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 17,
  color: '#E5D4C2', letterSpacing: '0.02em',
  marginBottom: 12,
}
const cancelConfirmBtn: React.CSSProperties = {
  background: '#D4B85A', color: '#052E20',
  border: 'none', borderRadius: 4,
  padding: '8px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  cursor: 'pointer',
}

const deleteCancelBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4,
  padding: '8px 16px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const deleteConfirmBtn: React.CSSProperties = {
  background: '#C27070', color: '#FFFFFF',
  border: 'none', borderRadius: 4,
  padding: '8px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
}

// Stocktake banner + buttons.
const stocktakeStartBtn: React.CSSProperties = {
  background: 'rgba(122,176,122,0.10)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.45)', borderRadius: 6,
  padding: '10px 18px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.08em',
  cursor: 'pointer',
}
const stocktakeBanner: React.CSSProperties = {
  marginBottom: 16, padding: '14px 18px',
  background: 'linear-gradient(90deg, rgba(122,176,122,0.10) 0%, rgba(212,184,90,0.08) 100%)',
  border: '1px solid rgba(122,176,122,0.40)',
  borderLeft: '3px solid #7AB07A',
  borderRadius: 8,
}
const stocktakeChip: React.CSSProperties = {
  display: 'inline-block',
  background: '#7AB07A', color: '#052E20',
  padding: '4px 10px', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10, fontWeight: 700,
  letterSpacing: '0.14em',
}
const stocktakeCancelBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.20)', borderRadius: 4,
  padding: '6px 14px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, letterSpacing: '0.06em',
  cursor: 'pointer',
}
const stocktakeFinishBtn: React.CSSProperties = {
  background: '#7AB07A', color: '#052E20',
  border: 'none', borderRadius: 4,
  padding: '6px 16px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
  cursor: 'pointer',
}
// Stocktake history strip — sits between the trend graph and the
// filter row. Hidden when there are no sessions yet.
const stocktakeHistoryBlock: React.CSSProperties = {
  marginBottom: 14, padding: '12px 14px',
  background: 'rgba(122,176,122,0.04)',
  border: '1px solid rgba(122,176,122,0.20)',
  borderLeft: '2px solid #7AB07A',
  borderRadius: 6,
}
const stocktakeHistoryRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  padding: '6px 10px',
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 4,
}
function stocktakeHistoryChip(c: string): React.CSSProperties {
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    color: c,
    background: c + '14',
    border: `1px solid ${c}40`,
    borderRadius: 3, padding: '2px 8px',
    letterSpacing: '0.08em', textTransform: 'uppercase',
  }
}

// Bulk-edit row highlight when checkbox is selected.
const bulkSelectedRow: React.CSSProperties = {
  background: 'rgba(122,176,122,0.06)',
  borderLeft: '2px solid #7AB07A',
  paddingLeft: 12,
}
// Sticky bulk-action bar at the bottom of the viewport.
const bulkBar: React.CSSProperties = {
  position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
  padding: '12px 24px',
  background: 'rgba(10, 53, 38, 0.96)',
  backdropFilter: 'blur(8px)',
  borderTop: '1px solid rgba(122,176,122,0.40)',
  boxShadow: '0 -10px 30px rgba(0,0,0,0.45)',
}
const bulkCountText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const bulkChip: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.18)', borderRadius: 4,
  padding: '5px 12px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  letterSpacing: '0.06em', cursor: 'pointer',
}
const bulkActionBtn: React.CSSProperties = {
  background: 'rgba(122,176,122,0.15)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.40)', borderRadius: 4,
  padding: '6px 12px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.06em', cursor: 'pointer',
}
const bulkActionSelect: React.CSSProperties = {
  background: 'rgba(212,184,90,0.12)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)', borderRadius: 4,
  padding: '6px 10px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.06em', cursor: 'pointer',
}

const reviewedRow: React.CSSProperties = {
  opacity: 0.35,
  background: 'rgba(122,176,122,0.04)',
}
const reviewedBadge: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7AB07A',
  background: 'rgba(122,176,122,0.14)',
  border: '1px solid rgba(122,176,122,0.40)',
  borderRadius: 4, padding: '2px 7px',
  letterSpacing: '0.08em', textTransform: 'uppercase',
}

// Inline catalogue-metadata editors inside the expand panel.
const inlineFieldGrid: React.CSSProperties = {
  display: 'grid', gap: 8,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
}
const inlineFieldDisplay: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 6, padding: '8px 10px',
  textAlign: 'left', cursor: 'pointer', width: '100%',
  display: 'flex', flexDirection: 'column', gap: 4,
}
const inlineFieldLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const inlineFieldValue: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
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
