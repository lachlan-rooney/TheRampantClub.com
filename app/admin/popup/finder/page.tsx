'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// CHOOSING THE BOTTLES ON THE TABLE AT THE POP-UP.
// ───────────────────────────────────────────────────────────────────────────
// Every bottle in the library with a confirmed flavour profile, searchable,
// with a tick. What is saved here is what the offline finder carries to the
// Palace — a bottle not on this list cannot be recommended to a guest.
//
// ⚠ THE COUNT IS THE POINT OF THE SCREEN. The owner is picking roughly forty
// out of nearly three hundred, so the running total is large, fixed to the
// bottom, and never scrolls away.
// ═══════════════════════════════════════════════════════════════════════════

interface Bottle {
  id: string; name: string; distillery: string | null; region: string | null
  age: string | number | null; abv: string | number | null; in_stock: boolean; pick: boolean
  spokes: Record<string, number>; spoke_count: number
  confirmed: boolean; unconfirmed_spokes: number
}
interface Cat { slug: string; name_en: string; sort_order: number }

// The catalogue stores age and ABV as free text, with the unit sometimes
// already in it. Only a bare number gets one added.
const unit = (v: string | number | null, suffix: string) => {
  if (v == null || v === '') return null
  const s = String(v).trim()
  return /^[\d.]+$/.test(s) ? s + suffix : s
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2', MUTED = '#B2AA98', DIM = '#7E7864', GOLD = '#D4B85A'
const SAGE = '#7FA86B', RED = '#C27070'

export default function PopupFinderPicker() {
  const [bottles, setBottles] = useState<Bottle[]>([])
  const [cats, setCats] = useState<Cat[]>([])
  const [chosen, setChosen] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [only, setOnly] = useState<'all' | 'stock' | 'ticked'>('stock')
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/popup/finder', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) { setErr(j.error || 'Could not read the library.'); return }
      setErr(null); setBottles(j.bottles || []); setCats(j.categories || [])
      setChosen(j.chosen || []); setSaved(j.chosen || [])
      setSavedAt(j.event?.saved_at || null); setMissing(j.missing || [])
    } catch { setErr('Could not reach the server.') }
  }, [])
  useEffect(() => { load() }, [load])

  const catName = useMemo(() => new Map(cats.map(c => [c.slug, c.name_en])), [cats])
  const pickedSet = useMemo(() => new Set(chosen), [chosen])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return bottles.filter(b => {
      if (only === 'stock' && !b.in_stock) return false
      if (only === 'ticked' && !pickedSet.has(b.id)) return false
      if (!needle) return true
      return b.name.toLowerCase().includes(needle)
        || (b.distillery || '').toLowerCase().includes(needle)
        || (b.region || '').toLowerCase().includes(needle)
        // search the flavours too — "peat" should find the peated bottles
        || Object.keys(b.spokes).some(s => (catName.get(s) || s).toLowerCase().includes(needle))
    })
  }, [bottles, q, only, pickedSet, catName])

  const toggle = (id: string) =>
    setChosen(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id])

  const dirty = chosen.length !== saved.length || chosen.some((id, i) => saved[i] !== id)

  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/admin/popup/finder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: chosen }) })
      const j = await r.json()
      if (!r.ok) { setMsg(j.error + (j.refused ? ` — ${j.refused.join(', ')}` : '')); return }
      setSaved(chosen); setSavedAt(new Date().toISOString())
      setMsg(`Saved — ${j.saved} bottle${j.saved === 1 ? '' : 's'} go to the Palace.`)
    } finally { setBusy(false) }
  }

  if (err) return <div style={bad}>{err}</div>

  const inStock = bottles.filter(b => b.in_stock).length
  const chosenOutOfStock = chosen.filter(id => bottles.find(b => b.id === id && !b.in_stock)).length

  return (
    <div style={{ maxWidth: 1000, paddingBottom: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: CREAM, margin: 0 }}>Bottles on the table</h1>
        <Link href="/admin/popup" style={link}>← Run sheet</Link>
      </div>
      <p style={lede}>
        Every bottle in the library with a <strong style={{ color: CREAM }}>confirmed flavour
        profile</strong> — {bottles.length} of them, {inStock} in stock. Tick the ones that will be on
        the table at the Palace. What you save here is what the tablets carry; a bottle not on this
        list cannot be recommended to a guest.
      </p>

      {missing.length > 0 && (
        <div style={{ ...note, borderLeftColor: RED, background: 'rgba(194,112,112,0.08)' }}>
          <strong style={{ color: RED }}>{missing.length} bottle(s) on the saved list no longer exist in the library.</strong>
          <div style={{ ...small, marginTop: 4 }}>They are not counted below. Save again to drop them for good.</div>
        </div>
      )}
      {msg && <div style={banner} onClick={() => setMsg(null)}>{msg}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '18px 0 14px' }}>
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus
               placeholder="Search a name, distillery, region or flavour"
               style={{ ...input, flex: '1 1 300px' }} />
        {([['stock', `In stock (${inStock})`], ['all', `All (${bottles.length})`], ['ticked', `Ticked (${chosen.length})`]] as const)
          .map(([k, label]) => (
          <button key={k} onClick={() => setOnly(k)} style={{ ...btn, ...(only === k ? btnOn : {}) }}>{label}</button>
        ))}
      </div>

      {shown.length === 0 && <div style={small}>Nothing matches that.</div>}

      {shown.map(b => {
        const on = pickedSet.has(b.id)
        return (
          <label key={b.id} style={{ ...row, ...(on ? { background: 'rgba(212,184,90,0.08)', borderColor: GOLD } : {}) }}>
            <input type="checkbox" checked={on} onChange={() => toggle(b.id)}
                   style={{ width: 20, height: 20, accentColor: GOLD, flex: 'none', cursor: 'pointer' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: CREAM, fontSize: 14, fontFamily: MONO }}>
                {b.name}
                {b.pick && <span style={pill}>COMMITTEE&rsquo;S PICK</span>}
                {!b.in_stock && <span style={{ ...pill, background: 'transparent', border: `1px solid ${RED}`, color: RED }}>NOT IN STOCK</span>}
              </div>
              <div style={{ ...small, marginTop: 3 }}>
                {/* ⚠ age AND abv ARE FREE TEXT AND ALREADY CARRY THEIR UNITS —
                    "14yo", "12 Years", "13", "50.00%", "46%". Appending one
                    gave "12yoyo" and "40.00%%". Add a unit only where the
                    value is a bare number. */}
                {[b.distillery, b.region, unit(b.age, 'yo'), unit(b.abv, '%')]
                  .filter(Boolean).join(' · ')}
              </div>
              {/* The flavours the matcher will actually use — so the owner can
                  see the shape of the table they are building, not just names. */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                {Object.entries(b.spokes).sort((x, y) => y[1] - x[1]).map(([slug, v]) => (
                  <span key={slug} style={{ ...spoke, opacity: 0.45 + v * 0.14 }}>
                    {catName.get(slug) || slug}<b style={{ marginLeft: 4 }}>{v}</b>
                  </span>
                ))}
              </div>
            </div>
          </label>
        )
      })}

      {/* ── THE COUNT, FIXED. It is what the owner is actually doing. ─── */}
      <div style={barStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1, color: chosen.length ? GOLD : DIM }}>
            {chosen.length}
          </span>
          <span style={{ ...small, opacity: 1 }}>
            bottle{chosen.length === 1 ? '' : 's'} ticked
            {chosenOutOfStock > 0 && <span style={{ color: RED }}> · {chosenOutOfStock} not in stock</span>}
            {savedAt && !dirty && <span style={{ color: SAGE }}> · saved</span>}
            {dirty && <span style={{ color: GOLD }}> · not saved yet</span>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chosen.length > 0 && (
            <button onClick={() => setChosen([])} style={btn} disabled={busy}>Clear</button>
          )}
          <button onClick={save} disabled={busy || !dirty}
                  style={{ ...btn, ...(dirty ? btnGo : {}), opacity: dirty ? 1 : 0.4 }}>
            {busy ? 'Saving…' : 'Save pop-up list'}
          </button>
        </div>
      </div>
    </div>
  )
}

