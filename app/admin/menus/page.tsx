'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import {
  ALLERGENS, DIETARY, ALLERGEN_LABEL, DIETARY_LABEL, price, mediaUrl,
  type Allergen, type Dietary,
} from '@/lib/menus/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE MENU EDITOR
// ───────────────────────────────────────────────────────────────────────────
// Pick a restaurant on the left, edit what it offers on the right. Two lists
// per restaurant because the club sells two things: the small plates that go
// anywhere, and the set menus cooked in the dining room.
//
// Everything saves on an explicit Save. Menus get edited during service by
// somebody who may be interrupted mid-sentence, and an autosave that fires on
// blur would commit a half-typed dish to a screen a member is holding.
//
// COST is on this screen and nowhere else in the app. It is labelled as such,
// sits apart from the member price, and never leaves an admin route.
// ═══════════════════════════════════════════════════════════════════════════

const GOLD = '#D4B85A'
const CREAM = '#E5D4C2'
const HAIR = 'rgba(229,212,194,.16)'
const MONO = "'Google Sans Code','DM Mono',monospace"

interface Venue {
  id: string; slug: string; name: string; kind: 'partner' | 'house'
  tagline_en: string | null; tagline_vn: string | null
  logo_path: string | null; accent_hex: string | null
  contact_name: string | null; contact_phone: string | null
  contact_email: string | null; contact_note: string | null
  arriving_on: string | null
  wait_minutes: number | null
  display_order: number; is_active: boolean; is_placeholder: boolean
}
interface Hour { id: string; venue_id: string; weekday: number; opens_at: string; last_order_at: string }
interface Item {
  id: string; venue_id: string; slug: string
  service: 'plate' | 'cocktail'
  section_en: string | null; section_vn: string | null
  name_en: string; name_vn: string | null
  description_en: string | null; description_vn: string | null
  allergens: Allergen[]; dietary: Dietary[]; allergens_confirmed: boolean
  photo_path: string | null
  price_vnd: number | null; cost_vnd: number | null
  lead_time_minutes: number | null
  availability_en: string | null; availability_vn: string | null
  display_order: number; is_active: boolean; is_placeholder: boolean
}
interface SetMenu {
  id: string; venue_id: string; slug: string
  name_en: string; name_vn: string | null
  standfirst_en: string | null; standfirst_vn: string | null
  price_per_head_vnd: number | null; cost_per_head_vnd: number | null
  min_covers: number | null; notice_hours: number | null
  display_order: number; is_active: boolean; is_placeholder: boolean
}
interface Course {
  id: string; set_menu_id: string
  course_en: string | null; course_vn: string | null
  dish_en: string; dish_vn: string | null
  note_en: string | null; note_vn: string | null
  allergens: Allergen[]; dietary: Dietary[]; allergens_confirmed: boolean
  display_order: number
}
interface AuditRow { kind: string; venue: string; label: string; detail: string }

type Kind = 'venue' | 'item' | 'set' | 'course'

