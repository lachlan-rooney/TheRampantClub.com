// A THROWAWAY member with a real taste profile, so the merged page has
// something to draw. Removed at the end. Nothing is written to a real
// member_no — a taste profile on one would be clobbered by the derive script.
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
const env={}
for(const l of readFileSync('/Users/lachlanrooney/Downloads/rampant-club/.env.local','utf8').split('\n')){const m=l.match(/^([A-Z_0-9]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'')}
const U=env.NEXT_PUBLIC_SUPABASE_URL
const svc={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation'}
const rest=(p,i={})=>fetch(`${U}/rest/v1/${p}`,{headers:svc,...i})
const admin=(p,i)=>fetch(`${U}/auth/v1/admin/${p}`,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},...i})
const M='ZZ-PAL'
const mode=process.argv[2]
const BASE=process.env.BASE||'http://localhost:3001'

const wipe=async()=>{
  await rest(`member_taste_profiles?member_no=eq.${M}`,{method:'DELETE'})
  await rest(`member_terms_consents?member_no=eq.${M}`,{method:'DELETE'})
  const ps=await (await rest(`profiles?member_no=eq.${M}&select=id`)).json()
  for(const x of ps||[]){
    await rest(`activity_events?actor=eq.${x.id}`,{method:'DELETE'})
    await rest(`tasting_notes?author=eq.${x.id}`,{method:'DELETE'})
    await rest(`profiles?id=eq.${x.id}`,{method:'DELETE'})
    await admin(`users/${x.id}`,{method:'DELETE'})
  }
  await rest(`members?member_no=eq.${M}`,{method:'DELETE'})
}

if (mode==='down'){ await wipe(); console.log('cleaned'); process.exit(0) }

await wipe()
await rest('members',{method:'POST',body:JSON.stringify({member_no:M,full_name:'ZZ Palate Member',tier:'Pioneer',status:'Active'})})
const email=`zz-pal-${randomUUID().slice(0,8)}@example.invalid`
const u=await (await admin('users',{method:'POST',body:JSON.stringify({email,password:`zz-${randomUUID()}`,email_confirm:true})})).json()
await rest('profiles',{method:'POST',headers:{...svc,Prefer:'resolution=merge-duplicates,return=representation'},
  body:JSON.stringify({id:u.id,display_name:'ZZ Palate Member',member_no:M,is_admin:false})})
// CONSENT THROUGH THE APP'S OWN ROUTE, not a hand-rolled insert. My first
// attempt inserted member_terms_consents rows directly and never checked the
// response — they all failed, my_consent_state still said needs_action, and the
// page under test was never reached. The sanctioned path is also the one that
// proves record_my_consent works.
const ref=U.match(/https:\/\/([a-z0-9]+)\./)[1]
const {createHmac}=await import('node:crypto')
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url')
const now=Math.floor(Date.now()/1000)
const un=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:u.id,email,role:'authenticated',aud:'authenticated',iat:now,exp:now+3600,app_metadata:{provider:'email'},user_metadata:{}})
const jwt=un+'.'+createHmac('sha256',env.SUPABASE_JWT_SECRET).update(un).digest('base64url')
const se={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'x',user:{id:u.id,aud:'authenticated',role:'authenticated',email,app_metadata:{},user_metadata:{}}}
const cv='base64-'+Buffer.from(JSON.stringify(se)).toString('base64url')
const cookie = cv.length<=3180 ? `sb-${ref}-auth-token=${cv}`
  : (()=>{const ps=[];for(let i=0,n=0;i<cv.length;i+=3180,n++)ps.push(`sb-${ref}-auth-token.${n}=${cv.slice(i,i+3180)}`);return ps.join('; ')})()

const state=await (await fetch(`${BASE}/api/members/documents`,{headers:{cookie}})).json()
for (const d of (state.documents||[]).filter(x=>x.needs_action)) {
  const r=await fetch(`${BASE}/api/members/documents/agree`,{method:'POST',
    headers:{cookie,'Content-Type':'application/json'},
    body:JSON.stringify({doc_key:d.doc_key,granted:true,language:'en',scrolled_to_end:true})})
  const j=await r.json().catch(()=>({}))
  if(!r.ok) { console.error('consent FAILED for '+d.doc_key+':', JSON.stringify(j)); process.exit(1) }
  // Proves the email suppression at the same time: privacy must NOT be emailed.
  console.error(`  consented ${d.doc_key} · emailed=${j.emailed}`)
}
// a real-shaped taste profile
await rest('member_taste_profiles',{method:'POST',body:JSON.stringify({member_no:M,
  vector:{dried_fruit_walnut:3.4,baking_spice:2.4,orchard_fruit:2.0,pepper_tannin:1.8,vanilla_coconut:1.2,treacle_roast:0.9,floral_honeyed:0.4,leather_polished_oak:0.6},
  sources:{noted_count:2,loved_bottles:['ZZ Test Oloroso 12yo','ZZ Test Highland 15yo']},
  source_count:9})})
console.log(u.id)
