'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Admin bilingual layer. A per-user EN/VN choice, remembered in localStorage, so
// the whole admin portal can be used by Vietnamese teammates. Pages wrap their
// visible strings in t('English', 'Tiếng Việt') — inline (not a keyed dict) so
// the ~30 admin pages can be retrofitted mechanically.

export type Lang = 'en' | 'vi'
const KEY = 'admin_lang'

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (en: string, vi: string) => string }
const Ctx = createContext<LangCtx>({ lang: 'en', setLang: () => {}, t: (en) => en })

export function AdminLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')   // SSR + first paint = 'en' (no hydration mismatch)
  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s === 'vi' || s === 'en') setLangState(s) } catch { /* ignore */ }
  }, [])
  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
    // Notify other mounted trees (e.g. the sidebar) in the same tab.
    try { window.dispatchEvent(new CustomEvent('admin-lang', { detail: l })) } catch { /* ignore */ }
  }
  useEffect(() => {
    const onLang = (e: Event) => { const l = (e as CustomEvent).detail; if (l === 'en' || l === 'vi') setLangState(l) }
    window.addEventListener('admin-lang', onLang)
    return () => window.removeEventListener('admin-lang', onLang)
  }, [])
  const t = (en: string, vi: string) => (lang === 'vi' ? vi : en)
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export const useLang = () => useContext(Ctx)
