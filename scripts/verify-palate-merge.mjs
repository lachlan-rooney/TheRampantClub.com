// ═══════════════════════════════════════════════════════════════════════════
// IS YOUR PALATE ONE PAGE?
//   node scripts/seed-throwaway-palate.mjs        → prints a throwaway login id
//   AS=<that id> node scripts/verify-palate-merge.mjs
//   node scripts/seed-throwaway-palate.mjs down   → removes it
// ───────────────────────────────────────────────────────────────────────────
// Your Palate, Your Journey and Your Notes were three nav entries for one
// subject: the first drew a radar of the member's flavour vector, the second
// drew THE SAME radar from the same vector, and the third listed the notes the
// second was already listing.
//
// ⚠ IT NEEDS A MEMBER WITH DATA, AND A CONSENTED ONE. Run as the owner it
// passes with three empty sections — TRC-DEMO has no taste profile and the club
// has no tasting notes at all — and as a real member the consent gate sends it
// to /members/agree instead. Hence the throwaway, which consents through the
// app's own route rather than by hand-inserting rows: my first attempt inserted
// member_terms_consents directly, never checked the response, and every insert
// failed silently while the page under test was never reached.
// ═══════════════════════════════════════════════════════════════════════════
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
const R='/Users/lachlanrooney/Downloads/rampant-club'
const env={}
for(const l of readFileSync(R+'/.env.local','utf8').split('\n')){const m=l.match(/^([A-Z_0-9]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'')}
const U=env.NEXT_PUBLIC_SUPABASE_URL, ref=U.match(/https:\/\/([a-z0-9]+)\./)[1]
const BASE=process.env.BASE||'http://localhost:3001'
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url'), now=Math.floor(Date.now()/1000)
const O=process.env.AS || '3e1583db-b881-42ec-aadb-6f69a22fad80'
const un=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:O,email:'lachlanrooney55@gmail.com',role:'authenticated',aud:'authenticated',iat:now,exp:now+3600,app_metadata:{provider:'email'},user_metadata:{}})
const jwt=un+'.'+createHmac('sha256',env.SUPABASE_JWT_SECRET).update(un).digest('base64url')
const se={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'x',user:{id:O,aud:'authenticated',role:'authenticated',email:'lachlanrooney55@gmail.com',app_metadata:{},user_metadata:{}}}
const v='base64-'+Buffer.from(JSON.stringify(se)).toString('base64url')
const cookies=[]
if(v.length<=3180)cookies.push({name:`sb-${ref}-auth-token`,value:v,domain:'localhost',path:'/'})
else for(let i=0,n=0;i<v.length;i+=3180,n++)cookies.push({name:`sb-${ref}-auth-token.${n}`,value:v.slice(i,i+3180),domain:'localhost',path:'/'})

let pass=0,fail=0
const t=(ok,m,d='')=>{ok?pass++:fail++;console.log(`${ok?'✓':'✗'} ${m}${d?' — '+d:''}`)}
const norm=s=>s.replace(/\s+/g,' ').toLowerCase()

const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:1280,height:1000}})
await ctx.addCookies(cookies)
const p=await ctx.newPage()
const errs=[]
p.on('pageerror',e=>errs.push(String(e).slice(0,160)))
p.on('response',r=>{if(r.status()>=400)errs.push(`${r.status()} ${r.url().replace(BASE,'')}`)})
// ERR_ABORTED is the nav's own notification poll being cancelled by a reload —
// normal, and not this page's doing. Anything else is real.
p.on('requestfailed',r=>{const e=r.failure()?.errorText||''
  if(e.includes('ERR_ABORTED')) return
  errs.push(`FAILED ${r.url().replace(BASE,'').slice(0,90)} :: ${e}`)})

// the two old addresses must land on the right section
for (const [from,to] of [['/members/notes','/members/taste'],['/members/journey','/members/taste']]) {
  await p.goto(BASE+from,{waitUntil:'networkidle'})
  t(p.url().includes(to), `${from} lands on Your Palate`, p.url().replace(BASE,''))
}

await p.goto(BASE+'/members/taste',{waitUntil:'networkidle'})
await p.waitForTimeout(3000)
const en=norm(await p.innerText('body'))
const s=await p.evaluate(()=>({
  secs:[...document.querySelectorAll('.pl-sec')].map(x=>x.id),
  jumps:[...document.querySelectorAll('.pl-jump-a')].map(x=>x.textContent.trim()),
  radars:document.querySelectorAll('svg.radar, .radar svg, [class*="radar"] svg').length,
}))
t(s.secs.join(',')==='now,journey,notes', 'three sections, in order', s.secs.join(' · '))
t(s.jumps.length===3, 'and three jump links', s.jumps.join(' / '))
t(en.includes('where it stands')&&en.includes('how it has moved')&&en.includes('what you wrote'),
  'each section is named')
t(errs.length===0,'no errors on the merged page',errs.slice(0,3).join(' | '))
// DID THE SECTIONS ACTUALLY DRAW? With a member who has a taste profile the
// radar must render — otherwise "three headings and three empty states" would
// pass as a successful merge.
const drew=await p.evaluate(()=>{
  const sec=id=>document.getElementById(id)
  const svgs=id=>sec(id)?sec(id).querySelectorAll('svg').length:0
  return {nowSvgs:svgs('now'), journeySvgs:svgs('journey'),
          nowChars:sec('now')?.innerText.trim().length||0,
          journeyChars:sec('journey')?.innerText.trim().length||0,
          notesChars:sec('notes')?.innerText.trim().length||0}
})
console.log('   sections →', JSON.stringify(drew))
// THE RADAR IS DRAWN ONCE. Two of them on one page is the complaint itself.
t(drew.nowSvgs>=1 && drew.journeySvgs===0, 'the radar is drawn ONCE, in section 01',
  `now ${drew.nowSvgs} · journey ${drew.journeySvgs}`)
t(drew.nowChars>100 && drew.notesChars>0, 'and every section has real content',
  `${drew.nowChars} / ${drew.journeyChars} / ${drew.notesChars} chars`)

// VN
await p.evaluate(()=>localStorage.setItem('trc_lang','vn'))
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(3000)
const vn=norm(await p.innerText('body'))
t(vn.includes('khẩu vị hiện tại')&&vn.includes('đã thay đổi thế nào')&&vn.includes('ghi chú của bạn'),
  'the section names turn over to VN')
t(!vn.includes('where it stands')&&!vn.includes('what you wrote'),'with no English left in them')
console.log('\nlengths — EN body '+en.length+' ch, VN body '+vn.length+' ch')
await b.close()
console.log(`\n${pass} passed, ${fail} failed`)
