// ═══════════════════════════════════════════════════════════════════════════
// THE TẾT ENQUIRY EMAIL — who it goes to, and what it must never carry.
//   npx tsx tests/tet/enquiry-mail.test.mjs
// ───────────────────────────────────────────────────────────────────────────
// Nothing is sent by this test. It imports the module, reads the recipient
// list it computed, and renders the body — so the addresses and the contents
// can be checked without putting anything in anybody's inbox.
//
// Owner, 2026-09-23: "tet email is truongminhquy@duncantaylorvn.com".
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
const t = (ok, m, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${m}${!ok && d ? ' — ' + d : ''}`) }

const src = readFileSync('lib/tet/notify.ts', 'utf8')
const def = src.match(/const DEFAULT_TO = '([^']+)'/)?.[1] ?? ''
const list = def.split(',').map(s => s.trim()).filter(Boolean)

t(list.includes('truongminhquy@duncantaylorvn.com'), 'Duncan Taylor Vietnam is told when an enquiry lands', def)
t(list.includes('membership@therampantclub.com'), 'and the club keeps its own copy', def)
t(/process\.env\.TET_ENQUIRY_TO \|\| DEFAULT_TO/.test(src), 'TET_ENQUIRY_TO still overrides the default')

const { enquiryEmailHtml } = await import('../../lib/tet/notify.ts')
const mail = enquiryEmailHtml({
  reference: 'TET-TEST-1', mode: 'enquiry', company: 'Acme Corp', name: 'Nguyễn An',
  email: 'an@acme.vn', phone: '+84 90 000 0000', kind: 'cask', caskRef: 'OCT-2027-03',
  bottles: 120, message: 'Sixty for clients, sixty for staff.', locale: 'vi-VN', personalised: true,
})
t(/Acme Corp/.test(mail.html) && /OCT-2027-03/.test(mail.html), 'the email carries what the buyer told us', mail.subject)
// The cost model has never been allowed near a client, and this email may be
// forwarded to one. Check the WORDS THE READER SEES — styles are stripped
// first, or every `margin:0` in the inline CSS reads as a leak (it did).
const text = mail.html
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/\sstyle="[^"]*"/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ')
const leaks = ['margin', 'cost', 'ex works', 'ex_works', 'gbp', '£', 'freight', 'landed', 'mark-up', 'markup']
  .filter(w => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text))
t(leaks.length === 0, 'and nothing about what it costs the club', `${leaks.join(', ')} | ${text.replace(/\s+/g, ' ').slice(0, 160)}`)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
