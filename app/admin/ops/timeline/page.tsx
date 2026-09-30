'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { useLang } from '@/lib/lang'
import { vnDateString } from '@/lib/datetime'
import GanttView from '../[project_id]/GanttView'
import type { Task, Project, TeamMember } from '@/lib/ops/types'

// ═══════════════════════════════════════════════════════════════════════════
// EVERY BOARD, ON ONE TIMELINE.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-10-01: "Is there a master view of all kanban jobs at once at
// all? A place i can whip out the gantt chart at any given moment and see
// what's due on which board when? All staff should be able to see it."
//
// There wasn't. Every board had its own Gantt and nothing put them together,
// so "what is happening in the third week of October" meant opening seven
// tabs and holding the answer in your head. With the shop on the 27th,
// Halloween on the 31st, the Palace on the 13th and the exhibition on the
// 10th and 11th, that is exactly the question worth being able to answer in
// one glance.
//
// SAME GANTT, not a second one. It renders the board's own component with the
// tasks of every board at once, so a bar means here what it means there:
// status colour, today line, day/week/month zoom, drag-to-scroll. The only
// addition is a coloured dot per row saying which board a job belongs to.
//
// READ-ONLY, deliberately. Rescheduling is done on the board that owns the
// job, where the person who owns it is looking at the rest of its column. A
// master view exists to SEE across boards, and a drag here would move a date
// on a board the dragger may not have opened in a fortnight.
// ═══════════════════════════════════════════════════════════════════════════

const FAMILY = "'Google Sans Code', monospace"

