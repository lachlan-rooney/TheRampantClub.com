'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

// Admin → Weekly Report editor. Narrative + financials toggle + refresh data +
// preview. Approval/send controls arrive with Phase B.

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"

interface Report {
  id: string; period_start: string; period_end: string; status: string
  headline: string | null; narrative: Record<string, string>; include_financials: boolean
  auto_data: { usage?: { visits?: number; unique_members?: number }; generated_at?: string }
  share_token: string
  send_postponed_to: string | null
}

const FIELDS: { key: string; label: string; hint: string; rows: number }[] = [
  { key: 'headline', label: 'Headline', hint: 'The strapline on the cover', rows: 1 },
  { key: 'moment_of_week', label: 'Moment of the week', hint: 'A highlight — sits in a gold callout', rows: 2 },
  { key: 'interviews_commentary', label: 'Interviews & pipeline commentary', hint: 'Colour on this week&rsquo;s prospects', rows: 3 },
  { key: 'marketing', label: 'Marketing initiatives', hint: 'What went out, what&rsquo;s planned', rows: 3 },
  { key: 'cost_cutting', label: 'Cost-cutting', hint: 'Savings & efficiencies (narrative — no data feed)', rows: 3 },
  { key: 'successes', label: 'Successes', hint: 'Wins worth celebrating', rows: 3 },
  { key: 'guests_note', label: 'Guests note', hint: 'Guest attendance is narrative (only a party-size estimate exists)', rows: 2 },
  { key: 'closing_note', label: 'Closing note', hint: 'A sign-off line', rows: 2 },
]

