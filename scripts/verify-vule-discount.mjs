// ═══════════════════════════════════════════════════════════════════════════
// VU LE & BUDDIES — 10%, on every price, and the arithmetic right.
//   node scripts/verify-vule-discount.mjs
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-11-06: it must show automatically and be unmistakable.
//
// A discount is the one thing on a price list that must not be approximately
// right, so this checks the NUMBERS against the live board rather than
// checking that a badge exists.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { chromium, devices } from 'playwright'

const env = {}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U = env.NEXT_PUBLIC_SUPABASE_URL
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
const B = process.env.BASE || 'http://localhost:3001'
const exp = String(Date.now()+30*24*60*60*1000)
const tp = `${exp}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')}`
const WANT = ['Q5364','Q5088','Q5134','Q5423','Q5177','Q5430','Q5057','Q5113','Q5439','Q5358']

let pass=0, fail=0
const t=(ok,m,d='')=>{ok?pass++:fail++;console.log(`${ok?'✓':'✗'} ${m}${d?' — '+d:''}`)}
const digits = s => Number(String(s).replace(/[^\d]/g,''))

const board = await (await fetch(`${U}/rest/v1/tet_cask_board?select=cask_ref,list_price_inc_vat_vnd,bottles_cask_strength`,{headers:H})).json()
const br = await chromium.launch()
try {
  for (const [label, opts] of [['desktop',{viewport:{width:1280,height:900},hasTouch:true}],
                               ['a phone',{...devices['iPhone 13'],viewport:{width:390,height:844}}]]) {
    console.log(`\n── ${label}`)
    const c = await br.newContext(opts)
    await c.addCookies([{name:'trc_tet',value:tp,domain:'localhost',path:'/'}])
    const p = await c.newPage()
    await p.goto(`${B}/embassy/tet`,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(4000)
    const body = (await p.innerText('body')).replace(/\s+/g,' ')

    t(await p.locator('.vl-banner').count() === 1, '  the banner is there, unprompted')
    t(/Vu Le & Buddies/i.test(body), '  it names Vu Le & Buddies')
    t(/10%/.test(body), '  and says 10%')
    t(await p.locator('.vl-tag').count() === WANT.length, '  every cask carries the tag', `${await p.locator('.vl-tag').count()}/${WANT.length}`)

    // THE ARITHMETIC, against the live board.
    const first = board.find(b => b.cask_ref === WANT[0])
    const listTotal = first.list_price_inc_vat_vnd * first.bottles_cask_strength
    const expected = Math.round(listTotal * 0.9)
    const shown = await p.evaluate(() => {
      // INNERMOST ONLY. A parent span contains both figures, so matching on
      // "has a colour and contains ₫" picked the ancestor and concatenated
      // the discounted and list prices into one meaningless number.
      const fig = document.querySelector('.ck-figs')
      const leaf = [...fig.querySelectorAll('span')].filter(s => !s.querySelector('span'))
      const gold = leaf.find(s => s.style.color && s.textContent.includes('₫'))
      const struck = leaf.find(s => s.style.textDecoration === 'line-through')
      return { discounted: gold?.textContent, list: struck?.textContent }
    })
    t(digits(shown.discounted) === expected, '  the discounted cask price is exactly 10% off',
      `${digits(shown.discounted).toLocaleString()} vs expected ${expected.toLocaleString()}`)
    t(digits(shown.list) === listTotal, '  and the struck-through list price is the real list',
      `${digits(shown.list).toLocaleString()}`)
    t(digits(shown.discounted) < digits(shown.list), '  discounted is lower than list (not inverted)')

    // Nothing may still claim the prices are DT list.
    t(!/prices below are Duncan Taylor/i.test(body) && !/Giá bên dưới là giá niêm yết/i.test(body),
      '  nothing contradicts the discount')
    await c.close()
  }
} finally { await br.close() }
console.log(`\n${fail===0?'PASS':'FAIL'}  ${pass} passed, ${fail} failed\n`)
process.exit(fail===0?0:1)
