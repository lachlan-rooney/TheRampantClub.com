// Verifies the Privacy Notice gate is INERT: a member who has never consented
// reaches /members/terms instead of being bounced to /members/agree.
//
// Uses a THROWAWAY MEMBER (member_no ZZ-GATE9), never a real one: the page needs
// a member_no because my_consent_state() keys on it, and writing verification
// rows onto a real member_no clobbers derived data.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const env = {}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U=env.NEXT_PUBLIC_SUPABASE_URL, S=env.SUPABASE_SERVICE_ROLE_KEY
const h={apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'application/json'}
const PASS='ZZ-Probe-Pass-2691', MNO='ZZ-GATE9', EMAIL='zz-gate@example.invalid'
let fails=0; const ok=(c,l,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c)fails++}
let uid
const cleanup = async () => {
  await fetch(`${U}/rest/v1/profiles?member_no=eq.${MNO}`,{method:'DELETE',headers:h})
  await fetch(`${U}/rest/v1/members?member_no=eq.${MNO}`,{method:'DELETE',headers:h})
  if (uid) await fetch(`${U}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:h})
}
try {
  await cleanup()
  await fetch(`${U}/rest/v1/members`,{method:'POST',headers:h,body:JSON.stringify({member_no:MNO,full_name:'ZZ Terms Probe',tier:'Legacy',status:'Active'})})
  uid=(await (await fetch(`${U}/auth/v1/admin/users`,{method:'POST',headers:h,body:JSON.stringify({email:EMAIL,password:PASS,email_confirm:true})})).json()).id
  await fetch(`${U}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:h,body:JSON.stringify({member_no:MNO,display_name:'ZZ Terms Probe'})})
  const prof=(await (await fetch(`${U}/rest/v1/profiles?select=member_no&id=eq.${uid}`,{headers:h})).json())[0]
  if(!prof?.member_no) { await fetch(`${U}/rest/v1/profiles`,{method:'POST',headers:h,body:JSON.stringify({id:uid,member_no:MNO,display_name:'ZZ Terms Probe'})}) }

  // NO CONSENT IS RECORDED. This member has never agreed to the Privacy Notice.
  // Before terms_documents.privacy.required was set false, this run was redirected
  // to /members/agree and never reached the page. That redirect not happening IS
  // the assertion.
  const browser=await chromium.launch({channel:'chrome'})
  const page=await browser.newPage({viewport:{width:900,height:1400}})
  await page.goto('http://localhost:3001/login',{waitUntil:'domcontentloaded'})
  await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASS)
  await page.click('button[type="submit"]'); await page.waitForURL(/\/members/,{timeout:20000})

  await page.goto('http://localhost:3001/members/terms',{waitUntil:'domcontentloaded'})
  const root=page.locator('.pg-root')
  await root.waitFor({state:'visible',timeout:4000}).catch(()=>{})
  if(await root.count()){ await page.locator('.pg-close').first().click().catch(()=>{}); await root.waitFor({state:'detached',timeout:5000}).catch(()=>{}) }

  ok(page.url().includes('/members/terms'), 'landed on /members/terms', page.url().replace('http://localhost:3001',''))
  const doc=page.locator('.trc-doc')
  await doc.waitFor({timeout:15000})
  const en=await doc.innerText()
  ok(en.includes('WHAT IS THE RAMPANT CLUB?'),'the published agreement renders')
  ok(en.includes('Vientmaese'),'AS SIGNED — the known typo is on the page')
  ok(!en.includes('Hồng Diễm'),'the club signatory name is NOT shown to members')
  ok(!/APPLICATION FORM/i.test(en),'no application form')
  ok(!en.includes('Article 1: Club Name'),'the old hardcoded articles are gone')
  ok((await page.locator('body').innerText()).includes('Version 1.0'),'version and effective date shown')

  await page.locator('button', { hasText: /^VN$/ }).first().click()
  await page.waitForTimeout(500)
  const vn=await doc.innerText()
  ok(vn.includes('THE RAMPANT CLUB LÀ GÌ?'),'VN toggle renders the Vietnamese body')
  ok(!vn.includes('Hồng Diễm'),'the name is absent in Vietnamese too')
  console.log('\n  FIRST LINES AS A MEMBER SEES THEM\n  '+'-'.repeat(52))
  console.log(en.split('\n').filter(Boolean).slice(0,6).map(l=>'  '+l.slice(0,90)).join('\n'))
  console.log('  '+'-'.repeat(52))
  await browser.close()
} catch(e){ ok(false,'threw','\n'+e.message.split('\n').slice(0,8).join('\n')) }
finally { await cleanup(); console.log('\n  throwaway member removed') }
console.log(fails===0?'PASS\n':`FAIL — ${fails}\n`); process.exit(fails?1:0)
