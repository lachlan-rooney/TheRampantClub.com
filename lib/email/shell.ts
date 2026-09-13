// ═══════════════════════════════════════════════════════════════════════════
// THE EMAIL SHELL — the club's colours survive the reader's dark mode.
// ───────────────────────────────────────────────────────────────────────────
// Our emails are cream ground (#E5D4C2) with bottle-green ink, the same as the
// site. A mail client in dark mode does not know that: Apple Mail, iOS Mail and
// Outlook INVERT a light email unless told not to, and the result is a muddy
// near-black card with olive text — recognisably not the club, and worse than
// plain black on white would have been.
//
// The fix is three things, and only the first is widely documented:
//
//   1. <meta name="color-scheme" content="light"> and its supported- twin, plus
//      the same as CSS. Apple Mail, iOS Mail and Outlook then leave the email
//      alone entirely. This is most of the win.
//   2. A prefers-color-scheme override that repaints the ground and the ink
//      back to the club's, for clients that respect media queries but invert
//      anyway.
//   3. [data-ogsc] / [data-ogsb] selectors — the attributes the Gmail app
//      rewrites a message with when it inverts. Gmail is the least obedient
//      client of the three; locking the GROUND is achievable, and the inline
//      colours inside mostly survive once the background does.
//
// bgcolor="" is repeated as an attribute as well as CSS on purpose: the oldest
// clients (and a few webmail readers) honour the attribute and ignore the rule.
//
// Wrap every outgoing email in this. Ten routes send mail; they can all adopt
// it as they are next touched.

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
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body { margin: 0; padding: 0; background-color: #E5D4C2; }
  /* Clients that invert anyway: put the ground back. */
  @media (prefers-color-scheme: dark) {
    body, .trc-ground { background-color: #E5D4C2 !important; }
    .trc-ink { color: #052E20 !important; }
  }
  /* The Gmail app rewrites the message with these attributes when it inverts. */
  [data-ogsc] body, [data-ogsc] .trc-ground, [data-ogsb] body, [data-ogsb] .trc-ground {
    background-color: #E5D4C2 !important;
  }
  [data-ogsc] .trc-ink { color: #052E20 !important; }
</style>
</head>
<body bgcolor="#E5D4C2" class="trc-ground" style="margin:0;padding:0;background-color:#E5D4C2;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E5D4C2" class="trc-ground" style="background-color:#E5D4C2;">
  <tr>
    <td align="center" bgcolor="#E5D4C2" class="trc-ground" style="background-color:#E5D4C2;">
${inner}
    </td>
  </tr>
</table>
</body>
</html>`
}
