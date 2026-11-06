// THE QR CODE — sign up on your own phone, then the casks.
//
// Generated 2026-11-06 for the Tết event. It points at the WELCOME page, not
// at the casks: a guest scans, leaves their details, and is taken straight to
// the board. The form is the key.
//
// Target:
//   https://therampantclub.com/embassy/welcome
// QR version 3, 29x29 modules, error correction M (~15% recoverable, which is
// ample on a lit screen). Produced with the `qrcode` package and FROZEN here
// as a static path.
//
// ── WHY STATIC AND NOT GENERATED AT RUNTIME ───────────────────────────────
// A guest scanning this is standing in front of the iPad. If the library had
// to load and render first, the code would appear a beat late or — on a
// tablet with a stale bundle, which this estate has already been bitten by —
// not at all. A frozen path is in the HTML, needs no JavaScript, and cannot
// fail to appear.
//
// ⚠ IF THE URL EVER CHANGES, THIS MUST BE REGENERATED. It does not derive
//   itself from anything. To redo it:
//     node -e "require('qrcode').toString('<url>',{type:'svg',errorCorrectionLevel:'M',margin:0}).then(console.log)"
//   and replace the d= below.
export const QR_TARGET = 'https://therampantclub.com/embassy/welcome'

export function EmbassyQR({ size = 104, colour = '#d2b37f' }: { size?: number; colour?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 29 29" shapeRendering="crispEdges"
         role="img" aria-label={`QR code to ${QR_TARGET}`}>
      {/* STROKE, not fill. The qrcode library draws each module row as a
          horizontal line at a .5 offset, stroked one unit wide — a path of
          zero-area segments. Filling it paints nothing at all, which renders
          a perfectly sized, perfectly invisible QR code. */}
      {/* STROKE, not fill — and as an inline STYLE, not an attribute.
          The qrcode library draws each module row as a horizontal line at a
          .5 offset, stroked one unit wide: a path of zero-area segments, so
          filling it paints nothing and renders a perfectly sized, perfectly
          invisible code. And a presentation ATTRIBUTE loses to any stylesheet
          rule, which is how it stayed invisible after the first fix. An
          inline style wins. */}
      <path style={{ stroke: colour, strokeWidth: 1, fill: 'none' }} shapeRendering="crispEdges" d="M0 0.5h7m3 0h1m1 0h1m1 0h2m1 0h4m1 0h7M0 1.5h1m5 0h1m1 0h2m1 0h1m1 0h4m1 0h2m2 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m2 0h3m3 0h1m2 0h3m1 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m7 0h3m1 0h2m2 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h2m2 0h4m2 0h2m2 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m4 0h6m2 0h2m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 7.5h4m2 0h5M0 8.5h1m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1m1 0h1m1 0h3m6 0h1m2 0h1M0 9.5h1m2 0h3m1 0h1m1 0h5m6 0h3m2 0h1m2 0h1M2 10.5h1m1 0h3m1 0h1m1 0h1m2 0h2m2 0h1m2 0h1m1 0h1m3 0h3M1 11.5h1m5 0h1m1 0h1m1 0h5m1 0h4m2 0h1m3 0h1M1 12.5h1m4 0h1m3 0h4m1 0h1m1 0h1m1 0h5m1 0h1m1 0h2M0 13.5h2m3 0h1m2 0h1m1 0h1m1 0h1m3 0h1m3 0h3m2 0h1m2 0h1M0 14.5h1m1 0h3m1 0h1m1 0h2m3 0h1m7 0h1m1 0h3m1 0h2M4 15.5h2m2 0h4m1 0h2m2 0h2m6 0h1m1 0h1M2 16.5h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h2m3 0h2m1 0h3m2 0h1m1 0h2M1 17.5h1m1 0h2m3 0h1m7 0h1m3 0h1m1 0h1m2 0h2m1 0h1M0 18.5h1m1 0h1m2 0h2m1 0h4m5 0h1m2 0h1m1 0h1m1 0h1m2 0h2M1 19.5h1m1 0h3m1 0h2m1 0h5m2 0h5m1 0h3m1 0h1M0 20.5h1m1 0h1m1 0h1m1 0h1m1 0h3m1 0h2m3 0h1m2 0h5M8 21.5h6m2 0h2m2 0h1m3 0h1m1 0h3M0 22.5h7m2 0h1m2 0h1m6 0h2m1 0h1m1 0h2m1 0h2M0 23.5h1m5 0h1m6 0h3m1 0h2m1 0h1m3 0h2m1 0h2M0 24.5h1m1 0h3m1 0h1m1 0h2m1 0h2m1 0h1m1 0h2m2 0h5M0 25.5h1m1 0h3m1 0h1m3 0h1m1 0h1m3 0h1m2 0h2m2 0h2m1 0h3M0 26.5h1m1 0h3m1 0h1m1 0h1m2 0h2m1 0h1m1 0h1m2 0h1m3 0h3m2 0h1M0 27.5h1m5 0h1m2 0h2m2 0h2m2 0h5m1 0h1m3 0h1M0 28.5h7m1 0h1m2 0h1m1 0h1m2 0h2m1 0h7m1 0h2" />
    </svg>
  )
}
