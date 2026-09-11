'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { HouseRule } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import { useLang, pick } from '@/lib/lang'

export default function RulesPage() {
  const { t, lang } = useLang()
  const [rules, setRules] = useState<HouseRule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.from('house_rules').select('*').order('sort_order')
      .then(({ data }) => { if (data) setRules(data); setLoading(false) })
  }, [])

  return (
    <>
      <MemberPage
        title="House Rules"
        subtitle="Nội Quy Câu Lạc Bộ"
        description={t('The following rules are observed by all members of The Rampant Club. Ignorance is not a defence, though it is occasionally an explanation.', 'Mọi hội viên của The Rampant Club đều tuân thủ những nội quy dưới đây. Không biết không phải là lý do bào chữa, dù đôi khi là một lời giải thích.')}
      >
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {loading ? (
          <p className="hr-quiet">{t('Loading...', 'Đang tải...')}</p>
        ) : (
          <div className="hr-grid">
            {/* The rules, listed in the margin on a desk. */}
            <nav className="hr-toc" aria-label={t('House Rules', 'Nội Quy Câu Lạc Bộ')}>
              <ol>
                {rules.map(r => (
                  <li key={r.id}><a href={`#rule-${r.id}`}><span>{pick(lang, r.section_title, r.section_title_vn)}</span></a></li>
                ))}
              </ol>
            </nav>

            {/* …and set out in full on a sheet of the house paper. */}
            <div>
              <article className="hr-sheet">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo-mark.svg" alt="" aria-hidden="true" className="hr-seal" />
                {rules.map(r => (
                  <section key={r.id} id={`rule-${r.id}`} className="hr-rule">
                    <h2 className="hr-h">
                      {pick(lang, r.section_title, r.section_title_vn)}
                    </h2>
                    {/* The other language, demoted — as the page title does. */}
                    {r.section_title_vn && (
                      <div className="hr-alt">
                        {lang === 'vn' ? r.section_title : r.section_title_vn}
                      </div>
                    )}
                    <p className="hr-p">
                      {r.body}
                    </p>
                  </section>
                ))}
              </article>

              <Link href="/members/terms" className="pk-cta hr-cta">
                {t('Full Terms & Conditions →', 'Toàn bộ Điều khoản & Điều kiện →').replace(/\s*→$/, '')} <span className="pk-go">→</span>
              </Link>
            </div>
          </div>
        )}
      </MemberPage>
    </>
  )
}

const MONO = "'Google Sans Code', 'DM Mono', monospace"
const SERIF = "'Rampant Sans', serif"
const PAPER = '#F3E9DA'
const INK = '#052E20'

const CSS = `
  @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
  .hr-quiet { font-family: ${MONO}; font-size: 14px; line-height: 1.95; color: #E5D4C2; opacity: .8; margin: 0; }
  .hr-grid { display: grid; grid-template-columns: 220px minmax(0, 780px); gap: 64px; align-items: start; }

  .hr-toc { position: sticky; top: 110px; padding-top: 8px; }
  .hr-toc ol { list-style: none; margin: 0; padding: 0; counter-reset: hrt; }
  .hr-toc li { counter-increment: hrt; }
  .hr-toc a { display: grid; grid-template-columns: 30px 1fr; gap: 6px; padding: 8px 0; color: #E5D4C2; text-decoration: none;
              font-family: ${MONO}; font-size: 12.5px; line-height: 1.55; opacity: .72; transition: opacity .3s ease; }
  .hr-toc a::before { content: counter(hrt, decimal-leading-zero); font-size: 11px; letter-spacing: .1em; padding-top: 1px; color: #D4B85A; }
  .hr-toc a span { background: linear-gradient(currentColor, currentColor) 0 100% / 0 1px no-repeat; padding-bottom: 2px;
                   transition: background-size .45s cubic-bezier(.16,.84,.44,1); }
  .hr-toc a:hover { opacity: 1; }
  .hr-toc a:hover span { background-size: 100% 1px; }

  .hr-sheet { position: relative; background: ${PAPER}; color: ${INK}; border-radius: 4px;
              padding: clamp(40px, 5.5vw, 76px) clamp(24px, 6vw, 80px) clamp(40px, 5vw, 68px);
              box-shadow: 0 34px 80px rgba(0,0,0,.38), 0 10px 24px rgba(0,0,0,.22); }
  /* a hairline inset, like a letterhead */
  .hr-sheet::before { content: ''; position: absolute; inset: 12px; border: 1px solid rgba(5,46,32,.13); border-radius: 2px; pointer-events: none; }
  .hr-seal { position: absolute; top: clamp(28px, 4vw, 44px); right: clamp(28px, 4.5vw, 52px); width: 34px; opacity: .85; }

  .hr-rule { scroll-margin-top: 110px; }
  .hr-rule + .hr-rule { margin-top: 60px; }
  .hr-h { font-family: ${SERIF}; font-weight: 400; font-size: clamp(28px, 3.2vw, 42px); line-height: 1; margin: 0; padding-right: 48px; }
  .hr-alt { font-family: ${SERIF}; font-size: clamp(17px, 1.7vw, 20px); line-height: 1.2; opacity: .58; margin-top: 8px; }
  .hr-p { font-family: ${MONO}; font-size: 13.5px; line-height: 2; margin: 20px 0 0; opacity: .9; }
  .hr-rule:first-of-type .hr-p::first-letter { font-family: ${SERIF}; float: left; font-size: 64px; line-height: .82; margin: 7px 6px 0 0; }

  .pk-cta.hr-cta { color: #E5D4C2; margin-top: 44px; }

  @media (max-width: 960px) {
    .hr-grid { grid-template-columns: minmax(0, 1fr); gap: 0; }
    .hr-toc { display: none; }
  }
  @media (max-width: 600px) {
    .hr-sheet { padding: 44px 22px 40px; }
    .hr-sheet::before { inset: 8px; }
    .hr-seal { top: 24px; right: 22px; width: 28px; }
    .hr-rule + .hr-rule { margin-top: 48px; }
  }
`
