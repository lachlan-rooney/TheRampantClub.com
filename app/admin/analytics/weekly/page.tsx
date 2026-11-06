'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'
import { RULES, band, prescription, BAND_COLOUR, BAND_LABEL, type RuleKey } from '@/lib/analytics/thresholds'

// THE WEEKLY OPS SCORECARD — the strongest data in the building, weekly.
//
// Additive: its own route, its own API, nothing of the existing dashboard
// touched. /admin stays exactly as it was.
//
// ── EVERY NUMBER CARRIES A PRESCRIPTION ───────────────────────────────────
// A red figure that does not say what to do about it is decoration. Each card
// shows the measurement, its band, and — at warning or worse — who picks it up
// and what they do. The rules live in lib/analytics/thresholds so they can be
// argued with in one place, and moved into an editable table later.
//
// ── IT SAYS WHEN IT DOES NOT KNOW ─────────────────────────────────────────
// Member reach reads low partly because visits are barely captured, not only
// because members are not coming. The card says so. An analytics surface that
// cannot distinguish "bad" from "unmeasured" will have somebody acting on a
// number that means nothing.

interface Gap {
  pipeline: { stalled: { prospect_id: string; name: string; stage: string; days_in_stage: number }[]
              median_days_in_stage: number | null; moved_this_week: number }
  rota: { scheduled: number; target: number; coverage_pct: number | null }
  grievances: { open_now: number; median_days_to_resolve: number | null; oldest_open_days: number | null }
  board: { open: number; overdue: number; due_next_7: number; blocked: number }
  reach: { seen_30d: number; members: number; pct: number | null }
}
interface Payload {
  period: { start: string; end: string }
  shared: { ops: { complaints: { opened: number; resolved: number } } | null
            pipeline: { conversion_pct: number } } | null
  gap: Gap
}

