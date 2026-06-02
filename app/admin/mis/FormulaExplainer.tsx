'use client'

import { useState } from 'react'

// Shared collapsible info panel that explains the MIS scoring model in plain
// English. Used on both the member list and member profile pages so the
// language stays consistent — edit it here, both screens update.

interface Props {
  variant?: 'compact' | 'full'
}

export default function FormulaExplainer({ variant = 'compact' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div style={wrap}>
      <button onClick={() => setOpen(o => !o)} style={toggleBtn} aria-expanded={open}>
        <span style={diamond}>◆</span>
        <span style={{ flex: 1 }}>
          {open ? 'Hide explanation' : 'How does this scoring work?'}
        </span>
        <span style={{ opacity: 0.5, fontSize: 14 }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={body}>
          <p style={lede}>
            <b style={{ color: '#E5D4C2' }}>PS(t)</b> — the score next to every preference — is what we think
            that preference is worth <i>right now</i>. It blends six inputs, settles between 0 and 5, and
            updates automatically every day without anyone touching it.
          </p>

          <div style={formulaRow}>
            <span style={formulaText}>
              PS(t) = S<sub>0</sub> &times; C &times; e<sup>(−λt)</sup> &times; F &times; R &times; M
            </span>
          </div>

          <div style={grid}>
            <Variable
              symbol="S₀" name="Importance" range="1–5"
              tldr="How much this matters."
              detail="5 means absolute / non-negotiable (allergies, dietary religion, lifelong identity). 3 is a calm steady preference. 1 is barely an opinion. Most preferences are set at interview and stay fixed; for allergies, dietary rules and identity facts the system locks importance at 5 automatically."
              accent="#D4B85A"
            />
            <Variable
              symbol="C" name="Confidence" range="0.25–1.00"
              tldr="How sure we are."
              detail="1.00 when the member said it explicitly. 0.75 when we've seen the pattern repeat. 0.25 when we're inferring from one-off behaviour. Drags PS(t) down when low."
            />
            <Variable
              symbol="e^(−λt)" name="Decay" range="λ ∈ {0, 0.002, 0.005, 0.010, 0.020}"
              tldr="How quickly stale information loses weight."
              detail="t is days since the preference was last validated. Allergies, dietary rules and identity facts (λ=0) are guaranteed permanent — the system enforces this rather than deciding it case by case — so they never decay. Mood / seasonal (λ=0.020) halves every 35 days; other classes sit between."
            />
            <Variable
              symbol="F" name="Frequency" range="0.8 / 1.0 / 1.2 / 1.5"
              tldr="How often this preference shows up in practice."
              detail="1.0 is the default — relevant about monthly. 1.5 means daily / every visit (amplifies). 0.8 means rarely. Only changes after 3+ months of visit data; for now it stays at 1.0."
              accent="#E5D4C2"
            />
            <Variable
              symbol="R" name="Reinforcement" range="1.0–1.3"
              tldr="Every confirmed re-validation nudges it up."
              detail="Starts at 1.0. Each time we re-check the preference and confirm it, R climbs by 0.075 (capped at 1.3). The more we've checked it, the more it counts."
            />
            <Variable
              symbol="M" name="Member engagement" range="0.8–1.5"
              tldr="How active a member is at the club."
              detail="Based on average visits per month. New members default to 1.0 (no penalty). Frequent visitors (2+ visits/month) amplify; lapsed members (under monthly) get floored at 0.8."
            />
          </div>

          <div style={sectionBreak} />

          <div style={twoCol}>
            <div>
              <h4 style={subhead}>Score Health %</h4>
              <p style={para}>
                <code>PS(t) / S₀ × 100</code>. Tells you how much of the preference's <i>maximum
                importance</i> is left right now. 100% means it's holding firm. Below 70% triggers
                the revalidation flag. Above 100% means an amplifier (F, R, or M) is pushing it past
                the importance ceiling — usually a sign this is a daily-or-better habit.
              </p>
            </div>
            <div>
              <h4 style={subhead}>Revalidation flag <span style={flagOn}>⚠</span></h4>
              <p style={para}>
                Surfaces when <b>any</b> of these are true:
              </p>
              <ul style={list}>
                <li>PS(t) has dropped below 70% of S₀</li>
                <li>more than 180 days since last validation</li>
                <li>S₀ ≥ 4 (important pref) AND more than 90 days</li>
              </ul>
            </div>
          </div>

          {variant === 'full' && (
            <>
              <div style={sectionBreak} />
              <div>
                <h4 style={subhead}>The cap and the floor</h4>
                <p style={para}>
                  PS(t) is clamped to 5 (the readable ceiling) and never goes below 0. With current data
                  (validation_count = 1, no visits yet) <b>R and M sit at 1.0</b>, so PS(t) reproduces the
                  legacy four-variable model exactly. They activate automatically as data accrues — no
                  formula change ever needed.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Variable({ symbol, name, range, tldr, detail, accent = '#B2AA98' }: {
  symbol: string; name: string; range: string; tldr: string; detail: string; accent?: string
}) {
  return (
    <div style={varCard}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ ...varSymbol, color: accent }}>{symbol}</span>
        <span style={varName}>{name}</span>
      </div>
      <div style={varRange}>{range}</div>
      <div style={varTldr}>{tldr}</div>
      <div style={varDetail}>{detail}</div>
    </div>
  )
}

// ── styles ──────────────────────────────────────────────────────────
const wrap: React.CSSProperties = {
  marginBottom: 24,
  border: '1px solid rgba(229,212,194,0.10)',
  borderRadius: 10,
  background: 'rgba(229,212,194,0.03)',
  overflow: 'hidden',
}
const toggleBtn: React.CSSProperties = {
  width: '100%',
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '14px 18px',
  background: 'transparent',
  border: 'none', cursor: 'pointer', textAlign: 'left',
  fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
  color: '#B2AA98', letterSpacing: '0.10em', textTransform: 'uppercase',
}
const diamond: React.CSSProperties = {
  color: '#D4B85A', fontSize: 8, transform: 'translateY(-1px)',
}
const body: React.CSSProperties = {
  padding: '0 22px 26px',
  borderTop: '1px solid rgba(229,212,194,0.08)',
  paddingTop: 22,
}
const lede: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 12,
  color: '#B2AA98', lineHeight: 1.7, margin: '0 0 18px',
  letterSpacing: '0.02em',
}
const formulaRow: React.CSSProperties = {
  textAlign: 'center', margin: '0 0 22px',
  padding: '14px',
  background: 'rgba(5,46,32,0.6)', borderRadius: 6,
  border: '1px solid rgba(212,184,90,0.20)',
}
const formulaText: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const grid: React.CSSProperties = {
  display: 'grid', gap: 12,
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
}
const varCard: React.CSSProperties = {
  padding: '14px 16px',
  background: 'rgba(5,46,32,0.4)',
  border: '1px solid rgba(229,212,194,0.08)',
  borderRadius: 6,
}
const varSymbol: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 18, fontWeight: 600,
}
const varName: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', letterSpacing: '0.04em',
}
const varRange: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 9,
  color: '#B2AA98', opacity: 0.7, letterSpacing: '0.06em',
  marginBottom: 8,
}
const varTldr: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#E5D4C2', lineHeight: 1.5, marginBottom: 6,
}
const varDetail: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 10,
  color: '#B2AA98', opacity: 0.85, lineHeight: 1.6,
}
const sectionBreak: React.CSSProperties = {
  height: 1, background: 'rgba(229,212,194,0.08)',
  margin: '24px 0 20px',
}
const twoCol: React.CSSProperties = {
  display: 'grid', gap: 24,
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
}
const subhead: React.CSSProperties = {
  fontFamily: "'Rampant Sans', serif", fontSize: 14, fontWeight: 500,
  color: '#E5D4C2', margin: '0 0 8px', letterSpacing: '0.02em',
}
const para: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.9, lineHeight: 1.7, margin: 0,
}
const list: React.CSSProperties = {
  fontFamily: "'Google Sans Code', monospace", fontSize: 11,
  color: '#B2AA98', opacity: 0.9, lineHeight: 1.8,
  margin: '6px 0 0', paddingLeft: 18,
}
const flagOn: React.CSSProperties = {
  color: '#D4B85A', marginLeft: 4,
}