export default function AdminMenusPage() {
  const { showToast, toastNode } = useToast()
  const [venues, setVenues] = useState<Venue[]>([])
  const [hours, setHours] = useState<Hour[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [sets, setSets] = useState<SetMenu[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [kill, setKill] = useState<{ kind: Kind; id: string; label: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/menus', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Could not load the menus.')
      setVenues(j.venues); setItems(j.items); setSets(j.sets); setHours(j.hours ?? [])
      setCourses(j.courses); setAudit(j.audit || [])
      setErr('')
      setSel(s => s ?? (j.venues[0]?.id ?? null))
    } catch (e) { setErr(String((e as Error).message)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const api = useCallback(async (method: string, body: unknown, qs = '') => {
    const r = await fetch('/api/admin/menus' + qs, {
      method,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'That did not save.')
    return j
  }, [])

  const save = useCallback(async (kind: Kind, id: string, patch: Record<string, unknown>) => {
    try { await api('PATCH', { kind, id, ...patch }); await load(); showToast('Saved.', 'success') }
    catch (e) { showToast(String((e as Error).message), 'error') }
  }, [api, load, showToast])

  const create = useCallback(async (kind: Kind, row: Record<string, unknown>) => {
    try { const j = await api('POST', { kind, ...row }); await load(); showToast('Added.', 'success'); return j.row }
    catch (e) { showToast(String((e as Error).message), 'error') }
  }, [api, load, showToast])

  const remove = useCallback(async (kind: Kind, id: string) => {
    try { await api('DELETE', null, `?kind=${kind}&id=${id}`); await load(); showToast('Removed.', 'info') }
    catch (e) { showToast(String((e as Error).message), 'error') }
  }, [api, load, showToast])

  // Reordering is a swap of two display_order values, the same move the studio
  // editor makes. Two PATCHes; the list reloads from the server afterwards so
  // the screen can never disagree with the database about the order.
  const move = useCallback(async <T extends { id: string; display_order: number }>(
    kind: Kind, list: T[], id: string, dir: -1 | 1,
  ) => {
    const i = list.findIndex(x => x.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    try {
      await Promise.all([
        api('PATCH', { kind, id: list[i].id, display_order: list[j].display_order }),
        api('PATCH', { kind, id: list[j].id, display_order: list[i].display_order }),
      ])
      await load()
    } catch (e) { showToast(String((e as Error).message), 'error') }
  }, [api, load, showToast])

  const venue = venues.find(v => v.id === sel) || null
  const vItems = useMemo(() => items.filter(i => i.venue_id === sel), [items, sel])
  const vSets = useMemo(() => sets.filter(s => s.venue_id === sel), [sets, sel])

  const danger = audit.filter(a => a.kind === 'ALLERGENS')

  return (
    <div style={{ padding: '28px 30px 90px', color: CREAM }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header style={{ marginBottom: 22 }}>
        <div className="am-eyebrow">Food</div>
        <h1 className="am-h1">The Menus</h1>
        <p className="am-lede">
          Small plates go anywhere in the club; set menus are cooked downstairs and sat down.
          Members see this at <code>/members/menus</code>, and the room tablets show the same thing.
        </p>
      </header>

      {/* The one warning worth interrupting for. */}
      {danger.length > 0 && (
        <div className="am-warn">
          <strong>{danger.length} live {danger.length === 1 ? 'dish has' : 'dishes have'} unconfirmed allergens.</strong>
          <span> Members are being shown “ask your server” for {danger.map(d => d.label).join(', ')}. Tick
            <em> Allergens confirmed</em> once the kitchen has told you what is in them.</span>
        </div>
      )}

      {err && <div className="am-err">{err}</div>}
      {loading && !venues.length && <p className="am-dim">Loading…</p>}

      <div className="am-grid">
        {/* ── Restaurants ─────────────────────────────────────────────── */}
        <aside>
          <div className="am-col-head">Restaurants</div>
          <ul className="am-vlist">
            {venues.map(v => (
              <li key={v.id}>
                <button className={`am-vbtn ${sel === v.id ? 'is-on' : ''}`} onClick={() => setSel(v.id)}>
                  <span>{v.name}</span>
                  <span className="am-vmeta">
                    {items.filter(i => i.venue_id === v.id).length} · {sets.filter(s => s.venue_id === v.id).length}
                    {!v.is_active && ' · hidden'}
                    {v.is_placeholder && ' · draft'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button className="am-add" onClick={() => create('venue', { name: 'New restaurant', is_placeholder: true })}>
            + Restaurant
          </button>
        </aside>

        {/* ── The selected restaurant ─────────────────────────────────── */}
        <main>
          {!venue && !loading && <p className="am-dim">Choose a restaurant, or add one.</p>}
          {venue && (
            <>
              <VenueForm key={venue.id} v={venue}
                         onSave={p => save('venue', venue.id, p)}
                         onDelete={() => setKill({ kind: 'venue', id: venue.id, label: venue.name })}
                         onToast={showToast} />

              <HoursForm key={`h-${venue.id}`} venueId={venue.id}
                         rows={hours.filter(h => h.venue_id === venue.id)}
                         onSaved={h => setHours(all => [...all.filter(x => x.venue_id !== venue.id), ...h])}
                         onToast={showToast} />

              <SectionBar title="Plates"
                          note="Small dishes to share, served anywhere in the club."
                          onAdd={() => create('item', { venue_id: venue.id, name_en: 'New dish', is_placeholder: true })} />
              {!vItems.length && <p className="am-dim">No dishes yet.</p>}
              {vItems.map((it, i) => (
                <ItemForm key={it.id} it={it}
                          first={i === 0} last={i === vItems.length - 1}
                          onMove={d => move('item', vItems, it.id, d)}
                          onSave={p => save('item', it.id, p)}
                          onDelete={() => setKill({ kind: 'item', id: it.id, label: it.name_en })}
                          onToast={showToast} />
              ))}

              <SectionBar title="Dining room set menus"
                          note="Cooked downstairs, sat down. Not available elsewhere in the club."
                          onAdd={() => create('set', { venue_id: venue.id, name_en: 'New set menu', is_placeholder: true })} />
              {!vSets.length && <p className="am-dim">No set menus yet.</p>}
              {vSets.map((s, i) => (
                <SetForm key={s.id} s={s}
                         courses={courses.filter(c => c.set_menu_id === s.id)}
                         first={i === 0} last={i === vSets.length - 1}
                         onMove={d => move('set', vSets, s.id, d)}
                         onSave={p => save('set', s.id, p)}
                         onDelete={() => setKill({ kind: 'set', id: s.id, label: s.name_en })}
                         onAddCourse={() => create('course', { set_menu_id: s.id, dish_en: 'New course' })}
                         onSaveCourse={(id, p) => save('course', id, p)}
                         onDeleteCourse={(id, label) => setKill({ kind: 'course', id, label })}
                         onMoveCourse={(id, d) => move('course', courses.filter(c => c.set_menu_id === s.id), id, d)} />
              ))}
            </>
          )}
        </main>
      </div>

      {/* Still-a-placeholder list, at the bottom where it belongs. */}
      {audit.filter(a => a.kind !== 'ALLERGENS').length > 0 && (
        <section style={{ marginTop: 44 }}>
          <div className="am-col-head">Still to confirm</div>
          <ul className="am-audit">
            {audit.filter(a => a.kind !== 'ALLERGENS').map((a, i) => (
              <li key={i}><b>{a.venue}</b> · {a.label} <span className="am-dim">— {a.detail}</span></li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmModal
        open={!!kill}
        eyebrow="Remove"
        title={`Remove ${kill?.label ?? ''}?`}
        body={kill?.kind === 'venue'
          ? 'This removes the restaurant and every dish and set menu under it. It cannot be undone.'
          : kill?.kind === 'set'
            ? 'This removes the set menu and all of its courses. It cannot be undone.'
            : 'This cannot be undone.'}
        confirmLabel="Remove"
        tone="danger"
        onCancel={() => setKill(null)}
        onConfirm={async () => { if (kill) { await remove(kill.kind, kill.id); if (kill.kind === 'venue') setSel(null) } setKill(null) }}
      />
      {toastNode}
    </div>
  )
}

// ── Pieces ─────────────────────────────────────────────────────────────────

function SectionBar({ title, note, onAdd }: { title: string; note: string; onAdd: () => void }) {
  return (
    <div className="am-secbar">
      <div>
        <div className="am-sec">{title}</div>
        <div className="am-secnote">{note}</div>
      </div>
      <button className="am-add" onClick={onAdd}>+ Add</button>
    </div>
  )
}

function Field({ label, value, onChange, hint, wide, type = 'text' }: {
  label: string; value: string | number | null
  onChange: (v: string) => void; hint?: string; wide?: boolean; type?: string
}) {
  return (
    <label className={`am-field ${wide ? 'is-wide' : ''}`}>
      <span className="am-label">{label}{hint && <em className="am-hint"> {hint}</em>}</span>
      <input className="am-input" type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function Area({ label, value, onChange, hint }: {
  label: string; value: string | null; onChange: (v: string) => void; hint?: string
}) {
  return (
    <label className="am-field is-wide">
      <span className="am-label">{label}{hint && <em className="am-hint"> {hint}</em>}</span>
      <textarea className="am-input" rows={2} value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function Check({ label, on, onChange, hint }: {
  label: string; on: boolean; onChange: (v: boolean) => void; hint?: string
}) {
  return (
    <label className="am-check">
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} />
      <span>{label}{hint && <em className="am-hint"> {hint}</em>}</span>
    </label>
  )
}

/** Upload a logo or a dish photo and hand back the stored path. */
function Upload({ shape, current, onPath, onToast }: {
  shape: 'logo' | 'dish'; current: string | null
  onPath: (p: string) => void
  onToast: (m: string, t?: 'info' | 'success' | 'error' | 'warn') => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const url = mediaUrl(current)

  const pick = async (f: File) => {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', f); fd.append('shape', shape)
      const r = await fetch('/api/admin/menus/media', { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Upload failed.')
      onPath(j.path)
      onToast('Uploaded — remember to Save.', 'success')
    } catch (e) { onToast(String((e as Error).message), 'error') }
    finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }

  return (
    <div className="am-up">
      {url
        /* eslint-disable-next-line @next/next/no-img-element */
        ? <img src={url} alt="" className={shape === 'logo' ? 'am-uplogo' : 'am-updish'} />
        : <div className="am-upnone">{shape === 'logo' ? 'No logo' : 'No photo'}</div>}
      <div>
        <button className="am-add" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
        </button>
        {url && <button className="am-link" onClick={() => onPath('')}>Clear</button>}
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden
               onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
      </div>
    </div>
  )
}

function Tagger({ allergens, dietary, onChange }: {
  allergens: Allergen[]; dietary: Dietary[]
  onChange: (a: Allergen[], d: Dietary[]) => void
}) {
  const tog = <T,>(list: T[], v: T): T[] => list.includes(v) ? list.filter(x => x !== v) : [...list, v]
  return (
    <div className="am-field is-wide">
      <span className="am-label">Allergens <em className="am-hint">the fourteen; tick every one the kitchen confirms</em></span>
      <div className="am-chips">
        {ALLERGENS.map(a => (
          <button key={a} className={`am-chip ${allergens.includes(a) ? 'is-on' : ''}`}
                  onClick={() => onChange(tog(allergens, a), dietary)}>{ALLERGEN_LABEL[a][0]}</button>
        ))}
      </div>
      <span className="am-label" style={{ marginTop: 12 }}>Dietary</span>
      <div className="am-chips">
        {DIETARY.map(d => (
          <button key={d} className={`am-chip is-diet ${dietary.includes(d) ? 'is-on' : ''}`}
                  onClick={() => onChange(allergens, tog(dietary, d))}>{DIETARY_LABEL[d][0]}</button>
        ))}
      </div>
    </div>
  )
}

// ── The three forms ────────────────────────────────────────────────────────

// ── WHEN THIS KITCHEN TAKES ORDERS ────────────────────────────────────────
// A week at a time, Monday first because that is how a rota is read here. Each
// day is a pair: when it opens and when it stops taking orders. Leave a day
// blank and it is shut that day; a last order EARLIER than the opening means
// the window runs past midnight (17:00 → 00:30), which the tablets understand.
//
// No hours at all = the restaurant is orderable whenever the club is open,
// which is how every restaurant behaved before this existed. Nothing goes dark
// because a form has not been filled in.

const DAYS: [number, string][] = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']]

function HoursForm({ venueId, rows, onSaved, onToast }: {
  venueId: string
  rows: { weekday: number; opens_at: string; last_order_at: string }[]
  onSaved: (h: Hour[]) => void
  onToast: (m: string, t?: 'info' | 'success' | 'error' | 'warn') => void
}) {
  const initial = () => {
    const m: Record<number, { opens_at: string; last_order_at: string }> = {}
    for (const r of rows) m[r.weekday] = { opens_at: r.opens_at, last_order_at: r.last_order_at }
    return m
  }
  const [week, setWeek] = useState<Record<number, { opens_at: string; last_order_at: string }>>(initial)
  const [busy, setBusy] = useState(false)
  const put = (day: number, k: 'opens_at' | 'last_order_at', v: string) =>
    setWeek(w => {
      const cur = w[day] ?? { opens_at: '', last_order_at: '' }
      return { ...w, [day]: { ...cur, [k]: v } }
    })

  const copyDown = () => {
    const first = DAYS.map(([d]) => week[d]).find(x => x?.opens_at && x?.last_order_at)
    if (!first) { onToast('Fill one day in first.', 'warn'); return }
    setWeek(Object.fromEntries(DAYS.map(([d]) => [d, { ...first }])))
  }

  const save = async () => {
    setBusy(true)
    try {
      const windows = DAYS
        .map(([d]) => ({ weekday: d, ...(week[d] ?? { opens_at: '', last_order_at: '' }) }))
        .filter(w => w.opens_at && w.last_order_at)
      const r = await fetch('/api/admin/menus/hours', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue_id: venueId, windows }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { onToast(j.error || 'That did not save.', 'error'); return }
      onSaved(j.hours ?? [])
      onToast(windows.length ? 'Hours saved.' : 'Hours cleared — this kitchen is orderable at any time.', 'success')
    } finally { setBusy(false) }
  }

  return (
    <section className="am-card">
      <h3 className="am-h3">Ordering hours</h3>
      <p className="am-dim" style={{ marginTop: -4 }}>
        The tablets show this restaurant as closed once last orders pass, and will not let a member add its
        dishes. Leave a day blank for closed. Last orders before the opening time means it runs past midnight.
        No hours at all = orderable whenever the club is open.
      </p>
      <div className="am-hours">
        {DAYS.map(([d, label]) => (
          <div key={d} className="am-hrow">
            <span className="am-hday">{label}</span>
            <input type="time" value={week[d]?.opens_at ?? ''} onChange={e => put(d, 'opens_at', e.target.value)} aria-label={`${label} opens`} />
            <span className="am-hto">→</span>
            <input type="time" value={week[d]?.last_order_at ?? ''} onChange={e => put(d, 'last_order_at', e.target.value)} aria-label={`${label} last orders`} />
            {(week[d]?.opens_at || week[d]?.last_order_at) && (
              <button className="am-hclear" onClick={() => setWeek(w => ({ ...w, [d]: { opens_at: '', last_order_at: '' } }))}>clear</button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        <button className="am-save" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save hours'}</button>
        <button className="am-ghost" onClick={copyDown}>Copy the first filled day to every day</button>
      </div>
    </section>
  )
}

function VenueForm({ v, onSave, onDelete, onToast }: {
  v: Venue; onSave: (p: Record<string, unknown>) => void; onDelete: () => void
  onToast: (m: string, t?: 'info' | 'success' | 'error' | 'warn') => void
}) {
  const [d, setD] = useState(v)
  const set = (k: keyof Venue) => (val: unknown) => setD(x => ({ ...x, [k]: val }))
  return (
    <section className="am-card">
      <div className="am-row2">
        <Field label="Name" value={d.name} onChange={set('name')} hint="not translated — it is their name" />
        <Field label="Order" value={d.display_order} type="number" onChange={x => set('display_order')(Number(x) || 0)} />
      </div>
      <div className="am-row2">
        <Field label="Tagline (EN)" value={d.tagline_en} onChange={set('tagline_en')} />
        <Field label="Tagline (VN)" value={d.tagline_vn} onChange={set('tagline_vn')} />
      </div>
      <div className="am-row2">
        <Upload shape="logo" current={d.logo_path} onPath={p => set('logo_path')(p || null)} onToast={onToast} />
        <Field label="Accent colour" value={d.accent_hex} onChange={set('accent_hex')} hint="#RRGGBB" />
      </div>
      {/* Set while a restaurant is announced but not open. The menu then shows
          its logo and "Arriving <date>" and none of its dishes, so placeholder
          items can sit ready without being served. CLEAR IT on opening day —
          though a date in the past stops announcing itself anyway. */}
      <div className="am-row2">
        <Field label="Arriving on" value={d.arriving_on} type="date"
               onChange={set('arriving_on')}
               hint="blank = serving now; a date hides its dishes" />
        {/* Shown beside the restaurant on the tablets as "≈ 25 min". Blank
            says nothing at all, which is better than a guess. */}
        <Field label="Estimated wait (minutes)" value={d.wait_minutes} type="number"
               onChange={x => set('wait_minutes')(x === '' || x === null ? null : Number(x))}
               hint="blank = show no wait" />
      </div>
      <details className="am-details">
        <summary>Contact — staff only, never shown to members</summary>
        <div className="am-row2">
          <Field label="Contact name" value={d.contact_name} onChange={set('contact_name')} />
          <Field label="Phone / Zalo" value={d.contact_phone} onChange={set('contact_phone')} />
        </div>
        <div className="am-row2">
          <Field label="Email" value={d.contact_email} onChange={set('contact_email')} />
          <Field label="Note" value={d.contact_note} onChange={set('contact_note')} />
        </div>
      </details>
      <div className="am-checks">
        <Check label="House kitchen" on={d.kind === 'house'} onChange={b => set('kind')(b ? 'house' : 'partner')} />
        <Check label="Shown to members" on={d.is_active} onChange={set('is_active')} />
        <Check label="Still a draft" on={d.is_placeholder} onChange={set('is_placeholder')} hint="appears in “still to confirm”" />
      </div>
      <div className="am-actions">
        <button className="am-save" onClick={() => onSave({
          name: d.name, kind: d.kind, tagline_en: d.tagline_en, tagline_vn: d.tagline_vn,
          logo_path: d.logo_path, accent_hex: d.accent_hex || null,
          contact_name: d.contact_name, contact_phone: d.contact_phone,
          contact_email: d.contact_email, contact_note: d.contact_note,
          arriving_on: d.arriving_on,
          display_order: d.display_order, is_active: d.is_active, is_placeholder: d.is_placeholder,
        })}>Save restaurant</button>
        <button className="am-del" onClick={onDelete}>Remove</button>
      </div>
    </section>
  )
}

function ItemForm({ it, first, last, onMove, onSave, onDelete, onToast }: {
  it: Item; first: boolean; last: boolean
  onMove: (d: -1 | 1) => void
  onSave: (p: Record<string, unknown>) => void; onDelete: () => void
  onToast: (m: string, t?: 'info' | 'success' | 'error' | 'warn') => void
}) {
  const [d, setD] = useState(it)
  const [open, setOpen] = useState(false)
  const set = (k: keyof Item) => (val: unknown) => setD(x => ({ ...x, [k]: val }))
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[^\d]/g, '')) || 0)

  return (
    <section className={`am-card is-item ${open ? 'is-open' : ''}`}>
      <div className="am-itemhead">
        <button className="am-disc" onClick={() => setOpen(o => !o)}>{open ? '−' : '+'}</button>
        <div className="am-itemname">
          {d.name_en}
          {!d.allergens_confirmed && <span className="am-flag">allergens unconfirmed</span>}
          {!d.is_active && <span className="am-flag is-quiet">hidden</span>}
        </div>
        <div className="am-itemprice">{price(d.price_vnd) ?? 'on request'}</div>
        <div className="am-nudge">
          <button disabled={first} onClick={() => onMove(-1)}>↑</button>
          <button disabled={last} onClick={() => onMove(1)}>↓</button>
        </div>
      </div>

      {open && (
        <>
          {/* Which tab it appears under. A dish added from this screen defaults
              to Plates; the bar's drinks are the exception, not the rule. */}
          <div className="am-checks" style={{ marginBottom: 14 }}>
            <Check label="This is a drink (shows under The Bar)"
                   on={d.service === 'cocktail'}
                   onChange={b => set('service')(b ? 'cocktail' : 'plate')} />
          </div>

          {/* A named list inside this restaurant — Livannah have skewers and
              nori tacos, the bar has Cocktails and Non-Alcoholic. Leave both
              blank where there is only one list; a heading over a single group
              is clutter. */}
          <div className="am-row2">
            <Field label="Section (EN)" value={d.section_en} onChange={set('section_en')}
                   hint="optional, e.g. Nori Tacos" />
            <Field label="Section (VN)" value={d.section_vn} onChange={set('section_vn')} />
          </div>
          <div className="am-row2">
            <Field label="Dish (EN)" value={d.name_en} onChange={set('name_en')} />
            <Field label="Dish (VN)" value={d.name_vn} onChange={set('name_vn')} />
          </div>
          <Area label="Description (EN)" value={d.description_en} onChange={set('description_en')} />
          <Area label="Description (VN)" value={d.description_vn} onChange={set('description_vn')} />

          <div className="am-row3">
            <Field label="Member price ₫" value={d.price_vnd} onChange={x => set('price_vnd')(num(x))}
                   hint="blank = on request" />
            <Field label="Our cost ₫" value={d.cost_vnd} onChange={x => set('cost_vnd')(num(x))}
                   hint="STAFF ONLY — never shown" />
            <Field label="Lead time (min)" value={d.lead_time_minutes}
                   onChange={x => set('lead_time_minutes')(num(x))} />
          </div>

          <Upload shape="dish" current={d.photo_path} onPath={p => set('photo_path')(p || null)} onToast={onToast} />

          <Tagger allergens={d.allergens} dietary={d.dietary}
                  onChange={(a, di) => setD(x => ({ ...x, allergens: a, dietary: di }))} />

          <div className="am-row2">
            <Field label="Availability (EN)" value={d.availability_en} onChange={set('availability_en')}
                   hint="e.g. evenings only" />
            <Field label="Availability (VN)" value={d.availability_vn} onChange={set('availability_vn')} />
          </div>

          <div className="am-checks">
            <Check label="Allergens confirmed by the kitchen" on={d.allergens_confirmed}
                   onChange={set('allergens_confirmed')}
                   hint="until this is ticked, members are told to ask" />
            <Check label="Shown to members" on={d.is_active} onChange={set('is_active')} />
            <Check label="Still a draft" on={d.is_placeholder} onChange={set('is_placeholder')} />
          </div>

          <div className="am-actions">
            <button className="am-save" onClick={() => onSave({
              service: d.service,
              section_en: d.section_en, section_vn: d.section_vn,
              name_en: d.name_en, name_vn: d.name_vn,
              description_en: d.description_en, description_vn: d.description_vn,
              allergens: d.allergens, dietary: d.dietary, allergens_confirmed: d.allergens_confirmed,
              photo_path: d.photo_path, price_vnd: d.price_vnd, cost_vnd: d.cost_vnd,
              lead_time_minutes: d.lead_time_minutes,
              availability_en: d.availability_en, availability_vn: d.availability_vn,
              is_active: d.is_active, is_placeholder: d.is_placeholder,
            })}>Save dish</button>
            <button className="am-del" onClick={onDelete}>Remove</button>
          </div>
        </>
      )}
    </section>
  )
}

function SetForm({
  s, courses, first, last, onMove, onSave, onDelete,
  onAddCourse, onSaveCourse, onDeleteCourse, onMoveCourse,
}: {
  s: SetMenu; courses: Course[]; first: boolean; last: boolean
  onMove: (d: -1 | 1) => void
  onSave: (p: Record<string, unknown>) => void; onDelete: () => void
  onAddCourse: () => void
  onSaveCourse: (id: string, p: Record<string, unknown>) => void
  onDeleteCourse: (id: string, label: string) => void
  onMoveCourse: (id: string, d: -1 | 1) => void
}) {
  const [d, setD] = useState(s)
  const [open, setOpen] = useState(false)
  const set = (k: keyof SetMenu) => (val: unknown) => setD(x => ({ ...x, [k]: val }))
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[^\d]/g, '')) || 0)

  return (
    <section className={`am-card is-item ${open ? 'is-open' : ''}`}>
      <div className="am-itemhead">
        <button className="am-disc" onClick={() => setOpen(o => !o)}>{open ? '−' : '+'}</button>
        <div className="am-itemname">{d.name_en} <span className="am-flag is-quiet">{courses.length} courses</span></div>
        <div className="am-itemprice">{price(d.price_per_head_vnd) ?? 'on request'}</div>
        <div className="am-nudge">
          <button disabled={first} onClick={() => onMove(-1)}>↑</button>
          <button disabled={last} onClick={() => onMove(1)}>↓</button>
        </div>
      </div>

      {open && (
        <>
          <div className="am-row2">
            <Field label="Menu name (EN)" value={d.name_en} onChange={set('name_en')} />
            <Field label="Menu name (VN)" value={d.name_vn} onChange={set('name_vn')} />
          </div>
          <Area label="Standfirst (EN)" value={d.standfirst_en} onChange={set('standfirst_en')} />
          <Area label="Standfirst (VN)" value={d.standfirst_vn} onChange={set('standfirst_vn')} />

          <div className="am-row2">
            <Field label="Per head ₫" value={d.price_per_head_vnd} onChange={x => set('price_per_head_vnd')(num(x))} />
            <Field label="Our cost per head ₫" value={d.cost_per_head_vnd} onChange={x => set('cost_per_head_vnd')(num(x))}
                   hint="STAFF ONLY" />
          </div>
          <div className="am-row2">
            <Field label="Minimum covers" value={d.min_covers} onChange={x => set('min_covers')(num(x))} />
            <Field label="Notice (hours)" value={d.notice_hours} onChange={x => set('notice_hours')(num(x))}
                   hint="48 = two days" />
          </div>

          <div className="am-checks">
            <Check label="Shown to members" on={d.is_active} onChange={set('is_active')} />
            <Check label="Still a draft" on={d.is_placeholder} onChange={set('is_placeholder')} />
          </div>

          <div className="am-actions">
            <button className="am-save" onClick={() => onSave({
              name_en: d.name_en, name_vn: d.name_vn,
              standfirst_en: d.standfirst_en, standfirst_vn: d.standfirst_vn,
              price_per_head_vnd: d.price_per_head_vnd, cost_per_head_vnd: d.cost_per_head_vnd,
              min_covers: d.min_covers, notice_hours: d.notice_hours,
              is_active: d.is_active, is_placeholder: d.is_placeholder,
            })}>Save set menu</button>
            <button className="am-del" onClick={onDelete}>Remove</button>
          </div>

          <div className="am-secbar" style={{ marginTop: 18 }}>
            <div className="am-sec" style={{ fontSize: 12 }}>Courses</div>
            <button className="am-add" onClick={onAddCourse}>+ Course</button>
          </div>
          {courses.map((c, i) => (
            <CourseRow key={c.id} c={c} first={i === 0} last={i === courses.length - 1}
                       onMove={dir => onMoveCourse(c.id, dir)}
                       onSave={p => onSaveCourse(c.id, p)}
                       onDelete={() => onDeleteCourse(c.id, c.dish_en)} />
          ))}
        </>
      )}
    </section>
  )
}

function CourseRow({ c, first, last, onMove, onSave, onDelete }: {
  c: Course; first: boolean; last: boolean
  onMove: (d: -1 | 1) => void
  onSave: (p: Record<string, unknown>) => void; onDelete: () => void
}) {
  const [d, setD] = useState(c)
  const set = (k: keyof Course) => (val: unknown) => setD(x => ({ ...x, [k]: val }))
  return (
    <div className="am-course">
      <div className="am-row3">
        <Field label="Course (EN)" value={d.course_en} onChange={set('course_en')} hint="To start" />
        <Field label="Dish (EN)" value={d.dish_en} onChange={set('dish_en')} />
        <Field label="Dish (VN)" value={d.dish_vn} onChange={set('dish_vn')} />
      </div>
      <div className="am-row2">
        <Field label="Course (VN)" value={d.course_vn} onChange={set('course_vn')} />
        <Field label="Note (EN)" value={d.note_en} onChange={set('note_en')} />
      </div>
      <Tagger allergens={d.allergens} dietary={d.dietary}
              onChange={(a, di) => setD(x => ({ ...x, allergens: a, dietary: di }))} />
      <Check label="Allergens confirmed" on={d.allergens_confirmed} onChange={set('allergens_confirmed')} />
      <div className="am-actions">
        <button className="am-save" onClick={() => onSave({
          course_en: d.course_en, course_vn: d.course_vn,
          dish_en: d.dish_en, dish_vn: d.dish_vn, note_en: d.note_en, note_vn: d.note_vn,
          allergens: d.allergens, dietary: d.dietary, allergens_confirmed: d.allergens_confirmed,
        })}>Save course</button>
        <button className="am-del" onClick={onDelete}>Remove</button>
        <div className="am-nudge">
          <button disabled={first} onClick={() => onMove(-1)}>↑</button>
          <button disabled={last} onClick={() => onMove(1)}>↓</button>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.am-eyebrow { font-family: ${MONO}; font-size: 10px; letter-spacing: .2em;
              text-transform: uppercase; color: ${GOLD}; }
.am-h1 { font-family: 'Rampant Sans', Georgia, serif; font-size: 30px; margin: 8px 0 6px; font-weight: 500; }
.am-lede { font-family: ${MONO}; font-size: 12px; line-height: 1.9; opacity: .6; max-width: 76ch; margin: 0; }
.am-lede code { background: rgba(229,212,194,.08); padding: 1px 5px; border-radius: 2px; }
.am-dim { font-family: ${MONO}; font-size: 12px; opacity: .45; }

.am-warn { border: 1px solid rgba(212,184,90,.45); border-left: 3px solid ${GOLD};
           padding: 12px 15px; margin-bottom: 18px; font-family: ${MONO};
           font-size: 11.5px; line-height: 1.85; }
.am-err { border-left: 3px solid #C27070; padding: 10px 14px; margin-bottom: 16px;
          font-family: ${MONO}; font-size: 12px; color: #E0A0A0; }

.am-grid { display: grid; grid-template-columns: 230px 1fr; gap: 30px; align-items: start; }
@media (max-width: 900px) { .am-grid { grid-template-columns: 1fr; } }

.am-col-head { font-family: ${MONO}; font-size: 10px; letter-spacing: .18em;
               text-transform: uppercase; opacity: .5; padding-bottom: 8px;
               border-bottom: 1px solid ${HAIR}; margin-bottom: 8px; }
.am-vlist { list-style: none; margin: 0 0 10px; padding: 0; }
.am-vbtn { display: block; width: 100%; text-align: left; background: none; border: none;
           border-bottom: 1px solid ${HAIR}; cursor: pointer; padding: 11px 6px;
           color: ${CREAM}; font-family: 'Rampant Sans', Georgia, serif; font-size: 15px; }
.am-vbtn.is-on { color: ${GOLD}; }
.am-vmeta { display: block; font-family: ${MONO}; font-size: 9.5px;
            letter-spacing: .1em; text-transform: uppercase; opacity: .42; margin-top: 4px; }

.am-card { border: 1px solid ${HAIR}; border-radius: 3px; padding: 16px 18px; margin-bottom: 14px; }
.am-card.is-item { padding: 10px 14px; }
.am-card.is-item.is-open { padding: 14px 18px 18px; border-color: rgba(212,184,90,.35); }

.am-itemhead { display: flex; align-items: center; gap: 12px; }
.am-disc { width: 26px; height: 26px; flex-shrink: 0; background: none; cursor: pointer;
           border: 1px solid ${HAIR}; border-radius: 2px; color: ${CREAM}; font-size: 14px; }
.am-itemname { flex: 1; font-family: 'Rampant Sans', Georgia, serif; font-size: 15px; }
.am-itemprice { font-family: ${MONO}; font-size: 12px; opacity: .7; white-space: nowrap; }
.am-flag { font-family: ${MONO}; font-size: 9px; letter-spacing: .1em; text-transform: uppercase;
           color: ${GOLD}; border: 1px solid rgba(212,184,90,.4); padding: 2px 6px;
           border-radius: 2px; margin-left: 9px; }
.am-flag.is-quiet { color: rgba(229,212,194,.5); border-color: ${HAIR}; }

.am-nudge { display: flex; gap: 4px; }
.am-nudge button { width: 26px; height: 26px; background: none; border: 1px solid ${HAIR};
                   border-radius: 2px; color: ${CREAM}; cursor: pointer; font-size: 12px; }
.am-nudge button:disabled { opacity: .25; cursor: default; }

.am-secbar { display: flex; justify-content: space-between; align-items: flex-end;
             gap: 16px; margin: 26px 0 12px; border-bottom: 1px solid ${HAIR}; padding-bottom: 8px; }
.am-sec { font-family: 'Rampant Sans', Georgia, serif; font-size: 17px; }
.am-secnote { font-family: ${MONO}; font-size: 10px; opacity: .45; margin-top: 3px; }

.am-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.am-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
@media (max-width: 720px) { .am-row2, .am-row3 { grid-template-columns: 1fr; } }

.am-field { display: block; margin-bottom: 12px; }
.am-label { display: block; font-family: ${MONO}; font-size: 9.5px; letter-spacing: .14em;
            text-transform: uppercase; opacity: .55; margin-bottom: 5px; }
.am-hint { font-style: normal; text-transform: none; letter-spacing: .02em; opacity: .75; }
.am-input { width: 100%; box-sizing: border-box; background: rgba(229,212,194,.05);
            border: 1px solid ${HAIR}; border-radius: 2px; color: ${CREAM};
            font-family: ${MONO}; font-size: 13px; padding: 9px 10px; outline: none; }
.am-input:focus { border-color: ${GOLD}; }

.am-checks { display: flex; flex-wrap: wrap; gap: 18px; margin: 12px 0 4px; }
.am-check { display: flex; align-items: center; gap: 8px; font-family: ${MONO};
            font-size: 11.5px; cursor: pointer; }
.am-check input { width: 16px; height: 16px; accent-color: ${GOLD}; }

.am-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.am-chip { font-family: ${MONO}; font-size: 10px; letter-spacing: .06em; padding: 5px 9px;
           background: none; border: 1px solid ${HAIR}; border-radius: 2px;
           color: rgba(229,212,194,.6); cursor: pointer; }
.am-chip.is-on { border-color: ${GOLD}; color: ${GOLD}; }
.am-chip.is-diet.is-on { border-color: #B0C18E; color: #B0C18E; }

.am-actions { display: flex; gap: 12px; align-items: center; margin-top: 14px; }
.am-save { background: ${CREAM}
.am-hours { display: grid; gap: 8px; margin-top: 12px; }
.am-hrow { display: grid; grid-template-columns: 48px auto 18px auto 1fr; gap: 10px; align-items: center; }
.am-hday { font-family: 'Google Sans Code', monospace; font-size: 12px; letter-spacing: .12em;
           text-transform: uppercase; color: rgba(229,212,194,.55); }
.am-hrow input[type=time] { background: rgba(0,0,0,.25); border: 1px solid rgba(229,212,194,.2);
                            color: #E5D4C2; border-radius: 3px; padding: 8px 10px;
                            font-family: 'Google Sans Code', monospace; font-size: 13px; min-height: 40px; }
.am-hrow input[type=time]:focus { outline: none; border-color: #D4B85A; }
.am-hto { text-align: center; color: rgba(229,212,194,.35); }
.am-hclear { background: none; border: none; cursor: pointer; justify-self: start;
             font-family: 'Google Sans Code', monospace; font-size: 11px; color: rgba(229,212,194,.45); }
.am-hclear:hover { color: #C27070; }
; color: #052E20; border: none; border-radius: 2px;
           font-family: ${MONO}; font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
           padding: 9px 16px; cursor: pointer; }
.am-add { background: none; border: 1px solid ${HAIR}; border-radius: 2px; color: ${CREAM};
          font-family: ${MONO}; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase;
          padding: 7px 12px; cursor: pointer; }
.am-add:disabled { opacity: .4; cursor: default; }
.am-del { background: none; border: none; color: #C27070; font-family: ${MONO};
          font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; }
.am-link { background: none; border: none; color: rgba(229,212,194,.5); font-family: ${MONO};
           font-size: 10.5px; cursor: pointer; margin-left: 10px; }

.am-details { margin: 6px 0 10px; }
.am-details summary { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .1em;
                      text-transform: uppercase; opacity: .5; cursor: pointer; padding: 6px 0; }

.am-up { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.am-uplogo { height: 40px; max-width: 150px; object-fit: contain; }
.am-updish { width: 84px; height: 62px; object-fit: cover; border-radius: 2px; }
.am-upnone { width: 84px; height: 44px; display: flex; align-items: center; justify-content: center;
             border: 1px dashed ${HAIR}; border-radius: 2px; font-family: ${MONO};
             font-size: 9px; opacity: .4; }

.am-course { border-left: 2px solid ${HAIR}; padding: 12px 0 12px 16px; margin-bottom: 10px; }

.am-audit { list-style: none; margin: 0; padding: 0; font-family: ${MONO};
            font-size: 11.5px; line-height: 2.1; }
`
