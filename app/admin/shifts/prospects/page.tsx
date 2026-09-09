'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'

// ═══════════════════════════════════════════════════════════════════════════
// THE STANDING PROSPECT RULE — one name per shift, four shifts a week.
// ───────────────────────────────────────────────────────────────────────────
// The evidence for that task is a row in the EXISTING prospects table, not a new
// one. This form posts to /api/admin/mis/prospects — the same route the MIS
// pipeline uses, which mints the P-xxx id, writes the activity trail and now
// BLOCKS DUPLICATES against the whole prospect table and the member roster.
// A second creation path would have been a second set of rules to keep in step.
const MONO = "'Google Sans Code', monospace"
const SERIF = "'Rampant Sans', serif"

interface P { prospect_id: string; full_name: string; stage: string; profession: string | null
  assigned_to: string | null; next_action: string | null; next_action_date: string | null
  decision: string | null; notes: string | null; created_at: string }

export default function ShiftProspectsPage() {
  const { t } = useLang()
  const [list, setList] = useState<P[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [f, setF] = useState({ name: '', role: '', why: '', bring: '', reach: '', owner: '', first: '', firstDate: '' })

  const load = useCallback(() => {
    fetch('/api/admin/mis/prospects', { cache: 'no-store' }).then(r => r.json())
      .then(j => setList(j.prospects || j.data || [])).catch(() => {})
  }, [])
  useEffect(load, [load])

  const submit = async () => {
    setBusy(true); setErr(null); setOk(null)
    // The five questions live in `notes` as a labelled block. prospects has no
    // dedicated column for "why now" and adding four would fork a 40-column
    // table that the MIS pipeline already reads.
    const notes = [
      `Why now: ${f.why}`,
      `Would bring: ${f.bring}`,
      `How we reach them: ${f.reach}`,
    ].filter(Boolean).join('\n\n')
    const r = await fetch('/api/admin/mis/prospects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: f.name, profession: f.role || null, notes,
        contact_info: f.reach || null, assigned_to: f.owner || null,
        next_action: f.first || null, next_action_date: f.firstDate || null,
        stage: 'Lead',
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      // A 409 is the duplicate block, and its message names the clashing record.
      setErr(j?.error || t('Could not submit.', 'Không thể gửi.'))
    } else {
      setOk(t(`Submitted as ${j?.prospect?.prospect_id || j?.data?.prospect_id || 'a new prospect'}.`,
              `Đã gửi với mã ${j?.prospect?.prospect_id || j?.data?.prospect_id || 'mới'}.`))
      setF({ name: '', role: '', why: '', bring: '', reach: '', owner: '', first: '', firstDate: '' })
      load()
    }
    setBusy(false)
  }

  return (
    <>
      <Link href="/admin/shifts" style={back}>← {t('Shifts', 'Ca làm việc')}</Link>
      <h1 style={{ fontFamily: SERIF, fontSize: 24, color: '#E5D4C2', margin: '16px 0 4px' }}>
        {t('Propose a member', 'Đề cử hội viên')}
      </h1>
      <p style={meta}>
        {t('Not what they would spend — what they would add. It will be checked.',
           'Không phải họ sẽ chi bao nhiêu — mà họ mang lại điều gì. Sẽ được kiểm chứng.')}
      </p>

      {err && <div style={{ ...warn, color: '#C27070' }}>{err}</div>}
      {ok && <div style={{ ...warn, color: '#7AB07A' }}>{ok}</div>}

      <div style={{ ...card, marginTop: 14 }}>
        <Field label={t('Their name', 'Tên')} v={f.name} set={v => setF(s => ({ ...s, name: v }))} />
        <Field label={t('Company and role', 'Công ty và chức vụ')} v={f.role} set={v => setF(s => ({ ...s, role: v }))} />
        <Field label={t('Why now', 'Vì sao lúc này')} v={f.why} set={v => setF(s => ({ ...s, why: v }))} rows={2} />
        <Field label={t('What they would bring to the room', 'Họ mang lại điều gì cho câu lạc bộ')} v={f.bring} set={v => setF(s => ({ ...s, bring: v }))} rows={2} />
        <Field label={t('How we would reach them', 'Cách chúng ta tiếp cận')} v={f.reach} set={v => setF(s => ({ ...s, reach: v }))} rows={2} />
        <Field label={t('Owner (optional)', 'Người phụ trách (tuỳ chọn)')} v={f.owner} set={v => setF(s => ({ ...s, owner: v }))} />
        <Field label={t('First move (optional)', 'Bước đầu tiên (tuỳ chọn)')} v={f.first} set={v => setF(s => ({ ...s, first: v }))} />
        <div style={{ marginTop: 10 }}>
          <div style={label}>{t('By when', 'Hạn khi nào')}</div>
          <input type="date" value={f.firstDate} onChange={e => setF(s => ({ ...s, firstDate: e.target.value }))} style={input} />
        </div>
        <button disabled={busy || !f.name.trim() || !f.why.trim() || !f.bring.trim()} style={{ ...btn, marginTop: 14 }} onClick={submit}>
          {busy ? t('Submitting…', 'Đang gửi…') : t('Submit to Miss Chau', 'Gửi Miss Chau')}
        </button>
        <div style={{ ...meta, marginTop: 8 }}>
          {t('A name already proposed, or already a member, is refused — and the message says which.',
             'Tên đã được đề cử hoặc đã là hội viên sẽ bị từ chối — và thông báo sẽ cho biết trùng với ai.')}
        </div>
      </div>

      <h2 style={{ fontFamily: SERIF, fontSize: 15, color: '#E5D4C2', margin: '24px 0 8px' }}>
        {t('Proposed', 'Đã đề cử')} · {list.length}
      </h2>
      {list.slice(0, 40).map(p => (
        <div key={p.prospect_id} style={{ ...card, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: MONO, fontSize: 12.5, color: '#E5D4C2' }}>{p.full_name}</div>
            <div style={{ ...meta }}>{p.prospect_id} · {p.stage}{p.decision ? ` · ${p.decision}` : ''}</div>
          </div>
          {p.profession && <div style={meta}>{p.profession}</div>}
          {p.next_action && <div style={{ ...meta, color: '#D4B85A' }}>{t('Next', 'Tiếp theo')}: {p.next_action}{p.next_action_date ? ` · ${p.next_action_date}` : ''}</div>}
        </div>
      ))}
    </>
  )
}

const Field = ({ label: l, v, set, rows }: { label: string; v: string; set: (s: string) => void; rows?: number }) => (
  <div style={{ marginTop: 10 }}>
    <div style={label}>{l}</div>
    {rows ? <textarea value={v} onChange={e => set(e.target.value)} rows={rows} style={{ ...input, resize: 'vertical' }} />
          : <input value={v} onChange={e => set(e.target.value)} style={input} />}
  </div>
)

const back: React.CSSProperties = { fontFamily: MONO, fontSize: 11, color: '#B2AA98', textDecoration: 'none' }
const card: React.CSSProperties = { padding: '14px 16px', borderRadius: 10, background: 'rgba(229,212,194,0.03)', border: '1px solid rgba(229,212,194,0.10)' }
const meta: React.CSSProperties = { fontFamily: MONO, fontSize: 10.5, color: '#B2AA98', lineHeight: 1.7 }
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#B2AA98', marginBottom: 5 }
const input: React.CSSProperties = { width: '100%', fontFamily: MONO, fontSize: 12, padding: '9px 11px', borderRadius: 7, background: 'rgba(5,46,32,0.6)', color: '#E5D4C2', border: '1px solid rgba(229,212,194,0.16)' }
const btn: React.CSSProperties = { fontFamily: MONO, fontSize: 12, padding: '10px 18px', borderRadius: 7, border: 'none', background: '#D4B85A', color: '#052E20', fontWeight: 700, cursor: 'pointer' }
const warn: React.CSSProperties = { ...meta, color: '#D4B85A', marginTop: 12, padding: '9px 12px', borderRadius: 6, background: 'rgba(212,184,90,0.06)', border: '1px solid rgba(212,184,90,0.2)' }
