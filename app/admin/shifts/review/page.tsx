'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// THE MONDAY REVIEW — five people, one week, read at 14:00 under time pressure.
// ───────────────────────────────────────────────────────────────────────────
// This is the ONLY screen where a grid earns its place: five people and a full
// week is the one thing that actually needs comparing side by side.
//
// It opens on LAST week, because that is what the review is about — the week
// just gone, not the one starting. Everything below the grid is a WORKING LIST,
// not a report: carried over, blocked, and the names proposed. Each one is
// something to decide, which is why nothing here is a chart.
const MONO = "'Google Sans Code', monospace"
const SERIF = "'Rampant Sans', serif"

interface Tpl { id: string; day_of_week: number; title_en: string; assignee_team_member_id: string | null }
interface Task { id: string; template_id: string; sort: number; title_en: string }
interface Inst { id: string; template_task_id: string; template_id: string; status: string
  blocked_reason: string | null; blocked_unblocker: string | null; carried_over_count: number; evidence: string | null }
interface Member { id: string; display_name: string; is_shift_supervisor: boolean }
interface Obj { template_id: string; objective_en: string }
interface P { prospect_id: string; full_name: string; stage: string; decision: string | null
  created_at: string; archived_at: string | null }

const mondayOf = (d: Date) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10) }
const addDays = (iso: string, n: number) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)

