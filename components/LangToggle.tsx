'use client'

import { useLang } from '@/lib/lang'

const MONO = "'Google Sans Code', monospace"

// ═══════════════════════════════════════════════════════════════════════════
// THE EN/VN SWITCH — ONE control, used by admin AND the member portal.
// ───────────────────────────────────────────────────────────────────────────
// It was briefly two: the admin's segmented pill and a member lookalike built
// separately. Two controls for one setting is the same drift as two language
// contexts, one layer up — they diverge visually first and behaviourally later.
// components/admin/LangToggle.tsx now re-exports this.
export default function LangToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang()
  return (
    <div style={{
      display: 'inline-flex', border: '1px solid rgba(229,212,194,0.16)',
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
              background: on ? '#D4B85A' : 'transparent',
              color: on ? '#052E20' : '#B2AA98',
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
