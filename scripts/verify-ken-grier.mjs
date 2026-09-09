import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const env = {}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U=env.NEXT_PUBLIC_SUPABASE_URL, S=env.SUPABASE_SERVICE_ROLE_KEY
const h={apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'application/json'}
const PASS='ZZ-Probe-Pass-2691'
let fails=0; const ok=(c,l,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c)fails++}
const id=(await (await fetch(`${U}/auth/v1/admin/users`,{method:'POST',headers:h,body:JSON.stringify({email:'zz-look@example.invalid',password:PASS,email_confirm:true})})).json()).id
const browser=await chromium.launch({channel:'chrome'})
const page=await browser.newPage({viewport:{width:900,height:1300}})
try{
  await page.goto('http://localhost:3001/login',{waitUntil:'domcontentloaded'})
  await page.fill('input[type="email"]','zz-look@example.invalid'); await page.fill('input[type="password"]',PASS)
  await page.click('button[type="submit"]'); await page.waitForURL(/\/members/,{timeout:20000})
  await page.goto('http://localhost:3001/members/events',{waitUntil:'domcontentloaded'})
  const close=page.locator('.pg-close'); if(await close.count() && await close.first().isVisible().catch(()=>false)) await close.first().click()
  const card=page.locator('.wo-card',{hasText:'An Evening with Ken Grier'})
  await card.waitFor({timeout:15000})
  const txt=await card.innerText()
  ok(true,'the entry is live on What’s On')
  ok((await card.locator('.wo-count').innerText()).trim()==='0/6 in','six seats, none taken',(await card.locator('.wo-count').innerText()).trim())
  ok(/Social/i.test(txt),'tagged Social')
  ok(/Sheraton/.test(txt),'the EXTERNAL venue shows')
  ok(/cannot take guests/.test(txt),'the no-guests line is visible to members')
  ok(await card.getByRole('button',{name:'Sign me up'}).count()===1,'a member can sign up')
  // Under which tab does a non-sport fixture appear?
  await page.locator('.wo-tabbtn',{hasText:'Happenings'}).click(); await page.waitForTimeout(600)
  ok(await page.locator('.wo-card',{hasText:'An Evening with Ken Grier'}).count()===1,'appears under Happenings, not lost between tabs')
  await page.locator('.wo-tabbtn',{hasText:'Golf'}).click(); await page.waitForTimeout(600)
  ok(await page.locator('.wo-card',{hasText:'An Evening with Ken Grier'}).count()===0,'and does NOT appear under Golf')
  console.log('\n  CARD AS A MEMBER SEES IT\n  ' + '-'.repeat(56))
  console.log(txt.split('\n').map(l=>'  '+l).join('\n'))
  console.log('  ' + '-'.repeat(56))
}catch(e){ ok(false,'render check threw',e.message.split('\n')[0]) }
finally{ await browser.close(); await fetch(`${U}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:h}) }
console.log(fails===0?'\nPASS\n':`\nFAIL — ${fails}\n`); process.exit(fails?1:0)
