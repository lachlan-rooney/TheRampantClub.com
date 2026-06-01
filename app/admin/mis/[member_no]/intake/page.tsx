'use client'

import { use, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'

// MIS Pass 1.5 — Transcript intake UI.
// Stream Claude's extraction live; let the admin review/edit each preference
// in place before committing the batch to the preferences table.

const ALLOWED_C = [1.00, 0.75, 0.50, 0.25]
const ALLOWED_L = [0.000, 0.002, 0.005, 0.010, 0.020]
const ALLOWED_F = [0.8, 1.0, 1.2, 1.5]
const CATEGORIES = [
  'Personal & Lifestyle', 'Food & Beverage', 'Whisky & Beverage',
  'Social & Networking', 'Business & Productivity', 'Wellness & Comfort',
  'Cultural & Intellectual', 'Family & Personal', 'Travel & Global',
]

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
}

interface Usage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

function predictPs(s0: number, c: number, f: number): number {
  // At save time t=0 and the new vc=1 → R=1.0. Visits=0 → M=1.0.
  // PS(t) = min(5, s0 * c * f * R * M).
  return Math.min(5, s0 * c * f * 1.0 * 1.0)
}

export default function MisIntakePage({ params }: { params: Promise<{ member_no: string }> }) {
  const { member_no } = use(params)
  const [memberName, setMemberName] = useState<string>('')
  const [transcript, setTranscript] = useState<string>('')
  const [extracted, setExtracted] = useState<Extracted[]>([])
  const [phase, setPhase] = useState<'idle' | 'streaming' | 'reasoning' | 'done' | 'saving' | 'saved' | 'error'>('idle')
  const [thinkingBuffer, setThinkingBuffer] = useState<string>('')
  const [reasoningTick, setReasoningTick] = useState(0)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [saved, setSaved] = useState<number>(0)
  const abortRef = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  // Resolve the member's name for the heading.
  useEffect(() => {
    fetch('/api/admin/mis/members', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const m = (d.members || []).find((x: { member_no: string; full_name: string }) => x.member_no === member_no)
        if (m) setMemberName(m.full_name)
      })
      .catch(() => {})
  }, [member_no])

  // Auto-scroll the results list as new prefs arrive.
  useEffect(() => {
    if (phase === 'streaming' && resultsRef.current) {
      resultsRef.current.scrollTop = resultsRef.current.scrollHeight
    }
  }, [extracted.length, phase])

  const start = useCallback(async () => {
    if (!transcript.trim()) {
      setErrMsg('Paste a transcript first.')
      return
    }
    setErrMsg(null)
    setExtracted([])
    setSaved(0)
    setUsage(null)
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
        throw new Error(txt || `Request failed (${r.status})`)
      }

      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })

        // Parse SSE events: each separated by \n\n, each line either "event: x" or "data: y".
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
        case 'status':
          setPhase('streaming')
          break
        case 'thinking':
          setThinkingBuffer(prev => (prev + String(payload.text || '')).slice(-2000))
          setReasoningTick(t => t + 1)
          break
        case 'preference': {
          const p = payload.pref as Extracted | undefined
          if (!p) return
          setExtracted(prev => [...prev, { ...p, accepted: true, uid: crypto.randomUUID() }])
          break
        }
        case 'partial':
          // Optional: could surface raw streaming text; we suppress for tidiness.
          break
        case 'usage':
          setUsage(payload as unknown as Usage)
          break
        case 'done':
          setPhase('done')
          break
        case 'error':
          setErrMsg(String(payload.message || 'Unknown error'))
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
    setExtracted(prev => prev.map(p => p.uid === uid ? { ...p, ...patch } : p))
  }
  const removePref = (uid: string) => {
    setExtracted(prev => prev.filter(p => p.uid !== uid))
  }
  const acceptedCount = useMemo(() => extracted.filter(p => p.accepted).length, [extracted])

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
    }))
    if (payload.length === 0) {
      setErrMsg('Nothing selected to save.')
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
      if (!r.ok) throw new Error(j.error || `Save failed (${r.status})`)
      setSaved(Number(j.inserted) || payload.length)
      setPhase('saved')
    } catch (e) {
      setErrMsg((e as Error).message)
      setPhase('done')
    }
  }, [member_no, extracted])

  return (
    <>
      <Link href={`/admin/mis/${member_no}`} style={backLink}>← Back to profile</Link>

      <div style={headerRow}>
        <div>
          <div style={eyebrow}>Interview intake · {member_no}</div>
          <h1 style={pageTitle}>{memberName || 'Loading…'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#B2AA98' }}>
          <span>Extracted: <span style={{ color: '#E5D4C2' }}>{extracted.length}</span></span>
          <span>Selected: <span style={{ color: '#D4B85A' }}>{acceptedCount}</span></span>
        </div>
      </div>

      <p style={lede}>
        Paste an interview transcript below and Claude Opus 4.7 will extract preferences live,
        scoring each one against the §2 derivation rules from the spec. Review, edit, and
        commit — anything rejected is discarded, anything accepted lands in the member&rsquo;s
        live profile.
      </p>

      {/* Transcript input */}
      <div style={inputPanel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={panelLabel}>Transcript</div>
          <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.6 }}>
            {transcript.length.toLocaleString()} chars · ~{Math.round(transcript.length / 4).toLocaleString()} tokens
          </div>
        </div>
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder="Paste the transcript here. Stage directions in [brackets] like [Firmly] or [Laughs] are read for the cadence-aware adjustments."
          rows={10}
          style={textareaStyle}
          disabled={phase === 'streaming' || phase === 'saving'}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          {phase === 'streaming' || phase === 'reasoning' ? (
            <button onClick={cancel} style={btnGhost}>Cancel</button>
          ) : (
            <button onClick={start} disabled={!transcript.trim()} style={btnPrimary}>
              {phase === 'done' || phase === 'saved' || phase === 'error' ? 'Re-process transcript' : 'Process transcript'}
            </button>
          )}
        </div>
      </div>

      {/* Live status row */}
      {(phase === 'streaming' || phase === 'reasoning' || (thinkingBuffer && phase !== 'idle')) && (
        <div style={statusRow}>
          <div style={{ ...statusDot, animation: phase === 'streaming' ? 'rc-pulse 1.4s ease-in-out infinite' : 'none' }} />
          <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#D4B85A', letterSpacing: '0.06em' }}>
            {phase === 'streaming' ? 'Claude is reading the transcript…' : phase === 'done' ? 'Finished.' : phase === 'error' ? 'Error.' : 'Working…'}
          </span>
          {thinkingBuffer && (
            <span style={{ marginLeft: 18, fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.7, fontStyle: 'italic', flex: 1 }} title={thinkingBuffer}>
              · {reasoningTick} reasoning steps
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

      {/* Extracted preferences */}
      {extracted.length > 0 && (
        <div ref={resultsRef} style={resultsList}>
          {extracted.map(p => {
            const pred = predictPs(p.s0, p.confidence, p.frequency)
            const healthPct = Math.round((pred / Math.max(p.s0, 1)) * 100)
            return (
              <div key={p.uid} style={{ ...prefCard, opacity: p.accepted ? 1 : 0.35 }}>
                <div style={prefHead}>
                  <div style={{ flex: 1 }}>
                    <div style={prefCategoryBadge}>{p.category}</div>
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
                      <span>Keep</span>
                    </label>
                    <button onClick={() => removePref(p.uid)} title="Discard" style={discardBtn}>×</button>
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
                        placeholder="Detail"
                      />
                    )}
                    {p.verbatim_quote && (
                      <div style={prefQuote}>“{p.verbatim_quote}”</div>
                    )}
                  </div>
                )}

                <div style={prefControls}>
                  <ScoreSelect label="S₀" value={p.s0} options={[1,2,3,4,5]} fmt={v => String(v)} onChange={v => updatePref(p.uid, { s0: v })} accent={p.s0 === 5 ? '#D4B85A' : undefined} />
                  <ScoreSelect label="C" value={p.confidence} options={ALLOWED_C} fmt={v => v.toFixed(2)} onChange={v => updatePref(p.uid, { confidence: v })} />
                  <ScoreSelect label="λ" value={p.lambda} options={ALLOWED_L} fmt={v => v.toFixed(3)} onChange={v => updatePref(p.uid, { lambda: v })} />
                  <ScoreSelect label="F" value={p.frequency} options={ALLOWED_F} fmt={v => v.toFixed(1)} onChange={v => updatePref(p.uid, { frequency: v })} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer actions */}
      {(extracted.length > 0 || usage || phase === 'saved') && (
        <div style={footerBar}>
          {usage && (
            <div style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 10, color: '#B2AA98', opacity: 0.65, letterSpacing: '0.04em' }}>
              {usage.input_tokens.toLocaleString()} in · {usage.output_tokens.toLocaleString()} out
              {usage.cache_read_input_tokens > 0 && ` · ${usage.cache_read_input_tokens.toLocaleString()} cached`}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            {phase === 'saved' && (
              <span style={{ fontFamily: "'Google Sans Code', monospace", fontSize: 11, color: '#7AB07A' }}>
                ✓ Saved {saved} preferences
              </span>
            )}
            {(phase === 'done' || phase === 'error') && (
              <button
                onClick={save}
                disabled={acceptedCount === 0 || phase !== 'done'}
                style={acceptedCount === 0 ? { ...btnPrimary, opacity: 0.4, cursor: 'not-allowed' } : btnPrimary}
              >
                Save {acceptedCount} preference{acceptedCount === 1 ? '' : 's'}
              </button>
            )}
            {phase === 'saving' && (
              <button disabled style={{ ...btnPrimary, opacity: 0.6 }}>Saving…</button>
            )}
            {phase === 'saved' && (
              <Link href={`/admin/mis/${member_no}`} style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>
                Back to profile →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function ScoreSelect({ label, value, options, fmt, onChange, accent }: {
  label: string
  value: number
  options: number[]
  fmt: (n: number) => string
  onChange: (v: number) => void
  accent?: string
}) {
  return (
    <div>
      <div style={ctrlLabel}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ ...ctrlInput, color: accent || '#E5D4C2' }}
      >
        {options.map(o => <option key={o} value={o}>{fmt(o)}</option>)}
      </select>
    </div>
  )
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
  borderRadius: 4, marginBottom: 6,
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
const footerBar: React.CSSProperties = {
  display: 'flex', gap: 14, alignItems: 'center',
  padding: '14px 16px',
  background: 'rgba(5,46,32,0.6)',
  border: '1px solid rgba(229,212,194,0.10)', borderRadius: 8,
  position: 'sticky', bottom: 16, backdropFilter: 'blur(6px)',
}
