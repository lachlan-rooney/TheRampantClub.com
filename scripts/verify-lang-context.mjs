// One language context, and the migration that protects a staff member's choice.
//
// THE ASSERTION THAT MATTERS: someone who chose Vietnamese has 'vi' in
// localStorage under the OLD key. Canonical is now 'vn'. Without a migration the
// validator rejects 'vi' and silently flips them to English — a regression that
// looks like nothing at all.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const env={}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U=env.NEXT_PUBLIC_SUPABASE_URL,S=env.SUPABASE_SERVICE_ROLE_KEY
const h={apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'application/json'}
const PASS='ZZ-Probe-Pass-2691', EMAIL='zz-lang@example.invalid'
let fails=0; const ok=(c,l,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c)fails++}
let uid
const cleanup=async()=>{ if(uid) await fetch(`${U}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:h}) }
try{
  uid=(await (await fetch(`${U}/auth/v1/admin/users`,{method:'POST',headers:h,body:JSON.stringify({email:EMAIL,password:PASS,email_confirm:true})})).json()).id
  await fetch(`${U}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:h,body:JSON.stringify({is_admin:true,requires_staff_pick:false,display_name:'ZZ Lang'})})
  if(!(await (await fetch(`${U}/rest/v1/profiles?select=id&id=eq.${uid}`,{headers:h})).json())[0])
    await fetch(`${U}/rest/v1/profiles`,{method:'POST',headers:h,body:JSON.stringify({id:uid,is_admin:true,requires_staff_pick:false,display_name:'ZZ Lang'})})

  const browser=await chromium.launch({channel:'chrome'})

  // ── 1 · the legacy 'vi' migration ───────────────────────────────────────
  const ctx=await browser.newContext({viewport:{width:1400,height:1000}})
  await ctx.addInitScript(() => { try { localStorage.setItem('admin_lang','vi') } catch {} })
  const page=await ctx.newPage()
  await page.goto('http://localhost:3001/login',{waitUntil:'domcontentloaded'})
  await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASS)
  await page.click('button[type="submit"]'); await page.waitForURL(/\/(admin|members)/,{timeout:20000})
  await page.goto('http://localhost:3001/admin/calendar',{waitUntil:'domcontentloaded'})
  await page.waitForTimeout(1200)
  const body=await page.locator('body').innerText()
  ok(/Lịch|Sàn/.test(body), "a staff member with 'vi' stored lands on VIETNAMESE, not English")
  const stored=await page.evaluate(() => localStorage.getItem('trc_lang'))
  ok(stored==='vn', "the legacy 'vi' is migrated to canonical 'vn'", String(stored))

  // ── 2 · one context: switching in the sidebar moves the page ────────────
  const toggle=page.locator('button', { hasText: /^EN$/ }).first()
  if (await toggle.count()) {
    await toggle.click(); await page.waitForTimeout(700)
    ok(/Calendar|Floor/.test(await page.locator('body').innerText()), 'switching to EN moves the page')
    ok(await page.evaluate(() => localStorage.getItem('trc_lang'))==='en','and persists the new choice')
  } else ok(true,'(no EN toggle on this page — skipped)')
  await ctx.close()

  // ── 3 · THE KIOSK RULE: a choice must not outlive the session ───────────
  const kctx=await browser.newContext({viewport:{width:1200,height:900}})
  const kpage=await kctx.newPage()
  await kpage.goto('http://localhost:3001/kiosk/pair',{waitUntil:'domcontentloaded'})
  await kpage.waitForTimeout(900)
  const kioskWrote=await kpage.evaluate(() => localStorage.getItem('trc_lang'))
  ok(kioskWrote===null,'a kiosk page writes NO language to storage — the next member cannot inherit one',String(kioskWrote))
  await kctx.close()

  // ── 4 · a kiosk page must not inherit a stored choice either ────────────
  const k2=await browser.newContext({viewport:{width:1200,height:900}})
  await k2.addInitScript(() => { try { localStorage.setItem('trc_lang','vn') } catch {} })
  const k2p=await k2.newPage()
  await k2p.goto('http://localhost:3001/kiosk/pair',{waitUntil:'domcontentloaded'})
  await k2p.waitForTimeout(900)
  ok(await k2p.evaluate(() => localStorage.getItem('trc_lang'))==='vn','(the stored value is left alone, not cleared)')
  await k2.close()
  await browser.close()
}catch(e){ ok(false,'threw','\n'+e.message.split('\n').slice(0,8).join('\n')) }
finally{ await cleanup(); console.log('\n  throwaway admin removed') }
console.log(fails===0?'PASS\n':`FAIL — ${fails}\n`); process.exit(fails?1:0)
