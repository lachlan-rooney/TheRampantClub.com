'use client'

import { use, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/admin-lang'

// MIS Pass 4 — Transcript intake UI.
// The stream still emits per-preference 'preference' events for the live
// preview so the admin sees extraction as it happens. When the server-side
// reconcile completes, the route fires a single 'reconciled' event with the
// canonical list + a flush summary; we REPLACE the staged list wholesale
// (no merge — the streamed prefs were a preview, the reconciled payload is
// the truth). Medical-forced rows are rendered as authoritative locks:
// "MEDICAL — LOCKED" badge, disabled S₀/C/λ inputs. Non-medical rows stay
// freely editable.

const ALLOWED_C = [1.00, 0.75, 0.50, 0.25]
const ALLOWED_L = [0.000, 0.002, 0.005, 0.010, 0.020]
const ALLOWED_F = [0.8, 1.0, 1.2, 1.5]

type LambdaOrigin =
  | 'ai_specific'
  | 'category_baseline_learned'
  | 'category_baseline_designed'
  | 'forced_medical'
  | 'forced_identity'
  | 'ai_permanent'

interface Extracted {
  uid: string
  category: string
  subcategory: string | null
  preference_name: string
  detail: string | null
  verbatim_quote: string | null
  s0: number
  confidence: number
  lambda: number
  frequency: number
  accepted: boolean
  lambda_origin: LambdaOrigin | null  // null while a row is still in the live-preview state
}

interface ReconciledPref {
  category: string
  subcategory: string
  preference_name: string
  detail: string
  verbatim_quote: string
  s0: number
  confidence: number
  lambda: number
  frequency: number
  source: 'Interview'
  lambda_origin: LambdaOrigin
}

interface BaselineEntry { baselineLambda: number; source: 'learned' | 'designed' }
interface ReconciledPayload {
  preferences: ReconciledPref[]
  dropped: { reason: string; item: unknown }[]
  medicalForced: number
  identityForced?: number
  aiPermanent?: number
  baselines: Record<string, BaselineEntry>
  raw_count: number
}

interface Usage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

function predictPs(s0: number, c: number, f: number): number {
  // At save time t=0 and the new vc=1 → R=1.0. Visits=0 → M=1.0.
  return Math.min(5, s0 * c * f * 1.0 * 1.0)
}

function lambdaOriginLabel(o: LambdaOrigin | null, t: (en: string, vi: string) => string): { text: string; tone: 'gold' | 'green' | 'grey' | 'red' | 'amber' } {
  switch (o) {
    case 'forced_medical':            return { text: t('MEDICAL — LOCKED', 'Y TẾ — ĐÃ KHÓA'),   tone: 'red'   }
    case 'forced_identity':           return { text: t('IDENTITY — LOCKED', 'DANH TÍNH — ĐÃ KHÓA'),  tone: 'gold'  }
    case 'ai_permanent':              return { text: t('PERMANENT — LOCKED', 'VĨNH VIỄN — ĐÃ KHÓA'), tone: 'amber' }
    case 'ai_specific':               return { text: t('AI · specific', 'AI · cụ thể'),      tone: 'gold'  }
    case 'category_baseline_learned': return { text: t('baseline · learned', 'baseline · đã học'), tone: 'green' }
    case 'category_baseline_designed':return { text: t('baseline · designed', 'baseline · thiết kế'), tone: 'grey' }
    default:                          return { text: t('live preview', 'xem trước trực tiếp'),       tone: 'grey'  }
  }
}
function isLockedOrigin(o: LambdaOrigin | null): boolean {
  return o === 'forced_medical' || o === 'forced_identity' || o === 'ai_permanent'
}

export default function MisIntakePage({ params }: { params: Promise<{ member_no: string }> }) {
  const { t } = useLang()
  const { member_no } = use(params)
  const [memberName, setMemberName] = useState<string>('')
  const [transcript, setTranscript] = useState<string>('')
  const [extracted, setExtracted] = useState<Extracted[]>([])
  const [phase, setPhase] = useState<'idle' | 'streaming' | 'reasoning' | 'reconciling' | 'done' | 'saving' | 'saved' | 'error'>('idle')
  const [thinkingBuffer, setThinkingBuffer] = useState<string>('')
  const [reasoningTick, setReasoningTick] = useState(0)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [reconciled, setReconciled] = useState<ReconciledPayload | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ inserted: number; medicalReforced: number; permanentReforced: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/admin/mis/members', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const m = (d.members || []).find((x: { member_no: string; full_name: string }) => x.member_no === member_no)
        if (m) setMemberName(m.full_name)
      })
      .catch(() => {})
  }, [member_no])

  useEffect(() => {
    if (phase === 'streaming' && resultsRef.current) {
      resultsRef.current.scrollTop = resultsRef.current.scrollHeight
    }
  }, [extracted.length, phase])

  const start = useCallback(async () => {
    if (!transcript.trim()) {
      setErrMsg(t('Paste a transcript first.', 'Vui lòng dán bản ghi trước.'))
      return
    }
    setErrMsg(null)
    setExtracted([])
    setSaved(null)
    setUsage(null)
    setReconciled(null)
    setThinkingBuffer('')
    setPhase('streaming')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const r = await fetch('/api/admin/mis/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no, transcript }),
        signal: controller.signal,
      })
      if (!r.ok || !r.body) {
        const txt = await r.text()
        throw new Error(txt || `${t('Request failed', 'Yêu cầu thất bại')} (${r.status})`)
      }

      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })

        let sep = buf.indexOf('\n\n')
        while (sep !== -1) {
          const raw = buf.slice(0, sep)
          buf = buf.slice(sep + 2)
          handleEvent(raw)
          sep = buf.indexOf('\n\n')
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setErrMsg((e as Error).message)
      setPhase('error')
    }

    function handleEvent(raw: string) {
      let evt = 'message'
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) evt = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) return
      let payload: Record<string, unknown>
      try { payload = JSON.parse(data) } catch { return }

      switch (evt) {
        case 'status': {
          const ph = String(payload.phase || '')
          if (ph === 'reconciling') setPhase('reconciling')
          else if (ph === 'starting') setPhase('streaming')
          break
        }
        case 'thinking':
          setThinkingBuffer(prev => (prev + String(payload.text || '')).slice(-2000))
          setReasoningTick(t => t + 1)
          break
        case 'preference': {
          const p = payload.pref as Omit<Extracted, 'uid' | 'accepted' | 'lambda_origin'> | undefined
          if (!p) return
          setExtracted(prev => [...prev, { ...p, accepted: true, uid: crypto.randomUUID(), lambda_origin: null }])
          break
        }
        case 'partial':
          break
        case 'reconciled': {
          // Replace the staged preview wholesale — never merge. The streamed
          // rows were a preview; this payload is the truth.
          const pl = payload as unknown as ReconciledPayload
          setReconciled(pl)
          setExtracted(pl.preferences.map(p => ({
            uid: crypto.randomUUID(),
            category: p.category,
            subcategory: p.subcategory || null,
            preference_name: p.preference_name,
            detail: p.detail || null,
            verbatim_quote: p.verbatim_quote || null,
            s0: p.s0,
            confidence: p.confidence,
            lambda: p.lambda,
            frequency: p.frequency,
            accepted: true,
            lambda_origin: p.lambda_origin,
          })))
          break
        }
        case 'usage':
          setUsage(payload as unknown as Usage)
          break
        case 'done':
          setPhase('done')
          break
        case 'error':
          setErrMsg(String(payload.message || t('Unknown error', 'Lỗi không xác định')))
          setPhase('error')
          break
      }
    }
  }, [member_no, transcript])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setPhase('idle')
  }, [])

  const updatePref = (uid: string, patch: Partial<Extracted>) => {
    setExtracted(prev => prev.map(p => {
      if (p.uid !== uid) return p
      // Locked rows (forced_medical OR ai_permanent) ignore writes to S₀/C/λ —
      // the lock survives the confirm step. Other fields (name, subcategory,
      // detail, accepted) stay editable for context.
      if (isLockedOrigin(p.lambda_origin)) {
        const { s0, confidence, lambda, ...editable } = patch
        void s0; void confidence; void lambda
        return { ...p, ...editable }
      }
      return { ...p, ...patch }
    }))
  }
  const removePref = (uid: string) => {
    setExtracted(prev => prev.filter(p => p.uid !== uid))
  }
  const acceptedCount   = useMemo(() => extracted.filter(p => p.accepted).length, [extracted])
  const medicalCount    = useMemo(() => extracted.filter(p => p.lambda_origin === 'forced_medical').length, [extracted])
  const permanentCount  = useMemo(() => extracted.filter(p => p.lambda_origin === 'ai_permanent').length, [extracted])

  const save = useCallback(async () => {
    const payload = extracted.filter(p => p.accepted).map(p => ({
      category: p.category,
      subcategory: p.subcategory,
      preference_name: p.preference_name,
      detail: p.detail,
      verbatim_quote: p.verbatim_quote,
      s0: p.s0,
      confidence: p.confidence,
      lambda: p.lambda,
      frequency: p.frequency,
      lambda_origin: p.lambda_origin,
    }))
    if (payload.length === 0) {
      setErrMsg(t('Nothing selected to save.', 'Chưa chọn mục nào để lưu.'))
      return
    }
    setErrMsg(null)
    setPhase('saving')
    try {
      const r = await fetch('/api/admin/mis/intake/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_no, preferences: payload }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `${t('Save failed', 'Lưu thất bại')} (${r.status})`)
      setSaved({
        inserted: Number(j.inserted) || payload.length,
        medicalReforced: Number(j.medicalReforced) || 0,
        permanentReforced: Number(j.permanentReforced) || 0,
      })
      setPhase('saved')
    } catch (e) {
      setErrMsg((e as Error).message)
      setPhase('done')
    }
  }, [member_no, extracted])

  // Build the baseline summary phrase for the banner.
  const baselineSummary = useMemo(() => {
    if (!reconciled) return null
    const learned = Object.entries(reconciled.baselines).filter(([, b]) => b.source === 'learned').map(([cat]) => cat)
    if (learned.length === 0) return t('all baselines designed (no learned λ promoted yet)', 'tất cả baseline đều thiết kế (chưa có λ học nào được đề bạt)')
    return `${t('learned', 'đã học')}: ${learned.join(', ')}; ${t('designed: rest', 'thiết kế: phần còn lại')}`
  }, [reconciled])

  return (
    <>
      <Link href={`/admin/mis/${member_no}`} style={backLink}>← {t('Back to profile', 'Quay lại hồ sơ')}</Link>

      <div style={headerRow}>
        <div>
          <div style={eyebrow}>{t('Interview intake', 'Tiếp nhận phỏng vấn')} · {member_no}</div>
          <h1 style={pageTitle}>{memberName || t('Loading…', 'Đang tải…')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98' }}>
          <span>{t('Extracted', 'Đã trích xuất')}: <span style={{ color: '#E5D4C2' }}>{extracted.length}</span></span>
          <span>{t('Selected', 'Đã chọn')}: <span style={{ color: '#D4B85A' }}>{acceptedCount}</span></span>
          {medicalCount > 0   && <span>{t('Medical-locked', 'Khóa y tế')}: <span style={{ color: '#C27070' }}>{medicalCount}</span></span>}
          {permanentCount > 0 && <span>{t('Permanent-locked', 'Khóa vĩnh viễn')}: <span style={{ color: '#D4B85A' }}>{permanentCount}</span></span>}
        </div>
      </div>

      <p style={lede}>
        {t('Paste an interview transcript below and Claude Opus 4.7 will extract preferences live, scoring each one against the live category baselines (learned where promoted, designed otherwise). When the stream ends, a reconciliation pass enforces the medical guardrail in code: any allergy or religious-dietary signal is locked to S₀=5 / C=1.00 / λ=0 and surfaces here as ', 'Dán bản ghi phỏng vấn bên dưới và Claude Opus 4.7 sẽ trích xuất các sở thích trực tiếp, chấm điểm từng mục theo các baseline danh mục hiện hành (đã học nếu được đề bạt, còn lại là thiết kế). Khi luồng kết thúc, một lượt đối chiếu sẽ thực thi rào chắn y tế trong mã: bất kỳ tín hiệu dị ứng hay kiêng khem tôn giáo nào đều bị khóa ở S₀=5 / C=1.00 / λ=0 và hiển thị ở đây dưới dạng ')}
        <code>MEDICAL — LOCKED</code>{t('. You can edit non-medical rows freely; medical-forced rows cannot be weakened. Review, commit.', '. Bạn có thể chỉnh sửa tự do các dòng không thuộc y tế; các dòng bắt buộc y tế không thể bị làm yếu đi. Xem lại, xác nhận.')}
      </p>

      <div style={inputPanel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={panelLabel}>{t('Transcript', 'Bản ghi')}</div>
          <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.6 }}>
            {transcript.length.toLocaleString()} {t('chars', 'ký tự')} · ~{Math.round(transcript.length / 4).toLocaleString()} {t('tokens', 'token')}
          </div>
        </div>
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder={t('Paste the transcript here. Stage directions in [brackets] like [Firmly] or [Laughs] are read for the cadence-aware adjustments.', 'Dán bản ghi vào đây. Các chỉ dẫn diễn xuất trong [dấu ngoặc] như [Firmly] hay [Laughs] được đọc để điều chỉnh theo ngữ điệu.')}
          rows={10}
          style={textareaStyle}
          disabled={phase === 'streaming' || phase === 'reconciling' || phase === 'saving'}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          {phase === 'streaming' || phase === 'reasoning' || phase === 'reconciling' ? (
            <button onClick={cancel} style={btnGhost}>{t('Cancel', 'Hủy')}</button>
          ) : (
            <button onClick={start} disabled={!transcript.trim()} style={btnPrimary}>
              {phase === 'done' || phase === 'saved' || phase === 'error' ? t('Re-process transcript', 'Xử lý lại bản ghi') : t('Process transcript', 'Xử lý bản ghi')}
            </button>
          )}
        </div>
      </div>

      {(phase === 'streaming' || phase === 'reasoning' || phase === 'reconciling' || (thinkingBuffer && phase !== 'idle')) && (
        <div style={statusRow}>
          <div style={{ ...statusDot, animation: phase === 'streaming' || phase === 'reconciling' ? 'rc-pulse 1.4s ease-in-out infinite' : 'none' }} />
          <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#D4B85A', letterSpacing: '0.06em' }}>
            {phase === 'streaming' ? t('Claude is reading the transcript…', 'Claude đang đọc bản ghi…') :
              phase === 'reconciling' ? t('Reconciling — applying medical guardrail and baseline inheritance…', 'Đang đối chiếu — áp dụng rào chắn y tế và kế thừa baseline…') :
              phase === 'done' ? t('Finished.', 'Đã xong.') :
              phase === 'error' ? t('Error.', 'Lỗi.') : t('Working…', 'Đang xử lý…')}
          </span>
          {thinkingBuffer && (
            <span style={{ marginLeft: 18, fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.7, fontStyle: 'italic', flex: 1 }} title={thinkingBuffer}>
              · {reasoningTick} {t('reasoning steps', 'bước suy luận')}
            </span>
          )}
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rc-pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
      ` }} />

      {errMsg && (
        <div style={errorBox}>{errMsg}</div>
      )}

      {reconciled && (
        <div style={banner}>
          <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#E5D4C2', lineHeight: 1.7 }}>
            <strong style={{ color: '#D4B85A' }}>{reconciled.preferences.length}</strong> {t('preference', 'sở thích')}{reconciled.preferences.length === 1 ? '' : 's'}
            {' · '}
            <strong style={{ color: reconciled.medicalForced > 0 ? '#C27070' : '#B2AA98' }}>{reconciled.medicalForced}</strong> {t('medical-forced', 'bắt buộc y tế')}
            {' · '}
            <strong style={{ color: (reconciled.identityForced ?? 0) > 0 ? '#D4B85A' : '#B2AA98' }}>{reconciled.identityForced ?? 0}</strong> {t('identity-locked', 'khóa danh tính')}
            {' · '}
            <strong style={{ color: (reconciled.aiPermanent ?? 0) > 0 ? '#D4B85A' : '#B2AA98' }}>{reconciled.aiPermanent ?? 0}</strong> {t('permanent-locked', 'khóa vĩnh viễn')}
            {' · '}
            <strong style={{ color: reconciled.dropped.length > 0 ? '#B2AA98' : '#7AB07A' }}>{reconciled.dropped.length}</strong> {t('dropped', 'đã loại bỏ')}
            {reconciled.dropped.length > 0 && (
              <span style={{ color: '#B2AA98', opacity: 0.75 }}> ({reconciled.dropped.map(d => d.reason).join(', ')})</span>
            )}
            <div style={{ marginTop: 4, color: '#B2AA98', opacity: 0.8 }}>{t('baselines', 'baseline')}: {baselineSummary}</div>
          </div>
        </div>
      )}

      {extracted.length > 0 && (
        <div ref={resultsRef} style={resultsList}>
          {extracted.map(p => {
            const pred = predictPs(p.s0, p.confidence, p.frequency)
            const healthPct = Math.round((pred / Math.max(p.s0, 1)) * 100)
            const locked = isLockedOrigin(p.lambda_origin)
            const isMedical   = p.lambda_origin === 'forced_medical'
            const isPermanent = p.lambda_origin === 'ai_permanent'
            const ol = lambdaOriginLabel(p.lambda_origin, t)
            return (
              <div key={p.uid} style={{
                ...prefCard,
                opacity: p.accepted ? 1 : 0.35,
                ...(isMedical   ? { borderLeft: '3px solid #C27070' } : {}),
                ...(isPermanent ? { borderLeft: '3px solid #D4B85A' } : {}),
              }}>
                <div style={prefHead}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                      <div style={prefCategoryBadge}>{p.category}</div>
                      <div style={originBadge(ol.tone)}>{ol.text}</div>
                    </div>
                    <input
                      type="text"
                      value={p.preference_name}
                      onChange={e => updatePref(p.uid, { preference_name: e.target.value })}
                      style={prefNameInput}
                    />
                    {p.subcategory && (
                      <div style={prefSubcategory}>{p.subcategory}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={prefScorePreview}>
                      <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 22, color: '#D4B85A', fontWeight: 600 }}>{pred.toFixed(2)}</div>
                      <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 9, color: '#B2AA98', letterSpacing: '0.10em' }}>PS(t) · {healthPct}%</div>
                    </div>
                    <label style={acceptToggle}>
                      <input
                        type="checkbox"
                        checked={p.accepted}
                        onChange={e => updatePref(p.uid, { accepted: e.target.checked })}
                      />
                      <span>{t('Keep', 'Giữ')}</span>
                    </label>
                    <button onClick={() => removePref(p.uid)} title={t('Discard', 'Loại bỏ')} style={discardBtn}>×</button>
                  </div>
                </div>

                {(p.detail || p.verbatim_quote) && (
                  <div style={{ marginTop: 10 }}>
                    {p.detail && (
                      <textarea
                        value={p.detail}
                        onChange={e => updatePref(p.uid, { detail: e.target.value })}
                        rows={2}
                        style={prefDetailInput}
                        placeholder={t('Detail', 'Chi tiết')}
                      />
                    )}
                    {p.verbatim_quote && (
                      <div style={prefQuote}>“{p.verbatim_quote}”</div>
                    )}
                  </div>
                )}

                <div style={prefControls}>
                  <ScoreSelect
                    label="S₀" value={p.s0} options={[1,2,3,4,5]} fmt={v => String(v)}
                    onChange={v => updatePref(p.uid, { s0: v })}
                    accent={p.s0 === 5 ? '#D4B85A' : undefined}
                    disabled={locked}
                  />
                  <ScoreSelect
                    label="C" value={p.confidence} options={ALLOWED_C} fmt={v => v.toFixed(2)}
                    onChange={v => updatePref(p.uid, { confidence: v })}
                    disabled={locked}
                  />
                  <ScoreSelect
                    label="λ" value={p.lambda} options={ALLOWED_L} fmt={v => v.toFixed(3)}
                    onChange={v => updatePref(p.uid, { lambda: v })}
                    disabled={locked}
                  />
                  <ScoreSelect
                    label="F" value={p.frequency} options={ALLOWED_F} fmt={v => v.toFixed(1)}
                    onChange={v => updatePref(p.uid, { frequency: v })}
                  />
                </div>
                {locked && (
                  <div style={isMedical ? lockNote : lockNotePermanent}>
                    {isMedical
                      ? t('Medical signal detected by content-based guardrail. S₀ / C / λ are locked at this row; the medical lock is re-asserted at the save boundary.', 'Tín hiệu y tế được phát hiện bởi rào chắn dựa trên nội dung. S₀ / C / λ bị khóa ở dòng này; khóa y tế được tái áp dụng tại thời điểm lưu.')
                      : t('The AI judged this specific item lifelong (λ=0) — it wasn’t caught by the medical or identity guardrails, so the model’s own call applies here. Same scoring effect as a guardrail lock, reached by judgment rather than rule. S₀ / C / λ are locked and re-asserted at the save boundary.', 'AI đánh giá mục cụ thể này là suốt đời (λ=0) — nó không bị bắt bởi rào chắn y tế hay danh tính, nên phán đoán của chính mô hình được áp dụng ở đây. Cùng hiệu ứng chấm điểm như khóa rào chắn, đạt được bằng phán đoán chứ không phải quy tắc. S₀ / C / λ bị khóa và được tái áp dụng tại thời điểm lưu.')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(extracted.length > 0 || usage || phase === 'saved') && (
        <div style={footerBar}>
          {usage && (
            <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.65, letterSpacing: '0.04em' }}>
              {usage.input_tokens.toLocaleString()} {t('in', 'vào')} · {usage.output_tokens.toLocaleString()} {t('out', 'ra')}
              {usage.cache_read_input_tokens > 0 && ` · ${usage.cache_read_input_tokens.toLocaleString()} ${t('cached', 'đã lưu đệm')}`}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            {phase === 'saved' && saved && (
              <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#7AB07A' }}>
                ✓ {t('Saved', 'Đã lưu')} {saved.inserted} {t('preference', 'sở thích')}{saved.inserted === 1 ? '' : 's'}
                {saved.medicalReforced   > 0 && ` · ${saved.medicalReforced} ${t('medical re-forced at save', 'bắt buộc y tế lại khi lưu')}`}
                {saved.permanentReforced > 0 && ` · ${saved.permanentReforced} ${t('permanent re-locked at save', 'khóa vĩnh viễn lại khi lưu')}`}
              </span>
            )}
            {(phase === 'done' || phase === 'error') && (
              <button
                onClick={save}
                disabled={acceptedCount === 0 || phase !== 'done'}
                style={acceptedCount === 0 ? { ...btnPrimary, opacity: 0.4, cursor: 'not-allowed' } : btnPrimary}
              >
                {t('Save', 'Lưu')} {acceptedCount} {t('preference', 'sở thích')}{acceptedCount === 1 ? '' : 's'}
              </button>
            )}
            {phase === 'saving' && (
              <button disabled style={{ ...btnPrimary, opacity: 0.6 }}>{t('Saving…', 'Đang lưu…')}</button>
            )}
            {phase === 'saved' && (
              <Link href={`/admin/mis/${member_no}`} style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>
                {t('Back to profile', 'Quay lại hồ sơ')} →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function ScoreSelect({ label, value, options, fmt, onChange, accent, disabled }: {
  label: string
  value: number
  options: number[]
  fmt: (n: number) => string
  onChange: (v: number) => void
  accent?: string
  disabled?: boolean
}) {
  return (
    <div>
      <div style={ctrlLabel}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        style={{
          ...ctrlInput,
          color: accent || '#E5D4C2',
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {options.map(o => <option key={o} value={o}>{fmt(o)}</option>)}
      </select>
    </div>
  )
}

function originBadge(tone: 'gold' | 'green' | 'grey' | 'red' | 'amber'): React.CSSProperties {
  const p = {
    gold:  { fg: '#D4B85A', bg: 'rgba(212,184,90,0.10)', bd: 'rgba(212,184,90,0.30)' },
    green: { fg: '#7AB07A', bg: 'rgba(122,176,122,0.10)', bd: 'rgba(122,176,122,0.30)' },
    grey:  { fg: '#B2AA98', bg: 'rgba(229,212,194,0.06)', bd: 'rgba(229,212,194,0.16)' },
    red:   { fg: '#C27070', bg: 'rgba(194,112,112,0.12)', bd: 'rgba(194,112,112,0.40)' },
    amber: { fg: '#D4B85A', bg: 'rgba(212,184,90,0.16)', bd: 'rgba(212,184,90,0.50)' },
  }[tone]
  return {
    fontFamily: "'Google Sans Code', monospace", fontSize: 9,
    color: p.fg, background: p.bg, border: `1px solid ${p.bd}`,
    borderRadius: 3, padding: '2px 8px',
    letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  }
}

// ── styles ──────────────────────────────────────────────────────────
const backLink: React.CSSProperties = {
  display: 'inline-block', marginBottom: 20, textDecoration: 'none',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.04em', opacity: 0.7,
}
const headerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  marginBottom: 14, gap: 24, flexWrap: 'wrap',
}
const eyebrow: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
  marginBottom: 4,
}
const pageTitle: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 28, fontWeight: 500,
  color: '#E5D4C2', letterSpacing: '0.04em', margin: 0,
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.7, maxWidth: 760,
  margin: '0 0 28px',
}
const inputPanel: React.CSSProperties = {
  marginBottom: 16, padding: 22,
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10,
}
const panelLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', letterSpacing: '0.16em', textTransform: 'uppercase',
}
const textareaStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: 14, background: 'rgba(5,46,32,0.5)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  lineHeight: 1.6, resize: 'vertical', outline: 'none',
  minHeight: 200,
}
const btnBase: React.CSSProperties = {
  border: 'none', borderRadius: 6, padding: '12px 22px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  letterSpacing: '0.08em', cursor: 'pointer', color: '#E5D4C2',
}
const btnPrimary: React.CSSProperties = { ...btnBase, background: '#5E6650' }
const btnGhost:   React.CSSProperties = { ...btnBase, background: 'rgba(229,212,194,0.10)' }

const statusRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(212,184,90,0.06)',
  border: '1px solid rgba(212,184,90,0.20)', borderRadius: 6,
}
const statusDot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: 4, background: '#D4B85A',
}
const errorBox: React.CSSProperties = {
  marginBottom: 14, padding: '10px 14px',
  background: 'rgba(180,70,70,0.15)', border: '1px solid rgba(180,70,70,0.30)',
  borderRadius: 6, color: '#E5D4C2',
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
}
const banner: React.CSSProperties = {
  marginBottom: 14, padding: '12px 16px',
  background: 'rgba(122,176,122,0.06)',
  border: '1px solid rgba(122,176,122,0.20)', borderRadius: 6,
}
const resultsList: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12,
  marginBottom: 18,
}
const prefCard: React.CSSProperties = {
  padding: 18,
  background: 'rgba(229,212,194,0.04)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 10,
  transition: 'opacity 0.2s ease',
}
const prefHead: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 16,
}
const prefCategoryBadge: React.CSSProperties = {
  display: 'inline-block', padding: '3px 8px',
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#D4B85A', letterSpacing: '0.10em', textTransform: 'uppercase',
  background: 'rgba(212,184,90,0.08)', border: '1px solid rgba(212,184,90,0.20)',
  borderRadius: 4,
}
const prefNameInput: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 500,
  color: '#E5D4C2', background: 'transparent',
  border: 'none', borderBottom: '1px solid transparent',
  width: '100%', padding: '4px 0', outline: 'none',
  letterSpacing: '0.02em',
}
const prefSubcategory: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.7, marginTop: 2,
}
const prefScorePreview: React.CSSProperties = {
  textAlign: 'right', minWidth: 80,
  padding: '6px 12px',
  background: 'rgba(5,46,32,0.4)', borderRadius: 6,
}
const acceptToggle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', cursor: 'pointer', userSelect: 'none',
}
const discardBtn: React.CSSProperties = {
  width: 28, height: 28,
  background: 'transparent', border: '1px solid rgba(229,212,194,0.10)',
  color: '#B2AA98', borderRadius: 4, cursor: 'pointer',
  fontSize: 14, lineHeight: 1, opacity: 0.6,
}
const prefDetailInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', marginBottom: 8,
  background: 'rgba(5,46,32,0.4)', color: '#E5D4C2',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  lineHeight: 1.6, resize: 'vertical', outline: 'none',
}
const prefQuote: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.75, fontStyle: 'italic',
  borderLeft: '2px solid rgba(212,184,90,0.30)',
  paddingLeft: 12, marginTop: 6, lineHeight: 1.6,
}
const prefControls: React.CSSProperties = {
  display: 'grid', gap: 10, marginTop: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
}
const ctrlLabel: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
  marginBottom: 3,
}
const ctrlInput: React.CSSProperties = {
  background: 'rgba(5,46,32,0.5)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 6,
  padding: '7px 8px', fontFamily: "'Google Sans Code', monospace",
  fontSize: 12, width: '100%', boxSizing: 'border-box', outline: 'none',
}
const lockNote: React.CSSProperties = {
  marginTop: 10, padding: '8px 10px',
  background: 'rgba(194,112,112,0.06)',
  border: '1px solid rgba(194,112,112,0.20)', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#C27070', lineHeight: 1.6,
}
const lockNotePermanent: React.CSSProperties = {
  marginTop: 10, padding: '8px 10px',
  background: 'rgba(212,184,90,0.06)',
  border: '1px solid rgba(212,184,90,0.20)', borderRadius: 4,
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#D4B85A', lineHeight: 1.6,
}
const footerBar: React.CSSProperties = {
  display: 'flex', gap: 14, alignItems: 'center',
  padding: '14px 16px',
  background: 'rgba(5,46,32,0.6)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  position: 'sticky', bottom: 16, backdropFilter: 'blur(6px)',
}
