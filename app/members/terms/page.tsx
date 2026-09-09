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
      style={{
        fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
        letterSpacing: '0.04em', padding: '6px 20px', borderRadius: 20,
        cursor: 'pointer', transition: 'all 0.2s ease',
        border: lang === l ? '1px solid transparent' : '1px solid rgba(229,212,194,0.2)',
        background: lang === l ? 'rgba(229,212,194,0.12)' : 'transparent',
        color: lang === l ? '#E5D4C2' : '#B2AA98',
      }}
    >{label}</button>
  )

  return (
    <MemberPage
      title={(lang === 'vn' ? doc?.name_vn : doc?.name_en) || doc?.name_en || 'Membership Agreement'}
      subtitle={doc?.name_vn || 'Thỏa Thuận Thành Viên'}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .trc-doc { font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 11.5px; color: #B2AA98; line-height: 1.85; }
        .trc-doc h1 { font-family: 'Rampant Sans', serif; font-size: 20px; color: #E5D4C2; margin: 0 0 6px; font-weight: 600; }
        .trc-doc h2 { font-family: 'Rampant Sans', serif; font-size: 15px; color: #E5D4C2; margin: 32px 0 12px; font-weight: 600; letter-spacing: 0.02em; }
        .trc-doc p { margin: 0 0 10px; text-align: justify; }
        .trc-doc ul { margin: 0 0 12px; padding-left: 18px; }
        .trc-doc li { margin-bottom: 6px; }
        .trc-doc em { color: #B2AA98; opacity: 0.7; }
        .trc-doc strong { color: #E5D4C2; font-weight: 600; }
        .trc-doc table { width: 100%; border-collapse: collapse; margin: 0 0 14px; }
        .trc-doc td, .trc-doc th { border: 1px solid rgba(229,212,194,0.12); padding: 8px 10px; vertical-align: top; text-align: left; }
      ` }} />

      <p style={{
        fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10, color: '#B2AA98',
        opacity: 0.5, fontStyle: 'italic', textAlign: 'center', margin: '0 0 24px',
      }}>
        {lang === 'en'
          ? 'This document is prepared in both English and Vietnamese. In the event of any discrepancy, the English version shall prevail.'
          : 'Văn bản này được lập bằng cả tiếng Anh và tiếng Việt. Trong trường hợp có sự khác biệt, phiên bản tiếng Anh sẽ được ưu tiên áp dụng.'}
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
        {tab('en', 'EN')}{tab('vn', 'VN')}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} height={11} width={i % 4 === 3 ? '62%' : '100%'} radius={4} />
          ))}
        </div>
      ) : !html ? (
        <p style={{
          fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11.5,
          color: '#B2AA98', opacity: 0.7, textAlign: 'center', padding: '40px 0', fontStyle: 'italic',
        }}>
          {lang === 'en'
            ? 'The agreement is not published yet. Please ask the Membership Team.'
            : 'Thỏa thuận chưa được công bố. Vui lòng liên hệ Bộ phận Thành viên.'}
        </p>
      ) : (
        <>
          <div className="trc-doc" dangerouslySetInnerHTML={{ __html: html }} />
          {doc?.version && (
            <p style={{
              fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
              color: '#B2AA98', opacity: 0.45, textAlign: 'center', margin: '36px 0 0',
            }}>
              {lang === 'en' ? 'Version' : 'Phiên bản'} {doc.version}
              {doc.effective_date ? ` · ${lang === 'en' ? 'effective' : 'hiệu lực'} ${doc.effective_date}` : ''}
            </p>
          )}
        </>
      )}
    </MemberPage>
  )
}
