'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'
import { vnd, pct, type BlendQuote, type CaskQuote, type Countdown } from '@/lib/tet/types'

// ═══════════════════════════════════════════════════════════════════════════
// THE QUOTE BUILDER — internal, and the only screen in the club that shows the
// Tết cost model.
// ───────────────────────────────────────────────────────────────────────────
// A salesperson on the phone needs three things the public page must never
// carry: what it costs us, what the margin is at this quantity, and what the
// next tier would do to both. All three come from the database with p_admin
// set, through /api/admin/tet/quote, which is the single place that flag is
// ever sent.
//
// It also shows what is still a placeholder, on the same screen as the prices
// it produces — because a quote built on an invented FX rate looks exactly like
// a real one, and the only thing standing between the two is somebody
// remembering. The banner is there so nobody has to.
// ═══════════════════════════════════════════════════════════════════════════

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const CREAM = '#E5D4C2'
const GOLD = '#D4B85A'
const AMBER = '#C49555'
const SAGE = '#7AB07A'
const MUTED = '#B2AA98'

interface Cask { cask_ref: string; distillery: string; region: string; age_years: number; abv_pct: number; status: string; is_placeholder: boolean }
interface Product { sku: string; name_en: string; expression: string | null; uk_list_price_gbp: number; is_placeholder: boolean }
interface Tier { label_en: string; min_bottles: number; max_bottles: number | null; discount_pct: number; sleeve_price_vnd: number }
interface Enquiry {
  reference: string; company_name: string; contact_name: string; contact_email: string
  contact_phone: string | null; kind: string; cask_ref: string | null; message: string | null
  status: string; created_at: string
}

