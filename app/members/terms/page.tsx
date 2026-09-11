'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/lang'
import MemberPage from '@/components/MemberPage'
import { Skeleton } from '@/components/members/Skeleton'

// ── THE MEMBERSHIP AGREEMENT, FROM THE REGISTER ────────────────────────────
// This page used to render 24 articles hardcoded in this file, unchanged since
// the original build and connected to nothing. It showed text no member had
// signed, referencing Schedules that do not exist. Those articles are a distinct
// document and are preserved in docs/rules-of-membership-PRESERVED.md pending a
// decision; they are not lost, they are just not this.
//
// The body now comes from terms_versions via /api/members/documents — the same
// source the consent gate reads, so the page and the gate cannot drift. No
// document text lives in the app.
//
// The agreement is satisfied_by='signature': it is shown READ-ONLY here, and is
// never agreed on this page. my_consent_state() returns needs_action=false for
// signature documents, so nothing about this page can gate a member.

interface Doc {
  doc_key: string
  name_en: string | null; name_vn: string | null
  version: string | null; effective_date: string | null
  html_en: string | null; html_vn: string | null
}

export default function TermsPage() {
  const { lang, setLang } = useLang()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/members/documents', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setDoc((d.documents || []).find((x: Doc) => x.doc_key === 'membership_terms') || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // THE FALLBACK RULE: a missing Vietnamese body falls back to English, never to
  // blank. Most _vn columns are nullable and a member reading VN must never be
  // handed an empty page.
  const html = lang === 'vn' ? (doc?.html_vn || doc?.html_en) : doc?.html_en

  const tab = (l: 'en' | 'vn', label: string) => (
    <button
      onClick={() => setLang(l)}
      className={`tm-tab ${lang === l ? 'is-on' : ''}`}
      aria-pressed={lang === l}
    >{label}</button>
  )

  return (
    <MemberPage
      // English title + Vietnamese subtitle: MemberPage itself promotes the
      // Vietnamese in VN mode. Passing name_vn as the title too printed it twice.
      title={doc?.name_en || 'Membership Agreement'}
      subtitle={doc?.name_vn || 'Thỏa Thuận Thành Viên'}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="tm-col">
        <div className="tm-tabs">
          {tab('en', 'EN')}{tab('vn', 'VN')}
        </div>

        <p className="tm-prevails">
          {lang === 'en'
            ? 'This document is prepared in both English and Vietnamese. In the event of any discrepancy, the English version shall prevail.'
            : 'Văn bản này được lập bằng cả tiếng Anh và tiếng Việt. Trong trường hợp có sự khác biệt, phiên bản tiếng Anh sẽ được ưu tiên áp dụng.'}
        </p>

        {loading ? (
          <div className="tm-skel">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} height={11} width={i % 4 === 3 ? '62%' : '100%'} radius={4} />
            ))}
          </div>
        ) : !html ? (
          <p className="tm-quiet">
            {lang === 'en'
              ? 'The agreement is not published yet. Please ask the Membership Team.'
              : 'Thỏa thuận chưa được công bố. Vui lòng liên hệ Bộ phận Thành viên.'}
          </p>
        ) : (
          // The agreement, set on a sheet of the house paper.
          <article className="tm-sheet">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-mark.svg" alt="" aria-hidden="true" className="tm-seal" />
            <div className="trc-doc" dangerouslySetInnerHTML={{ __html: html }} />
            {doc?.version && (
              <p className="tm-version">
                {lang === 'en' ? 'Version' : 'Phiên bản'} {doc.version}
                {doc.effective_date ? ` · ${lang === 'en' ? 'effective' : 'hiệu lực'} ${doc.effective_date}` : ''}
              </p>
            )}
          </article>
        )}
      </div>
    </MemberPage>
  )
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const PAPER = '#F3E9DA'
const INK = '#052E20'

