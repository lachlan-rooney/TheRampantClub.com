// ═══════════════════════════════════════════════════════════════════════════
// THE EMAIL SHELL — the club's night palette, so nothing wants to invert it.
// ───────────────────────────────────────────────────────────────────────────
// THE PROBLEM. Our emails were cream ground with bottle-green ink, like the
// public site. A mail client in dark mode inverts a LIGHT email, and the
// result was a muddy near-black card with olive text: recognisably not the
// club. Declaring color-scheme fixes Apple Mail, iOS Mail and Outlook, but
// Gmail ignores it and inverts anyway.
//
// WHAT WAS TRIED AND THROWN AWAY. An 8px cream tile as a background image
// holds the GROUND through Gmail's inverter — image pixels survive where
// colours do not. It was measured working. It was also worse: Gmail lightens
// the TEXT too, and text cannot be an image, so the card came out cream with
// near-white type on it. Holding half the palette is worse than losing all of
// it. That approach is gone; do not reach for it again.
//
// WHAT WORKS. Send the email DARK. Clients invert light emails; they leave
// dark ones alone, because there is nothing for dark mode to improve. The club
// already has a night palette — bottle green, cream ink, gold — and it is the
// one the portal and the kiosk are built in. So the email is on-brand at noon
// AND immune to inversion at midnight, and it needs no tricks to stay that way.
//
// A reader in LIGHT mode gets a dark email. That is a deliberate trade: it is
// the club's own look, the same as signing in to the portal, and it is
// identical for every reader — which is worth more than matching the
// brightness of whatever inbox it lands in.

export const EMAIL = {
  ground: '#052E20',   // bottle green — the portal's ground
  panel:  '#0A3526',   // one step up, for a panel inside the ground
  ink:    '#E5D4C2',   // cream
  muted:  '#B2AA98',   // cream at conversational weight
  gold:   '#D4B85A',   // the accent, used for one thing at a time
  rule:   'rgba(229,212,194,0.14)',
} as const

export function emailShell(inner: string, opts?: { title?: string; preheader?: string }): string {
  const title = opts?.title || 'The Rampant Club'
  // The line a mail list shows after the subject. Hidden in the body itself —
  // without one, clients quote whatever text comes first, which is usually the
  // alt text of the lion.
  const preheader = opts?.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${opts.preheader}</div>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- The email IS dark. Saying so is what stops a client "helping". -->
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark light">
<title>${title}</title>
<style>
  :root { color-scheme: dark; supported-color-schemes: dark light; }
  body { margin: 0; padding: 0; background-color: ${EMAIL.ground}; }
  /* Belt and braces for the clients that still decide to intervene: in either
     scheme, the ground is the club's green and the ink is the club's cream. */
  @media (prefers-color-scheme: light) {
    body, .trc-ground { background-color: ${EMAIL.ground} !important; }
    .trc-ink { color: ${EMAIL.ink} !important; }
  }
  [data-ogsc] body, [data-ogsc] .trc-ground, [data-ogsb] body, [data-ogsb] .trc-ground {
    background-color: ${EMAIL.ground} !important;
  }
  [data-ogsc] .trc-ink { color: ${EMAIL.ink} !important; }
  a { color: ${EMAIL.gold}; }
</style>
</head>
<body bgcolor="${EMAIL.ground}" class="trc-ground" style="margin:0;padding:0;background-color:${EMAIL.ground};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${EMAIL.ground}" class="trc-ground" style="background-color:${EMAIL.ground};">
  <tr>
    <td align="center" bgcolor="${EMAIL.ground}" class="trc-ground" style="background-color:${EMAIL.ground};padding:0;">
${inner}
    </td>
  </tr>
</table>
</body>
</html>`
}
