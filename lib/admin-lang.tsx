'use client'

// ── COMPATIBILITY SHIM ─────────────────────────────────────────────────────
// This file used to BE the admin language implementation ('en' | 'vi', its own
// localStorage key, its own provider). It is now a re-export of the single
// shared context in lib/lang.tsx, kept because ~55 admin pages import `useLang`
// from here and changing 55 imports to prove a point is not a change, it is
// churn.
//
// The canonical code is now 'vn', not 'vi' — see lib/lang.tsx for why that is
// deliberate and must not be "corrected".
export { useLang, LangProvider as AdminLangProvider, pick, normaliseLang } from './lang'
export type { Lang } from './lang'
