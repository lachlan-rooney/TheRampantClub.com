import NavOverlay from '@/components/NavOverlay'
import LoginTicker from '@/components/LoginTicker'
import BottomTabBar from '@/components/members/BottomTabBar'
import InstallNudge from '@/components/members/InstallNudge'
import PortalGuide from '@/components/PortalGuide'
import LangToggle from '@/components/LangToggle'

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: #052E20 !important; }

        /* ── Portal-wide UX polish ────────────────────────────────────────
           Many member pages set outline:none on inputs with no replacement,
           leaving keyboard/switch-access users with no focus indicator. Give
           the whole portal one gold focus ring (only on keyboard focus, so it
           never shows on mouse/touch). Also smooth taps on touch devices. */
        .members-page :focus-visible,
        [class*="member"] input:focus-visible,
        [class*="member"] textarea:focus-visible,
        [class*="member"] select:focus-visible,
        [class*="member"] button:focus-visible,
        [class*="member"] a:focus-visible {
          outline: 2px solid rgba(212, 184, 90, 0.7);
          outline-offset: 2px;
          border-radius: 4px;
        }
        input:focus-visible, textarea:focus-visible, select:focus-visible {
          outline: 2px solid rgba(212, 184, 90, 0.7);
          outline-offset: 2px;
        }
        /* Kill the blue tap-flash on touch; keep taps feeling instant. */
        a, button { -webkit-tap-highlight-color: transparent; }

        .m-lang { top: calc(56px + env(safe-area-inset-top, 0px)); right: 40px; }
        @media (max-width: 768px) { .m-lang { top: calc(72px + env(safe-area-inset-top, 0px)); right: 20px; } }

        /* Reserve room for the mobile bottom tab bar so it never covers content. */
        @media (max-width: 768px) {
          body { padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px)); }
        }
      ` }} />
      <NavOverlay variant="members" dark />
      {/* THE SAME PLACE AS ADMIN — measured, not described. app/admin/layout.tsx
          puts LangToggle in a right-aligned strip at the top of the content,
          inside 48px/40px padding: on a desk it lands 56px down, its right edge
          40px in. It was pinned to the very corner here (17px down, 24px in),
          up in the ticker's line — "top right" in words, not the same spot.
          Absolute, not fixed, so it scrolls away with the page as admin's does. */}
      <div className="m-lang" style={{
        position: 'absolute', zIndex: 60,
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12,
      }}>
        <LangToggle />
      </div>
      <LoginTicker />
      {children}
      <BottomTabBar />
      <InstallNudge />
      {/* Available on every member page — opens on first login, replayable via
          the menu / the dashboard button / ?guide=1 / the open-portal-guide event. */}
      <PortalGuide />
    </>
  )
}
