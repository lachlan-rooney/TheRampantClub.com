import NavOverlay from '@/components/NavOverlay'
import LoginTicker from '@/components/LoginTicker'
import BottomTabBar from '@/components/members/BottomTabBar'
import InstallNudge from '@/components/members/InstallNudge'

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

        /* Reserve room for the mobile bottom tab bar so it never covers content. */
        @media (max-width: 768px) {
          body { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)); }
        }
      ` }} />
      <NavOverlay variant="members" dark />
      <LoginTicker />
      {children}
      <BottomTabBar />
      <InstallNudge />
    </>
  )
}
