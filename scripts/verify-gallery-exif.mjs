// A member uploads a photo carrying GPS. The stored file must not.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
const env={}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U=env.NEXT_PUBLIC_SUPABASE_URL,S=env.SUPABASE_SERVICE_ROLE_KEY
const h={apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'application/json'}
const PASS='ZZ-Probe-Pass-2691', EMAIL='zz-exif@example.invalid', MNO='ZZ-EXIF9'
let fails=0; const ok=(c,l,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c)fails++}
let uid, eventId, storedPath
const cleanup=async()=>{
  if(storedPath) await fetch(`${U}/storage/v1/object/event-media/${storedPath}`,{method:'DELETE',headers:{apikey:S,Authorization:`Bearer ${S}`}})
  if(eventId){ await fetch(`${U}/rest/v1/event_media?event_id=eq.${eventId}`,{method:'DELETE',headers:h})
               await fetch(`${U}/rest/v1/events?id=eq.${eventId}`,{method:'DELETE',headers:h}) }
  await fetch(`${U}/rest/v1/profiles?member_no=eq.${MNO}`,{method:'DELETE',headers:h})
  await fetch(`${U}/rest/v1/members?member_no=eq.${MNO}`,{method:'DELETE',headers:h})
  if(uid) await fetch(`${U}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:h})
}
try{
  await cleanup()
  const ev=await fetch(`${U}/rest/v1/events`,{method:'POST',headers:{...h,Prefer:'return=representation'},
    body:JSON.stringify({title:'ZZ EXIF probe event',status:'visible',category:'social',event_date:new Date().toISOString().slice(0,10)})})
  const evj=await ev.json()
  if(!evj[0]?.id) throw new Error(`event insert: HTTP ${ev.status} ${JSON.stringify(evj).slice(0,160)}`)
  eventId=evj[0].id

  await fetch(`${U}/rest/v1/members`,{method:'POST',headers:h,body:JSON.stringify({member_no:MNO,full_name:'ZZ EXIF Probe',tier:'Legacy',status:'Active'})})
  const ur=await fetch(`${U}/auth/v1/admin/users`,{method:'POST',headers:h,body:JSON.stringify({email:EMAIL,password:PASS,email_confirm:true})})
  uid=(await ur.json()).id
  await fetch(`${U}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:h,body:JSON.stringify({member_no:MNO,display_name:'ZZ EXIF Probe'})})
  if(!(await (await fetch(`${U}/rest/v1/profiles?select=id&id=eq.${uid}`,{headers:h})).json())[0])
    await fetch(`${U}/rest/v1/profiles`,{method:'POST',headers:h,body:JSON.stringify({id:uid,member_no:MNO,display_name:'ZZ EXIF Probe'})})

  // A photo as a phone produces it: GPS, a timestamp, a camera.
  const withGps=await sharp({create:{width:96,height:96,channels:3,background:'#2f4f2f'}})
    .jpeg().withExif({ IFD0:{ Make:'ZZPhone', DateTime:'2026:09:09 14:00:00' },
                       GPS:{ GPSLatitudeRef:'N', GPSLongitudeRef:'E' } }).toBuffer()
  const before=await sharp(withGps).metadata()
  ok(!!before.exif,'the uploaded photo really carries EXIF',`${before.exif?.length} bytes`)

  const browser=await chromium.launch({channel:'chrome'})
  const ctx=await browser.newContext(); const page=await ctx.newPage()
  await page.goto('http://localhost:3001/login',{waitUntil:'domcontentloaded'})
  await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASS)
  await page.click('button[type="submit"]'); await page.waitForURL(/\/members/,{timeout:20000})

  const res=await ctx.request.post(`http://localhost:3001/api/members/events/${eventId}/media/upload`,{
    multipart:{ file:{ name:'holiday.jpg', mimeType:'image/jpeg', buffer:withGps } } })
  ok(res.ok(),'the member upload succeeds through the server route',`HTTP ${res.status()}`)
  const body=await res.json()
  storedPath=body.storage_path
  ok(!!storedPath,'a storage path came back',String(storedPath))

  const fetched=await ctx.request.get(body.url)
  const stored=Buffer.from(await fetched.body())
  const after=await sharp(stored).metadata()
  ok(!after.exif,'THE STORED FILE CARRIES NO EXIF — no GPS, no timestamp, no camera')
  ok(stored.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff])),'and it is still a valid JPEG')

  console.log('\n── the attack the old path allowed ──')
  const html=Buffer.from('<html><script>alert(document.cookie)</script></html>')
  const bad=await ctx.request.post(`http://localhost:3001/api/members/events/${eventId}/media/upload`,{
    multipart:{ file:{ name:'photo.jpg', mimeType:'image/jpeg', buffer:html } } })
  ok(bad.status()===400,'HTML declared image/jpeg is REFUSED',`HTTP ${bad.status()}`)

  await ctx.close(); await browser.close()
}catch(e){ ok(false,'threw','\n'+e.message.split('\n').slice(0,8).join('\n')) }
finally{ await cleanup(); console.log('\n  probe event, photo and member removed') }
console.log(fails===0?'PASS\n':`FAIL — ${fails}\n`); process.exit(fails?1:0)