export default function AdminTet() {
  const { t } = useLang()
  const [data, setData] = useState<{
    provisional: boolean | null; countdown: Countdown | null
    audit: { area: string; item: string; detail: string }[]
    enquiries: Enquiry[]; casks: Cask[]; products: Product[]; tiers: Tier[]
  } | null>(null)

  const [mode, setMode] = useState<'blend' | 'cask'>('blend')
  const [qty, setQty] = useState<Record<string, string>>({})
  const [sleeve, setSleeve] = useState(true)
  const [caskRef, setCaskRef] = useState('')
  const [reduced, setReduced] = useState(true)
  const [quote, setQuote] = useState<BlendQuote | CaskQuote | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/tet', { cache: 'no-store' })
    if (r.ok) setData(await r.json())
  }, [])
  useEffect(() => { load() }, [load])

  const price = async () => {
    setBusy(true); setErr(''); setQuote(null)
    try {
      const payload = mode === 'cask'
        ? { kind: 'cask', cask_ref: caskRef, target_abv: reduced ? 50 : null }
        : { kind: 'blend', sleeve, lines: Object.entries(qty).map(([sku, q]) => ({ sku, qty: Number(q) || 0 })).filter(l => l.qty > 0) }
      const r = await fetch('/api/admin/tet/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error === 'empty_order' ? t('Put a quantity in first.', 'Nhập số lượng trước.') : (j.error || 'failed')); return }
      if (j.quote?.error) { setErr(String(j.quote.error)); return }
      setQuote(j.quote)
    } finally { setBusy(false) }
  }

  if (!data) return <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>{t('Loading…', 'Đang tải…')}</div>

  const cd = data.countdown
  const blendQuote = quote && 'total_bottles' in quote ? quote as BlendQuote : null
  const caskQuote = quote && 'cask_ref' in quote ? quote as CaskQuote : null

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: CREAM }}>
            {cd?.season || 'Tết Đinh Mùi 2027'}
          </h1>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 4 }}>
            {t('Duncan Taylor × The Rampant Club · internal quote builder', 'Duncan Taylor × The Rampant Club · công cụ báo giá nội bộ')}
          </div>
        </div>
        <Link href="/tet" target="_blank" style={btnGhost}>{t('The buyer’s page ↗', 'Trang khách hàng ↗')}</Link>
      </div>

      {data.provisional !== false && (
        <div style={{ ...card, borderColor: `${AMBER}66`, background: `${AMBER}10`, marginTop: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: AMBER }}>
            {t('Provisional', 'Tạm thời')}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: CREAM, lineHeight: 1.8, marginTop: 6 }}>
            {t(`Every price below is built on placeholder numbers — ${data.audit.length} of them. Quote from this and you are quoting an invented FX rate. The buyer's page shows no prices at all until these are cleared.`,
               `Mọi mức giá bên dưới đều dựa trên số liệu tạm — ${data.audit.length} mục. Đừng báo giá từ đây. Trang khách hàng chưa hiển thị giá cho đến khi hoàn tất.`)}
          </div>
        </div>
      )}

      {cd && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 16 }}>
          {[
            [t('Casks close', 'Hạn đặt thùng'), cd.cutoffs.cask.date, cd.cutoffs.cask.days_remaining],
            [t('Blends close', 'Hạn đặt pha trộn'), cd.cutoffs.blend.date, cd.cutoffs.blend.days_remaining],
            [t('Artwork', 'Thiết kế'), cd.cutoffs.artwork.date, cd.cutoffs.artwork.days_remaining],
            [t('In hand', 'Giao tận tay'), cd.in_hand_date, cd.days_to_festival],
          ].map(([label, date, days]) => (
            <div key={String(label)} style={card}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTED }}>{label}</div>
              <div style={{ fontFamily: SERIF, fontSize: 22, color: Number(days) < 30 ? AMBER : GOLD, marginTop: 4 }}>{days}d</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED, marginTop: 2 }}>{String(date)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── THE BUILDER ──────────────────────────────────────────────── */}
      <section style={{ ...card, marginTop: 22 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => { setMode('blend'); setQuote(null) }} style={tab(mode === 'blend')}>{t('Blends', 'Rượu pha trộn')}</button>
          <button onClick={() => { setMode('cask'); setQuote(null) }} style={tab(mode === 'cask')}>{t('A cask', 'Một thùng')}</button>
        </div>

        {mode === 'blend' ? (
          <>
            {data.products.map(p => (
              <div key={p.sku} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 16, color: CREAM }}>{p.name_en}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED }}>
                    {p.sku}{p.is_placeholder ? ` · ${t('placeholder price', 'giá tạm')}` : ''}
                  </div>
                </div>
                <input inputMode="numeric" value={qty[p.sku] ?? ''} onChange={e => setQty(q => ({ ...q, [p.sku]: e.target.value.replace(/\D/g, '') }))}
                       placeholder="0" style={numField} aria-label={`${p.name_en} quantity`} />
              </div>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 12, color: CREAM, marginTop: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={sleeve} onChange={e => setSleeve(e.target.checked)} style={{ width: 18, height: 18, accentColor: GOLD }} />
              {t('With a printed sleeve', 'Kèm hộp in tên')}
            </label>
          </>
        ) : (
          <>
            <select value={caskRef} onChange={e => setCaskRef(e.target.value)} style={{ ...numField, width: '100%', textAlign: 'left' }}>
              <option value="">{t('Choose a cask…', 'Chọn một thùng…')}</option>
              {data.casks.map(c => (
                <option key={c.cask_ref} value={c.cask_ref}>
                  {c.cask_ref} · {c.distillery} · {c.age_years}yo · {c.abv_pct}%{c.status !== 'available' ? ` · ${c.status}` : ''}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setReduced(false)} style={tab(!reduced)}>{t('Cask strength', 'Nguyên độ')}</button>
              <button onClick={() => setReduced(true)} style={tab(reduced)}>{t('Bottled at 50%', 'Đóng chai 50%')}</button>
            </div>
          </>
        )}

        <button onClick={price} disabled={busy} style={{ ...btnGold, marginTop: 16, opacity: busy ? .5 : 1 }}>
          {busy ? t('Pricing…', 'Đang tính…') : t('Price it', 'Tính giá')}
        </button>
        {err && <div style={{ fontFamily: MONO, fontSize: 11.5, color: '#C27070', marginTop: 10 }}>{err}</div>}

        {blendQuote && <BlendResult q={blendQuote} t={t} />}
        {caskQuote && <CaskResult q={caskQuote} t={t} />}
      </section>

      {/* ── ENQUIRIES ────────────────────────────────────────────────── */}
      <section style={{ ...card, marginTop: 22 }}>
        <h2 style={h2}>{t('Interest registered', 'Đăng ký quan tâm')} <span style={{ color: MUTED, fontSize: 13 }}>{data.enquiries.length}</span></h2>
        {data.enquiries.length === 0 ? (
          <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.8 }}>
            {t('Nobody yet. They appear here the moment someone fills the form on /tet.',
               'Chưa có ai. Sẽ hiển thị ngay khi có người điền biểu mẫu trên /tet.')}
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            {data.enquiries.map(e => (
              <div key={e.reference} style={{ ...row, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 15, color: CREAM }}>{e.company_name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 3 }}>
                    {e.contact_name} · <a href={`mailto:${e.contact_email}`} style={{ color: GOLD }}>{e.contact_email}</a>
                    {e.contact_phone ? ` · ${e.contact_phone}` : ''}
                  </div>
                  {e.message && <div style={{ fontFamily: MONO, fontSize: 11.5, color: CREAM, marginTop: 6, lineHeight: 1.7 }}>{e.message}</div>}
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: GOLD }}>{e.cask_ref || e.kind}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 3 }}>
                    {new Date(e.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>{e.reference}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── WHAT IS STILL INVENTED ───────────────────────────────────── */}
      <section style={{ ...card, marginTop: 22, marginBottom: 40 }}>
        <h2 style={h2}>{t('Still to replace', 'Còn phải thay')} <span style={{ color: MUTED, fontSize: 13 }}>{data.audit.length}</span></h2>
        <div style={{ marginTop: 10 }}>
          {data.audit.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', borderTop: i ? '1px solid rgba(229,212,194,.07)' : 'none' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: AMBER, minWidth: 58, textTransform: 'uppercase' }}>{a.area}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: CREAM, minWidth: 150 }}>{a.item}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTED }}>{a.detail}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ */

function BlendResult({ q, t }: { q: BlendQuote; t: (en: string, vn: string) => string }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${GOLD}44` }}>
      <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
        {q.total_bottles} {t('bottles', 'chai')} · {q.tier.label_en} · {pct(q.tier.discount_pct)} {t('off', 'giảm')}
      </div>
      {q.lines.map(l => (
        <div key={l.sku} style={row}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, color: CREAM }}>{l.name_en}</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED }}>
              {l.qty} × {vnd(l.unit_inc_vat_vnd)}
              {l.landed_cost_vnd != null && ` · ${t('cost', 'giá vốn')} ${vnd(l.landed_cost_vnd)}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: SERIF, fontSize: 16, color: CREAM }}>{vnd(l.line_total_vnd)}</div>
            {l.gross_margin_pct != null && (
              <div style={{ fontFamily: MONO, fontSize: 11, color: l.gross_margin_pct < 0.3 ? AMBER : SAGE }}>
                {pct(l.gross_margin_pct, 1)} {t('margin', 'biên lợi nhuận')}
              </div>
            )}
          </div>
        </div>
      ))}
      <Totals rows={[
        [t('Subtotal', 'Tạm tính'), vnd(q.subtotal_vnd)],
        ...(q.setup_fee_vnd ? [[t('Artwork setup', 'Phí thiết kế'), vnd(q.setup_fee_vnd)] as [string, string]] : []),
        [t('Total inc VAT', 'Tổng gồm VAT'), vnd(q.total_inc_vat_vnd)],
        ...(q.total_cost_vnd != null ? [[t('Our cost', 'Giá vốn'), vnd(q.total_cost_vnd)] as [string, string]] : []),
        ...(q.gross_profit_vnd != null ? [[t('Gross profit', 'Lợi nhuận gộp'), vnd(q.gross_profit_vnd)] as [string, string]] : []),
      ]} />
      {q.next_tier && (
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: GOLD, marginTop: 10, lineHeight: 1.7 }}>
          {t(`${q.next_tier.bottles_away} more bottles reaches ${q.next_tier.label_en} — ${Math.round(q.next_tier.discount_pct * 100)}% off.`,
             `Thêm ${q.next_tier.bottles_away} chai sẽ đạt mức ${q.next_tier.label_en} — giảm ${Math.round(q.next_tier.discount_pct * 100)}%.`)}
        </div>
      )}
    </div>
  )
}

