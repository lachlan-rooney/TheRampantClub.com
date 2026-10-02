// ═══════════════════════════════════════════════════════════════════════════
// CAN A MEMBER REACH THE SIGN-IN BUTTON ON A TABLET?
//   node scripts/verify-kiosk-signin-reach.mjs        (dev server on :3001)
// ───────────────────────────────────────────────────────────────────────────
// Owner, 2026-10-02: "The member log in button on the tbalet is hidden behind
// the bottom nav."
//
// ⚠ IT ONLY SHOWS UP AT KEYBOARD HEIGHTS. At a tablet's real 1280x800 every
// control is clear of the bar and this passes — which is why it was never
// caught. The bug belongs to the state the member is actually in: focusing the
// PIN field opens the Android keyboard, 100dvh collapses to under half the
// screen, and the page (which needs 468px) overflows a 282px gap above a
// position: fixed bar.
//
// AND AT THE REALISTIC MOMENT. It fills the surname and six digits first:
// asking whether Continue is reachable on an untouched screen asks the question
// before anybody needs the answer.
//
// elementFromPoint over each control's own centre is the test — "it is on the
// page" and "a thumb lands on it" are different claims.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
const R='/Users/lachlanrooney/Downloads/rampant-club'
const env={}
for(const l of readFileSync(R+'/.env.local','utf8').split('\n')){const m=l.match(/^([A-Z_0-9]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'')}
const U=env.NEXT_PUBLIC_SUPABASE_URL, BASE='http://localhost:3001'
const svc={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation'}
const rest=(p,i={})=>fetch(`${U}/rest/v1/${p}`,{headers:svc,...i})
const ref=U.match(/https:\/\/([a-z0-9]+)\./)[1]
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url'), now=Math.floor(Date.now()/1000)
const O='3e1583db-b881-42ec-aadb-6f69a22fad80'
const un=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:O,email:'lachlanrooney55@gmail.com',role:'authenticated',aud:'authenticated',iat:now,exp:now+3600,app_metadata:{provider:'email'},user_metadata:{}})
const jwt=un+'.'+createHmac('sha256',env.SUPABASE_JWT_SECRET).update(un).digest('base64url')
const se={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'x',user:{id:O,aud:'authenticated',role:'authenticated',email:'lachlanrooney55@gmail.com',app_metadata:{},user_metadata:{}}}
const av='base64-'+Buffer.from(JSON.stringify(se)).toString('base64url')
const adminCookie=av.length<=3180?`sb-${ref}-auth-token=${av}`:(()=>{const ps=[];for(let i=0,n=0;i<av.length;i+=3180,n++)ps.push(`sb-${ref}-auth-token.${n}=${av.slice(i,i+3180)}`);return ps.join('; ')})()
const LABEL='ZZ-BOARD2'
await rest(`kiosk_devices?label=eq.${LABEL}`,{method:'DELETE'})
const made=await (await fetch(`${BASE}/api/admin/kiosk-devices`,{method:'POST',headers:{cookie:adminCookie,'Content-Type':'application/json'},body:JSON.stringify({label:LABEL,room:'The Dining Room'})})).json()
const paired=await fetch(`${BASE}/api/kiosk/pair`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:made.pair_code})})
const device=((paired.headers.getSetCookie?.()||[]).find(c=>c.startsWith('trc_kiosk_device='))||'').split(';')[0].split('=')[1]

let bad=0
const b=await chromium.launch()
// The heights an Android soft keyboard leaves behind. A tablet keyboard takes
// roughly 40-45% of the screen, so a 800px-tall tablet becomes ~450px and a
// 768px one ~430px. THIS is the state the member is in while typing a PIN.
for (const vp of [{w:1280,h:800,n:'landscape'},{w:1280,h:450,n:'+keyboard'},{w:1280,h:360,n:'+big keyboard'},{w:800,h:700,n:'portrait +kbd'},{w:800,h:560,n:'portrait +big kbd'}]) {
  const ctx=await b.newContext({viewport:{width:vp.w,height:vp.h},hasTouch:true})
  await ctx.addCookies([{name:'trc_kiosk_device',value:device,domain:'localhost',path:'/'}])
  const p=await ctx.newPage()
  await p.goto(`${BASE}/kiosk/member`,{waitUntil:'networkidle'}); await p.waitForTimeout(1500)
  // THE REALISTIC MOMENT: a surname and six digits typed. Measuring an untouched
  // screen asks whether the button is reachable before anyone needs it.
  const ins=await p.$$('input')
  if(ins[0]) await ins[0].fill('Rooney')
  if(ins[1]) await ins[1].fill('123456')
  await p.waitForTimeout(900)
  const r=await p.evaluate(()=>{
    const bar=document.querySelector('.kbar')
    const barY=bar?bar.getBoundingClientRect().top:Infinity
    const out=[]
    for (const el of document.querySelectorAll('button, input')) {
      const q=el.getBoundingClientRect()
      if(!q.width&&!q.height) continue
      if (el.closest('.kbar')) continue
      const label=(el.textContent||el.getAttribute('placeholder')||el.tagName).trim().slice(0,20)||el.tagName
      const hit=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2)
      const reach = hit===el||el.contains(hit)
      if (q.bottom>barY || q.bottom>window.innerHeight || !reach)
        out.push(`${label} [${Math.round(q.top)}-${Math.round(q.bottom)}] reach=${reach} hit=${hit?hit.tagName:'none'}`)
    }
    return {barY:Math.round(barY), vh:window.innerHeight,
            scrollH:document.documentElement.scrollHeight, blocked:out}
  })
    const ok = r.blocked.length === 0
  if (!ok) bad++
  console.log(`${ok ? '✓' : '✗'} ${vp.n.padEnd(18)} bar@${r.barY} vh=${r.vh} page=${r.scrollH} ${ok ? 'all reachable' : 'BLOCKED → ' + r.blocked.join(' | ')}`)
  await ctx.close()
}
await b.close()
await rest(`kiosk_devices?label=eq.${LABEL}`,{method:'DELETE'})
console.log(bad ? `\n${bad} viewport(s) with an unreachable control` : '\nevery control reachable at every height')
process.exit(bad ? 1 : 0)
