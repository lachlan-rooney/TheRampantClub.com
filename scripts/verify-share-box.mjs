// Verifies the share box in the ADMIN calendar, in a real browser.
//
// Assertion #1 is the one that matters: a STAFF-ONLY entry shows NO box. Every
// private booking here is titled with a member's name, so a box on one is a
// one-tap route to putting that name in a group chat.
//
// Uses a THROWAWAY ADMIN, created and removed inside this run.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const env = {}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U=env.NEXT_PUBLIC_SUPABASE_URL, S=env.SUPABASE_SERVICE_ROLE_KEY
const h={apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'application/json'}
const PASS='ZZ-Probe-Pass-2691', EMAIL='zz-admin@example.invalid'
let fails=0; const ok=(c,l,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c)fails++}
const today=new Date(Date.now()+7*3600e3).toISOString().slice(0,10)
let uid, ids=[]
const cleanup=async()=>{
  for(const id of ids) await fetch(`${U}/rest/v1/calendar_entries?id=eq.${id}`,{method:'DELETE',headers:h})
  await fetch(`${U}/rest/v1/calendar_entries?title=like.ZZ*`,{method:'DELETE',headers:h})
  if(uid) await fetch(`${U}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:h})
}
try{
  await cleanup()
  const mk=async body=>{const r=await fetch(`${U}/rest/v1/calendar_entries`,{method:'POST',headers:{...h,Prefer:'return=representation'},body:JSON.stringify(body)});const j=await r.json();ids.push(j[0].id);return j[0]}
  await mk({ title:'ZZ Member Tasting', title_vn:'ZZ Nếm Thử', entry_date:today, start_time:'19:00',
             space:'The Studio', kind:'tasting', visibility:'member', blocks_space:false,
             board_note:'A quiet hour with the new Islay cask.', description:'INTERNAL: staff note, must never share' })
  await mk({ title:'ZZ Private hire — Mr Nguyen', entry_date:today, start_time:'20:00',
             space:'The Dining Room', kind:'private_hire', visibility:'staff', blocks_space:false,
             attendee:'Mr Nguyen (member)', description:'INTERNAL: staff note' })

  uid=(await (await fetch(`${U}/auth/v1/admin/users`,{method:'POST',headers:h,body:JSON.stringify({email:EMAIL,password:PASS,email_confirm:true})})).json()).id
  await fetch(`${U}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:h,body:JSON.stringify({is_admin:true,requires_staff_pick:false,display_name:'ZZ Admin'})})
  // A fresh auth user may have no profiles row yet — PATCH silently affects zero
  // rows and the login then lands on /members, not /admin.
  const chk=(await (await fetch(`${U}/rest/v1/profiles?select=is_admin&id=eq.${uid}`,{headers:h})).json())[0]
  if(!chk) await fetch(`${U}/rest/v1/profiles`,{method:'POST',headers:h,body:JSON.stringify({id:uid,is_admin:true,requires_staff_pick:false,display_name:'ZZ Admin'})})
  const chk2=(await (await fetch(`${U}/rest/v1/profiles?select=is_admin&id=eq.${uid}`,{headers:h})).json())[0]
  ok(chk2?.is_admin===true,'throwaway admin profile is in place')

  const browser=await chromium.launch({channel:'chrome'})
  const page=await browser.newPage({viewport:{width:1500,height:1400}})
  await page.goto('http://localhost:3001/login',{waitUntil:'domcontentloaded'})
  await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASS)
  await page.click('button[type="submit"]'); await page.waitForURL(/\/(members|admin)/,{timeout:20000})
  await page.goto('http://localhost:3001/admin/calendar',{waitUntil:'domcontentloaded'})

  await page.getByText('ZZ Member Tasting').first().waitFor({timeout:20000})
  ok(true,'admin calendar loaded with both entries')

  // EVERY card on the page, not just mine — the calendar carries real entries and
  // a count scoped to my two would prove nothing about the rest.
  const SHARE = /Share message|Tin nhắn chia sẻ/
  const staffCards  = page.locator('[data-visibility="staff"]')
  const memberCards = page.locator('[data-visibility="member"]')
  let staffWithBox = 0
  for (let i = 0; i < await staffCards.count(); i++)
    if (await staffCards.nth(i).getByRole('button', { name: SHARE }).count()) staffWithBox++
  let memberWithout = 0
  for (let i = 0; i < await memberCards.count(); i++)
    if (!(await memberCards.nth(i).getByRole('button', { name: SHARE }).count())) memberWithout++
  ok(staffWithBox === 0, `NO staff-only entry has a share box`, `${await staffCards.count()} staff cards on the page`)
  ok(memberWithout === 0, `every member-visible entry has one`, `${await memberCards.count()} member cards on the page`)

  const mine = page.locator(`[data-entry-id="${ids[0]}"]`)
  ok(await mine.count() === 1, 'my test entry is addressable')
  await mine.getByRole('button', { name: SHARE }).click()
  const ta = mine.locator('textarea')
  await ta.first().waitFor({timeout:10000})
  const enText = await ta.first().inputValue()
  const vnText = await ta.nth(1).inputValue()
  ok(/ZZ Member Tasting/.test(enText),'the draft carries the title')
  ok(/🥃/.test(enText),'the tasting emoji is at the head')
  ok(/quiet hour with the new Islay cask/.test(enText),'board_note (written FOR members) is the blurb')
  ok(!/INTERNAL/.test(enText+vnText),'the staff-only description is NOT in either draft')
  ok(!/Mr Nguyen/.test(enText+vnText),'no member name anywhere')
  ok(!/[*_~`]/.test(enText+vnText),'plain text — no markup')
  ok(/ZZ Nếm Thử/.test(vnText),'the VN draft uses title_vn')

  // Editing the draft must not write back to the entry.
  await ta.first().fill('EDITED IN THE BOX')
  await page.waitForTimeout(400)
  const row=(await (await fetch(`${U}/rest/v1/calendar_entries?select=title,board_note&id=eq.${ids[0]}`,{headers:h})).json())[0]
  ok(row.title==='ZZ Member Tasting' && !/EDITED/.test(row.board_note||''),'editing the draft did NOT alter the entry')

  console.log('\n  DRAFT AS SHOWN IN THE ADMIN BOX\n  '+'-'.repeat(50))
  console.log(vnText.split('\n').map(l=>'  '+l).join('\n'))
  console.log('  '+'-'.repeat(50))
  await browser.close()
}catch(e){ ok(false,'threw','\n'+e.message.split('\n').slice(0,10).join('\n')) }
finally{ await cleanup(); console.log('\n  throwaway admin + entries removed') }
console.log(fails===0?'PASS\n':`FAIL — ${fails}\n`); process.exit(fails?1:0)
