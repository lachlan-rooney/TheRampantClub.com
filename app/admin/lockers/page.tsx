'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// Admin / Whisky Library / Lockers
//
// Visual wall of the member lockers. Renders a grid driven by each locker's
// position_row / position_col. Click a tile to open the drawer and edit
// assignment, label, contents (bottles + fill levels), notes, status.
//
// Wall layout: the physical wall has a doorway between columns 5 and 6
// (the bar entrance). We render that as a tall door panel spanning all rows
// at column index 6 of the grid, with locker cells flowing 1..5 and 6..N
// around it. The doorway is a visual fact about the room, not an editable
// position — no locker can sit there.
//
// Bottle entry: bottles must be PICKED from the whiskies catalogue, not
// hand-typed. This keeps the inventory normalised — names match the live
// list, distillery/age/abv come from one source of truth, and a name typo
// can't create a phantom bottle the bar can't trace back to a real entry.

interface Locker {
  locker_no: string
  member_no: string | null
  member_name: string | null
  member_nickname: string | null
  member_status: string | null
  label: string | null
  position_row: number | null
  position_col: number | null
  status: string
  notes: string | null
  bottle_count: number
  avg_fill_pct: number
  updated_at: string
}

interface BottleContent {
  id: string
  locker_no: string
  bottle_name: string
  distillery: string | null
  age: number | null
  abv: number | null
  fill_pct: number
  opened_at: string | null
  notes: string | null
}

interface MemberLite {
  member_no: string
  full_name: string
  nickname: string | null
  status: string
  tier: string
}

interface WhiskyLite {
  id: string
  name: string
  distillery: string | null
  region: string | null
  age: string | null   // stored as text in `whiskies`; parsed on insert
  abv: string | null   // stored as text in `whiskies`; parsed on insert
  in_stock: boolean
}

const STATUSES = ['occupied', 'reserved', 'empty', 'retired'] as const
// Doorway column index in the wall grid (1-indexed). A door sits between
// cols 5 and 6 — the entrance to the Rampant Room. This is a visual fact
// about the physical wall; lockers cannot occupy it.
const WALL_DOOR_AFTER_COL = 5

