'use client'

import { useEffect, useState } from 'react'
import LegalPage from '@/components/LegalPage'
import LangToggle from '@/components/LangToggle'
import { useLang } from '@/lib/lang'

// THE PRIVACY NOTICE — the real one, from the register.
//
// This page was 64 lines of English hardcoded here, headed "Last updated: March
// 2026", under the title "Privacy Policy". None of that was true any more. The
// club's actual notice is "What We Keep, and Why", v1.1, effective 9 September
// 2026, held in terms_versions in English AND Vietnamese — and it is the
// document members were asked to consent to.
//
// So the public page and the members' copy were two different documents, and
// the one facing the street was the stale one, in a language half the
// membership does not read.
//
// ── IT FOLLOWS THE REGISTER NOW ───────────────────────────────────────────
// Whatever version the register says is current is what this prints, with the
// effective date from the row rather than a string somebody has to remember to
// edit. Publishing the next version updates this page, which is the whole point
// — the Snug has to come out of this notice, and that must not need a deploy.
//
// ── THE FALLBACK RULE ─────────────────────────────────────────────────────
// A missing Vietnamese body falls back to English, never to a blank page. The
// route does that so every surface gets the same answer; the switch is only
// offered when there really is a Vietnamese text.

interface Doc {
  version: string
  effective_date: string | null
  title_en: string | null
  title_vn: string | null
  html_en: string
  html_vn: string
  has_vn: boolean
}

export default function PrivacyPage() {
  const { t, lang } = useLang()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/legal/privacy')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no'))))
      .then(setDoc)
      .catch(() => setFailed(true))
  }, [])

  const vn = lang === 'vn'
  const title = (vn ? doc?.title_vn : doc?.title_en) || doc?.title_en
    || t('What We Keep, and Why', 'Những Gì Chúng Tôi Lưu Giữ, và Vì Sao')

  // The date the notice took effect, in the reader's language. Not "last
  // updated": a legal notice has an effective date, and the two are different
  // claims.
  const when = doc?.effective_date
    ? new Date(doc.effective_date + 'T00:00:00').toLocaleDateString(vn ? 'vi-VN' : 'en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const meta = when
    ? t(`In effect from ${when} · v${doc?.version}`, `Có hiệu lực từ ${when} · v${doc?.version}`)
    : t('Loading…', 'Đang tải…')

  return (
    <LegalPage
      title={title}
      subtitle={vn ? (doc?.title_en || 'What We Keep, and Why') : (doc?.title_vn || 'Những Gì Chúng Tôi Lưu Giữ, và Vì Sao')}
      lastUpdated={meta}
      lang={doc?.has_vn ? <LangToggle /> : undefined}
      html={
        failed
          ? `<p>${t('The notice could not be loaded just now. It is also in your member portal, and we will send it on request.',
                    'Hiện chưa tải được thông báo này. Thông báo cũng có trong cổng hội viên, và chúng tôi sẽ gửi khi quý vị yêu cầu.')}</p>`
          : doc
            ? (vn ? doc.html_vn : doc.html_en)
            // Deliberately a single quiet line rather than a skeleton: this is
            // one block of text that arrives all at once, and a shimmer
            // pretending to be fifteen clauses is a worse wait than a word.
            : `<p>${t('Fetching the notice…', 'Đang tải thông báo…')}</p>`
      }
    />
  )
}