function CaskResult({ q, t }: { q: CaskQuote; t: (en: string, vn: string) => string }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${GOLD}44` }}>
      <div style={{ fontFamily: SERIF, fontSize: 18, color: CREAM }}>{q.cask_ref} · {q.distillery}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, marginTop: 3 }}>
        {q.region} · {q.age_years}yo · {q.cask_abv_pct}% → {q.target_abv_pct}%
        {q.extra_bottles > 0 && ` · +${q.extra_bottles} ${t('bottles', 'chai')}`}
      </div>
      <Totals rows={[
        [t('Bottles', 'Số chai'), String(q.bottles)],
        [t('A bottle', 'Mỗi chai'), vnd(q.unit_inc_vat_vnd)],
        [t('The cask', 'Cả thùng'), vnd(q.cask_total_vnd)],
        ...(q.landed_cost_vnd != null ? [[t('Cost a bottle', 'Giá vốn mỗi chai'), vnd(q.landed_cost_vnd)] as [string, string]] : []),
        ...(q.gross_margin_pct != null ? [[t('Margin', 'Biên lợi nhuận'), pct(q.gross_margin_pct, 1)] as [string, string]] : []),
        ...(q.gross_profit_vnd != null ? [[t('Gross profit', 'Lợi nhuận gộp'), vnd(q.gross_profit_vnd)] as [string, string]] : []),
      ]} />
    </div>
  )
}

function Totals({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ marginTop: 12 }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', borderTop: i ? '1px solid rgba(229,212,194,.07)' : 'none' }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTED }}>{k}</span>
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: CREAM }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */

const card: React.CSSProperties = {
  border: '1px solid rgba(229,212,194,.14)', borderRadius: 12, padding: '16px 18px',
  background: 'rgba(229,212,194,.03)',
}
const h2: React.CSSProperties = { fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: CREAM, margin: 0 }
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
  borderBottom: '1px solid rgba(229,212,194,.07)',
}
const numField: React.CSSProperties = {
  width: 90, minHeight: 42, padding: '0 12px', borderRadius: 8, textAlign: 'right',
  background: 'rgba(229,212,194,.07)', border: '1px solid rgba(229,212,194,.2)',
  color: CREAM, fontFamily: MONO, fontSize: 15, outline: 'none',
}
const tab = (on: boolean): React.CSSProperties => ({
  fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
  padding: '9px 14px', minHeight: 38, borderRadius: 8, cursor: 'pointer',
  background: on ? CREAM : 'none', color: on ? '#052E20' : CREAM,
  border: on ? 'none' : '1px solid rgba(229,212,194,.25)',
})
const btnGold: React.CSSProperties = {
  fontFamily: MONO, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
  padding: '12px 24px', minHeight: 44, borderRadius: 8, cursor: 'pointer',
  background: GOLD, color: '#052E20', border: 'none',
}
const btnGhost: React.CSSProperties = {
  fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase',
  padding: '10px 16px', borderRadius: 8, textDecoration: 'none',
  background: 'none', color: CREAM, border: '1px solid rgba(229,212,194,.25)',
}