export default function LockersPage() {
  const [lockers, setLockers] = useState<Locker[]>([])
  const [contents, setContents] = useState<BottleContent[]>([])
  const [members, setMembers] = useState<MemberLite[]>([])
  const [whiskies, setWhiskies] = useState<WhiskyLite[]>([])
  const [loading, setLoading] = useState(true)
  const [openLocker, setOpenLocker] = useState<string | null>(null)
  const [seedOpen, setSeedOpen] = useState(false)
  const [seedRows, setSeedRows] = useState(4)
  const [seedCols, setSeedCols] = useState(10)
  const [seedPrefix, setSeedPrefix] = useState('')
  const [filter, setFilter] = useState<string>('all')

  // Whiskies come from the same `whiskies` table the Atlas reads; RLS lets
  // admins see everything, and the catalogue is small enough to ship in one
  // shot (a few hundred rows at most). Loaded once on mount — picking a
  // bottle is a read-only operation so we don't refetch on every drawer open.
  const loadWhiskies = useCallback(async () => {
    try {
      const sb = createBrowserSupabaseClient()
      const { data } = await sb.from('whiskies')
        .select('id, name, distillery, region, age, abv, in_stock')
        .order('name')
      setWhiskies((data as WhiskyLite[]) || [])
    } catch {
      setWhiskies([])
    }
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/lockers', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/mis/members', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ members: [] })),
    ]).then(([l, m]) => {
      setLockers(l.lockers || [])
      setContents(l.contents || [])
      setMembers(m.members || [])
      setLoading(false)
    })
  }, [])
  useEffect(() => { load(); loadWhiskies() }, [load, loadWhiskies])

  const gridDims = useMemo(() => {
    let maxR = 0, maxC = 0
    for (const l of lockers) {
      if (l.position_row && l.position_row > maxR) maxR = l.position_row
      if (l.position_col && l.position_col > maxC) maxC = l.position_col
    }
    return { rows: maxR, cols: maxC }
  }, [lockers])

  const lockerByPos = useMemo(() => {
    const m = new Map<string, Locker>()
    for (const l of lockers) {
      if (l.position_row != null && l.position_col != null) {
        m.set(`${l.position_row}-${l.position_col}`, l)
      }
    }
    return m
  }, [lockers])

  const counts = useMemo(() => {
    const total = lockers.length
    const occupied = lockers.filter(l => l.status === 'occupied').length
    const reserved = lockers.filter(l => l.status === 'reserved').length
    const empty    = lockers.filter(l => l.status === 'empty').length
    const retired  = lockers.filter(l => l.status === 'retired').length
    const bottles  = contents.length
    const lowFill  = contents.filter(c => c.fill_pct <= 25).length
    return { total, occupied, reserved, empty, retired, bottles, lowFill }
  }, [lockers, contents])

  const seed = async () => {
    const r = await fetch('/api/admin/lockers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: seedRows, cols: seedCols, prefix: seedPrefix || undefined }),
    })
    const j = await r.json()
    if (!r.ok) { alert(j.error || 'Seed failed'); return }
    setSeedOpen(false)
    load()
  }

  if (loading) return <div style={emptyText}>Loading lockers…</div>

  const noGrid = gridDims.rows === 0 || gridDims.cols === 0

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>Whisky Library</div>
        <h1 style={pageTitle}>Member lockers</h1>
        <p style={lede}>
          The physical wall — every tile is a locker. Click one to assign a member, edit contents, or move it on the grid. Empty tiles wait to be filled; gold tiles are reserved; red-tinted are retired.
        </p>
      </div>

      {/* Stat strip */}
      <div style={statStrip}>
        <Stat label="Lockers"   value={counts.total} />
        <Stat label="Occupied"  value={counts.occupied} color="#7AB07A" />
        <Stat label="Reserved"  value={counts.reserved} color="#D4B85A" />
        <Stat label="Empty"     value={counts.empty} color="#B2AA98" />
        <Stat label="Retired"   value={counts.retired} color="#7E7864" />
        <Stat label="Bottles"   value={counts.bottles} />
        <Stat label="Low fill (≤25%)" value={counts.lowFill} color="#C27070" />
      </div>

      {/* Filters + seed */}
      <div style={toolbarRow}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', ...STATUSES] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ ...chip, ...(filter === s ? chipActive : null) }}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        <button onClick={() => setSeedOpen(s => !s)} style={btnGhost}>
          {seedOpen ? 'Cancel' : noGrid ? '＋ Seed grid' : '＋ Add more lockers'}
        </button>
      </div>

      {seedOpen && (
        <div style={seedBlock}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={editLabel}>Rows</div>
              <input type="number" min={1} max={20} value={seedRows} onChange={e => setSeedRows(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} style={{ ...inputStyle, width: 80 }} />
            </div>
            <div>
              <div style={editLabel}>Columns</div>
              <input type="number" min={1} max={30} value={seedCols} onChange={e => setSeedCols(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} style={{ ...inputStyle, width: 80 }} />
            </div>
            <div>
              <div style={editLabel}>Prefix (optional)</div>
              <input value={seedPrefix} onChange={e => setSeedPrefix(e.target.value.slice(0, 4))} placeholder="e.g. L" style={{ ...inputStyle, width: 100 }} />
            </div>
            <button onClick={seed} style={btnPrimary}>Create {seedRows * seedCols} lockers</button>
          </div>
          <div style={{ ...inviteMeta, marginTop: 10 }}>
            Existing lockers at the same locker_no are preserved. Rows are labelled A–T, columns 01..30 zero-padded. The prefix prepends to the locker number (e.g. prefix &quot;L&quot; → L A-01).
          </div>
        </div>
      )}

      {/* The wall */}
      {noGrid ? (
        <div style={emptyBlock}>
          <div style={{ marginBottom: 12 }}>No lockers yet.</div>
          <button onClick={() => setSeedOpen(true)} style={btnPrimary}>＋ Seed the grid</button>
        </div>
      ) : (() => {
        // If the wall is wide enough for a door (>5 lockable cols), the
        // grid template inserts a door column between col 5 and col 6.
        // Otherwise it's a plain row × cols grid.
        const hasDoor = gridDims.cols > WALL_DOOR_AFTER_COL
        const leftCols  = hasDoor ? WALL_DOOR_AFTER_COL : gridDims.cols
        const rightCols = hasDoor ? gridDims.cols - WALL_DOOR_AFTER_COL : 0
        const gridTemplateColumns = hasDoor
          ? `36px repeat(${leftCols}, minmax(72px, 1fr)) 56px repeat(${rightCols}, minmax(72px, 1fr))`
          : `36px repeat(${gridDims.cols}, minmax(72px, 1fr))`
        // Door cell sits at CSS column = 1 (row label) + leftCols + 1 = leftCols + 2.
        // Spans the header row + every locker row visually as one panel.
        const doorCssCol = leftCols + 2
        return (
          <div style={{ ...wallGrid, gridTemplateColumns }}>
            {/* column headers — split by the door */}
            <div />
            {Array.from({ length: leftCols }, (_, c) => (
              <div key={`ch-${c}`} style={gridHeader}>{String(c + 1).padStart(2, '0')}</div>
            ))}
            {hasDoor && <div style={doorHeader} aria-hidden="true" />}
            {Array.from({ length: rightCols }, (_, c) => (
              <div key={`ch-r-${c}`} style={gridHeader}>{String(WALL_DOOR_AFTER_COL + c + 1).padStart(2, '0')}</div>
            ))}

            {/* rows */}
            {Array.from({ length: gridDims.rows }, (_, r) => (
              <RowFragment
                key={`r-${r}`}
                rowIdx={r + 1}
                leftCols={leftCols}
                rightCols={rightCols}
                hasDoor={hasDoor}
                lockerByPos={lockerByPos}
                onOpen={(no) => setOpenLocker(no)}
                filter={filter}
              />
            ))}

            {/* The door — single tall panel spanning header + all rows.
                Rendered last so it sits visually over the door-column slots
                each row leaves blank. */}
            {hasDoor && (
              <div
                style={{
                  ...doorPanel,
                  gridColumn: doorCssCol,
                  gridRow: `1 / span ${gridDims.rows + 1}`,
                }}
                title="Entrance — door between columns 05 and 06"
              >
                <div style={doorFrame}>
                  <div style={doorHandle} />
                  <div style={doorLabel}>ENTRANCE</div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Drawer */}
      {openLocker && (
        <LockerDrawer
          locker_no={openLocker}
          members={members}
          whiskies={whiskies}
          onClose={() => setOpenLocker(null)}
          onChange={load}
        />
      )}
    </>
  )
}

function RowFragment({ rowIdx, leftCols, rightCols, hasDoor, lockerByPos, onOpen, filter }: {
  rowIdx: number
  leftCols: number
  rightCols: number
  hasDoor: boolean
  lockerByPos: Map<string, Locker>
  onOpen: (locker_no: string) => void
  filter: string
}) {
  const rowLetter = 'ABCDEFGHIJKLMNOPQRST'[rowIdx - 1] || `R${rowIdx}`

  const renderTile = (colIdx1: number) => {
    const l = lockerByPos.get(`${rowIdx}-${colIdx1}`)
    if (!l) return <div key={`empty-${rowIdx}-${colIdx1}`} style={tileGhost} />
    const dim = filter !== 'all' && l.status !== filter
    return (
      <button
        key={l.locker_no}
        onClick={() => onOpen(l.locker_no)}
        style={{
          ...tileBase,
          ...tileByStatus(l.status),
          opacity: dim ? 0.25 : 1,
        }}
        title={`${l.locker_no} · ${l.member_name || 'unassigned'}`}
      >
        <div style={tileNo}>{l.locker_no}</div>
        <div style={tileName}>{l.label || l.member_name || (l.status === 'reserved' ? 'Reserved' : l.status === 'retired' ? 'Retired' : '—')}</div>
        <div style={tileMeta}>
          {l.bottle_count > 0 ? `${l.bottle_count} btl` : ''}
        </div>
        {l.bottle_count > 0 && (
          <div style={tileFillTrack}>
            <div style={{ ...tileFillBar, width: `${l.avg_fill_pct}%`, background: fillColor(l.avg_fill_pct) }} />
          </div>
        )}
      </button>
    )
  }

  return (
    <>
      <div style={gridRowLabel}>{rowLetter}</div>
      {Array.from({ length: leftCols }, (_, c) => renderTile(c + 1))}
      {/* Door slot — left blank so the spanning <doorPanel> sibling can sit over it. */}
      {hasDoor && <div aria-hidden="true" />}
      {Array.from({ length: rightCols }, (_, c) => renderTile(WALL_DOOR_AFTER_COL + c + 1))}
    </>
  )
}

function tileByStatus(s: string): React.CSSProperties {
  switch (s) {
    case 'occupied': return { background: 'rgba(122,176,122,0.10)', borderColor: 'rgba(122,176,122,0.40)' }
    case 'reserved': return { background: 'rgba(212,184,90,0.10)', borderColor: 'rgba(212,184,90,0.40)' }
    case 'retired':  return { background: 'rgba(180,70,70,0.06)',  borderColor: 'rgba(180,70,70,0.25)', opacity: 0.7 }
    default:         return { background: 'rgba(229,212,194,0.03)', borderColor: 'rgba(229,212,194,0.10)' }
  }
}
function fillColor(pct: number): string {
  if (pct <= 25) return '#C27070'
  if (pct <= 50) return '#D4B85A'
  return '#7AB07A'
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={statTile}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: color || '#E5D4C2' }}>{value}</div>
    </div>
  )
}

// ── DRAWER ──────────────────────────────────────────────────────────
function LockerDrawer({ locker_no, members, whiskies, onClose, onChange }: {
  locker_no: string
  members: MemberLite[]
  whiskies: WhiskyLite[]
  onClose: () => void
  onChange: () => void
}) {
  const [locker, setLocker] = useState<Locker | null>(null)
  const [contents, setContents] = useState<BottleContent[]>([])
  const [loading, setLoading] = useState(true)
  const [memberQuery, setMemberQuery] = useState('')
  const [adding, setAdding] = useState(false)
  // Picker state — bottle entry is a SELECTION, not a typing exercise.
  // selectedWhisky drives the Add button; bottleQuery only filters the list.
  const [selectedWhisky, setSelectedWhisky] = useState<WhiskyLite | null>(null)
  const [bottleQuery, setBottleQuery] = useState('')
  const [bottleListOpen, setBottleListOpen] = useState(false)
  const [fillPct, setFillPct] = useState('100')
  const bottlePickerRef = useRef<HTMLDivElement | null>(null)

  // Close the open dropdown when clicking outside the picker.
  useEffect(() => {
    if (!bottleListOpen) return
    const onClick = (e: MouseEvent) => {
      if (bottlePickerRef.current && !bottlePickerRef.current.contains(e.target as Node)) {
        setBottleListOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [bottleListOpen])

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/lockers/${locker_no}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        setLocker(j.locker)
        setContents(j.contents || [])
        setLoading(false)
      })
  }, [locker_no])
  useEffect(() => { load() }, [load])

  const patch = async (patchBody: Record<string, unknown>) => {
    await fetch(`/api/admin/lockers/${locker_no}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    })
    load()
    onChange()
  }

  const addBottle = async () => {
    if (!selectedWhisky) return
    setAdding(true)
    // age/abv come from the catalogue as text; the API parses them with
    // Number(). Passing empty string → null on the server side.
    await fetch(`/api/admin/lockers/${locker_no}/contents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bottle_name: selectedWhisky.name,
        distillery:  selectedWhisky.distillery || null,
        age:         selectedWhisky.age || null,
        abv:         selectedWhisky.abv || null,
        fill_pct:    Number(fillPct) || 100,
      }),
    })
    setSelectedWhisky(null)
    setBottleQuery('')
    setFillPct('100')
    setAdding(false)
    load()
    onChange()
  }

  // Whisky search — name / distillery / region, max 30 rows to keep the
  // popover light. In-stock first so the bartender finds what's actually
  // on the shelf before the archived/historical drams.
  const filteredWhiskies = useMemo(() => {
    const q = bottleQuery.trim().toLowerCase()
    const matches = q
      ? whiskies.filter(w =>
          w.name.toLowerCase().includes(q) ||
          (w.distillery || '').toLowerCase().includes(q) ||
          (w.region     || '').toLowerCase().includes(q)
        )
      : whiskies
    return [...matches].sort((a, b) => Number(b.in_stock) - Number(a.in_stock)).slice(0, 30)
  }, [whiskies, bottleQuery])

  const updateBottle = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/lockers/${locker_no}/contents?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    load()
    onChange()
  }

  const removeBottle = async (id: string) => {
    if (!confirm('Remove this bottle from the locker?')) return
    await fetch(`/api/admin/lockers/${locker_no}/contents?id=${id}`, { method: 'DELETE' })
    load()
    onChange()
  }

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members.slice(0, 12)
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.member_no.toLowerCase().includes(q) ||
      (m.nickname || '').toLowerCase().includes(q)
    ).slice(0, 12)
  }, [members, memberQuery])

  return (
    <>
      <div style={drawerBackdrop} onClick={onClose} />
      <div style={drawerPanel}>
        <div style={drawerHeader}>
          <div>
            <div style={eyebrow}>Locker</div>
            <h2 style={drawerTitle}>{locker_no}</h2>
            {locker?.member_name && (
              <div style={{ ...nicknameText, marginTop: 4 }}>
                {locker.member_name}
                {locker.member_no && (
                  <Link href={`/admin/mis/${locker.member_no}`} style={{ marginLeft: 8, fontSize: 11, color: '#7AB07A', textDecoration: 'none' }}>
                    → profile
                  </Link>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        {loading || !locker ? (
          <div style={emptyText}>Loading…</div>
        ) : (
          <>
            {/* Assignment */}
            <Section title="Assignment">
              <div style={editLabel}>Member</div>
              {locker.member_no ? (
                <div style={memberAssignedRow}>
                  <div>
                    <strong>{locker.member_name}</strong>
                    <span style={{ marginLeft: 8, color: '#B2AA98', fontSize: 11 }}>{locker.member_no}</span>
                  </div>
                  <button onClick={() => patch({ member_no: null })} style={tinyBtn}>Unassign</button>
                </div>
              ) : (
                <>
                  <input
                    value={memberQuery}
                    onChange={e => setMemberQuery(e.target.value)}
                    placeholder="Search member by name or number…"
                    style={inputStyle}
                  />
                  <div style={memberList}>
                    {filteredMembers.map(m => (
                      <button key={m.member_no} onClick={() => patch({ member_no: m.member_no })} style={memberRow}>
                        <span>{m.full_name}</span>
                        <span style={{ color: '#B2AA98', fontSize: 11 }}>{m.member_no} · {m.tier}</span>
                      </button>
                    ))}
                    {filteredMembers.length === 0 && (
                      <div style={emptyHint}>No matches.</div>
                    )}
                  </div>
                </>
              )}

              <div style={editLabel}>Display label (optional)</div>
              <input
                defaultValue={locker.label || ''}
                onBlur={e => { if ((e.target.value || null) !== locker.label) patch({ label: e.target.value || null }) }}
                placeholder="Override the member name on the tile"
                style={inputStyle}
              />

              <div style={editLabel}>Status</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => patch({ status: s })} style={{ ...chip, ...(locker.status === s ? chipActive : null) }}>
                    {s}
                  </button>
                ))}
              </div>

              <div style={editLabel}>Position (row / col)</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number" min={1} max={20}
                  defaultValue={locker.position_row ?? ''}
                  onBlur={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n !== locker.position_row) patch({ position_row: n }) }}
                  style={{ ...inputStyle, width: 90 }}
                />
                <input
                  type="number" min={1} max={30}
                  defaultValue={locker.position_col ?? ''}
                  onBlur={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n !== locker.position_col) patch({ position_col: n }) }}
                  style={{ ...inputStyle, width: 90 }}
                />
              </div>

              <div style={editLabel}>Notes</div>
              <textarea
                rows={3}
                defaultValue={locker.notes || ''}
                onBlur={e => { if ((e.target.value || null) !== locker.notes) patch({ notes: e.target.value || null }) }}
                placeholder="Lock combo, fragile bottles, anything for the team."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Section>

            {/* Contents */}
            <Section title={`Contents · ${contents.length} ${contents.length === 1 ? 'bottle' : 'bottles'}`}>
              {contents.length === 0 && (
                <div style={emptyHint}>No bottles in this locker yet.</div>
              )}
              {contents.map(c => (
                <div key={c.id} style={bottleRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 13, color: '#E5D4C2' }}>
                      {c.bottle_name}
                    </div>
                    <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', marginTop: 3 }}>
                      {[c.distillery, c.age ? `${c.age}y` : null, c.abv ? `${c.abv}%` : null].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <input
                        type="range" min={0} max={100}
                        defaultValue={c.fill_pct}
                        onChange={e => {
                          const t = e.currentTarget.nextElementSibling as HTMLElement | null
                          if (t) t.textContent = `${e.currentTarget.value}%`
                        }}
                        onMouseUp={e => updateBottle(c.id, { fill_pct: Number((e.target as HTMLInputElement).value) })}
                        onTouchEnd={e => updateBottle(c.id, { fill_pct: Number((e.target as HTMLInputElement).value) })}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: fillColor(c.fill_pct), width: 40, textAlign: 'right' }}>
                        {c.fill_pct}%
                      </span>
                    </div>
                  </div>
                  <button onClick={() => removeBottle(c.id)} style={{ ...tinyBtn, color: '#C27070', borderColor: 'rgba(180,70,70,0.30)' }}>Remove</button>
                </div>
              ))}

              <div style={addBottleBlock}>
                <div style={editLabel}>Add bottle · pick from the whisky catalogue</div>

                {selectedWhisky ? (
                  // Selection state: show the chosen whisky as a chip with its
                  // catalogue metadata, plus a clear button. No free-text edits
                  // — fields trace back to the source row.
                  <div style={pickedWhiskyChip}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 13, color: '#E5D4C2' }}>
                        {selectedWhisky.name}
                      </div>
                      <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', marginTop: 3 }}>
                        {[
                          selectedWhisky.distillery,
                          selectedWhisky.age ? `${selectedWhisky.age}y` : null,
                          selectedWhisky.abv ? `${selectedWhisky.abv}%` : null,
                          selectedWhisky.region,
                          selectedWhisky.in_stock ? null : 'archived',
                        ].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <button onClick={() => { setSelectedWhisky(null); setBottleListOpen(true) }} style={tinyBtn}>Change</button>
                  </div>
                ) : (
                  // Picker state: search input + filtered popover. The list is
                  // visible whenever the input has focus and there are matches.
                  <div ref={bottlePickerRef} style={{ position: 'relative' }}>
                    <input
                      value={bottleQuery}
                      onChange={e => { setBottleQuery(e.target.value); setBottleListOpen(true) }}
                      onFocus={() => setBottleListOpen(true)}
                      placeholder={whiskies.length === 0
                        ? 'No whiskies in the catalogue yet — add one in /admin/whisky'
                        : `Search ${whiskies.length} whiskies by name, distillery, or region…`}
                      style={inputStyle}
                      disabled={whiskies.length === 0}
                    />
                    {bottleListOpen && whiskies.length > 0 && (
                      <div style={whiskyDropdown}>
                        {filteredWhiskies.length === 0 ? (
                          <div style={emptyHint}>No matches.</div>
                        ) : filteredWhiskies.map(w => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => { setSelectedWhisky(w); setBottleListOpen(false); setBottleQuery('') }}
                            style={whiskyRow}
                          >
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {w.name}
                            </span>
                            <span style={{ color: '#B2AA98', fontSize: 10, marginLeft: 8, flexShrink: 0 }}>
                              {[w.distillery, w.age ? `${w.age}y` : null, w.abv ? `${w.abv}%` : null].filter(Boolean).join(' · ') || '—'}
                              {!w.in_stock && <span style={{ color: '#7E7864', marginLeft: 6 }}>· archived</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={editLabel}>Fill %</div>
                    <input
                      value={fillPct}
                      onChange={e => setFillPct(e.target.value)}
                      placeholder="Fill %"
                      type="number" min={0} max={100}
                      style={inputStyle}
                    />
                  </div>
                  <button
                    onClick={addBottle}
                    disabled={!selectedWhisky || adding}
                    style={{ ...btnPrimary, opacity: !selectedWhisky ? 0.4 : 1 }}
                  >
                    {adding ? 'Adding…' : '＋ Add bottle'}
                  </button>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sectionBlock}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

// ── styles ───────────────────────────────────────────────────────────
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760, margin: 0,
}
const nicknameText: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', letterSpacing: '0.04em',
}
const statStrip: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 10, marginBottom: 16,
}
const statTile: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 6, padding: '12px 14px',
}
const statLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const statValue: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 24, fontWeight: 600,
  marginTop: 4,
}
const toolbarRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  gap: 12, flexWrap: 'wrap', marginBottom: 14,
}
const chip: React.CSSProperties = {
  background: 'rgba(229,212,194,0.04)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  cursor: 'pointer',
}
const chipActive: React.CSSProperties = {
  background: 'rgba(212,184,90,0.18)', color: '#D4B85A',
  border: '1px solid rgba(212,184,90,0.40)',
}
const seedBlock: React.CSSProperties = {
  marginBottom: 16, padding: 14,
  background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 8,
}
const wallGrid: React.CSSProperties = {
  display: 'grid', gap: 6,
  background: 'rgba(229,212,194,0.02)',
  border: '1px solid rgba(229,212,194,0.06)',
  padding: 12, borderRadius: 8, marginTop: 8,
  overflowX: 'auto',
}
const gridHeader: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.10em', textAlign: 'center',
  padding: '4px 0',
}
const gridRowLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#7E7864', letterSpacing: '0.10em', textAlign: 'center',
  alignSelf: 'center',
}
const tileBase: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2,
  padding: '8px 8px 6px', borderRadius: 4,
  border: '1px solid', cursor: 'pointer',
  textAlign: 'left', minHeight: 72,
  transition: 'transform 0.12s ease, border-color 0.12s ease',
}
const tileGhost: React.CSSProperties = {
  border: '1px dashed rgba(229,212,194,0.06)', borderRadius: 4, minHeight: 72,
}
const tileNo: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.08em',
}
const tileName: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 13,
  color: '#E5D4C2', lineHeight: 1.2,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const tileMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.06em',
}
const tileFillTrack: React.CSSProperties = {
  marginTop: 'auto', height: 3,
  background: 'rgba(229,212,194,0.08)', borderRadius: 2, overflow: 'hidden',
}
const tileFillBar: React.CSSProperties = {
  height: '100%', transition: 'width 0.3s ease',
}
const emptyBlock: React.CSSProperties = {
  padding: '60px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12, color: '#B2AA98',
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const emptyHint: React.CSSProperties = {
  padding: '12px 0', textAlign: 'center',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.5, fontStyle: 'italic',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 12px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const editLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginTop: 6,
}
const btnPrimary: React.CSSProperties = {
  background: '#5E6650', color: '#E5D4C2',
  border: 'none', borderRadius: 6,
  padding: '10px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
  textAlign: 'center',
}
const btnGhost: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '10px 16px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
  textAlign: 'center',
}
const inviteMeta: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', letterSpacing: '0.04em', lineHeight: 1.55,
}

