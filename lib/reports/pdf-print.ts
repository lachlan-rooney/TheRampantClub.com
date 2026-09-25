import { site } from './render'

// ═══════════════════════════════════════════════════════════════════════════
// THE ATTACHMENT IS THE PAGE.
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-09-25: "The attached PDF in the email i send out to shawn
// doesn't look like it does when i preview on the site. No picture, different
// look altogether."
//
// It never did. lib/reports/pdf.ts draws its OWN document with pdf-lib: four
// of the page's twelve sections, Helvetica instead of the club's faces, no
// photograph, no crest, and a filter that turned every Vietnamese character
// into a question mark. The email body and the hosted page have always shared
// one renderer; the attachment was a third telling of the same week.
//
// So it is printed, not drawn. Headless Chromium opens the report's own hosted
// page — the exact URL the owner previews — and prints it. There is nothing to
// keep in sync because there is only one layout.
//
// WHY THE PUBLIC PAGE AND NOT THE HTML: the page loads the club's fonts, the
// photograph and the inline SVG charts by URL. Feeding Chromium a string of
// HTML would mean resolving all of that by hand, which is the same divergence
// in a different place. A report is approved before it is sent, and an
// approved report's token page is public — so the browser needs no session,
// and a draft simply cannot be printed, which is correct.
//
// THE COST, PLAINLY: a browser binary in the send path, several seconds per
// send, and one more thing that can fail on a Monday morning. It fails SOFT —
// lib/reports/send.ts already catches and sends without an attachment rather
// than not sending. An investor with no PDF still has the whole report in the
// body of the email and a link at the top.
// ═══════════════════════════════════════════════════════════════════════════

// Where Chrome lives. On Vercel it is the brotli-packed build in
// @sparticuz/chromium, unpacked into /tmp on first use. Locally there is no
// such thing for macOS, so a real Chrome is used — which is also the honest
// way to check the output, since it is the same engine.
const LOCAL_CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean) as string[]

async function localChrome(): Promise<string | null> {
  const { existsSync } = await import('node:fs')
  for (const p of LOCAL_CHROME) if (existsSync(p)) return p
  // Playwright's own browser, if it has been installed for the tests.
  try {
    const { chromium } = await import('playwright')
    const p = chromium.executablePath()
    if (p && existsSync(p)) return p
  } catch { /* playwright is a dev dependency; absent in production */ }
  return null
}

export async function printReportPdf(shareToken: string): Promise<Uint8Array> {
  const url = `${site()}/reports/${shareToken}`
  const onVercel = !!process.env.VERCEL

  // Imported HERE, not at the top of the file. A native dependency at module
  // scope 500s every export in the file that imports it — that is written down
  // as its own lesson, and this module is imported by the send path, which
  // must keep working when the browser cannot.
  const puppeteer = (await import('puppeteer-core')).default

  let executablePath: string | undefined
  let args: string[] = []
  if (onVercel) {
    const chromium = (await import('@sparticuz/chromium')).default
    executablePath = await chromium.executablePath()
    args = chromium.args
  } else {
    const local = await localChrome()
    if (!local) throw new Error('No Chrome found locally (set CHROME_PATH).')
    executablePath = local
    args = ['--no-sandbox', '--disable-dev-shm-usage']
  }

  const browser = await puppeteer.launch({
    executablePath, args, headless: true,
    defaultViewport: { width: 900, height: 1400, deviceScaleFactor: 2 },
  })
  try {
    const page = await browser.newPage()
    // A minute is generous, and the alternative to waiting is an empty page.
    page.setDefaultNavigationTimeout(45_000)
    await page.goto(url, { waitUntil: 'networkidle0' })

    // THE PAGE FADES IN. `rpt-rise` starts at opacity 0, so printing too early
    // prints an empty sheet — the animation is the single most likely way for
    // this to produce a blank PDF, and it is silenced rather than waited on.
    await page.addStyleTag({ content: `
      *, *::before, *::after { animation: none !important; transition: none !important; }
      .rpt-wrap { animation: none !important; opacity: 1 !important; transform: none !important; }
      /* The grain is fixed to the viewport: on paper it would print once, on
         page one, and leave the rest clean. Off. */
      .rpt-grain { display: none !important; }
      /* Keep the SMALL things whole — a row of stat cards split down the
         middle of a number is the one break that reads as a fault. Sections
         are allowed to run over a page: forbidding that left the first page
         half empty because "Who's Been In" would not fit under it. */
      table, .rpt-report img { break-inside: avoid; page-break-inside: avoid; }
    ` })
    // THE SITE'S OWN FURNITURE IS NOT PART OF THE REPORT. The page is a page
    // on the website, so the global footer rides along at the bottom — and in
    // print it landed on a sheet of its own, an otherwise empty sixth page
    // offering Shawn the cookie policy. Anything outside the report column is
    // removed, style and script tags excepted: the page's own CSS lives in one.
    await page.evaluate(() => {
      const wrap = document.querySelector('.rpt-wrap')
      if (!wrap) return
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (['STYLE', 'LINK', 'SCRIPT'].includes(el.tagName)) continue
        if (el === wrap || wrap.contains(el) || el.contains(wrap)) continue
        el.remove()
      }
    })

    // A GLYPH THE PRINTER DOES NOT HAVE. The deltas are set with ▲ and ▼
    // (U+25B2/U+25BC), which every mail client and every desktop browser can
    // draw — and the stripped-down Chromium that runs on the server cannot,
    // because it ships with almost no fonts. It printed "30  22" with a hole
    // where the arrow should be, which reads as a typo rather than a rise.
    // Swapped for + and − here only: the email and the page keep the arrows.
    await page.evaluate(() => {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const hits: Text[] = []
      while (walk.nextNode()) {
        const n = walk.currentNode as Text
        if (n.nodeValue && /[▲▼]/.test(n.nodeValue)) hits.push(n)
      }
      for (const n of hits) n.nodeValue = n.nodeValue!.replace(/▲/g, '+').replace(/▼/g, '\u2212')
    })

    // Fonts, then the photograph. An <img> that has not decoded prints as a gap.
    await page.evaluate(async () => {
      await (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready
      await Promise.all(Array.from(document.images)
        .filter(i => !i.complete)
        .map(i => new Promise(res => { i.onload = res; i.onerror = res })))
    })

    const pdf = await page.pdf({
      format: 'a4',
      printBackground: true,          // or it comes out white: the club is dark
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      preferCSSPageSize: false,
    })
    return pdf
  } finally {
    await browser.close().catch(() => {})
  }
}
