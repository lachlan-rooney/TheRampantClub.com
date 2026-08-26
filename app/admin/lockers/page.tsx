'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { ConfirmModal, useToast } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'
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

interface ActivityRow {
  id: string
  locker_no: string
  event_type: 'assigned' | 'unassigned' | 'status_changed' | 'label_changed'
            | 'notes_changed' | 'position_changed' | 'retired' | 'misc_patch'
  before_state: Record<string, unknown> | null
  after_state:  Record<string, unknown> | null
  changed_by_email: string | null
  notes: string | null
  created_at: string
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
// Physical wall geometry. Fixed — every slot is a real locker bay on the
// wall, whether or not the DB has data for it. An unseeded slot renders
// as a clean empty box (subtle solid border), not as a dashed-out ghost.
const WALL_LEFT_ROWS      = 4
const WALL_LEFT_COLS      = 6
const WALL_RIGHT_ROWS     = 3
const WALL_RIGHT_COLS     = 4
const WALL_DOOR_AFTER_COL = WALL_LEFT_COLS
// Row index AFTER which a horizontal divider stretches the full row width
// on the left wall. 1 = divider sits between row A and row B.
const WALL_LEFT_DIVIDER_AFTER_ROW = 1

export default function LockersPage() {
  const { t } = useLang()
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
  // Member-search highlight — type a name fragment to dim non-matching
  // tiles. Matches against assigned member's full name, nickname, AND
  // locker number, so the bar can find by any of those.
  const [memberSearch, setMemberSearch] = useState('')
  // Low-fill alert toggle — when on, only tiles with ≥1 bottle at ≤25%
  // stay un-dimmed. Surfaces "which member lockers need a refill check"
  // at a glance without having to scroll/eyeball each tile's fill bar.
  const [showLowFillOnly, setShowLowFillOnly] = useState(false)
  const { showToast, toastNode } = useToast()
  // Per-locker low-fill count, computed from the contents array we
  // already loaded. Map locker_no → number of bottles ≤25%.
  const lowFillByLocker = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of contents) {
      if (c.fill_pct <= 25) m.set(c.locker_no, (m.get(c.locker_no) || 0) + 1)
    }
    return m
  }, [contents])

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

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    Promise.all([
      fetch('/api/admin/lockers', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/admin/mis/members', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ members: [] })),
    ]).then(([l, m]) => {
      setLockers(l.lockers || [])
      setContents(l.contents || [])
      setMembers(m.members || [])
      if (!silent) setLoading(false)
    })
  }, [])

  // Auto-seed the 36 wall positions on mount. The endpoint upserts with
  // ignoreDuplicates so lockers that already exist (and their assignments
  // / contents / labels) are never touched — this only adds missing bays
  // so the wall renders all 36 boxes including a fully editable D row.
  const ensureLayout = useCallback(async () => {
    const positions: Array<{ locker_no: string; position_row: number; position_col: number }> = []
    const letters = ['A', 'B', 'C', 'D']
    for (let r = 1; r <= WALL_LEFT_ROWS; r++) {
      for (let c = 1; c <= WALL_LEFT_COLS; c++) {
        positions.push({ locker_no: `${letters[r - 1]}-${String(c).padStart(2, '0')}`, position_row: r, position_col: c })
      }
    }
    for (let r = 1; r <= WALL_RIGHT_ROWS; r++) {
      for (let c = 1; c <= WALL_RIGHT_COLS; c++) {
        const absCol = WALL_DOOR_AFTER_COL + c
        positions.push({ locker_no: `${letters[r - 1]}-${String(absCol).padStart(2, '0')}`, position_row: r, position_col: absCol })
      }
    }
    await fetch('/api/admin/lockers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    }).catch(() => { /* best-effort; if it fails the wall still renders empty-slot placeholders */ })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await ensureLayout()
      if (cancelled) return
      load()
      loadWhiskies()
    })()
    return () => { cancelled = true }
  }, [load, loadWhiskies, ensureLayout])

  const hasAnyLocker = lockers.length > 0

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
    if (!r.ok) { showToast(j.error || t('Seed failed', 'Tạo lưới thất bại'), 'error'); return }
    setSeedOpen(false)
    load()
  }

  if (loading) return <div style={emptyText}>{t('Loading lockers…', 'Đang tải tủ khóa…')}</div>

  const noGrid = !hasAnyLocker

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={eyebrow}>{t('Whisky Library', 'Thư viện rượu whisky')}</div>
        <h1 style={pageTitle}>{t('Member lockers', 'Tủ khóa hội viên')}</h1>
        <p style={lede}>
          {t('The physical wall — every tile is a locker. Click one to assign a member, edit contents, or move it on the grid. Empty tiles wait to be filled; gold tiles are reserved; red-tinted are retired.', 'Bức tường thực tế — mỗi ô là một tủ khóa. Bấm vào một ô để phân bổ hội viên, chỉnh sửa nội dung, hoặc di chuyển ô trên lưới. Ô trống đang chờ được lấp đầy; ô màu vàng là đã đặt trước; ô ánh đỏ là đã ngừng sử dụng.')}
        </p>
      </div>

      {/* Stat strip */}
      <div style={statStrip}>
        <Stat label={t('Lockers', 'Tủ khóa')}   value={counts.total} />
        <Stat label={t('Occupied', 'Đang dùng')}  value={counts.occupied} color="#7AB07A" />
        <Stat label={t('Reserved', 'Đã đặt trước')}  value={counts.reserved} color="#D4B85A" />
        <Stat label={t('Empty', 'Trống')}     value={counts.empty} color="#B2AA98" />
        <Stat label={t('Retired', 'Ngừng dùng')}   value={counts.retired} color="#7E7864" />
        <Stat label={t('Bottles', 'Số chai')}   value={counts.bottles} />
        <Stat label={t('Low fill (≤25%)', 'Sắp hết (≤25%)')} value={counts.lowFill} color="#C27070" />
      </div>

      {/* Filters + seed */}
      <div style={toolbarRow}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', ...STATUSES] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ ...chip, ...(filter === s ? chipActive : null) }}>
              {s === 'all' ? t('All', 'Tất cả') : s}
            </button>
          ))}
          <button
            onClick={() => setShowLowFillOnly(v => !v)}
            style={{ ...chip, ...(showLowFillOnly ? chipActive : null), borderLeft: '2px solid #C27070' }}
            title={t('Highlight lockers with ≥1 bottle at ≤25%', 'Làm nổi bật tủ có ≥1 chai ở mức ≤25%')}
          >
            {t('≤25% only', 'Chỉ ≤25%')}{counts.lowFill > 0 ? ` (${counts.lowFill})` : ''}
          </button>
        </div>
        <input
          value={memberSearch}
          onChange={e => setMemberSearch(e.target.value)}
          placeholder={t('Find a member or locker no…', 'Tìm hội viên hoặc số tủ khóa…')}
          style={{ ...inputStyle, maxWidth: 260, flex: '0 1 260px' }}
        />
        <button onClick={() => setSeedOpen(s => !s)} style={btnGhost}>
          {seedOpen ? t('Cancel', 'Hủy') : noGrid ? t('＋ Seed grid', '＋ Khởi tạo lưới') : t('＋ Add more lockers', '＋ Thêm tủ khóa')}
        </button>
      </div>

      {seedOpen && (
        <div style={seedBlock}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={editLabel}>{t('Rows', 'Số hàng')}</div>
              <input type="number" min={1} max={20} value={seedRows} onChange={e => setSeedRows(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} style={{ ...inputStyle, width: 80 }} />
            </div>
            <div>
              <div style={editLabel}>{t('Columns', 'Số cột')}</div>
              <input type="number" min={1} max={30} value={seedCols} onChange={e => setSeedCols(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} style={{ ...inputStyle, width: 80 }} />
            </div>
            <div>
              <div style={editLabel}>{t('Prefix (optional)', 'Tiền tố (tùy chọn)')}</div>
              <input value={seedPrefix} onChange={e => setSeedPrefix(e.target.value.slice(0, 4))} placeholder={t('e.g. L', 'ví dụ: L')} style={{ ...inputStyle, width: 100 }} />
            </div>
            <button onClick={seed} style={btnPrimary}>{t('Create', 'Tạo')} {seedRows * seedCols} {t('lockers', 'tủ khóa')}</button>
          </div>
          <div style={{ ...inviteMeta, marginTop: 10 }}>
            {t('Existing lockers at the same locker_no are preserved. Rows are labelled A–T, columns 01..30 zero-padded. The prefix prepends to the locker number (e.g. prefix', 'Các tủ khóa hiện có cùng locker_no sẽ được giữ nguyên. Các hàng được đặt tên A–T, các cột 01..30 có số 0 đệm phía trước. Tiền tố được thêm vào đầu số tủ khóa (ví dụ tiền tố')} &quot;L&quot; → L A-01).
          </div>
        </div>
      )}

      {/* The wall */}
      {noGrid ? (
        <div style={emptyBlock}>
          <div style={{ marginBottom: 12 }}>{t('No lockers yet.', 'Chưa có tủ khóa nào.')}</div>
          <button onClick={() => setSeedOpen(true)} style={btnPrimary}>{t('＋ Seed the grid', '＋ Khởi tạo lưới')}</button>
        </div>
      ) : (() => {
        // Fixed wall geometry — every position in the rectangle is a real
        // bay on the physical wall. Unseeded slots render as clean empty
        // boxes inside the grid; the dividerAfterRow draws a hairline that
        // stretches the full row width between rows A and B on the left.
        const leftTileH = 72
        const gap = 6
        const leftWallH = WALL_LEFT_ROWS * leftTileH + (WALL_LEFT_ROWS - 1) * gap
        const rightTileH = Math.floor((leftWallH - (WALL_RIGHT_ROWS - 1) * gap) / WALL_RIGHT_ROWS)
        return (
          <div style={wallSplit}>
            <SubGrid
              cols={WALL_LEFT_COLS}
              rows={WALL_LEFT_ROWS}
              colOffset={0}
              tileH={leftTileH}
              gap={gap}
              showRowLabels
              dividerAfterRow={WALL_LEFT_DIVIDER_AFTER_ROW}
              lockerByPos={lockerByPos}
              onOpen={(no) => setOpenLocker(no)}
              filter={filter}
              memberSearch={memberSearch}
              lowFillByLocker={lowFillByLocker}
              showLowFillOnly={showLowFillOnly}
            />

            <div style={doorColumn}>
              <div style={doorColumnHeader}>↕</div>
              <div style={{ ...doorColumnPanel, height: leftWallH }}>
                <span style={doorColumnLabel}>
                  {t('ENTRANCE', 'LỐI VÀO').split('').map((ch, i) => <span key={i}>{ch}</span>)}
                </span>
              </div>
            </div>

            <SubGrid
              cols={WALL_RIGHT_COLS}
              rows={WALL_RIGHT_ROWS}
              colOffset={WALL_DOOR_AFTER_COL}
              tileH={rightTileH}
              gap={gap}
              showRowLabels={false}
              dividerAfterRow={WALL_LEFT_DIVIDER_AFTER_ROW}
              lockerByPos={lockerByPos}
              onOpen={(no) => setOpenLocker(no)}
              filter={filter}
              memberSearch={memberSearch}
              lowFillByLocker={lowFillByLocker}
              showLowFillOnly={showLowFillOnly}
            />
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
          /* Silent refresh — the drawer is open, we don't want to flip the
             page-level loading flag (which would unmount the drawer with
             everything else). The wall tile updates in place. */
          onChange={() => load(true)}
        />
      )}

      {toastNode}
    </>
  )
}

// One side of the wall. Every position in the rectangle gets rendered —
// either as a real locker tile (data exists) or as a clean empty box
// (no data yet, still a real bay on the physical wall). tileH lets the
// right side scale to match the left side's total height; colOffset
// shifts the column-number labels (so the right side reads "07..10").
// dividerAfterRow optionally draws a hairline that stretches the full
// row width between two data rows.
function SubGrid({
  cols, rows, colOffset, tileH, gap, showRowLabels,
  dividerAfterRow, lockerByPos, onOpen, filter, memberSearch,
  lowFillByLocker, showLowFillOnly,
}: {
  cols: number
  rows: number
  colOffset: number
  tileH: number
  gap: number
  showRowLabels: boolean
  dividerAfterRow?: number
  lockerByPos: Map<string, Locker>
  onOpen: (locker_no: string) => void
  filter: string
  memberSearch: string
  lowFillByLocker: Map<string, number>
  showLowFillOnly: boolean
}) {
  // Search predicate: matches against member full name, nickname, OR
  // the locker number itself. Case-insensitive, substring match. Empty
  // query = no dimming. Status filter and search compose multiplicatively.
  const q = memberSearch.trim().toLowerCase()
  const matchesSearch = (l: Locker) => {
    if (!q) return true
    return (
      l.locker_no.toLowerCase().includes(q) ||
      (l.member_name || '').toLowerCase().includes(q) ||
      (l.member_nickname || '').toLowerCase().includes(q) ||
      (l.label || '').toLowerCase().includes(q)
    )
  }
  const labelOffset = showRowLabels ? 1 : 0
  const gridTemplateColumns = showRowLabels
    ? `36px repeat(${cols}, minmax(72px, 1fr))`
    : `repeat(${cols}, minmax(72px, 1fr))`

  return (
    <div style={{ ...subGridWrap, gridTemplateColumns, gap }}>
      {/* Column headers (grid row 1) */}
      {Array.from({ length: cols }, (_, c) => (
        <div
          key={`ch-${c}`}
          style={{ ...gridHeader, gridRow: 1, gridColumn: c + 1 + labelOffset }}
        >
          {String(colOffset + c + 1).padStart(2, '0')}
        </div>
      ))}

      {/* Row labels (col 1, one per data row) */}
      {showRowLabels && Array.from({ length: rows }, (_, r) => {
        const rowIdx = r + 1
        const rowLetter = 'ABCDEFGHIJKLMNOPQRST'[rowIdx - 1] || `R${rowIdx}`
        return (
          <div
            key={`rl-${rowIdx}`}
            style={{ ...gridRowLabel, gridRow: rowIdx + 1, gridColumn: 1 }}
          >
            {rowLetter}
          </div>
        )
      })}

      {/* Every locker bay — real tile if data exists, empty slot otherwise.
          Explicit grid placement; missing data renders as a clean empty
          box, not a dashed-out ghost. */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const rowIdx = r + 1
          const relCol = c + 1
          const l = lockerByPos.get(`${rowIdx}-${colOffset + relCol}`)
          const cellPlacement: React.CSSProperties = {
            gridRow: rowIdx + 1,
            gridColumn: relCol + labelOffset,
            minHeight: tileH,
          }
          if (!l) {
            return (
              <div
                key={`slot-${rowIdx}-${relCol}`}
                style={{ ...emptySlot, ...cellPlacement }}
                aria-hidden="true"
              />
            )
          }
          const lowFillCount = lowFillByLocker.get(l.locker_no) || 0
          const dim =
            (filter !== 'all' && l.status !== filter) ||
            !matchesSearch(l) ||
            (showLowFillOnly && lowFillCount === 0)
          const isSearchHit = q.length > 0 && matchesSearch(l)
          return (
            <button
              key={l.locker_no}
              onClick={() => onOpen(l.locker_no)}
              style={{
                ...tileBase,
                ...tileByStatus(l.status),
                ...cellPlacement,
                opacity: dim ? 0.18 : 1,
                ...(isSearchHit ? { outline: '2px solid #D4B85A', outlineOffset: 1 } : {}),
                position: 'relative',  // anchor the low-fill dot
              }}
              title={`${l.locker_no} · ${l.member_name || 'unassigned'}${lowFillCount > 0 ? ` · ${lowFillCount} bottle${lowFillCount === 1 ? '' : 's'} ≤25%` : ''}`}
            >
              {lowFillCount > 0 && (
                <span style={lowFillDot} aria-label={`${lowFillCount} low-fill bottles`}>
                  {lowFillCount > 1 ? lowFillCount : ''}
                </span>
              )}
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
        })
      )}

      {/* Optional full-row hairline between data rows. Sits on the BOTTOM
          edge of the row it follows, span ALL columns including the row
          label so the line is continuous across the side. */}
      {dividerAfterRow != null && dividerAfterRow >= 1 && dividerAfterRow < rows && (
        <div
          aria-hidden="true"
          style={{
            ...rowDivider,
            gridRow: dividerAfterRow + 1,
            gridColumn: `1 / span ${cols + labelOffset}`,
          }}
        />
      )}
    </div>
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
  const { t } = useLang()
  const [locker, setLocker] = useState<Locker | null>(null)
  const [contents, setContents] = useState<BottleContent[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [memberQuery, setMemberQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
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

  // Initial load shows the "Loading…" placeholder. Subsequent refreshes
  // (after a patch or content change) use silent=true so the drawer body
  // never unmounts — the user sees the new value land in place, not the
  // panel disappearing and coming back.
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    fetch(`/api/admin/lockers/${locker_no}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        setLocker(j.locker)
        setContents(j.contents || [])
        setActivity(j.activity || [])
        if (!silent) setLoading(false)
      })
  }, [locker_no])
  useEffect(() => { load() }, [load])

  const patch = async (patchBody: Record<string, unknown>) => {
    // Optimistic update — the clicked chip changes state immediately,
    // before the server roundtrip. Silent refetch then reconciles with
    // anything the server normalised (e.g. member_name on member_no
    // change, updated_at).
    setLocker(prev => prev ? { ...prev, ...(patchBody as Partial<Locker>) } : prev)
    await fetch(`/api/admin/lockers/${locker_no}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    })
    load(true)
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
    load(true)
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
    load(true)
    onChange()
  }

  const [confirmBottle, setConfirmBottle] = useState<BottleContent | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const requestRemoveBottle = (c: BottleContent) => setConfirmBottle(c)
  const closeRemoveBottle   = () => { if (!removeBusy) setConfirmBottle(null) }
  const runRemoveBottle = async () => {
    if (!confirmBottle) return
    setRemoveBusy(true)
    try {
      await fetch(`/api/admin/lockers/${locker_no}/contents?id=${confirmBottle.id}`, { method: 'DELETE' })
      setConfirmBottle(null)
      load(true)
      onChange()
    } finally {
      setRemoveBusy(false)
    }
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
            <div style={eyebrow}>{t('Locker', 'Tủ khóa')}</div>
            <h2 style={drawerTitle}>{locker_no}</h2>
            {locker?.member_name && (
              <div style={{ ...nicknameText, marginTop: 4 }}>
                {locker.member_name}
                {locker.member_no && (
                  <Link href={`/admin/mis/${locker.member_no}`} style={{ marginLeft: 8, fontSize: 11, color: '#7AB07A', textDecoration: 'none' }}>
                    → {t('profile', 'hồ sơ')}
                  </Link>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>

        {loading || !locker ? (
          <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
        ) : (
          <>
            {/* Assignment */}
            <Section title={t('Assignment', 'Phân bổ')}>
              <div style={editLabel}>{t('Member', 'Hội viên')}</div>
              {locker.member_no ? (
                <div style={memberAssignedRow}>
                  <div>
                    <strong>{locker.member_name}</strong>
                    <span style={{ marginLeft: 8, color: '#B2AA98', fontSize: 11 }}>{locker.member_no}</span>
                  </div>
                  <button onClick={() => patch({ member_no: null })} style={tinyBtn}>{t('Unassign', 'Bỏ phân bổ')}</button>
                </div>
              ) : (
                <>
                  <input
                    value={memberQuery}
                    onChange={e => setMemberQuery(e.target.value)}
                    placeholder={t('Search member by name or number…', 'Tìm hội viên theo tên hoặc số…')}
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
                      <div style={emptyHint}>{t('No matches.', 'Không có kết quả.')}</div>
                    )}
                  </div>
                </>
              )}

              <div style={editLabel}>{t('Display label (optional)', 'Nhãn hiển thị (tùy chọn)')}</div>
              <input
                defaultValue={locker.label || ''}
                onBlur={e => { if ((e.target.value || null) !== locker.label) patch({ label: e.target.value || null }) }}
                placeholder={t('Override the member name on the tile', 'Thay tên hội viên hiển thị trên ô')}
                style={inputStyle}
              />

              <div style={editLabel}>{t('Status', 'Trạng thái')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => patch({ status: s })} style={{ ...chip, ...(locker.status === s ? chipActive : null) }}>
                    {s}
                  </button>
                ))}
              </div>

              <div style={editLabel}>{t('Position (row / col)', 'Vị trí (hàng / cột)')}</div>
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

              <div style={editLabel}>{t('Notes', 'Ghi chú')}</div>
              <textarea
                rows={3}
                defaultValue={locker.notes || ''}
                onBlur={e => { if ((e.target.value || null) !== locker.notes) patch({ notes: e.target.value || null }) }}
                placeholder={t('Lock combo, fragile bottles, anything for the team.', 'Mã khóa, chai dễ vỡ, bất cứ điều gì cho đội ngũ.')}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Section>

            {/* Contents */}
            <Section title={`${t('Contents', 'Nội dung')} · ${contents.length} ${contents.length === 1 ? t('bottle', 'chai') : t('bottles', 'chai')}`}>
              {contents.length === 0 && (
                <div style={emptyHint}>{t('No bottles in this locker yet.', 'Chưa có chai nào trong tủ khóa này.')}</div>
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
                  <button onClick={() => requestRemoveBottle(c)} style={{ ...tinyBtn, color: '#C27070', borderColor: 'rgba(180,70,70,0.30)' }}>{t('Remove', 'Gỡ bỏ')}</button>
                </div>
              ))}

              <div style={addBottleBlock}>
                <div style={editLabel}>{t('Add bottle · pick from the whisky catalogue', 'Thêm chai · chọn từ danh mục rượu whisky')}</div>

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
                          selectedWhisky.in_stock ? null : t('archived', 'đã lưu trữ'),
                        ].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <button onClick={() => { setSelectedWhisky(null); setBottleListOpen(true) }} style={tinyBtn}>{t('Change', 'Thay đổi')}</button>
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
                        ? t('No whiskies in the catalogue yet — add one in /admin/whisky', 'Chưa có rượu whisky nào trong danh mục — thêm một chai tại /admin/whisky')
                        : `${t('Search', 'Tìm')} ${whiskies.length} ${t('whiskies by name, distillery, or region…', 'rượu whisky theo tên, nhà chưng cất, hoặc vùng…')}`}
                      style={inputStyle}
                      disabled={whiskies.length === 0}
                    />
                    {bottleListOpen && whiskies.length > 0 && (
                      <div style={whiskyDropdown}>
                        {filteredWhiskies.length === 0 ? (
                          <div style={emptyHint}>{t('No matches.', 'Không có kết quả.')}</div>
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
                              {!w.in_stock && <span style={{ color: '#7E7864', marginLeft: 6 }}>· {t('archived', 'đã lưu trữ')}</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={editLabel}>{t('Fill %', 'Mức đầy %')}</div>
                    <input
                      value={fillPct}
                      onChange={e => setFillPct(e.target.value)}
                      placeholder={t('Fill %', 'Mức đầy %')}
                      type="number" min={0} max={100}
                      style={inputStyle}
                    />
                  </div>
                  <button
                    onClick={addBottle}
                    disabled={!selectedWhisky || adding}
                    style={{ ...btnPrimary, opacity: !selectedWhisky ? 0.4 : 1 }}
                  >
                    {adding ? t('Adding…', 'Đang thêm…') : t('＋ Add bottle', '＋ Thêm chai')}
                  </button>
                </div>
              </div>
            </Section>

            {/* Activity timeline — collapsed by default to keep the drawer
                scannable. Expand to see assignment / status / position
                history. Bottle additions live in Contents above; this is
                about the LOCKER itself. */}
            <Section title={`${t('Activity', 'Hoạt động')} · ${activity.length} ${activity.length === 1 ? t('event', 'sự kiện') : t('events', 'sự kiện')}`}>
              {activity.length === 0 ? (
                <div style={emptyHint}>{t('No locker activity logged yet. (Migration may not have been applied — see', 'Chưa ghi nhận hoạt động tủ khóa nào. (Có thể migration chưa được áp dụng — xem')} db/locker_activity.sql{'.)'}</div>
              ) : (
                <>
                  <button
                    onClick={() => setShowActivity(v => !v)}
                    style={{ ...tinyBtn, alignSelf: 'flex-start', marginBottom: 4 }}
                  >
                    {showActivity ? t('Hide history', 'Ẩn lịch sử') : `${t('Show last', 'Xem')} ${Math.min(activity.length, 50)} ${activity.length === 1 ? t('event', 'sự kiện gần nhất') : t('events', 'sự kiện gần nhất')}`}
                  </button>
                  {showActivity && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {activity.map(a => (
                        <div key={a.id} style={activityRow}>
                          <span style={activityTimestamp}>
                            {new Date(a.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span style={activityChip(a.event_type)}>{a.event_type.replace(/_/g, ' ')}</span>
                          <span style={activityDescription}>{describeActivity(a)}</span>
                          {a.changed_by_email && (
                            <span style={{ color: '#7E7864', fontSize: 9, marginLeft: 'auto' }}>{a.changed_by_email}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Section>
          </>
        )}
      </div>

      <ConfirmModal
        open={!!confirmBottle}
        eyebrow={t('⚠ REMOVE BOTTLE', '⚠ GỠ BỎ CHAI')}
        title={t('Remove this bottle?', 'Gỡ bỏ chai này?')}
        subject={confirmBottle ? `${confirmBottle.bottle_name} · ${t('locker', 'tủ khóa')} ${locker_no}` : undefined}
        body={t("Takes the bottle off this locker's contents. The locker activity timeline keeps a record of the removal. Cannot be undone.", 'Gỡ chai này khỏi nội dung của tủ khóa. Dòng thời gian hoạt động của tủ khóa vẫn lưu lại việc gỡ bỏ. Không thể hoàn tác.')}
        confirmLabel={t('Remove bottle', 'Gỡ bỏ chai')}
        busyLabel={t('Removing…', 'Đang gỡ bỏ…')}
        busy={removeBusy}
        onCancel={closeRemoveBottle}
        onConfirm={runRemoveBottle}
      />
    </>
  )
}

// Plain-English summary of an activity row — preferred over rendering
// raw before/after JSON to non-technical staff.
function describeActivity(a: ActivityRow): string {
  const before = a.before_state || {}
  const after  = a.after_state  || {}
  const fmt = (v: unknown) => v == null || v === '' ? '—' : String(v)
  switch (a.event_type) {
    case 'assigned':
      return `member set to ${fmt(after.member_no)}`
    case 'unassigned':
      return `member ${fmt(before.member_no)} removed`
    case 'status_changed':
      return `status ${fmt(before.status)} → ${fmt(after.status)}`
    case 'retired':
      return `retired (was ${fmt(before.status)}${before.member_no ? `, member ${fmt(before.member_no)}` : ''})`
    case 'label_changed':
      return `label ${fmt(before.label)} → ${fmt(after.label)}`
    case 'notes_changed':
      return 'notes updated'
    case 'position_changed':
      return `position (${fmt(before.position_row)},${fmt(before.position_col)}) → (${fmt(after.position_row)},${fmt(after.position_col)})`
    default: {
      // Generic before/after dump for misc_patch.
      const changedKeys = Object.keys(after).join(', ')
      return `changed: ${changedKeys || '(unknown)'}`
    }
  }
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
// Empty bay placeholder — solid (not dashed) so it reads as a real slot on
// the wall waiting for a locker, distinct from a ghost outline.
const emptySlot: React.CSSProperties = {
  border: '1px solid rgba(229,212,194,0.08)',
  background: 'rgba(229,212,194,0.015)',
  borderRadius: 4,
}
// Full-row hairline between data rows. Sits at the BOTTOM of its grid row
// (alignSelf: end) and is only 1px tall, so the rest of that row stays
// available for whatever's placed at the same grid position (tiles).
const rowDivider: React.CSSProperties = {
  alignSelf: 'end',
  height: 1,
  background: 'rgba(212,184,90,0.30)',
  marginBottom: -3,  // pull it into the gap below so it lives BETWEEN rows
  pointerEvents: 'none',
  zIndex: 1,
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
// Low-fill alert dot — top-right corner of a locker tile. Solid red,
// shows the count if >1 bottle is low (so a locker with 3 low bottles
// reads "3"); silent dot if exactly 1. Pulses subtly to draw the eye.
const lowFillDot: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4,
  minWidth: 14, height: 14, padding: '0 4px',
  borderRadius: 7,
  background: '#C27070',
  color: '#FFFFFF',
  fontFamily: "'Google Sans Code', monospace", fontSize: 8, fontWeight: 700,
  letterSpacing: '0.04em',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 0 6px rgba(194,112,112,0.45)',
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
// Activity timeline rows in the locker drawer.
const activityRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  padding: '6px 8px',
  background: 'rgba(5,46,32,0.4)',
  border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
}
const activityTimestamp: React.CSSProperties = {
  color: '#7E7864', letterSpacing: '0.04em', minWidth: 100,
}
const activityDescription: React.CSSProperties = {
  color: '#E5D4C2', flex: 1,
}
function activityChip(eventType: string): React.CSSProperties {
  const tone =
      eventType === 'assigned'         ? '#7AB07A'
    : eventType === 'unassigned'       ? '#E58F4A'
    : eventType === 'retired'          ? '#C27070'
    : eventType === 'status_changed'   ? '#D4B85A'
    : eventType === 'position_changed' ? '#B2AA98'
    : eventType === 'label_changed'    ? '#B2AA98'
    : eventType === 'notes_changed'    ? '#B2AA98'
    :                                    '#7E7864'
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 8,
    color: tone,
    background: tone + '14',
    border: `1px solid ${tone}40`,
    borderRadius: 3, padding: '2px 6px',
    letterSpacing: '0.06em', textTransform: 'uppercase',
  }
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
// The door is a single tall panel between the two sub-grids. Its height is
// pinned to the LEFT sub-grid's total tile height (computed in the page) so
// it always lines up with the locker rows on the left, regardless of how
// many rows live on the right side.
const wallSplit: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12,
  background: 'rgba(229,212,194,0.02)',
  border: '1px solid rgba(229,212,194,0.06)',
  padding: 12, borderRadius: 8, marginTop: 8,
  overflowX: 'auto',
}
const subGridWrap: React.CSSProperties = {
  display: 'grid',
  flex: '0 0 auto',
}
const doorColumn: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', flex: '0 0 auto',
  width: 56,
}
const doorColumnHeader: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', letterSpacing: '0.10em',
  textAlign: 'center', padding: '4px 0',
  // Match the height of the column-number headers in the sub-grids so the
  // door's top edge sits flush with the top of row A's tiles on either side.
  minHeight: 22,
}
const doorColumnPanel: React.CSSProperties = {
  // height is set inline to leftWallH so the door matches the left side
  background: 'linear-gradient(180deg, rgba(94,102,80,0.30) 0%, rgba(94,102,80,0.18) 100%)',
  border: '1px solid rgba(212,184,90,0.45)',
  borderRadius: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  position: 'relative',
}
const doorColumnLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#D4B85A', letterSpacing: '0.22em',
  textTransform: 'uppercase',
  // Stack each character so it reads vertically without writing-mode/rotation.
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  lineHeight: 1.15,
  textAlign: 'center',
}
