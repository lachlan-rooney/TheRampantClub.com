'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

// ═══════════════════════════════════════════════════════════════════════════
// THE LANGUAGE CONTEXT — one implementation, for every surface.
// ───────────────────────────────────────────────────────────────────────────
// There were THREE, which is the same drift that put four names on
// /members/events:
//   · lib/admin-lang.tsx        'en' | 'vi', localStorage 'admin_lang'
//   · components/PortalGuide    'en' | 'vn', localStorage 'rampant.welcome.lang.v1'
//   · app/members/agree         'en' | 'vn', component state, not persisted
//
// 'vn' IS CANONICAL AND THAT IS DELIBERATE — DO NOT "FIX" IT TO 'vi'.
// 'vi' is the correct ISO 639-1 code for Vietnamese and 'vn' is the country
// code, so the technically-right answer is the one we are NOT using. The
// database has already voted: 84 `_vn` columns and zero `_vi`. Renaming 84
// columns to satisfy a standard nobody reads is not worth it; changing one
// TypeScript union is. Both spellings are accepted on the way IN so no caller
// has to translate its own language code.
export type Lang = 'en' | 'vn'

const KEY = 'trc_lang'
// Read-and-forget: a staff member who chose Vietnamese keeps it, and a member
// who used the welcome guide keeps theirs. Without this migration the validator
// rejects 'vi' and silently flips them back to English.
const LEGACY_KEYS = ['admin_lang', 'rampant.welcome.lang.v1']

export const normaliseLang = (v: string | null | undefined): Lang | null =>
  v === 'en' ? 'en' : (v === 'vn' || v === 'vi') ? 'vn' : null

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  /** t(english, vietnamese) — inline, not a keyed dictionary. */
  t: (en: string, vn: string) => string
}
const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {}, t: en => en })

const EVENT = 'trc-lang'

export function LangProvider({ children }: { children: ReactNode }) {
  // SSR and first paint are always 'en' so there is no hydration mismatch; the
  // stored choice is applied in the effect below.
  const [lang, setLangState] = useState<Lang>('en')
  const pathname = usePathname()

  // ── THE KIOSK RULE ────────────────────────────────────────────────────────
  // A room tablet is shared and bolted down. A language choice there is
  // per-session and must never outlive the member who made it, or the next
  // member finds the tablet in someone else's language. So on /kiosk the choice
  // lives in React state only — never read from, never written to, storage.
  const ephemeral = pathname === '/kiosk' || (pathname?.startsWith('/kiosk/') ?? false)

  useEffect(() => {
    if (ephemeral) return
    try {
      const direct = normaliseLang(localStorage.getItem(KEY))
      if (direct) { setLangState(direct); return }
      for (const k of LEGACY_KEYS) {
        const migrated = normaliseLang(localStorage.getItem(k))
        if (migrated) { setLangState(migrated); localStorage.setItem(KEY, migrated); return }
      }
    } catch { /* private mode, blocked storage — English is a fine default */ }
  }, [ephemeral])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    if (!ephemeral) { try { localStorage.setItem(KEY, l) } catch { /* ignore */ } }
    // Other mounted trees in the same tab (the admin sidebar, the portal guide).
    try { window.dispatchEvent(new CustomEvent(EVENT, { detail: l })) } catch { /* ignore */ }
  }, [ephemeral])

  useEffect(() => {
    const onLang = (e: Event) => {
      const l = normaliseLang((e as CustomEvent).detail)
      if (l) setLangState(l)
    }
    window.addEventListener(EVENT, onLang)
    // The old admin event name, so a stale tree mid-deploy still follows along.
    window.addEventListener('admin-lang', onLang)
    return () => {
      window.removeEventListener(EVENT, onLang)
      window.removeEventListener('admin-lang', onLang)
    }
  }, [])

  const t = useCallback((en: string, vn: string) => (lang === 'vn' ? (vn || en) : en), [lang])

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export const useLang = () => useContext(Ctx)

// ── THE FALLBACK RULE, in one place ────────────────────────────────────────
// Most `_vn` columns are nullable. A member reading Vietnamese who hits an
// untranslated row must see the ENGLISH, never an empty card. Anything picking
// between a pair of columns goes through here.
export const pick = (lang: Lang, en: string | null | undefined, vn: string | null | undefined): string =>
  (lang === 'vn' ? (vn?.trim() || en?.trim()) : (en?.trim() || vn?.trim())) || ''
