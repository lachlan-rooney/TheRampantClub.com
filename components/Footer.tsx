'use client'


export default function Footer() {
  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'Rampant Sans';
          src: url('/fonts/MNRampantSans-Regular.woff2') format('woff2'),
               url('/fonts/MNRampantSans-Regular.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }

        @font-face {
          font-family: 'Google Sans Code';
          src: url('/fonts/GoogleSansCode-VariableFont_wght.ttf') format('truetype');
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }

        .trc-footer {
          background: #052E20;
          padding: 64px 32px 20px;
          font-family: 'Google Sans Code', monospace;
          position: relative;
          z-index: 100;
        }

        .trc-footer-inner {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 48px;
        }

        /* ── Column titles ── */
        .trc-footer-heading {
          font-family: 'Rampant Sans', 'Playfair Display', serif;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #E5D4C2;
          margin-bottom: 16px;
        }

        /* ── Links ── */
        .trc-footer-link {
          display: block;
          font-size: 11px;
          color: #B2AA98;
          text-decoration: none;
          letter-spacing: 0.03em;
          line-height: 1.7;
          margin-bottom: 0;
          transition: color 0.2s ease;
        }
        .trc-footer-link:hover { color: #E5D4C2; }

        /* ── Address text ── */
        .trc-footer-address {
          font-size: 11px;
          color: #B2AA98;
          letter-spacing: 0.03em;
          line-height: 1.7;
          font-style: normal;
        }

        /* ── Social icons row ── */
        .trc-footer-socials {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .trc-footer-social {
          color: #B2AA98;
          text-decoration: none;
          font-size: 11px;
          letter-spacing: 0.03em;
          transition: color 0.2s ease;
        }
        .trc-footer-social:hover { color: #E5D4C2; }

        /* ── Bottom bar ── */
        .trc-footer-bottom {
          margin-top: 32px;
          padding-top: 14px;
          border-top: 1px solid rgba(229, 212, 194, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .trc-footer-wordmark-img {
          height: auto;
          width: 140px;
          opacity: 0.4;
          filter: brightness(0) invert(1) sepia(1) saturate(0.3) hue-rotate(340deg) brightness(0.92);
        }

        .trc-footer-copyright {
          font-size: 10px;
          color: #B2AA98;
          opacity: 0.5;
          letter-spacing: 0.03em;
        }

        @media (max-width: 768px) {
          .trc-footer { padding: 48px 20px 32px; }
          .trc-footer-inner {
            grid-template-columns: 1fr 1fr;
            gap: 36px;
          }
          .trc-footer-bottom { flex-direction: column; gap: 12px; text-align: center; }
        }

        @media (max-width: 480px) {
          .trc-footer-inner {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }
      ` }} />

      <footer className="trc-footer">
        <div className="trc-footer-inner">
          {/* Contact */}
          <div>
            <div className="trc-footer-heading">Contact</div>
            <a href="mailto:Membership@TheRampantClub.com" className="trc-footer-link">Email: Membership@TheRampantClub.com</a>
            <div className="trc-footer-address">Fax: Decommissioned</div>
            <div className="trc-footer-address">Carrier Pigeon: On Standby</div>
          </div>

          {/* Opening Times */}
          <div>
            <div className="trc-footer-heading">Opening Times</div>
            <div className="trc-footer-address">Four &rsquo;til Last Pour</div>
          </div>

          {/* Address logo */}
          <div style={{ textAlign: 'right' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/PNG/[RAMPANT]_Logo_Rampants/Layer_1.svg"
              alt="74A/2 Hai Bà Trưng, Phường Sài Gòn"
              style={{ height: 90, width: 'auto' }}
            />
          </div>
        </div>

        <div className="trc-footer-bottom">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-script.svg"
            alt="The Rampant Club"
            className="trc-footer-wordmark-img"
          />
          <div style={{ textAlign: 'right' }}>
            <div className="trc-footer-copyright">&copy; {new Date().getFullYear()} The Rampant Club. All rights reserved.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
              {[
                { label: 'Terms', href: '/terms' },
                { label: 'Privacy', href: '/privacy' },
                { label: 'Cookies', href: '/cookies' },
                { label: 'Sitemap', href: '/sitemap' },
              ].map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  style={{
                    fontFamily: "'Google Sans Code', 'DM Mono', monospace",
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    color: '#B2AA98',
                    textDecoration: 'none',
                    opacity: 0.5,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.opacity = '0.8')}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.opacity = '0.5')}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