export default function WeeklyScorecard() {
  const { t, lang } = useLang()
  const vn = lang === 'vn'
  const [d, setD] = useState<Payload | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/admin/analytics/weekly', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(setD)
      .catch(() => setErr(t('Could not read the scorecard.', 'Không đọc được bảng điểm.')))
  }, [t])

  if (err) return <main style={wrap}><p style={quiet}>{err}</p></main>
  if (!d) return <main style={wrap}><p style={quiet}>{t('Reading the week…', 'Đang đọc tuần…')}</p></main>

  const g = d.gap
  const cards: { key: RuleKey; value: number | null; sub: string; note?: string }[] = [
    { key: 'overdueTasks', value: g.board.overdue,
      sub: t(`${g.board.open} open · ${g.board.due_next_7} due in seven days · ${g.board.blocked} blocked`,
             `${g.board.open} đang mở · ${g.board.due_next_7} đến hạn trong 7 ngày · ${g.board.blocked} bị chặn`) },
    { key: 'pipelineStalled', value: g.pipeline.stalled.length,
      sub: t(`median ${g.pipeline.median_days_in_stage ?? '—'} days in stage · ${g.pipeline.moved_this_week} moved this week`,
             `trung vị ${g.pipeline.median_days_in_stage ?? '—'} ngày mỗi giai đoạn · ${g.pipeline.moved_this_week} đã chuyển tuần này`) },
    { key: 'coveragePct', value: g.rota.coverage_pct,
      sub: t(`${g.rota.scheduled} shifts against a target of ${g.rota.target}`,
             `${g.rota.scheduled} ca so với mục tiêu ${g.rota.target}`) },
    { key: 'grievanceOpen', value: g.grievances.open_now,
      sub: t(`oldest open ${g.grievances.oldest_open_days ?? '—'} days · median resolve ${g.grievances.median_days_to_resolve ?? '—'} days`,
             `lâu nhất ${g.grievances.oldest_open_days ?? '—'} ngày · trung vị xử lý ${g.grievances.median_days_to_resolve ?? '—'} ngày`) },
    { key: 'resolutionDays', value: g.grievances.median_days_to_resolve,
      sub: t(`${d.shared?.ops?.complaints.resolved ?? 0} resolved this week, ${d.shared?.ops?.complaints.opened ?? 0} opened`,
             `${d.shared?.ops?.complaints.resolved ?? 0} đã xử lý tuần này, ${d.shared?.ops?.complaints.opened ?? 0} mới`) },
    { key: 'memberReach', value: g.reach.pct,
      sub: t(`${g.reach.seen_30d} of ${g.reach.members} members seen in thirty days`,
             `${g.reach.seen_30d} trong ${g.reach.members} hội viên đã ghé trong 30 ngày`),
      note: t('Reads low partly because arrivals are barely captured — not only because members are not coming.',
              'Con số thấp một phần vì lượt ghé chưa được ghi nhận đầy đủ, không chỉ vì hội viên ít đến.') },
  ]

  return (
    <main style={wrap}>
      <Link href="/admin" style={back}>← {t('Admin', 'Quản trị')}</Link>
      <h1 style={h1}>{t('Weekly Ops Scorecard', 'Bảng điểm vận hành tuần')}</h1>
      <p style={lede}>
        {t(`The week of ${d.period.start} to ${d.period.end}. Every number says what to do about it.`,
           `Tuần ${d.period.start} đến ${d.period.end}. Mỗi con số đều kèm hành động cần làm.`)}
      </p>

      <div style={grid}>
        {cards.map(c => {
          const b = band(c.key, c.value)
          const rx = prescription(c.key, c.value, vn)
          const r = RULES[c.key]
          const unit = c.key === 'coveragePct' || c.key === 'memberReach' ? '%'
                     : c.key === 'resolutionDays' ? t('d', ' ngày') : ''
          return (
            <section key={c.key} style={{ ...card, borderColor: `${BAND_COLOUR[b]}55` }}>
              <div style={{ ...bandTag, background: `${BAND_COLOUR[b]}1f`, color: BAND_COLOUR[b] }}>
                {vn ? BAND_LABEL[b].vn : BAND_LABEL[b].en}
              </div>
              <div style={label}>{vn ? r.label_vn : r.label_en}</div>
              <div style={{ ...figure, color: BAND_COLOUR[b] }}>
                {c.value ?? '—'}<span style={{ fontSize: 16, opacity: .6 }}>{c.value != null ? unit : ''}</span>
              </div>
              <div style={sub}>{c.sub}</div>
              {c.note && <div style={caveat}>{c.note}</div>}
              {rx && (
                <div style={rxBox}>
                  <span style={rxWho}>{rx.owner}</span>
                  <span style={rxWhat}>{rx.action}</span>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {g.pipeline.stalled.length > 0 && (
        <section style={{ marginTop: 34 }}>
          <h2 style={h2}>{t('Stalled in the pipeline', 'Đứng yên trong quy trình')}</h2>
          <p style={quiet}>
            {t('Nobody has moved these in thirty days. Move them on or close them.',
               'Những hồ sơ này không chuyển trạng thái trong 30 ngày. Hãy đẩy tiếp hoặc đóng lại.')}
          </p>
          <ul style={list}>
            {g.pipeline.stalled.map(s => (
              <li key={s.prospect_id} style={row}>
                <Link href={`/admin/mis/pipeline/${s.prospect_id}`} style={rowLink}>{s.name}</Link>
                <span style={rowMeta}>{s.stage} · {s.days_in_stage}{t('d', ' ngày')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p style={{ ...quiet, marginTop: 34 }}>
        {t('Thresholds live in lib/analytics/thresholds and are meant to be argued with.',
           'Ngưỡng cảnh báo nằm trong lib/analytics/thresholds và nên được điều chỉnh theo thực tế.')}
      </p>
    </main>
  )
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', Georgia, serif"
const wrap: React.CSSProperties = { padding: '28px clamp(18px,3vw,40px) 80px', maxWidth: 1180, margin: '0 auto' }
const back: React.CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A8575', textDecoration: 'none' }
const h1: React.CSSProperties = { fontFamily: SERIF, fontSize: 'clamp(28px,4vw,44px)', color: '#E5D4C2', margin: '10px 0 0', fontWeight: 400 }
const h2: React.CSSProperties = { fontFamily: SERIF, fontSize: 22, color: '#E5D4C2', margin: '0 0 6px', fontWeight: 400 }
const lede: React.CSSProperties = { fontFamily: MONO, fontSize: 12.5, lineHeight: 1.8, color: '#B2AA98', margin: '10px 0 26px' }
const quiet: React.CSSProperties = { fontFamily: MONO, fontSize: 11.5, lineHeight: 1.8, color: '#7E7864' }
const grid: React.CSSProperties = { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }
const card: React.CSSProperties = { position: 'relative', border: '1px solid', borderRadius: 10, padding: '18px 20px 20px', background: 'rgba(229,212,194,0.025)' }
const bandTag: React.CSSProperties = { position: 'absolute', top: 14, right: 14, padding: '3px 9px', borderRadius: 3, fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase' }
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8A8575', paddingRight: 70 }
const figure: React.CSSProperties = { fontFamily: SERIF, fontSize: 42, lineHeight: 1.1, margin: '10px 0 6px', fontVariantNumeric: 'tabular-nums' }
const sub: React.CSSProperties = { fontFamily: MONO, fontSize: 11, lineHeight: 1.7, color: '#B2AA98' }
const caveat: React.CSSProperties = { fontFamily: MONO, fontSize: 10, lineHeight: 1.7, color: '#7E7864', marginTop: 8, fontStyle: 'italic' }
const rxBox: React.CSSProperties = { marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(229,212,194,.12)', display: 'flex', flexDirection: 'column', gap: 4 }
const rxWho: React.CSSProperties = { fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: '#D4B85A' }
const rxWhat: React.CSSProperties = { fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7, color: '#E5D4C2' }
const list: React.CSSProperties = { listStyle: 'none', margin: '14px 0 0', padding: 0 }
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderTop: '1px solid rgba(229,212,194,.1)' }
const rowLink: React.CSSProperties = { fontFamily: MONO, fontSize: 12.5, color: '#E5D4C2', textDecoration: 'none' }
const rowMeta: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#8A8575', whiteSpace: 'nowrap' }