// Drawer
const drawerBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
}
const drawerPanel: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '92vw',
  background: '#0A3526', borderLeft: '1px solid rgba(229,212,194,0.10)',
  padding: '28px 26px', overflowY: 'auto', zIndex: 201,
}
const drawerHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  marginBottom: 18,
}
const drawerTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 26, fontWeight: 500,
  color: '#E5D4C2', margin: '4px 0', letterSpacing: '0.04em',
}
const closeBtn: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98', border: 'none',
  fontSize: 28, cursor: 'pointer', padding: 0, lineHeight: 1,
}
const sectionBlock: React.CSSProperties = {
  marginBottom: 22, paddingTop: 14, borderTop: '1px solid rgba(229,212,194,0.08)',
}
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.14em', textTransform: 'uppercase',
  marginBottom: 10,
}
const memberAssignedRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 12px', background: 'rgba(122,176,122,0.10)',
  border: '1px solid rgba(122,176,122,0.30)', borderRadius: 6,
  color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 12,
}
const memberList: React.CSSProperties = {
  marginTop: 6, maxHeight: 220, overflowY: 'auto',
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
const tinyBtn: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.12)', borderRadius: 4,
  padding: '4px 10px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer',
}
const bottleRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 10, padding: '10px 12px',
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)', borderRadius: 6,
  marginBottom: 6,
}
const addBottleBlock: React.CSSProperties = {
  marginTop: 12, padding: 12,
  background: 'rgba(212,184,90,0.04)', border: '1px solid rgba(212,184,90,0.18)',
  borderRadius: 6,
  display: 'flex', flexDirection: 'column', gap: 6,
}
const pickedWhiskyChip: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 12px',
  background: 'rgba(122,176,122,0.10)',
  border: '1px solid rgba(122,176,122,0.30)',
  borderRadius: 6,
}
const whiskyDropdown: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
  maxHeight: 260, overflowY: 'auto',
  background: '#0A3526',
  border: '1px solid rgba(229,212,194,0.16)',
  borderRadius: 6,
  boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
  zIndex: 220,
}
const whiskyRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', width: '100%',
  padding: '8px 12px',
  background: 'transparent', border: 'none',
  borderBottom: '1px solid rgba(229,212,194,0.06)',
  color: '#E5D4C2', fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  cursor: 'pointer', textAlign: 'left',
}