const CSS = `
  .tm-col { max-width: 860px; }
  .tm-tabs { display: flex; gap: 26px; }
  .tm-tab { position: relative; background: none; border: none; padding: 0 0 7px; cursor: pointer; color: #E5D4C2;
            font-family: ${MONO}; font-size: 12px; letter-spacing: .18em; opacity: .55; transition: opacity .3s ease; }
  .tm-tab::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.5px; background: #D4B85A;
                   transform: scaleX(0); transform-origin: left; transition: transform .45s cubic-bezier(.16,.84,.44,1); }
  .tm-tab:hover { opacity: .85; }
  .tm-tab.is-on { opacity: 1; color: #D4B85A; }
  .tm-tab.is-on::after { transform: scaleX(1); }
  .tm-prevails { font-family: ${MONO}; font-size: 13px; line-height: 1.9; color: #E5D4C2; opacity: .8; max-width: 620px; margin: 22px 0 40px; }
  .tm-quiet { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .8; max-width: 560px; margin: 0; }
  .tm-skel { display: flex; flex-direction: column; gap: 10px; max-width: 760px; }

  .tm-sheet { position: relative; background: ${PAPER}; color: ${INK}; border-radius: 4px;
              padding: clamp(44px, 6vw, 84px) clamp(24px, 6.5vw, 88px) clamp(40px, 5vw, 68px);
              box-shadow: 0 34px 80px rgba(0,0,0,.38), 0 10px 24px rgba(0,0,0,.22); }
  .tm-sheet::before { content: ''; position: absolute; inset: 12px; border: 1px solid rgba(5,46,32,.13); border-radius: 2px; pointer-events: none; }
  .tm-seal { position: absolute; top: clamp(28px, 4vw, 44px); right: clamp(28px, 4.5vw, 52px); width: 34px; opacity: .85; }

  .trc-doc { font-family: ${MONO}; font-size: 13.5px; line-height: 2; overflow-wrap: anywhere; }
  .trc-doc h1 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(34px, 4.6vw, 58px); line-height: .98; margin: 0 0 18px; padding-right: 48px; overflow-wrap: normal; }
  .trc-doc h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(24px, 2.8vw, 32px); line-height: 1.05; margin: 52px 0 16px; overflow-wrap: normal; }
  .trc-doc h3 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(19px, 2vw, 23px); line-height: 1.15; margin: 34px 0 12px; }
  .trc-doc p { margin: 0 0 16px; opacity: .9; }
  .trc-doc ul, .trc-doc ol { margin: 0 0 18px; padding-left: 20px; opacity: .9; }
  .trc-doc li { margin-bottom: 8px; padding-left: 4px; }
  .trc-doc li::marker { color: rgba(5,46,32,.55); }
  .trc-doc em { opacity: .75; }
  .trc-doc strong { font-weight: 600; }
  .trc-doc a { color: inherit; text-underline-offset: 3px; }
  .trc-doc hr { border: none; border-top: 1px solid rgba(5,46,32,.16); margin: 36px 0; }
  .trc-doc table { width: 100%; border-collapse: collapse; margin: 0 0 18px; font-size: 12.5px; line-height: 1.7; }
  .trc-doc td, .trc-doc th { border-top: 1px solid rgba(5,46,32,.16); border-bottom: 1px solid rgba(5,46,32,.16); padding: 10px 12px 10px 0; vertical-align: top; text-align: left; }
  .trc-doc th { font-weight: 600; }

  .tm-version { font-family: ${MONO}; font-size: 12px; letter-spacing: .04em; opacity: .7; margin: 44px 0 0; padding-top: 18px;
                border-top: 1px solid rgba(5,46,32,.16); }

  @media (max-width: 600px) {
    .tm-sheet { padding: 48px 22px 40px; }
    .tm-sheet::before { inset: 8px; }
    .tm-seal { top: 24px; right: 22px; width: 28px; }
    .trc-doc { font-size: 13px; line-height: 1.95; }
  }
  @media (prefers-reduced-motion: reduce) { .tm-tab::after { transition: none; } }
`
