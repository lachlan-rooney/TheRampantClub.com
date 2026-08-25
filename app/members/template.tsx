'use client'

// App Router template re-mounts on every navigation within /members, so this
// gives a gentle crossfade between member routes instead of a hard cut. It wraps
// only the page content — the nav overlay and bottom tab bar live in layout.tsx
// (outside the template), so they stay put while the page fades.

export default function MembersTemplate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes m-route-fade { from { opacity: 0 } to { opacity: 1 } }
        .m-route { animation: m-route-fade 0.26s ease both; }
        @media (prefers-reduced-motion: reduce) { .m-route { animation: none; } }
      ` }} />
      <div className="m-route">{children}</div>
    </>
  )
}
