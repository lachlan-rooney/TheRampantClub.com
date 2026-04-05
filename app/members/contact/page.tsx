'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ContactPage() {
  const [copied, setCopied] = useState(false)

  const copyEmail = () => {
    navigator.clipboard.writeText('membership@therampantclub.com')
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap');

        .contact-page {
          min-height: 100vh;
          background: #052E20;
          font-family: 'DM Mono', monospace;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .contact-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 200px;
        }

        .contact-back {
          position: fixed;
          top: 24px;
          right: 24px;
          font-size: 11px;
          color: #B2AA98; opacity: 0.35;
          text-decoration: none;
          letter-spacing: 0.06em;
          transition: opacity 0.2s;
          z-index: 10;
        }
        .contact-back:hover { opacity: 0.6; }

        .contact-container {
          position: relative; z-index: 2;
          text-align: center;
          max-width: 480px;
          padding: 24px;
        }

        .contact-title {
          font-family: 'Rampant Sans', serif;
          font-size: 28px; font-weight: 600;
          color: #E5D4C2; letter-spacing: 0.02em;
          margin-bottom: 4px;
        }
        .contact-subtitle {
          font-size: 11px; color: #B2AA98;
          opacity: 0.35; letter-spacing: 0.06em;
          margin-bottom: 36px;
        }

        .contact-diamond {
          width: 6px; height: 6px;
          background: #E5D4C2;
          transform: rotate(45deg);
          opacity: 0.3;
          margin: 0 auto 36px;
        }

        .contact-address {
          font-family: 'Rampant Sans', serif;
          font-size: 20px; font-weight: 500;
          color: #E5D4C2;
          letter-spacing: 0.04em;
          line-height: 1.6;
          margin-bottom: 48px;
        }

        .contact-hotline-label {
          font-size: 12px;
          color: #B2AA98; opacity: 0.5;
          letter-spacing: 0.03em;
          line-height: 1.7;
          margin-bottom: 8px;
        }
        .contact-hotline-vn {
          font-size: 11px;
          color: #B2AA98; opacity: 0.5;
          letter-spacing: 0.03em;
          line-height: 1.6;
          margin-bottom: 56px;
        }

        .contact-note {
          font-family: 'Rampant Sans', serif;
          font-size: 20px;
          font-weight: 500;
          color: #E5D4C2;
          letter-spacing: 0.04em;
          line-height: 1.8;
          max-width: 460px;
          margin: 0 auto;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #052E20; }
        ::-webkit-scrollbar-thumb { background: rgba(229, 212, 194, 0.2); border-radius: 3px; }

        @media (max-width: 768px) {
          .contact-address { font-size: 18px; }
          .contact-back { top: 18px; right: 18px; }
        }
      ` }} />

      <div className="contact-page">
        <div className="contact-grain" />
        <Link href="/members" className="contact-back">&larr; Back</Link>

        <div className="contact-container">
          <h1 className="contact-title">Contact</h1>
          <p className="contact-subtitle">Liên hệ</p>

          <div className="contact-diamond" />

          <div className="contact-note">
            <span onClick={copyEmail} style={{ color: '#E5D4C2', cursor: 'pointer', position: 'relative' }}>
              membership@therampantclub.com
              <span style={{
                position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                bottom: -28, fontFamily: "'Google Sans Code', 'DM Mono', monospace",
                fontSize: 10, color: '#B2AA98', whiteSpace: 'nowrap',
                background: 'rgba(229,212,194,0.1)', padding: '4px 12px', borderRadius: 4,
                opacity: copied ? 1 : 0, transition: 'opacity 0.8s ease',
                pointerEvents: 'none',
              }}>
                Copied to clipboard
              </span>
            </span>
          </div>

          <div style={{ fontFamily: "'Rampant Sans', serif", fontSize: 20, fontWeight: 500, color: '#E5D4C2', letterSpacing: '0.04em', lineHeight: 1.8, marginTop: 16 }}>
            <a href="tel:+84817888768" style={{ color: '#E5D4C2', textDecoration: 'none' }}>
              (+84) 817 888 768
            </a>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 32 }}>
            <a href="tel:+84817888768" style={{ opacity: 0.6 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1.003 1.003 0 011.01-.24c1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="#B2AA98"/></svg>
            </a>
            <a href="https://zalo.me/84817888768" target="_blank" rel="noopener noreferrer" style={{ opacity: 0.6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/zalo.svg" alt="Zalo" style={{ width: 20, height: 20 }} />
            </a>
            <a href="https://wa.me/84817888768" target="_blank" rel="noopener noreferrer" style={{ opacity: 0.6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/whatsapp.svg" alt="WhatsApp" style={{ width: 20, height: 20 }} />
            </a>
            <a href="https://instagram.com/rampantclub" target="_blank" rel="noopener noreferrer" style={{ opacity: 0.6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/instagram.svg" alt="Instagram" style={{ width: 20, height: 20 }} />
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
