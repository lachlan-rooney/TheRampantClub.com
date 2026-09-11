'use client'

import { PublicPage } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

// The service worker's offline shell. It is served from the cache when the
// network is gone, so NOTHING here may depend on JavaScript to become visible:
// the page's own chunk may never have been cached. The rise-in is plain CSS
// (no observer), and the only picture that must appear — the mark — is one the
// worker precaches. The drawing is a nicety: if it was never cached it simply
// isn't there (alt="" leaves no broken-image box).
export default function OfflinePage() {
  return (
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style dangerouslySetInnerHTML={{ __html: `
        .of { display: grid; grid-template-columns: 1.1fr .9fr; gap: 48px; align-items: center;
              min-height: 100vh; min-height: 100svh; box-sizing: border-box; padding-top: 96px; padding-bottom: 96px; }
        .of-rise { animation: of-rise .9s cubic-bezier(.16,.84,.44,1) both; }
        @keyframes of-rise { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: none } }
        .of-mark { width: 64px; height: auto; display: block; margin: 0 0 30px; }
        .of-eyebrow { color: #D4B85A; opacity: 1; }
        .of-btn { display: inline-block; margin-top: 34px; background: none; color: #D4B85A; border: none;
                  border-bottom: 1px solid #D4B85A; border-radius: 0; padding: 6px 0 7px; cursor: pointer;
                  font-family: 'Google Sans Code', 'DM Mono', monospace; font-size: 12.5px; letter-spacing: .12em;
                  text-transform: uppercase; }
        .of-btn:hover .pk-go { transform: translateX(7px); }
        .of-art { justify-self: center; width: min(100%, 460px); }
        @media (max-width: 860px) {
          .of { grid-template-columns: 1fr; align-content: start; gap: 36px; align-items: start; padding-top: 72px; }
          .of-art { justify-self: end; width: 78%; max-width: 340px; margin-right: -8vw; }
        }
        @media (prefers-reduced-motion: reduce) { .of-rise { animation: none; } }
      ` }} />
      <CreamInkDefs />

      <div className="pk-wrap of">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-mark-cream.png" alt="The Rampant Club" className="of-mark of-rise" />
          <div className="pk-eyebrow of-eyebrow of-rise" style={{ animationDelay: '.05s' }}>The Rampant Club</div>
          <h1 className="pk-h1 of-rise" style={{ animationDelay: '.1s' }}>Off the grid</h1>
          <div className="of-rise" style={{ animationDelay: '.16s' }}>
            <p className="pk-sub" style={{ margin: '12px 0 0' }}>Ngoài Vùng Phủ Sóng</p>
          </div>
          <p className="pk-lede of-rise" style={{ animationDelay: '.22s' }}>
            No signal at the moment. The club is still here. Reconnect when you can —
            we&rsquo;ll have a glass waiting.
          </p>
          <div className="of-rise" style={{ animationDelay: '.28s' }}>
            <button onClick={() => window.location.reload()} className="of-btn">
              Try again <span className="pk-go" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
        <div className="of-art of-rise" style={{ animationDelay: '.3s' }}>
          <CreamInk name="lion-reclining" width="100%" rot={-3} dur={10} />
        </div>
      </div>
    </PublicPage>
  )
}