export default function ReviewPage() {
  const { t } = useLang()
  const thisWeek = mondayOf(new Date(Date.now() + 7 * 3600e3))
  const [week, setWeek] = useState(addDays(thisWeek, -7))     // LAST week by default
  const [d, setD] = useState<{ acting: Member | null; templates: Tpl[]; tasks: Task[]; instances: Inst[]
    team: Member[]; objectives: Obj[] } | null>(null)
  const [prospects, setProspects] = useState<P[]>([])
  // The grid looks BACK at `week`; the five objectives look FORWARD at `thisWeek`.
  // They are different weeks, so they need different reads — otherwise the field
  // shows last week's text and reads as though this week were already agreed.
  const [nextObjectives, setNextObjectives] = useState<Obj[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch(`/api/admin/shifts?week=${week}`, { cache: 'no-store' }).then(r => r.json()).then(setD).catch(() => {})
    // include_archived: a name that was proposed and then DECLINED may have been
    // archived. That is the verdict most worth discussing, so it must not vanish.
    fetch('/api/admin/mis/prospects?include_archived=true', { cache: 'no-store' }).then(r => r.json())
      .then(j => setProspects(j.prospects || j.data || [])).catch(() => {})
    fetch(`/api/admin/shifts?week=${thisWeek}`, { cache: 'no-store' }).then(r => r.json())
      .then(j => setNextObjectives(j.objectives || [])).catch(() => {})
  }, [week, thisWeek])
  useEffect(load, [load])

  const rows = useMemo(() => {
    if (!d) return []
    return d.templates.map(tpl => {
      const inst = d.instances.filter(i => i.template_id === tpl.id)
      const by = (s: string) => inst.filter(i => i.status === s).length
      const done = by('done')
      return {
        tpl, who: d.team.find(m => m.id === tpl.assignee_team_member_id)?.display_name || '—',
        total: inst.length, done, in_progress: by('in_progress'), not_started: by('not_started'), blocked: by('blocked'),
        pct: inst.length ? Math.round((done / inst.length) * 100) : 0,
      }
    })
  }, [d])

  const carried = useMemo(() => (d?.instances || [])
    .filter(i => i.carried_over_count > 0)
    .sort((a, b) => b.carried_over_count - a.carried_over_count), [d])
  const blocked = useMemo(() => (d?.instances || []).filter(i => i.status === 'blocked'), [d])

  const weekProspects = useMemo(() => prospects.filter(p => {
    const c = String(p.created_at).slice(0, 10)
    return c >= week && c <= addDays(week, 6)
  }), [prospects, week])

  const nameOf = (i: Inst) => d?.tasks.find(x => x.id === i.template_task_id)?.title_en || '—'
  const whoOf = (i: Inst) => {
    const tpl = d?.templates.find(x => x.id === i.template_id)
    return d?.team.find(m => m.id === tpl?.assignee_team_member_id)?.display_name || '—'
  }

  const saveObjective = async (template_id: string) => {
    setBusy(true); setErr(null)
    const r = await fetch('/api/admin/shifts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'objective', week_start: thisWeek, template_id, objective_en: drafts[template_id] || '' }) })
    if (!r.ok) setErr((await r.json().catch(() => ({})))?.error || t('Could not save.', 'Không thể lưu.'))
    else { setDrafts(s => { const n = { ...s }; delete n[template_id]; return n }); load() }
    setBusy(false)
  }

  if (!d) return null
  if (!d.acting?.is_shift_supervisor) {
    return (
      <>
        <Link href="/admin/shifts" style={back}>← {t('Shifts', 'Ca làm việc')}</Link>
        <div style={warn}>{t('The Monday review is for Mr Sĩ and Miss Chau.', 'Phần rà soát thứ Hai dành cho Mr Sĩ và Miss Chau.')}</div>
      </>
    )
  }

  return (
    <>
      <Link href="/admin/shifts" style={back}>← {t('Shifts', 'Ca làm việc')}</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, margin: '16px 0 4px' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 24, color: '#E5D4C2' }}>{t('Monday review', 'Rà soát thứ Hai')}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={mini} onClick={() => setWeek(w => addDays(w, -7))}>←</button>
          <span style={{ ...meta, alignSelf: 'center' }}>{week} → {addDays(week, 6)}</span>
          <button style={mini} disabled={week >= thisWeek} onClick={() => setWeek(w => addDays(w, 7))}>→</button>
        </div>
      </div>
      {err && <div style={{ ...warn, color: '#C27070' }}>{err}</div>}

      {/* ── THE GRID. Five rows, the only comparison that matters. ────────── */}
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead><tr>
            {[t('Who', 'Ai'), t('Shift', 'Ca'), t('Done', 'Xong'), t('In progress', 'Đang làm'),
              t('Not started', 'Chưa bắt đầu'), t('Blocked', 'Bị chặn'), '%'].map(h =>
              <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.tpl.id}>
                <td style={{ ...td, color: '#E5D4C2' }}>{r.who}</td>
                <td style={td}>{r.tpl.title_en}</td>
                <td style={{ ...td, color: '#7AB07A' }}>{r.done}/{r.total}</td>
                <td style={td}>{r.in_progress || '—'}</td>
                <td style={{ ...td, opacity: r.not_started ? 1 : .4 }}>{r.not_started || '—'}</td>
                <td style={{ ...td, color: r.blocked ? '#C27070' : undefined }}>{r.blocked || '—'}</td>
                <td style={{ ...td, color: r.pct >= 80 ? '#7AB07A' : r.pct >= 50 ? '#D4B85A' : '#C27070', fontWeight: 700 }}>{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── CARRIED OVER. 2 is a flag, 3+ is escalated. ───────────────────── */}
      <Section title={`${t('Carried over', 'Chuyển tiếp')} · ${carried.length}`}>
        {carried.length === 0 ? <div style={meta}>{t('Nothing carried.', 'Không có việc nào chuyển tiếp.')}</div>
          : carried.map(i => (
            <div key={i.id} style={line}>
              <span style={{ ...pill, background: i.carried_over_count >= 3 ? 'rgba(194,112,112,.22)' : 'rgba(212,184,90,.18)',
                             color: i.carried_over_count >= 3 ? '#C27070' : '#D4B85A' }}>×{i.carried_over_count}</span>
              <span style={{ ...meta, color: '#E5D4C2' }}>{whoOf(i)}</span>
              <span style={meta}>{nameOf(i)}</span>
              {i.carried_over_count >= 3 && <span style={{ ...meta, color: '#C27070' }}>{t('escalate', 'cần xử lý')}</span>}
            </div>
          ))}
      </Section>

      {/* ── BLOCKED, WITH THE REASON. The reason is the point. ────────────── */}
      <Section title={`${t('Blocked', 'Bị chặn')} · ${blocked.length}`}>
        {blocked.length === 0 ? <div style={meta}>{t('Nothing blocked.', 'Không có việc nào bị chặn.')}</div>
          : blocked.map(i => (
            <div key={i.id} style={{ ...line, flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <div style={{ ...meta, color: '#E5D4C2' }}>{whoOf(i)} — {nameOf(i)}</div>
              <div style={{ ...meta, color: '#C27070' }}>{i.blocked_reason}</div>
              {i.blocked_unblocker && <div style={meta}>{t('Can unblock', 'Người gỡ được')}: {i.blocked_unblocker}</div>}
            </div>
          ))}
      </Section>

      {/* ── NAMES PROPOSED, and what was decided. ─────────────────────────── */}
      <Section title={`${t('Proposed this week', 'Đề cử trong tuần')} · ${weekProspects.length}`}>
        {weekProspects.length === 0 ? <div style={meta}>{t('No names proposed.', 'Chưa có tên nào được đề cử.')}</div>
          : weekProspects.map(p => (
            <div key={p.prospect_id} style={line}>
              <span style={{ ...meta, color: '#E5D4C2' }}>{p.full_name}</span>
              <span style={meta}>{p.prospect_id}</span>
              <span style={{ ...pill, background: 'rgba(158,143,196,.2)', color: '#9E8FC4' }}>{p.decision || p.stage}</span>
              {p.archived_at && <span style={{ ...meta, opacity: .6 }}>{t('archived', 'đã lưu trữ')}</span>}
            </div>
          ))}
      </Section>

      {/* ── THE FIVE OBJECTIVES, which land on each person's shift view. ──── */}
      <Section title={`${t('The five for', 'Năm việc cho tuần')} ${thisWeek}`}>
        <div style={{ ...meta, marginBottom: 8 }}>
          {t('Agreed here, shown at the top of that person’s shift.', 'Thống nhất tại đây, hiển thị đầu ca của người phụ trách.')}
        </div>
        {d.templates.map(tpl => {
          const existing = nextObjectives.find(o => o.template_id === tpl.id)?.objective_en || ''
          const who = d.team.find(m => m.id === tpl.assignee_team_member_id)?.display_name || tpl.title_en
          return (
            <div key={tpl.id} style={{ marginBottom: 8 }}>
              <div style={label}>{who}</div>
              <input defaultValue={existing} style={input}
                onChange={e => setDrafts(s => ({ ...s, [tpl.id]: e.target.value }))}
                placeholder={t('One thing that must be true by Friday', 'Một điều phải hoàn thành trước thứ Sáu')} />
              {drafts[tpl.id] !== undefined && drafts[tpl.id] !== existing && (
                <button disabled={busy} style={{ ...mini, marginTop: 5 }} onClick={() => saveObjective(tpl.id)}>
                  {t('Save', 'Lưu')}
                </button>
              )}
            </div>
          )
        })}
      </Section>
    </>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginTop: 20 }}>
    <div style={{ fontFamily: SERIF, fontSize: 15, color: '#E5D4C2', marginBottom: 8 }}>{title}</div>
    <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.10)' }}>
      {children}
    </div>
  </div>
)

