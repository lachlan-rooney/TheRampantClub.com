// An event picture on a bolted-down shared tablet must not land in Cache Storage.
//
// THE CONTROL MATTERS MORE THAN THE ASSERTION HERE. "Nothing was cached" is
// trivially true if the service worker never ran. So this first proves the SW is
// active AND caching something, and only then that it cached nothing from the
// attachment path.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
const env={}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U=env.NEXT_PUBLIC_SUPABASE_URL,S=env.SUPABASE_SERVICE_ROLE_KEY
const h={apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'application/json'}
const PASS='ZZ-Probe-Pass-2691', EMAIL='zz-cache@example.invalid', MNO='ZZ-CACHE9'
let fails=0; const ok=(c,l,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c)fails++}
let uid, entryId, attId, storagePath
const cleanup=async()=>{
  if(storagePath) await fetch(`${U}/storage/v1/object/entry-attachments/${storagePath}`,{method:'DELETE',headers:{apikey:S,Authorization:`Bearer ${S}`}})
  if(attId) await fetch(`${U}/rest/v1/entry_attachments?id=eq.${attId}`,{method:'DELETE',headers:h})
  if(entryId) await fetch(`${U}/rest/v1/calendar_entries?id=eq.${entryId}`,{method:'DELETE',headers:h})
  await fetch(`${U}/rest/v1/profiles?member_no=eq.${MNO}`,{method:'DELETE',headers:h})
  await fetch(`${U}/rest/v1/members?member_no=eq.${MNO}`,{method:'DELETE',headers:h})
  if(uid) await fetch(`${U}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:h})
}
try{
  await cleanup()
  const today=new Date(Date.now()+7*3600e3).toISOString().slice(0,10)
  entryId=(await (await fetch(`${U}/rest/v1/calendar_entries`,{method:'POST',headers:{...h,Prefer:'return=representation'},
    body:JSON.stringify({title:'ZZ Cache Probe',entry_date:today,kind:'event',visibility:'member',blocks_space:false})})).json())[0].id
  const jpg=await sharp({create:{width:64,height:64,channels:3,background:'#7a1f1f'}}).jpeg().toBuffer()
  storagePath=`calendar_entry/${entryId}/${Date.now()}.jpg`
  await fetch(`${U}/storage/v1/object/entry-attachments/${storagePath}`,{method:'POST',headers:{apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'image/jpeg'},body:jpg})
  attId=(await (await fetch(`${U}/rest/v1/entry_attachments`,{method:'POST',headers:{...h,Prefer:'return=representation'},
    body:JSON.stringify({entity_type:'calendar_entry',entity_id:entryId,storage_path:storagePath,mime:'image/jpeg',bytes:jpg.length,filename:'poster.jpg',verified_kind:'jpeg'})})).json())[0].id

  await fetch(`${U}/rest/v1/members`,{method:'POST',headers:h,body:JSON.stringify({member_no:MNO,full_name:'ZZ Cache Probe',tier:'Legacy',status:'Active'})})
  uid=(await (await fetch(`${U}/auth/v1/admin/users`,{method:'POST',headers:h,body:JSON.stringify({email:EMAIL,password:PASS,email_confirm:true})})).json()).id
  await fetch(`${U}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:h,body:JSON.stringify({member_no:MNO,display_name:'ZZ Cache Probe'})})
  if(!(await (await fetch(`${U}/rest/v1/profiles?select=id&id=eq.${uid}`,{headers:h})).json())[0])
    await fetch(`${U}/rest/v1/profiles`,{method:'POST',headers:h,body:JSON.stringify({id:uid,member_no:MNO,display_name:'ZZ Cache Probe'})})

  const browser=await chromium.launch({channel:'chrome'})
  const ctx=await browser.newContext(); const page=await ctx.newPage()

  // Sign in so the attachment route will serve (it requires a session).
  await page.goto('http://localhost:3001/login',{waitUntil:'domcontentloaded'})
  await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASS)
  await page.click('button[type="submit"]'); await page.waitForURL(/\/members/,{timeout:20000})

  // ── THE CONTROL: the service worker must actually be running and caching ──
  await page.goto('http://localhost:3001/kiosk/pair',{waitUntil:'domcontentloaded'})
  // BOUNDED. PWARegistrar returns early unless NODE_ENV === 'production', so
  // against a dev server serviceWorker.ready never resolves and this hung
  // forever with no output. A test that cannot fail cannot pass either.
  const active=await page.evaluate(async () => {
    const ready = navigator.serviceWorker?.ready
    if (!ready) return false
    const r = await Promise.race([ready, new Promise(res => setTimeout(() => res(null), 8000))])
    return !!(r && r.active)
  })
  ok(active,'the service worker is ACTIVE on a kiosk page (needs a PRODUCTION build)')
  if (!active) throw new Error('service worker never became active — run against `npm start`, not `npm run dev`')
  await page.goto('http://localhost:3001/members',{waitUntil:'domcontentloaded'})
  await page.waitForTimeout(2500)
  const cachedAnything=await page.evaluate(async () => {
    const names=await caches.keys(); let n=0
    for (const k of names) n += (await (await caches.open(k)).keys()).length
    return n
  })
  ok(cachedAnything>0,'and it IS caching — so "nothing cached" below means something',`${cachedAnything} entries`)

  // ── Now fetch the attachment from a kiosk page and look again ──
  await page.goto('http://localhost:3001/kiosk/pair',{waitUntil:'domcontentloaded'})
  const got=await page.evaluate(async id => {
    const r = await fetch(`/api/entries/attachment/${id}`)
    return { ok: r.ok, len: (await r.blob()).size }
  }, attId)
  ok(got.ok && got.len>0,'the picture really was fetched on the kiosk page',`${got.len} bytes`)
  await page.waitForTimeout(2000)

  const leaked=await page.evaluate(async () => {
    const out=[]; const names=await caches.keys()
    for (const k of names) for (const req of await (await caches.open(k)).keys()) {
      const u=req.url
      if (u.includes('/api/entries/attachment') || u.includes('supabase.co') || u.includes('/kiosk')) out.push(u)
    }
    return out
  })
  ok(leaked.length===0,'NOTHING from the attachment path, storage host or /kiosk is in Cache Storage',
     leaked.length?leaked.slice(0,3).join(' | '):'clean')

  await ctx.close(); await browser.close()
}catch(e){ ok(false,'threw','\n'+e.message.split('\n').slice(0,8).join('\n')) }
finally{ await cleanup(); console.log('\n  probe entry, file and member removed') }
console.log(fails===0?'PASS\n':`FAIL — ${fails}\n`); process.exit(fails?1:0)