const lede: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: MUTED, lineHeight: 1.8, maxWidth: '82ch', margin: '8px 0 0' }
const small: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: DIM, lineHeight: 1.6 }
const bad: React.CSSProperties = { fontFamily: MONO, fontSize: 13, color: RED, padding: 20, border: `1px solid ${RED}`, borderRadius: 8 }
const note: React.CSSProperties = { borderLeft: `3px solid ${GOLD}`, background: 'rgba(212,184,90,0.06)', padding: '12px 14px', borderRadius: 4, margin: '14px 0' }
const banner: React.CSSProperties = { fontFamily: MONO, fontSize: 12, color: '#052E20', background: GOLD, padding: '12px 14px', borderRadius: 6, margin: '14px 0', cursor: 'pointer', lineHeight: 1.6 }
const row: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 6, marginBottom: 6, cursor: 'pointer' }
const input: React.CSSProperties = { minHeight: 38, padding: '0 12px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)', color: CREAM, fontFamily: MONO, fontSize: 13 }
const btn: React.CSSProperties = { minHeight: 38, padding: '0 14px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: CREAM, fontFamily: MONO, fontSize: 12, cursor: 'pointer' }
const btnOn: React.CSSProperties = { background: 'rgba(212,184,90,0.18)', borderColor: GOLD, color: GOLD }
const btnGo: React.CSSProperties = { background: GOLD, color: '#052E20', borderColor: GOLD, fontWeight: 700 }
const pill: React.CSSProperties = { fontFamily: MONO, fontSize: 8, letterSpacing: '.12em', background: GOLD, color: '#052E20', padding: '2px 6px', borderRadius: 3, marginLeft: 8, verticalAlign: 'middle' }
const spoke: React.CSSProperties = { fontFamily: MONO, fontSize: 9, letterSpacing: '.04em', color: CREAM, background: 'rgba(255,255,255,0.07)', padding: '2px 6px', borderRadius: 3 }
const barStyle: React.CSSProperties = {
  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
  padding: '14px 24px', background: 'rgba(5,46,32,0.97)', backdropFilter: 'blur(12px)',
  borderTop: '1px solid rgba(229,212,194,0.18)',
}
const link: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: GOLD, textDecoration: 'none' }