const back: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', textDecoration: 'none' }
const meta: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, color: '#B2AA98', lineHeight: 1.7 }
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 4 }
const th: React.CSSProperties = { ...meta, textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(229,212,194,0.12)', textTransform: 'uppercase', letterSpacing: '.06em' }
const td: React.CSSProperties = { fontFamily: MONO, fontSize: 11.5, color: '#B2AA98', padding: '9px 8px', borderBottom: '1px solid rgba(229,212,194,0.06)' }
const line: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '7px 0', borderBottom: '1px solid rgba(229,212,194,0.06)' }
const pill: React.CSSProperties = { fontFamily: MONO, fontSize: 9, borderRadius: 999, padding: '2px 8px' }
const mini: React.CSSProperties = { fontFamily: MONO, fontSize: 10, padding: '5px 11px', borderRadius: 5, border: '1px solid rgba(229,212,194,0.22)', background: 'transparent', color: '#B2AA98', cursor: 'pointer' }
const input: React.CSSProperties = { width: '100%', fontFamily: MONO, fontSize: 12, padding: '9px 11px', borderRadius: 7, background: 'rgba(5,46,32,0.6)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.16)' }
const warn: React.CSSProperties = { ...meta, color: '#D4B85A', marginTop: 12, padding: '9px 12px', borderRadius: 6, background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.2)' }