// ── Wall door ──
// Vertical panel that visually divides the wall between cols 5 and 6,
// representing the actual doorway into the Rampant Room. It's purely
// architectural — not interactive — but the visual gap matters: it lets
// staff orient themselves against the real wall at a glance.
const doorHeader: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#7E7864', letterSpacing: '0.10em', textAlign: 'center',
  padding: '4px 0',
}
const doorPanel: React.CSSProperties = {
  // Sits inside the same grid as the locker tiles; the gridColumn/gridRow
  // are set inline based on the actual layout numbers.
  alignSelf: 'stretch', justifySelf: 'stretch',
  padding: 6,
  background: 'linear-gradient(180deg, rgba(94,102,80,0.18) 0%, rgba(94,102,80,0.10) 100%)',
  border: '1px solid rgba(212,184,90,0.30)',
  borderRadius: 4,
  position: 'relative',
  display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center',
}
const doorFrame: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 3,
  background:
    'repeating-linear-gradient(180deg, rgba(229,212,194,0.04) 0 18px, rgba(229,212,194,0.02) 18px 36px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const doorHandle: React.CSSProperties = {
  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
  width: 6, height: 6, borderRadius: '50%',
  background: '#D4B85A',
  boxShadow: '0 0 6px rgba(212,184,90,0.65)',
}
const doorLabel: React.CSSProperties = {
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  transform: 'rotate(180deg)',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.32em',
  textTransform: 'uppercase',
  opacity: 0.85,
}
