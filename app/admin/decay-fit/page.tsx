'use client'

import { useCallback, useEffect, useState } from 'react'
import { ConfirmModal } from '@/components/admin/dialogs'
import { useLang } from '@/lib/admin-lang'

// Admin / Intelligence / Decay Fit
//
// MIS Pass 3 console. Per-category designed-vs-active-vs-proposed λ, with
// the evidence (n_events, distance to event floor, CI rel-width) shown
// inline. Accept/reject controls appear only on rows with status='proposed'
// — 'insufficient_data' rows are heartbeat records, not promotion candidates,
// and the empty state is the day-one state by design.

interface LdcRow {
  id: string
  category: string
  learned_lambda: number
  designed_lambda: number
  lambda_ci_lower: number | null
  lambda_ci_upper: number | null
  n_observations: number
  n_events: number
  half_life_days: number | null
  fit_timestamp: string
  status: string | null
  ci_relative_width: number | null
  meets_event_floor: boolean | null
  ci_narrow_enough: boolean | null
  notes: string | null
}

interface CategorySlice {
  category: string
  designedLambda: number
  active: LdcRow | null
  latestProposal: LdcRow | null
  history: LdcRow[]
}

interface DecisionRow {
  decision_id: string
  category: string
  proposal_row_id: string
  decision: 'accept' | 'reject'
  previous_status: string | null
  previous_lambda: number | null
  new_status: string | null
  new_lambda: number | null
  decided_by: string
  decided_at: string
  note: string | null
}

interface PageData {
  categories: CategorySlice[]
  decisions: DecisionRow[]
  total_validation_events: number
  designed_lambda: Record<string, number>
}

const EVENT_FLOOR = 20