export default function ReportEditor() {
  const { id } = useParams<{ id: string }>()
  const [r, setR] = useState<Report | null>(null)
  const [nar, setNar] = useState<Record<string, string>>({})
  const [fin, setFin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [acting, setActing] = useState(false)
  const [msg, setMsg] = useState('')
  const [activity, setActivity] = useState<{ id: string; event_type: string; created_at: string; note: string | null }[]>([])

  const load = async () => {
    const res = await fetch(`/api/admin/reports/${id}`, { cache: 'no-store' })
    const d = await res.json()
    if (d.report) { setR(d.report); setNar(d.report.narrative || {}); setFin(d.report.include_financials) }
    const sb = createBrowserSupabaseClient()
    const { data: a } = await sb.from('report_activity').select('id, event_type, created_at, note').eq('report_id', id).order('created_at', { ascending: false })
    setActivity(a || [])
  }
  useEffect(() => { load() }, [id])

  const act = async (path: string, ok: string) => {
    setActing(true); setMsg('')
    const r = await fetch(`/api/admin/reports/${id}/${path}`, { method: 'POST' })
    setActing(false)
    if (r.ok) { setMsg(ok); load() } else { const d = await r.json().catch(() => ({})); setMsg(d.error || 'Failed') }
    setTimeout(() => setMsg(''), 3500)
  }
  const previewEmail = async () => {
    const r = await fetch(`/api/admin/reports/${id}/send?dry=1`, { method: 'POST' })
    const html = await r.text()
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() }
  }

  // Editable while draft/pending, OR approved-but-held (postponement window open).
  const held = !!r && r.status === 'approved' && !!r.send_postponed_to && new Date(r.send_postponed_to) > new Date()
  const locked = r ? (r.status !== 'draft' && r.status !== 'pending_approval' && !held) : true
  const holdLabel = r?.send_postponed_to ? new Date(r.send_postponed_to).toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) : null

  const postpone = async (hours: number) => {
    setActing(true); setMsg('')
    const res = await fetch(`/api/admin/reports/${id}/postpone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours }) })
    setActing(false)
    setMsg(res.ok ? (hours > 0 ? 'Send postponed' : 'Hold cleared') : 'Postpone failed')
    load(); setTimeout(() => setMsg(''), 3500)
  }

  const save = async () => {
    setSaving(true); setMsg('')
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nar, headline: nar.headline || '', include_financials: fin }),
    })
    setSaving(false)
    setMsg(res.ok ? 'Saved' : 'Save failed'); setTimeout(() => setMsg(''), 2500)
  }
  const refresh = async () => {
    setRefreshing(true); setMsg('')
    const res = await fetch(`/api/admin/reports/${id}/refresh-data`, { method: 'POST' })
    setRefreshing(false)
    if (res.ok) { load(); setMsg('Data refreshed') } else setMsg('Refresh failed')
    setTimeout(() => setMsg(''), 2500)
  }

  if (!r) return <div style={{ fontFamily: MONO, fontSize: 12, color: '#B2AA98' }}>Loading…</div>

  return (
    <>
      <Link href="/admin/reports" style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', textDecoration: 'none' }}>← All reports</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', margin: '10px 0 20px' }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500, color: '#E5D4C2' }}>{r.headline || 'Weekly Report'}</h1>
          <div style={{ fontFamily: MONO, fontSize: 11, color: '#B2AA98', marginTop: 4 }}>
            {r.period_start} – {r.period_end} · {r.status.replace('_', ' ')} · {r.auto_data?.usage?.visits ?? 0} visits, {r.auto_data?.usage?.unique_members ?? 0} members
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={`/reports/${r.share_token}`} target="_blank" rel="noreferrer" style={btnGhost}>Preview ↗</a>
          <button onClick={refresh} disabled={refreshing || locked} style={{ ...btnGhost, opacity: refreshing || locked ? 0.5 : 1 }}>{refreshing ? 'Refreshing…' : 'Refresh data'}</button>
        </div>
      </div>

      {locked && <div style={{ fontFamily: MONO, fontSize: 11, color: '#D4B85A', marginBottom: 16 }}>This report is {r.status} — narrative is locked.</div>}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <input type="checkbox" checked={fin} disabled={locked} onChange={e => setFin(e.target.checked)} id="fin" />
          <label htmlFor="fin" style={{ fontFamily: MONO, fontSize: 12, color: '#E5D4C2' }}>Include monthly financials</label>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#7E7864', marginBottom: 16 }}>
          Tip: add a clickable link in any section with <span style={{ color: '#B2AA98' }}>[label](https://…)</span>
        </div>
        {FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label style={label}>{f.label}</label>
            {f.rows === 1 ? (
              <input style={input} disabled={locked} value={nar[f.key] || ''} onChange={e => setNar(v => ({ ...v, [f.key]: e.target.value }))} />
            ) : (
              <textarea style={{ ...input, resize: 'vertical' }} rows={f.rows} disabled={locked} value={nar[f.key] || ''} onChange={e => setNar(v => ({ ...v, [f.key]: e.target.value }))} />
            )}
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#7E7864', marginTop: 3 }} dangerouslySetInnerHTML={{ __html: f.hint }} />
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          {!locked && <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>}
          <button onClick={previewEmail} style={btnGhost}>Preview email ↗</button>
          {r.status === 'draft' && <button onClick={() => act('submit', 'Submitted for approval')} disabled={acting} style={btnGold}>Submit for approval →</button>}
          {r.status === 'pending_approval' && <>
            <button onClick={() => act('approve', 'Approved')} disabled={acting} style={btnGold}>Approve</button>
            <button onClick={() => act('revert', 'Reverted to draft')} disabled={acting} style={btnGhost}>Revert to draft</button>
          </>}
          {r.status === 'approved' && <button onClick={() => act('send', 'Sent')} disabled={acting} style={btnGold}>Send now →</button>}
          {r.status === 'sent' && <span style={{ fontFamily: MONO, fontSize: 11, color: '#5B8FA8' }}>✓ Sent</span>}
          {msg && <span style={{ fontFamily: MONO, fontSize: 11, color: /fail|only|can't|can.t|no permitted/i.test(msg) ? '#C27070' : '#7AB07A' }}>{msg}</span>}
        </div>
        {r.status === 'approved' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: '#B2AA98' }}>
              Auto-sends 17:00 VN Mon.{holdLabel ? ` Held until ${holdLabel} VN — use “Send now” then.` : ''} Emergency postpone holds the auto-send (max 21:00):
            </span>
            {[1, 2, 3, 4].map(h => <button key={h} onClick={() => postpone(h)} disabled={acting} style={btnGhost}>+{h}h</button>)}
            {r.send_postponed_to && <button onClick={() => postpone(0)} disabled={acting} style={{ ...btnGhost, color: '#C49555' }}>Clear hold</button>}
          </div>
        )}
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#C49555', marginTop: 10 }}>
          Beta: sends go to you only — Shawn is not emailed until you go live.
        </div>
      </div>

      {activity.length > 0 && (
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#D4B85A', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>History</div>
          {activity.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: '1px solid rgba(229,212,194,0.06)', fontFamily: MONO, fontSize: 10, color: '#B2AA98' }}>
              <span>{a.event_type.replace(/_/g, ' ')}{a.note ? ` — ${a.note}` : ''}</span>
              <span style={{ color: '#7E7864', whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

const card: React.CSSProperties = { padding: 22, background: 'rgba(229,212,194,0.04)', border: '1px solid rgba(229,212,194,0.1)', borderRadius: 12 }
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, color: '#B2AA98', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }
const input: React.CSSProperties = { background: 'rgba(229,212,194,0.06)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.12)', borderRadius: 8, padding: '9px 12px', fontFamily: MONO, fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6 }
const btnPrimary: React.CSSProperties = { background: '#5E6650', color: '#E5D4C2', border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontFamily: MONO, fontSize: 12 }
const btnGhost: React.CSSProperties = { background: 'transparent', color: '#B2AA98', border: '1px solid rgba(229,212,194,0.18)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontFamily: MONO, fontSize: 11, textDecoration: 'none' }
const btnGold: React.CSSProperties = { background: '#D4B85A', color: '#052E20', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontFamily: MONO, fontSize: 12, fontWeight: 600 }
