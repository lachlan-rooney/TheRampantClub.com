// THE ASSERTION THAT MATTERS: a member is REFUSED a staff-only entry's file.
//
// A staff-only entry is invisible to members by RLS. If its attachment were
// reachable, the file would be the way round the policy protecting the entry.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
const env={}
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'') }
const U=env.NEXT_PUBLIC_SUPABASE_URL,S=env.SUPABASE_SERVICE_ROLE_KEY
const h={apikey:S,Authorization:`Bearer ${S}`,'Content-Type':'application/json'}
const PASS='ZZ-Probe-Pass-2691', EMAIL='zz-att@example.invalid', MNO='ZZ-ATT9'
let fails=0; const ok=(c,l,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c)fails++}
const today=new Date(Date.now()+7*3600e3).toISOString().slice(0,10)
let uid, entries=[], atts=[], paths=[]
const cleanup=async()=>{
  for(const p of paths) await fetch(`${U}/storage/v1/object/entry-attachments/${p}`,{method:'DELETE',headers:{apikey:S,Authorization:`Bearer ${S}`}})
  for(const a of atts) await fetch(`${U}/rest/v1/entry_attachments?id=eq.${a}`,{method:'DELETE',headers:h})
  for(const e of entries) await fetch(`${U}/rest/v1/calendar_entries?id=eq.${e}`,{method:'DELETE',headers:h})
  await fetch(`${U}/rest/v1/profiles?member_no=eq.${MNO}`,{method:'DELETE',headers:h})
  await fetch(`${U}/rest/v1/members?member_no=eq.${MNO}`,{method:'DELETE',headers:h})
  if(uid) await fetch(`${U}/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:h})
}
const put=async(name,bytes,mime)=>{
  const p=`calendar_entry/${name}`
  await fetch(`${U}/storage/v1/object/entry-attachments/${p}`,{method:'POST',headers:{apikey:S,Authorization:`Bearer ${S}`,'Content-Type':mime},body:bytes})
  paths.push(p); return p
}
try{
  await cleanup()
  const mkEntry=async v=>{
    const r=await fetch(`${U}/rest/v1/calendar_entries`,{method:'POST',headers:{...h,Prefer:'return=representation'},
      body:JSON.stringify({title:`ZZ ${v} entry`,entry_date:today,kind:'event',visibility:v,blocks_space:false})})
    const j=(await r.json())[0]
    if(!j?.id) throw new Error(`entry insert (${v}) returned no row: HTTP ${r.status}`)
    entries.push(j.id); return j.id
  }
  const memberEntry=await mkEntry('member'), staffEntry=await mkEntry('staff')
  // A THIRD entry for the PDF: one attachment per entry is enforced by a unique
  // index, so hanging two off one entry is a 409 — the constraint working.
  const pdfEntry=await mkEntry('member')

  const jpg=await sharp({create:{width:64,height:64,channels:3,background:'#052E20'}}).jpeg().toBuffer()
  const doc=await PDFDocument.create(); doc.addPage(); const pdf=await doc.save()

  const mkAtt=async(entity_id,bytes,kind,mime,fname)=>{
    const p=await put(`${entity_id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${kind==='pdf'?'pdf':'jpg'}`,bytes,mime)
    const r=await fetch(`${U}/rest/v1/entry_attachments`,{method:'POST',headers:{...h,Prefer:'return=representation'},
      body:JSON.stringify({entity_type:'calendar_entry',entity_id,storage_path:p,mime,bytes:bytes.length,filename:fname,verified_kind:kind})})
    const j=(await r.json())[0]
    if(!j?.id) throw new Error(`attachment insert returned no row: HTTP ${r.status}`)
    atts.push(j.id); return j.id
  }
  const memberAtt=await mkAtt(memberEntry,jpg,'jpeg','image/jpeg','poster.jpg')
  const staffAtt =await mkAtt(staffEntry, jpg,'jpeg','image/jpeg','private-guest-list.jpg')
  const pdfAtt   =await mkAtt(pdfEntry,   pdf,'pdf','application/pdf','invitation.pdf')
  ok(true,'three entries staged: member-visible + staff-only + one for the PDF')
  const dupe=await fetch(`${U}/rest/v1/entry_attachments`,{method:'POST',headers:h,
    body:JSON.stringify({entity_type:'calendar_entry',entity_id:memberEntry,storage_path:'x/dupe.jpg',mime:'image/jpeg',bytes:10,filename:'d.jpg',verified_kind:'jpeg'})})
  ok(dupe.status===409,'a SECOND attachment on one entry is refused — one per entry',`HTTP ${dupe.status}`)

  // a throwaway MEMBER (not admin)
  await fetch(`${U}/rest/v1/members`,{method:'POST',headers:h,body:JSON.stringify({member_no:MNO,full_name:'ZZ Att Probe',tier:'Legacy',status:'Active'})})
  const ures=await fetch(`${U}/auth/v1/admin/users`,{method:'POST',headers:h,body:JSON.stringify({email:EMAIL,password:PASS,email_confirm:true})})
  const ujson=await ures.json(); uid=ujson.id
  if(!uid) throw new Error(`user create failed: HTTP ${ures.status} ${JSON.stringify(ujson).slice(0,140)}`)
  await fetch(`${U}/rest/v1/profiles?id=eq.${uid}`,{method:'PATCH',headers:h,body:JSON.stringify({member_no:MNO,display_name:'ZZ Att Probe'})})
  if(!(await (await fetch(`${U}/rest/v1/profiles?select=id&id=eq.${uid}`,{headers:h})).json())[0])
    await fetch(`${U}/rest/v1/profiles`,{method:'POST',headers:h,body:JSON.stringify({id:uid,member_no:MNO,display_name:'ZZ Att Probe'})})
  const prof=(await (await fetch(`${U}/rest/v1/profiles?select=is_admin&id=eq.${uid}`,{headers:h})).json())[0]
  ok(prof?.is_admin!==true,'the probe account is a MEMBER, not an admin')

  const browser=await chromium.launch({channel:'chrome'})
  const ctx=await browser.newContext()
  const page=await ctx.newPage()
  await page.goto('http://localhost:3001/login',{waitUntil:'domcontentloaded'})
  await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASS)
  await page.click('button[type="submit"]'); await page.waitForURL(/\/members/,{timeout:20000})

  const A='http://localhost:3001/api/entries/attachment/'
  console.log('\n── as a signed-in MEMBER ──')
  const good=await ctx.request.get(A+memberAtt)
  ok(good.ok(),'the member-visible entry’s image IS served',`HTTP ${good.status()}`)
  ok((await good.body()).slice(0,3).equals(Buffer.from([0xff,0xd8,0xff])),'and it is really the JPEG')

  const bad=await ctx.request.get(A+staffAtt)
  ok(bad.status()===404,'the STAFF-ONLY entry’s file is REFUSED',`HTTP ${bad.status()}`)
  ok(!(await bad.body()).slice(0,3).equals(Buffer.from([0xff,0xd8,0xff])),'and no image bytes come back')

  const pdfRes=await ctx.request.get(A+pdfAtt)
  ok(pdfRes.ok(),'the PDF is served',`HTTP ${pdfRes.status()}`)
  const cd=pdfRes.headers()['content-disposition']||''
  ok(/attachment/i.test(cd),'as a FILE (Content-Disposition: attachment), never inline',cd.slice(0,60))

  console.log('\n── signed out ──')
  const anonCtx=await browser.newContext()
  const anonRes=await anonCtx.request.get(A+memberAtt)
  ok(anonRes.status()===401,'an unauthenticated request is refused',`HTTP ${anonRes.status()}`)
  await anonCtx.close(); await ctx.close(); await browser.close()
}catch(e){ ok(false,'threw','\n'+e.message.split('\n').slice(0,8).join('\n')) }
finally{ await cleanup(); console.log('\n  probe entries, files and member removed') }
console.log(fails===0?'PASS\n':`FAIL — ${fails}\n`); process.exit(fails?1:0)
