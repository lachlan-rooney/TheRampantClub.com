'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/lang'
import { PublicPage } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

export default function ContactPage() {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)

  const copyEmail = () => {
    navigator.clipboard.writeText('membership@therampantclub.com')
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        /* The same masthead as every member page (components/MemberPage): the
           way back, the title set large, the drawing in the empty half. */
        .ct-wrap { max-width: 1180px; margin: 0 auto; box-sizing: border-box; color: #E5D4C2;
                   padding-left: 24px; padding-right: max(24px, calc(150px - (100vw - 1180px) / 2)); }
        .ct-mast { display: grid; grid-template-columns: minmax(0, 1fr) clamp(150px, 19vw, 250px); gap: 48px; align-items: start;
                   padding-top: 118px; padding-bottom: 64px; }
        .ct-rise { opacity: 0; transform: translateY(22px); animation: pk-rise .9s cubic-bezier(.16,.84,.44,1) both; }

        .contact-back { display: inline-flex; align-items: baseline; gap: 10px; color: #E5D4C2; text-decoration: none;
                        font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 11.5px; letter-spacing: .12em;
                        text-transform: uppercase; border-bottom: 1px solid rgba(229,212,194,.45); padding-bottom: 5px;
                        opacity: .9; transition: opacity .2s ease, border-color .2s ease; }
        .contact-back:hover { opacity: 1; border-bottom-color: #D4B85A; }
        .contact-back .ct-go { display: inline-block; transition: transform .35s ease; }
        .contact-back:hover .ct-go { transform: translateX(-7px); }

        .contact-title { font-family: 'Rampant Sans', serif; font-weight: 400; color: #E5D4C2;
                         font-size: clamp(46px, 7.6vw, 104px); line-height: .92; margin: 34px 0 0; }
        .contact-subtitle { font-family: 'Rampant Sans', serif; font-size: clamp(18px, 2.6vw, 28px); line-height: 1.15;
                            color: #E5D4C2; opacity: .6; margin: 14px 0 0; }
        .ct-art { align-self: end; padding-bottom: 6px; }

        /* The ways to reach the Club, set as large as the title's voice. */
        .ct-body { padding-bottom: 130px; }
        .ct-line { display: block; width: fit-content; max-width: 100%; font-family: 'Rampant Sans', serif; font-weight: 400;
                   font-size: clamp(30px, 5vw, 68px); line-height: 1.02; color: #E5D4C2; text-decoration: none;
                   padding-bottom: 10px; border-bottom: 1px solid rgba(229,212,194,.3); overflow-wrap: anywhere;
                   transition: border-color .3s ease, color .3s ease; }
        .ct-line:hover { border-bottom-color: #D4B85A; }
        .ct-line + .ct-line, .ct-copy + .ct-line { margin-top: 26px; }
        .ct-email { cursor: pointer; }
        .ct-copy { display: block; height: 22px; margin-top: 10px; font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12px;
                   letter-spacing: .06em; color: #D4B85A; transition: opacity .8s ease; pointer-events: none; }

        .ct-icons { display: flex; align-items: center; gap: 30px; margin-top: 48px; }
        .ct-icons a { display: inline-flex; opacity: .82; transition: opacity .2s ease, transform .35s ease; }
        .ct-icons a:hover { opacity: 1; transform: translateY(-2px); }
        .ct-icons img, .ct-icons svg { width: 24px; height: 24px; display: block; }
        /* the marks are black line; set them in cream like the rest of the page */
        .ct-icons img { filter: brightness(0) invert(91%) sepia(12%) saturate(390%) hue-rotate(335deg); }

        @media (max-width: 1024px) { .ct-wrap { padding-right: 24px; } }
        @media (max-width: 860px) {
          .ct-wrap { padding-left: 20px; padding-right: 20px; }
          .ct-mast { display: block; padding-top: 112px; padding-bottom: 44px; }
          .ct-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
          .ct-top .ct-art { width: 96px; flex: 0 0 auto; padding-bottom: 0; margin-right: -4px; }
          .ct-mast > .ct-art { display: none; }
          .contact-title { margin-top: 26px; font-size: clamp(40px, 12vw, 64px); }
          .ct-line { font-size: clamp(24px, 7.4vw, 40px); }
          .ct-body { padding-bottom: 96px; }
        }
        @media (min-width: 861px) { .ct-top { display: contents; } .ct-top .ct-art { display: none; } }
        @media (prefers-reduced-motion: reduce) {
          .ct-rise { opacity: 1; transform: none; animation: none; }
          .contact-back .ct-go, .ct-icons a { transition: none; }
        }
      ` }} />
      <CreamInkDefs />

      <header className="ct-wrap ct-mast">
        <div>
          <div className="ct-top">
            <Link href="/members" className="contact-back ct-rise"><span className="ct-go" aria-hidden="true">&larr;</span>{t('Back to dashboard', 'Về trang chủ')}</Link>
            <div className="ct-art ct-rise" style={{ animationDelay: '.2s' }}><CreamInk name="butler-tray" width="100%" rot={-6} dur={9} /></div>
          </div>
          {/* Same swap as MemberPage: in VN the Vietnamese leads, the English follows. */}
          <h1 className="contact-title ct-rise" style={{ animationDelay: '.06s' }}>{t('Contact', 'Liên hệ')}</h1>
          <p className="contact-subtitle ct-rise" style={{ animationDelay: '.12s' }}>{t('Liên hệ', 'Contact')}</p>
        </div>
        <div className="ct-art ct-rise" style={{ animationDelay: '.2s' }}><CreamInk name="butler-tray" width="100%" rot={-6} dur={9} /></div>
      </header>

      <div className="ct-wrap ct-body ct-rise" style={{ animationDelay: '.18s' }}>
        <span onClick={copyEmail} className="ct-line ct-email">
          membership@<wbr />therampantclub.com
        </span>
        <span className="ct-copy" style={{ opacity: copied ? 1 : 0 }}>
          {t('Copied to clipboard', 'Đã sao chép')}
        </span>

        <a href="tel:+84817888768" className="ct-line">
          (+84) 817 888 768
        </a>

        <div className="ct-icons">
          <a href="tel:+84817888768">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1.003 1.003 0 011.01-.24c1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="#E5D4C2"/></svg>
          </a>
          <a href="https://zalo.me/84817888768" target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/zalo.svg" alt="Zalo" />
          </a>
          <a href="https://wa.me/84817888768" target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/whatsapp.svg" alt="WhatsApp" />
          </a>
          <a href="https://instagram.com/rampantclub" target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/instagram.svg" alt="Instagram" />
          </a>
        </div>
      </div>
    </PublicPage>
  )
}
