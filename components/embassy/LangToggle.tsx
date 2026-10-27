'use client'

// THE EMBASSY'S LANGUAGE SWITCH — the club's control in Embassy gold.
//
// Forked from components/LangToggle for the same reason the tet components
// are: the colours are baked in, and threading a theme through on the day of
// a live event was not worth the risk to the club's own pages. Behaviour is
// identical; only #D4B85A -> #d2b37f and #052E20 -> #151d2a differ.


import { useLang } from '@/lib/lang'

const MONO = "'Google Sans Code', monospace"

// ═══════════════════════════════════════════════════════════════════════════
// THE EN/VN SWITCH — ONE control, used by admin AND the member portal.
// ───────────────────────────────────────────────────────────────────────────
// It was briefly two: the admin's segmented pill and a member lookalike built
// separately. Two controls for one setting is the same drift as two language
// contexts, one layer up — they diverge visually first and behaviourally later.
// components/admin/LangToggle.tsx now re-exports this.
export default function LangToggle({ compact = false, tone = 'dark' }: { compact?: boolean; tone?: 'dark' | 'light' }) {
  const { lang, setLang } = useLang()
  // 'light' = the same control on a cream public page (2026-09-15, /menus). The
  // dark palette's unselected grey all but disappears on cream; one component
  // with two tones, not a second switch that drifts.
  const light = tone === 'light'
  return (
    <div style={{
      display: 'inline-flex', border: light ? '1px solid rgba(5,46,32,0.28)' : '1px solid rgba(229,212,194,0.16)',
      borderRadius: 20, overflow: 'hidden',
    }}>
      {(['en', 'vn'] as const).map(l => {
        const on = lang === l
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-pressed={on}
            title={l === 'en' ? 'English' : 'Tiếng Việt'}
            style={{
              border: 'none', cursor: 'pointer',
              padding: compact ? '4px 10px' : '5px 12px',
              fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
              background: on ? (light ? '#151d2a' : '#d2b37f') : 'transparent',
              color: on ? (light ? '#E5D4C2' : '#151d2a') : (light ? 'rgba(5,46,32,0.72)' : '#B2AA98'),
              fontWeight: on ? 700 : 400,
            }}
          >
            {l === 'en' ? 'EN' : 'VN'}
          </button>
        )
      })}
    </div>
  )
}
