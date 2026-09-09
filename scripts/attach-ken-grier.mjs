// Attaches the Ve Dể Di invitation to the Ken Grier fixture THROUGH THE REAL
// ADMIN ROUTE, so the file gets the same treatment every other upload gets:
// magic-byte check, sharp re-encode (EXIF stripped), Content-Type set from what
// the bytes are.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
const env={}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U=env.NEXT_PUBLIC_SUPABASE_URL,S=env.SUPABASE_SERVICE_ROLE_KEY
const h={apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'application/json'}
const FIXTURE='5c158445-83fb-481e-a122-b38a7ccb5b9d'
const SRC='/Users/lachlanrooney/Downloads/Ken Grier.jpeg'
const PASS='ZZ-Probe-Pass-2691', EMAIL='zz-upload@example.invalid'
let fails=0; const ok=(c,l,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c)fails++}
let uid
try{
  const bytes=readFileSync(SRC)
  const before=await sharp(bytes).metadata()
  console.log(`  source: ${before.width}x${before.height} ${before.format}, exif ${before.exif?before.exif.length+'B':'none'}`)

  uid=(await (await fetch(`${U}/auth/v1/admin/users`,{method:'POST',headers:h,body:JSON.stringify({email:EMAIL,password:PASS,email_confirm:true})})).json()).id
  await fetch(`${U}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:h,body:JSON.stringify({is_admin:true,requires_staff_pick:false,display_name:'ZZ Upload'})})
  if(!(await (await fetch(`${U}/rest/v1/profiles?select=id&id=eq.${uid}`,{headers:h})).json())[0])
    await fetch(`${U}/rest/v1/profiles`,{method:'POST',headers:h,body:JSON.stringify({id:uid,is_admin:true,requires_staff_pick:false,display_name:'ZZ Upload'})})

  const browser=await chromium.launch({channel:'chrome'})
  const ctx=await browser.newContext(); const page=await ctx.newPage()
  await page.goto('http://localhost:3001/login',{waitUntil:'domcontentloaded'})
  await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASS)
  await page.click('button[type="submit"]'); await page.waitForURL(/\/(admin|members)/,{timeout:20000})

  const res=await ctx.request.post(`http://localhost:3001/api/admin/entries/fixture/${FIXTURE}/attachment`,{
    multipart:{ file:{ name:'Ken Grier.jpeg', mimeType:'image/jpeg', buffer:bytes } } })
  const body=await res.json()
  ok(res.ok(),'uploaded through the admin route',`HTTP ${res.status()} ${JSON.stringify(body).slice(0,120)}`)
  await ctx.close(); await browser.close()

  const row=(await (await fetch(`${U}/rest/v1/entry_attachments?select=*&entity_id=eq.${FIXTURE}`,{headers:h})).json())[0]
  ok(!!row,'the attachment row exists',row?`${row.filename} · ${row.verified_kind} · ${(row.bytes/1024).toFixed(0)}KB`:'')

  const sg=await (await fetch(`${U}/storage/v1/object/sign/entry-attachments/${row.storage_path}`,{method:'POST',headers:h,body:JSON.stringify({expiresIn:60})})).json()
  const stored=Buffer.from(await (await fetch(`${U}/storage/v1${sg.signedURL||sg.signedUrl}`)).arrayBuffer())
  const after=await sharp(stored).metadata()
  ok(!after.exif,'the STORED file carries no EXIF')
  ok(after.width===before.width,'and the artwork is not degraded in size',`${after.width}x${after.height}`)
}catch(e){ ok(false,'threw','\n'+e.message.split('\n').slice(0,6).join('\n')) }
finally{ if(uid) await fetch(`${U}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:h}); console.log('  throwaway admin removed') }
console.log(fails===0?'PASS\n':`FAIL — ${fails}\n`); process.exit(fails?1:0)
