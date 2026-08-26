'use client'

import { useLang } from '@/lib/admin-lang'

const MONO = "'Google Sans Code', monospace"

// EN/VN switch for the admin top bar. Per-user, remembered.
export default function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <div style={{ display: 'inline-flex', border: '1px solid rgba(229,212,194,0.16)', borderRadius: 20, overflow: 'hidden' }}>
      {(['en', 'vi'] as const).map(l => {
        const on = lang === l
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-pressed={on}
            title={l === 'en' ? 'English' : 'Tiếng Việt'}
            style={{
              border: 'none', cursor: 'pointer', padding: '5px 12px',
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
