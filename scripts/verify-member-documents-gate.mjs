import { readFileSync } from 'node:fs'
const env = {}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const { NEXT_PUBLIC_SUPABASE_URL:U, SUPABASE_SERVICE_ROLE_KEY:S } = env
const APP = 'http://localhost:3001'
const svcH = { apikey:S, Authorization:`Bearer ${S}`, 'Content-Type':'application/json' }
const rest = (p,o={}) => fetch(`${U}/rest/v1/${p}`, { headers:svcH, ...o })
let fails=0
const ok=(c,l,d='')=>{ console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c) fails++ }
const head=t=>console.log(`\n── ${t} ` + '─'.repeat(Math.max(0,56-t.length)))

const MEM='ZZ-GATE-1', EMAIL='zz-gate-1@example.invalid', PW='zz-Test-Pass-9182'
let user=null
try {
  await rest('members',{method:'POST',headers:{...svcH,Prefer:'resolution=merge-duplicates'},
    body:JSON.stringify({member_no:MEM,full_name:'Zeta Gate',tier:'Honorary',status:'Active'})})
  const u=await (await fetch(`${U}/auth/v1/admin/users`,{method:'POST',headers:svcH,
    body:JSON.stringify({email:EMAIL,password:PW,email_confirm:true})})).json()
  user=u.id
  await rest('profiles',{method:'POST',headers:{...svcH,Prefer:'resolution=merge-duplicates'},
    body:JSON.stringify({id:u.id,display_name:'Zeta Gate',is_admin:false,member_no:MEM})})

  const { chromium } = await import('playwright')
  let browser; try { browser = await chromium.launch({channel:'chrome'}) } catch { browser = await chromium.launch() }

  // CHECK 5 — a real phone viewport with a dynamic-toolbar-sized window
  const ctx = await browser.newContext({ viewport:{width:390,height:664}, isMobile:true, hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
  const page = await ctx.newPage()

  await page.goto(`${APP}/login`, { waitUntil:'domcontentloaded' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PW)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/members/, { timeout: 30000 }).catch(()=>{})

  head('1 · the gate, in a real browser on a phone viewport')
  ok(page.url().includes('/members/agree'),
     'a member behind on a required document is REDIRECTED to /members/agree', page.url().replace(APP,''))

  // try to go round it
  await page.goto(`${APP}/members/taste`, { waitUntil:'domcontentloaded' })
  ok(page.url().includes('/members/agree'), 'and cannot reach another member page by typing the URL', page.url().replace(APP,''))

  await page.goto(`${APP}/members/agree`, { waitUntil:'networkidle' })
  await page.waitForTimeout(1500)

  head('4 · 5 · the scroll gate')
  const btn = page.locator('button', { hasText: /^I agree$/ }).first()
  ok(await btn.count() > 0, 'the agree control is present')
  const before = await btn.isDisabled()
  ok(before === true, 'DISABLED before the member reaches the end of a long document')

  // scroll the document region to its foot — the sentinel is inside it
  await page.evaluate(() => {
    const box = [...document.querySelectorAll('div')].find(d => d.scrollHeight > d.clientHeight + 40 && getComputedStyle(d).overflowY === 'auto')
    if (box) box.scrollTop = box.scrollHeight
  })
  await page.waitForTimeout(1200)
  const after = await btn.isDisabled()
  ok(after === false, 'ENABLED once the sentinel at the foot is reached (IntersectionObserver, no arithmetic)')

  // Diagnose before clicking rather than reporting a bare timeout.
  const diag = await btn.evaluate(el => {
    const r = el.getBoundingClientRect()
    const mid = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2)
    return { visible: r.width>0 && r.height>0, top: Math.round(r.top), h: Math.round(r.height),
             inViewport: r.top >= 0 && r.bottom <= innerHeight,
             topmost: mid ? (mid === el ? 'the button' : mid.tagName + '.' + (mid.className||'').toString().slice(0,30)) : 'nothing' }
  })
  console.log(`  button: top=${diag.top} h=${diag.h} inViewport=${diag.inViewport} topmostAtCentre=${diag.topmost}`)
  // Centre it, then click for real. scrollIntoViewIfNeeded parks an element at the
  // nearest edge, and the bottom edge is under the fixed tab bar. No forced DOM
  // click: a forced click would hide the very interception being tested for.
  await btn.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  try {
    await btn.click({ timeout: 12000 })
    ok(true, 'a REAL tap lands on the control (not a forced DOM click)')
  } catch (e) {
    console.log('\n  PLAYWRIGHT SAYS:\n' + String(e.message).split('\n').slice(0, 14).map(l => '    ' + l).join('\n'))
    const st = await btn.evaluate(el => {
      const r = el.getBoundingClientRect()
      return { disabled: el.disabled, top: Math.round(r.top), bottom: Math.round(r.bottom),
               vh: innerHeight, display: getComputedStyle(el).display,
               visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity,
               pointerEvents: getComputedStyle(el).pointerEvents }
    })
    console.log('    element state:', JSON.stringify(st))
    ok(false, 'a REAL tap lands on the control')
  }
  await page.waitForTimeout(4000)
  head('1 · agreeing releases them')
  const rows = await (await rest(`member_terms_consents?select=doc_key,granted,evidence,terms_version_id&member_no=eq.${MEM}`)).json()
  ok(rows.length === 1, 'exactly one consent row', `${rows.length}`)
  ok(rows[0]?.evidence?.scrolled_to_end === true, 'recording that they reached the end')
  ok(rows[0]?.evidence?.version_agreed === '1.0', 'and the version they agreed to', rows[0]?.evidence?.version_agreed)
  await page.goto(`${APP}/members/taste`, { waitUntil:'domcontentloaded' })
  await page.waitForTimeout(800)
  ok(!page.url().includes('/members/agree'), 'the member is RELEASED and reaches the portal', page.url().replace(APP,''))
  await browser.close()
} catch(e){ ok(false,'harness', e.message.split('\n')[0]) }
finally {
  await rest(`member_terms_consents?member_no=eq.${MEM}`,{method:'DELETE'})
  await rest(`profiles?member_no=eq.${MEM}`,{method:'PATCH',body:JSON.stringify({member_no:null})})
  if(user) await fetch(`${U}/auth/v1/admin/users/${user}`,{method:'DELETE',headers:svcH})
  await rest(`members?member_no=eq.${MEM}`,{method:'DELETE'})
  console.log('\n  ZZ-GATE fixtures removed')
}
console.log(fails===0?'\nPASS\n':`\nFAIL — ${fails}\n`); process.exit(fails===0?0:1)