export default function MasterTimelinePage() {
  const { t } = useLang()
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [who, setWho] = useState<string | null>(null)
  const [board, setBoard] = useState<string | null>(null)
  const [horizon, setHorizon] = useState<number | null>(60)   // days ahead; null = everything
  // BOARD or GANTT, like a board has. The timeline answered "when", and the
  // owner wanted the other half too (2026-10-01): the same cards in the same
  // four columns, drawn from every board at once.
  const [view, setView] = useState<'board' | 'gantt'>('board')

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    ;(async () => {
      const [{ data: pr }, { data: tk }, { data: tm }] = await Promise.all([
        supabase.from('projects').select('*').is('deleted_at', null).eq('status', 'active').order('created_at'),
        // OPEN work only. A timeline of finished jobs is a history lesson, and
        // the one question this page answers is what is still coming.
        supabase.from('tasks').select('*').eq('status', 'open'),
        supabase.from('team_members').select('*').order('display_name'),
      ])
      setProjects((pr || []) as Project[])
      setTasks((tk || []) as Task[])
      setTeam((tm || []) as TeamMember[])
      const { data: cols } = await supabase.from('board_columns').select('id, name')
      setColName(new Map(((cols || []) as { id: string; name: string }[]).map(c => [c.id, c.name])))
      setLoading(false)
    })()
  }, [])

  const boardById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])
  // Which column each task sits in, by name — every board uses the same four.
  const [colName, setColName] = useState<Map<string, string>>(new Map())
  const today = vnDateString()
  const horizonEnd = useMemo(() => {
    if (horizon == null) return null
    const d = new Date(`${today}T12:00:00+07:00`)
    d.setDate(d.getDate() + horizon)
    return d.toISOString().slice(0, 10)
  }, [horizon, today])

  const shown = useMemo(() => tasks.filter(x => {
    if (!boardById.has(x.project_id)) return false          // archived or deleted boards stay out
    if (who && x.assignee !== who) return false
    if (board && x.project_id !== board) return false
    // The horizon trims the FUTURE only: anything already overdue stays on
    // screen however long it has been sitting there.
    if (horizonEnd && x.due_date && x.due_date > horizonEnd) return false
    return true
  }), [tasks, who, board, horizonEnd, boardById])

  const dated = shown.filter(x => x.due_date || x.start_date)
  const overdue = shown.filter(x => x.due_date && x.due_date < today)
  const thisWeek = (() => {
    const d = new Date(`${today}T12:00:00+07:00`); d.setDate(d.getDate() + 7)
    const end = d.toISOString().slice(0, 10)
    return shown.filter(x => x.due_date && x.due_date >= today && x.due_date <= end)
  })()

  const countFor = (fn: (x: Task) => boolean) => tasks.filter(x => boardById.has(x.project_id) && fn(x)).length

  return (
    <>
      <Link href="/admin/ops" style={backLink}>← {t('Boards', 'Bảng')}</Link>
      <div style={{ margin: '8px 0 6px' }}>
        <h1 style={pageTitle}>{t('Everything, on one timeline', 'Tất cả trên một dòng thời gian')}</h1>
      </div>
      <p style={lede}>
        {t('Every open job on every board. Read-only — reschedule on the board that owns the job.',
           'Tất cả công việc đang mở trên mọi bảng. Chỉ xem — hãy đổi lịch trên bảng sở hữu công việc đó.')}
      </p>

      {/* the three numbers worth knowing before looking at anything */}
      <div style={{ display: 'flex', gap: 22, margin: '14px 0 16px', flexWrap: 'wrap' }}>
        <Stat n={overdue.length} label={t('overdue', 'quá hạn')} tone="#C27070" />
        <Stat n={thisWeek.length} label={t('due in seven days', 'đến hạn trong 7 ngày')} tone="#D4B85A" />
        <Stat n={shown.length} label={t('open', 'đang mở')} tone="#E5D4C2" />
      </div>

      <div style={{ ...bar, justifyContent: 'flex-end', marginTop: -34 }}>
        <div style={{ display: 'flex', border: '1px solid rgba(229,212,194,0.15)', borderRadius: 6, overflow: 'hidden' }}>
          {(['board', 'gantt'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              ...chip(false), borderRadius: 0, border: 'none', padding: '6px 14px',
              background: view === v ? 'rgba(212,184,90,0.18)' : 'transparent',
              color: view === v ? '#D4B85A' : '#B2AA98',
            }}>{v === 'board' ? t('Board', 'Bảng') : 'Gantt'}</button>
          ))}
        </div>
      </div>

      <div style={bar}>
        <button onClick={() => setBoard(null)} style={chip(board === null)}>
          {t('All boards', 'Tất cả bảng')} <b style={chipN}>{countFor(() => true)}</b>
        </button>
        {projects.map(p => (
          <button key={p.id} onClick={() => setBoard(b => (b === p.id ? null : p.id))} style={chip(board === p.id)}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.colour || '#5E6650', display: 'inline-block' }} />
            {p.name.split('·')[0].trim()} <b style={chipN}>{countFor(x => x.project_id === p.id)}</b>
          </button>
        ))}
      </div>

      <div style={bar}>
        <button onClick={() => setWho(null)} style={chip(who === null)}>{t('Everyone', 'Tất cả')}</button>
        {team
          .map(m => ({ m, n: countFor(x => x.assignee === m.id) }))
          .filter(x => x.n > 0)
          .sort((a, b) => b.n - a.n)
          .map(({ m, n }) => (
            <button key={m.id} onClick={() => setWho(w => (w === m.id ? null : m.id))} style={chip(who === m.id)}>
              {m.display_name} <b style={chipN}>{n}</b>
            </button>
          ))}
        <span style={{ flex: 1 }} />
        {([[30, '30d'], [60, '60d'], [120, '4m'], [null, t('All', 'Tất cả')]] as [number | null, string][]).map(([d, label]) => (
          <button key={label} onClick={() => setHorizon(d)} style={chip(horizon === d)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
      ) : view === 'gantt' ? (
        dated.length === 0 ? (
          <div style={emptyText}>{t('Nothing dated in that window.', 'Không có mốc nào trong khoảng đó.')}</div>
        ) : (
          <GanttView
            tasks={dated}
            project={null}
            canEdit={false}
            /* Straight to the card, not merely to the board it sits on: landing
               on fifty cards and being left to find the one you clicked is not
               arriving anywhere. */
            onOpenCard={(task) => { window.location.href = `/admin/ops/${task.project_id}?task=${task.id}` }}
            onReschedule={() => {}}
            boardOf={(task) => {
              const p = boardById.get(task.project_id)
              return p ? { name: p.name, colour: p.colour || '#5E6650' } : null
            }}
          />
        )
      ) : shown.length === 0 ? (
        <div style={emptyText}>{t('Nothing open in that window.', 'Không có việc nào đang mở trong khoảng đó.')}</div>
      ) : (
        /* THE SAME FOUR COLUMNS, from every board at once. Every board in the
           club uses Backlog → In progress → Blocked → Done, so the columns can
           be merged by NAME and a card keeps the colour of the board it came
           from. Read-only, like the Gantt: a card is moved on its own board,
           where the rest of its column is visible. */
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
          {COLUMN_ORDER.map(name => {
            const inCol = shown
              .filter(x => (colName.get(x.column_id) || 'Backlog') === name)
              .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
            return (
              <div key={name} style={columnStyle}>
                <div style={columnHeader}>
                  <span style={{ color: '#E5D4C2' }}>{name}</span>
                  <span style={{ opacity: 0.6 }}>{inCol.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {inCol.map(x => {
                    const b = boardById.get(x.project_id)
                    const late = !!x.due_date && x.due_date < today
                    return (
                      <Link key={x.id} href={`/admin/ops/${x.project_id}?task=${x.id}`} style={{
                        ...cardStyle, borderLeft: `3px solid ${b?.colour || '#5E6650'}`,
                      }}>
                        <span style={{ display: 'block', color: '#E5D4C2', fontSize: 12, lineHeight: 1.4 }}>{x.title}</span>
                        <span style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ ...pill, color: b?.colour || '#B2AA98', borderColor: (b?.colour || '#B2AA98') + '55' }}>
                            {(b?.name || '').split('·')[0].trim()}
                          </span>
                          {x.assignee && <span style={pill}>{team.find(m => m.id === x.assignee)?.display_name || '—'}</span>}
                          {x.due_date && (
                            <span style={{ ...pill, color: late ? '#C27070' : '#B2AA98', borderColor: late ? 'rgba(194,112,112,0.5)' : 'rgba(229,212,194,0.18)' }}>
                              {vnShort(x.due_date)}
                            </span>
                          )}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

    </>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 30, lineHeight: 1, color: tone }}>{n}</div>
      <div style={{ fontFamily: FAMILY, fontSize: 10.5, color: '#B2AA98', marginTop: 4 }}>{label}</div>
    </div>
  )
}

const backLink: React.CSSProperties = { fontFamily: FAMILY, fontSize: 11, color: '#B2AA98', textDecoration: 'none' }
const pageTitle: React.CSSProperties = { fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', margin: '6px 0 0' }
const lede: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, lineHeight: 1.7, color: '#B2AA98', margin: '8px 0 0', maxWidth: 680 }
const emptyText: React.CSSProperties = { fontFamily: FAMILY, fontSize: 12, color: '#B2AA98', opacity: 0.7, padding: '28px 0' }
// NO DONE COLUMN HERE. This page loads open work only, so a Done column could
// never be anything but empty — and a column permanently reading zero looks
// like a fault rather than a fact. Finished work lives on its own board.
const COLUMN_ORDER = ['Backlog', 'In progress', 'Blocked']
const vnShort = (d: string) => new Date(`${d}T12:00:00+07:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
const columnStyle: React.CSSProperties = {
  flex: '0 0 270px', width: 270, background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10, padding: 10,
}
const columnHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  fontFamily: FAMILY, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#B2AA98', padding: '2px 2px 10px',
}
const cardStyle: React.CSSProperties = {
  display: 'block', textDecoration: 'none', background: 'rgba(5,46,32,0.55)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8, padding: '9px 10px',
  fontFamily: FAMILY,
}
const pill: React.CSSProperties = {
  borderRadius: 999, border: '1px solid rgba(229,212,194,0.18)', color: '#B2AA98',
  padding: '2px 8px', fontFamily: FAMILY, fontSize: 9.5,
}
const bar: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', margin: '0 0 10px' }
const chip = (on: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderRadius: 999, padding: '5px 12px',
  background: on ? 'rgba(212,184,90,0.18)' : 'transparent',
  border: `1px solid ${on ? 'rgba(212,184,90,0.55)' : 'rgba(229,212,194,0.15)'}`,
  color: on ? '#D4B85A' : '#B2AA98', fontFamily: FAMILY, fontSize: 11,
})
const chipN: React.CSSProperties = { fontWeight: 400, opacity: 0.7, fontSize: 10 }