export default function DecayFitPage() {
  const { t } = useLang()
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Confirm modal — accept (promote λ) / reject a proposal.
  const [pending, setPending] = useState<{ id: string; action: 'accept' | 'reject'; lambda: number; category: string } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/mis/decay-fit', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])
  useEffect(() => { load() }, [load])

  const runFit = async (dry: boolean) => {
    setRunning(true); setRunResult(null); setError(null)
    try {
      const r = await fetch(`/api/cron/decay-fit${dry ? '?dry=1' : ''}`, { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Fit failed', 'Khớp thất bại'))
      setRunResult(dry
        ? `${t('Dry run', 'Chạy thử')} · ${j.results?.length ?? 0} ${t('categories evaluated', 'hạng mục được đánh giá')}, ${j.rowsToInsert?.length ?? 0} ${t('would be written', 'sẽ được ghi')}`
        : `${t('Fit complete', 'Khớp hoàn tất')} · ${j.proposals_written} ${t('rows written', 'dòng đã ghi')} (${j.propose_count} ${t('proposed', 'đề xuất')}, ${j.insufficient_count} ${t('insufficient', 'chưa đủ')})`)
      if (!dry) load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  const closeConfirm = () => { if (!busyId) setPending(null) }
  const runDecision = async () => {
    if (!pending) return
    const { id: rowId, action } = pending
    setBusyId(rowId); setError(null)
    try {
      const r = await fetch(`/api/admin/mis/decay-fit/${rowId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('Decision failed', 'Quyết định thất bại'))
      setPending(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div style={emptyText}>{t('Loading…', 'Đang tải…')}</div>
  if (!data) return <div style={emptyText}>{t('No data.', 'Không có dữ liệu.')}</div>

  const hasAnyProposal = data.categories.some(c => c.latestProposal)
  const proposable = data.categories.filter(c => c.latestProposal?.status === 'proposed').length
  const totalEvents = data.total_validation_events

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={eyebrow}>{t('Intelligence · MIS Pass 3', 'Trí tuệ · MIS Lượt 3')}</div>
        <h1 style={pageTitle}>{t('Decay Fit', 'Khớp Suy Giảm')}</h1>
        <p style={lede}>
          {t('Bayesian λ-fit for the preference-decay model. Each month the cron pulls survival spells from', 'Khớp λ Bayes cho mô hình suy giảm sở thích. Mỗi tháng, cron kéo các khoảng sống sót từ')} <code>v_decay_contradictions</code>, <code>v_decay_confirmations</code> {t('and', 'và')} <code>v_decay_live_exposure</code>{t(', runs a Gamma-conjugate posterior per category, and writes one proposal row per canonical category. A proposal becomes live scoring only after explicit accept here. Medical preferences (λ=0) are excluded row-by-row at the view layer and never reach the fit.', ', chạy hậu nghiệm liên hợp Gamma cho mỗi hạng mục, và ghi một dòng đề xuất cho mỗi hạng mục chuẩn. Một đề xuất chỉ được đưa vào chấm điểm trực tiếp sau khi được chấp nhận rõ ràng tại đây. Sở thích y tế (λ=0) bị loại trừ theo từng dòng ở lớp hiển thị và không bao giờ đến bước khớp.')}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => runFit(true)} disabled={running} style={btnGhost}>
          {running ? '…' : t('Dry run', 'Chạy thử')}
        </button>
        <button onClick={() => runFit(false)} disabled={running} style={btnGhost}>
          {running ? '…' : t('Run fit now', 'Chạy khớp ngay')}
        </button>
        <div style={{ ...metaText, marginLeft: 'auto' }}>
          {totalEvents} {t('validation event', 'sự kiện xác thực')}{totalEvents === 1 ? '' : t('s', '')} {t('logged', 'đã ghi nhận')} · {proposable} {t('proposal', 'đề xuất')}{proposable === 1 ? '' : t('s', '')} {t('awaiting decision', 'đang chờ quyết định')}
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {runResult && <div style={infoBox}>{runResult}</div>}

      {!hasAnyProposal ? (
        <div style={emptyBlock}>
          <div style={{ fontSize: 14, color: '#E5D4C2', marginBottom: 8 }}>{t('No category has reached the evidence floor yet.', 'Chưa có hạng mục nào đạt ngưỡng bằng chứng.')}</div>
          <div style={{ lineHeight: 1.7 }}>
            {totalEvents} {t('validation event', 'sự kiện xác thực')}{totalEvents === 1 ? '' : t('s', '')} {t('on record across', 'được ghi nhận trên')} {data.categories.length} {t('canonical categories. The fitter needs at least', 'hạng mục chuẩn. Bộ khớp cần ít nhất')} <strong>{EVENT_FLOOR} {t('contradictions', 'mâu thuẫn')}</strong> {t('per category before a proposal can clear the gate. Until then the live decay constants are the designed prior centres shown below, and the system is honest about not having learned anything yet.', 'cho mỗi hạng mục trước khi một đề xuất có thể vượt cổng. Cho đến lúc đó, các hằng số suy giảm trực tiếp là các tâm tiên nghiệm được thiết kế hiển thị bên dưới, và hệ thống trung thực rằng chưa học được điều gì.')}
          </div>
          <div style={{ marginTop: 14, lineHeight: 1.7 }}>
            {t('Run the fit anyway to write the heartbeat (one row per category at', 'Vẫn chạy khớp để ghi nhịp tim (một dòng cho mỗi hạng mục ở')} <code>status=insufficient_data</code>{t('), or wait for the monthly cron on the 1st.', '), hoặc chờ cron hàng tháng vào ngày mùng 1.')}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12 }}>
        {data.categories.map(c => {
          const live = c.active?.learned_lambda ?? c.designedLambda
          const liveSource: 'active' | 'designed' = c.active ? 'active' : 'designed'
          const proposal = c.latestProposal
          const halfLifeLive = LN2 / live
          const isOpen = expandedId === c.category

          return (
            <div key={c.category} style={card}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={categoryTitle}>{c.category}</div>
                <span style={liveSource === 'active' ? activePill : designedPill}>
                  {liveSource === 'active' ? t('learned', 'đã học') : t('designed', 'thiết kế')}
                </span>
              </div>

              <div style={lambdaRow}>
                <div>
                  <div style={miniLabel}>{t('Live λ', 'λ trực tiếp')}</div>
                  <div style={lambdaBig}>{live.toFixed(4)}</div>
                  <div style={miniMeta}>{halfLifeLive.toFixed(0)}{t('d half-life', ' ngày bán rã')}</div>
                </div>
                <div>
                  <div style={miniLabel}>{t('Designed λ', 'λ thiết kế')}</div>
                  <div style={lambdaSmall}>{c.designedLambda.toFixed(4)}</div>
                  <div style={miniMeta}>{(LN2 / c.designedLambda).toFixed(0)}{t('d half-life', ' ngày bán rã')}</div>
                </div>
              </div>

              {proposal ? (
                <div style={proposalBlock}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={statusPill(proposal.status || 'unknown')}>{proposal.status || 'unknown'}</span>
                    <span style={metaText}>
                      {t('fit', 'khớp')} {new Date(proposal.fit_timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={miniLabel}>{t('Proposed λ', 'λ đề xuất')}</div>
                      <div style={lambdaMid}>{proposal.learned_lambda.toFixed(4)}</div>
                      {proposal.lambda_ci_lower != null && proposal.lambda_ci_upper != null && (
                        <div style={miniMeta}>{t('95% CI', 'KTC 95%')} [{proposal.lambda_ci_lower.toFixed(4)}, {proposal.lambda_ci_upper.toFixed(4)}]</div>
                      )}
                    </div>
                    <div>
                      <div style={miniLabel}>{t('Evidence', 'Bằng chứng')}</div>
                      <div style={evidenceRow}>
                        <span style={proposal.meets_event_floor ? gatePass : gateFail}>
                          {proposal.n_events}/{EVENT_FLOOR} {t('events', 'sự kiện')}
                        </span>
                      </div>
                      <div style={evidenceRow}>
                        <span style={proposal.ci_narrow_enough ? gatePass : gateFail}>
                          {t('CI rel-w', 'độ rộng KTC')} {proposal.ci_relative_width != null ? proposal.ci_relative_width.toFixed(2) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {proposal.notes && (
                    <div style={notesText}>{proposal.notes}</div>
                  )}

                  {proposal.status === 'proposed' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button
                        onClick={() => setPending({ id: proposal.id, action: 'accept', lambda: proposal.learned_lambda, category: c.category })}
                        disabled={busyId === proposal.id}
                        style={btnAccept}
                      >
                        {busyId === proposal.id ? '…' : `${t('Accept · promote', 'Chấp nhận · nâng cấp')} ${proposal.learned_lambda.toFixed(4)}`}
                      </button>
                      <button
                        onClick={() => setPending({ id: proposal.id, action: 'reject', lambda: proposal.learned_lambda, category: c.category })}
                        disabled={busyId === proposal.id}
                        style={btnReject}
                      >
                        {t('Reject', 'Từ chối')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={noProposalBlock}>
                  {t('No proposal yet — fit will write one on the next run.', 'Chưa có đề xuất — bước khớp sẽ ghi một đề xuất ở lần chạy tới.')}
                </div>
              )}

              {c.history.length > 1 && (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : c.category)}
                    style={btnGhostSmall}
                  >
                    {isOpen ? t('Hide history', 'Ẩn lịch sử') : `${t('History', 'Lịch sử')} · ${c.history.length}`}
                  </button>
                  {isOpen && (
                    <div style={historyTable}>
                      {c.history.map(h => (
                        <div key={h.id} style={historyRow}>
                          <span style={statusPill(h.status || 'unknown')}>{h.status || 'unknown'}</span>
                          <span style={metaText}>{new Date(h.fit_timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                          <span style={{ ...metaText, marginLeft: 'auto' }}>
                            λ={h.learned_lambda.toFixed(4)} · d={h.n_events}/{h.n_observations}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {data.decisions.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={sectionTitle}>{t('Recent decisions', 'Quyết định gần đây')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {data.decisions.map(d => (
              <div key={d.decision_id} style={decisionRow}>
                <span style={d.decision === 'accept' ? acceptPill : rejectPill}>{d.decision}</span>
                <span style={{ color: '#E5D4C2', fontFamily: monoFamily, fontSize: 12 }}>{d.category}</span>
                <span style={metaText}>
                  {d.previous_lambda != null ? d.previous_lambda.toFixed(4) : '—'} → {d.new_lambda != null ? d.new_lambda.toFixed(4) : '—'}
                </span>
                <span style={{ ...metaText, marginLeft: 'auto' }}>
                  {d.decided_by} · {new Date(d.decided_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!pending}
        tone={pending?.action === 'accept' ? 'success' : 'danger'}
        eyebrow={pending?.action === 'accept' ? t('✓ PROMOTE λ', '✓ NÂNG CẤP λ') : t('⚠ REJECT PROPOSAL', '⚠ TỪ CHỐI ĐỀ XUẤT')}
        title={pending?.action === 'accept' ? t('Promote this λ to active?', 'Nâng cấp λ này lên trạng thái hoạt động?') : t('Reject this proposal?', 'Từ chối đề xuất này?')}
        subject={pending ? `${pending.category} · λ ${pending.lambda.toFixed(4)}` : undefined}
        body={pending?.action === 'accept'
          ? t('This becomes the live category baseline for all new preference extractions. Existing scores are unaffected; only future extractions inherit the learned λ.', 'Giá trị này trở thành đường cơ sở trực tiếp của hạng mục cho mọi lần trích xuất sở thích mới. Các điểm số hiện có không bị ảnh hưởng; chỉ các lần trích xuất trong tương lai kế thừa λ đã học.')
          : t('The proposal will not be promoted. The live decay constant stays as it is, and the row is marked rejected in the audit trail.', 'Đề xuất sẽ không được nâng cấp. Hằng số suy giảm trực tiếp giữ nguyên, và dòng này được đánh dấu từ chối trong nhật ký kiểm toán.')}
        confirmLabel={pending?.action === 'accept' ? `${t('Promote', 'Nâng cấp')} ${pending.lambda.toFixed(4)}` : t('Reject proposal', 'Từ chối đề xuất')}
        busyLabel={t('Working…', 'Đang xử lý…')}
        busy={!!busyId}
        onCancel={closeConfirm}
        onConfirm={runDecision}
      />
    </>
  )
}

const LN2 = Math.LN2
const monoFamily = "'Google Sans Code', monospace"

function statusPill(s: string): React.CSSProperties {
  const palette: Record<string, { fg: string; bg: string; bd: string }> = {
    proposed:          { fg: '#D4B85A', bg: 'rgba(212,184,90,0.16)', bd: 'rgba(212,184,90,0.40)' },
    active:            { fg: '#7AB07A', bg: 'rgba(122,176,122,0.16)', bd: 'rgba(122,176,122,0.40)' },
    insufficient_data: { fg: '#9E8FC4', bg: 'rgba(158,143,196,0.10)', bd: 'rgba(158,143,196,0.30)' },
    rejected:          { fg: '#7E7864', bg: 'rgba(229,212,194,0.04)', bd: 'rgba(229,212,194,0.10)' },
    superseded:        { fg: '#7E7864', bg: 'rgba(229,212,194,0.04)', bd: 'rgba(229,212,194,0.10)' },
    unknown:           { fg: '#7E7864', bg: 'rgba(229,212,194,0.04)', bd: 'rgba(229,212,194,0.10)' },
  }
  const p = palette[s] || palette.unknown
  return {
    background: p.bg, color: p.fg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '2px 8px',
    fontFamily: monoFamily, fontSize: 9,
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  }
}

const eyebrow: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 32, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: '4px 0 8px',
}
const lede: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 860, margin: 0,
}
const sectionTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: 0,
}
const card: React.CSSProperties = {
  padding: 16,
  background: 'rgba(229,212,194,0.03)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 8,
}
const categoryTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const lambdaRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
  padding: '10px 0', borderBottom: '1px solid rgba(229,212,194,0.06)',
}
const lambdaBig: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 20, color: '#E5D4C2', letterSpacing: '0.04em',
}
const lambdaMid: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 16, color: '#D4B85A', letterSpacing: '0.04em',
}
const lambdaSmall: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 14, color: '#B2AA98', letterSpacing: '0.04em',
}
const miniLabel: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 9,
  color: '#7E7864', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 4,
}
const miniMeta: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 10, color: '#7E7864', marginTop: 2,
}
const metaText: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 11, color: '#7E7864',
}
const proposalBlock: React.CSSProperties = {
  marginTop: 12, padding: 12,
  background: 'rgba(212,184,90,0.04)', border: '1px solid rgba(212,184,90,0.18)',
  borderRadius: 6,
}
const noProposalBlock: React.CSSProperties = {
  marginTop: 12, padding: '10px 12px',
  background: 'rgba(229,212,194,0.02)', border: '1px dashed rgba(229,212,194,0.10)',
  borderRadius: 6,
  fontFamily: monoFamily, fontSize: 11, color: '#7E7864', fontStyle: 'italic',
}
const notesText: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 10, color: '#7E7864',
  lineHeight: 1.6, padding: '6px 0', borderTop: '1px solid rgba(229,212,194,0.06)',
}
const evidenceRow: React.CSSProperties = {
  fontFamily: monoFamily, fontSize: 11, marginTop: 4,
}
const gatePass: React.CSSProperties = {
  color: '#7AB07A', fontFamily: monoFamily, fontSize: 11,
}
const gateFail: React.CSSProperties = {
  color: '#C27070', fontFamily: monoFamily, fontSize: 11,
}
const activePill: React.CSSProperties = {
  background: 'rgba(122,176,122,0.16)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.40)', borderRadius: 3,
  padding: '2px 8px',
  fontFamily: monoFamily, fontSize: 9,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}
const designedPill: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 3,
  padding: '2px 8px',
  fontFamily: monoFamily, fontSize: 9,
  letterSpacing: '0.08em', textTransform: 'uppercase',
}
const acceptPill: React.CSSProperties = {
  ...activePill, fontWeight: 600,
}
const rejectPill: React.CSSProperties = {
  ...designedPill, color: '#C27070', borderColor: 'rgba(194,112,112,0.35)', background: 'rgba(194,112,112,0.08)',
}
const btnAccept: React.CSSProperties = {
  background: 'rgba(122,176,122,0.18)', color: '#7AB07A',
  border: '1px solid rgba(122,176,122,0.40)', borderRadius: 4,
  padding: '6px 12px', fontFamily: monoFamily,
  fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer',
}
const btnReject: React.CSSProperties = {
  background: 'rgba(229,212,194,0.06)', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 12px', fontFamily: monoFamily,
  fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: '#B2AA98',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '6px 14px', fontFamily: monoFamily,
  fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer',
}
const btnGhostSmall: React.CSSProperties = {
  background: 'transparent', color: '#7E7864',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 4,
  padding: '4px 10px', fontFamily: monoFamily,
  fontSize: 9, letterSpacing: '0.06em', cursor: 'pointer',
}
const historyTable: React.CSSProperties = {
  marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4,
}
const historyRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '4px 0',
  borderBottom: '1px solid rgba(229,212,194,0.04)',
}
const decisionRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 12px',
  background: 'rgba(229,212,194,0.02)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 6,
}
const emptyText: React.CSSProperties = {
  padding: '32px 0', textAlign: 'center',
  fontFamily: monoFamily, fontSize: 12,
  color: '#B2AA98', opacity: 0.6, fontStyle: 'italic',
}
const emptyBlock: React.CSSProperties = {
  padding: '40px 32px', marginBottom: 18,
  fontFamily: monoFamily, fontSize: 12, color: '#B2AA98',
  background: 'rgba(229,212,194,0.02)', border: '1px solid rgba(229,212,194,0.06)',
  borderRadius: 8, maxWidth: 760,
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: monoFamily, fontSize: 11,
}
const infoBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(122,176,122,0.10)', border: '1px solid rgba(122,176,122,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: monoFamily, fontSize: 11,
}
