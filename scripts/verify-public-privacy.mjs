// ═══════════════════════════════════════════════════════════════════════════
// IS THE PUBLIC PRIVACY NOTICE THE REAL ONE, IN BOTH LANGUAGES?
//   node scripts/verify-public-privacy.mjs           (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// /privacy was 64 lines of English hardcoded in the page, headed "Last updated:
// March 2026", titled "Privacy Policy". The club's real notice — "What We Keep,
// and Why", in terms_versions, English AND Vietnamese — is the one members
// consented to. The street was being shown the stale one.
//
// PROVE THE HARNESS: checks 1 and 2 read the register directly and fail if it
// is empty, so nothing below can pass against no document. Check 7 asserts the
// page's words came FROM the register (a sentence only the register has), not
// merely that Vietnamese appeared — the old page had a Vietnamese subtitle and
// nothing else, which is exactly the false pass to avoid.
//
// Read-only. It creates nothing and deletes nothing.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const BASE = 'http://localhost:3001'
const svc = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${d ? ' — ' + d : ''}`) }
const norm = s => s.replace(/\s+/g, ' ').toLowerCase()

// ── THE REGISTER ────────────────────────────────────────────────────────
const rows = await (await fetch(`${U}/rest/v1/terms_versions?doc_key=eq.privacy&select=version,effective_date,title_en,title_vn,body,body_vn&order=effective_date.desc,version.desc`, { headers: svc })).json()
t(Array.isArray(rows) && rows.length > 0, '1 · HARNESS: the register holds a privacy notice', `${rows.length ?? 0} version(s)`)
const live = rows[0]
t(!!live?.body && !!live?.body_vn, '2 · HARNESS: in BOTH languages', live ? `EN ${live.body.length} ch · VN ${(live.body_vn || '').length} ch` : 'none')
if (!live?.body) { console.log('\nnothing to check against'); process.exit(1) }

// A sentence that exists ONLY in the register, so finding it on the page proves
// provenance rather than vocabulary.
const enMark = live.body.split('\n').find(l => l.length > 70 && !l.startsWith('#'))
const vnMark = (live.body_vn || '').split('\n').find(l => l.length > 70 && !l.startsWith('#'))

// ── THE ROUTE ───────────────────────────────────────────────────────────
const api = await fetch(`${BASE}/api/legal/privacy`)
const j = await api.json().catch(() => ({}))
t(api.status === 200 && j.html_en?.length > 2000, '3 · the public route serves it without a login', `status ${api.status}, ${j.html_en?.length ?? 0} ch of html`)
t(j.version === live.version, '4 · and serves the version the register calls current', `v${j.version} vs register v${live.version}`)
t(!('body_url' in j) && !('created_by' in j) && !('id' in j),
  '5 · and nothing the page does not need', Object.keys(j).join(','))
const forbidden = await fetch(`${BASE}/api/legal/membership_terms`)
t(forbidden.status === 404, '6 · the membership Terms are NOT published this way', `status ${forbidden.status}`)

// ── THE PAGE ────────────────────────────────────────────────────────────
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(String(e)))
p.on('response', r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url().replace(BASE, '')}`) })

await p.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' })
await p.evaluate(() => { try { localStorage.setItem('trc-lang', 'en') } catch {} })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(900)
const en = norm(await p.innerText('body'))

t(en.includes(norm(enMark)), '7 · PROVE THE HARNESS: the page prints the REGISTER\'s words', `"${enMark.slice(0, 58)}…"`)
t(!en.includes('last updated: march 2026') && !en.includes('privacy policy'),
  '8 · the stale hardcoded notice is gone', en.includes('privacy policy') ? 'STILL THERE' : 'gone')
t(en.includes('in effect from'), '9 · it states an effective date, not a "last updated"')

// THE SWITCH — it must be reachable from a public page, at desk width.
//
// SCOPED TO THE NAV. `button:text-is("VN")` takes the FIRST match, which is the
// page's own switch beside the document — and while the menu is open the scrim
// covers the page, so that one is legitimately unclickable and the check failed
// on the wrong control.
const burger = await p.$('button[aria-label="Open menu"]')
t(!!burger, '10 · the public nav opens')
if (burger) {
  await burger.click(); await p.waitForTimeout(600)
  const vnBtn = await p.$('.nav-lang-always button:text-is("VN")')
  t(!!vnBtn, '11 · and carries an EN/VN switch at desk width', vnBtn ? 'present' : 'MISSING — member branch only?')

  // IT MUST BE HITTABLE, NOT MERELY PRESENT. space-between in a 400px drawer
  // pushed it to x=423, outside the panel and onto the scrim: it drew perfectly
  // and could never be tapped. elementFromPoint over its own centre is the proof.
  const reachable = vnBtn ? await p.evaluate(() => {
    const el = document.querySelector('.nav-lang-always button')
    if (!el) return false
    const r = el.getBoundingClientRect()
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
        || document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el
  }) : false
  t(reachable, '11b · and the switch can actually be TAPPED, not just drawn')

  if (vnBtn) {
    await vnBtn.click(); await p.waitForTimeout(900)
    // ── CLOSE IT WITH THE BUTTON ────────────────────────────────────────
    // Escape does NOT close this menu (nothing listens for it), and while it is
    // open components/nav/Glass has cloned the whole page into a frosted
    // backdrop — so `main.pk` appears TWICE. Measuring then found the English
    // copy sitting behind the Vietnamese one and reported the page as not
    // switching. The clone is inert, aria-hidden and stripped of ids, so it is
    // doing nothing wrong; the harness was reading the wallpaper.
    await p.click('button[aria-label="Close menu"]')
    await p.waitForTimeout(600)
    const copies = await p.$$eval('main.pk', ms => ms.length)
    t(copies === 1, '11c · HARNESS: the menu is shut and the glass clone is gone', `${copies} copy of the page`)

    const vn = norm(await p.innerText('body'))
    t(vn.includes(norm(vnMark)), '12 · and the notice TURNS OVER to Vietnamese', `"${vnMark.slice(0, 48)}…"`)
    t(!vn.includes(norm(enMark)), '13 · with the English gone, not stacked under it')
    t(vn.includes('có hiệu lực từ'), '14 · including the date line')
  }
}

// The clause list in the margin is built from the document's own headings.
// Counted in the VIETNAMESE document, which is what is on screen by now, and
// scoped so a glass clone could never be counted again.
const toc = await p.$$eval('main.pk:not([inert]) .lg-toc a', as => as.map(a => a.textContent?.trim()).filter(Boolean))
const h2s = (live.body.match(/^## .+$/gm) || []).length
const h2sVn = ((live.body_vn || '').match(/^## .+$/gm) || []).length
t(toc.length === h2sVn && toc.length > 5, '15 · the margin lists the document\'s own clauses', `${toc.length} in the margin, ${h2sVn} in the Vietnamese markdown (${h2s} in the English)`)

// And the anchors work: every margin link has something to land on.
const anchored = await p.$$eval('main.pk:not([inert]) .lg-doc h2[id]', hs => hs.length)
t(anchored === h2sVn, '16 · each clause can be linked to', `${anchored} anchored`)

t(errs.length === 0, '17 · no page errors or failed requests', errs.slice(0, 3).join(' | '))
await b.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
