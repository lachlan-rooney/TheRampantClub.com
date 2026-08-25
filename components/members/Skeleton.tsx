'use client'

// Branded shimmer skeleton for the member portal — replaces the one-line
// "Loading…" texts so pages reserve their layout and shimmer instead of
// popping in. Cream-on-green, matches the club palette.

export function Skeleton({
  width = '100%', height = 14, radius = 6, style,
}: {
  width?: number | string
  height?: number | string
  radius?: number
  style?: React.CSSProperties
}) {
  return (
    <>
      <SkeletonKeyframes />
      <div
        aria-hidden
        style={{
          width, height, borderRadius: radius,
          background: 'linear-gradient(100deg, rgba(229,212,194,0.05) 30%, rgba(229,212,194,0.14) 50%, rgba(229,212,194,0.05) 70%)',
          backgroundSize: '200% 100%',
          animation: 'mskel 1.4s ease-in-out infinite',
          ...style,
        }}
      />
    </>
  )
}

// A stack of shimmer lines — a reasonable default page loader.
export function SkeletonLines({ lines = 3, gap = 12 }: { lines?: number; gap?: number }) {
  return (
    <div role="status" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={14} />
      ))}
    </div>
  )
}

// A shimmer card — for tile/panel-heavy pages.
export function SkeletonCard({ height = 120 }: { height?: number }) {
  return <Skeleton width="100%" height={height} radius={12} />
}

function SkeletonKeyframes() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes mskel { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
      @media (prefers-reduced-motion: reduce) { [style*="mskel"] { animation: none !important } }
    ` }} />
  )
}
