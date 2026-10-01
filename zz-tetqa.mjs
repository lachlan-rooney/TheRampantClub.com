// /tet, judged as a visitor would: phone and desk, every control, every edge.
import { chromium, devices } from 'playwright'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
const S='/private/tmp/claude-501/-Users-lachlanrooney-Downloads-rampant-club/7c80ed44-dfe0-4d44-9d67-7c6fbe63e6ce/scratchpad'
const env={}; for (const l of readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^([A-Z_0-9]+)=(.*)$/); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,'')}
const exp=String(Date.now()+864e5)
const pass=exp+'.'+createHmac('sha256',env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')
const b=await chromium.launch()
const report={}
for (const [name, opts] of [
  ['phone',  { ...devices['iPhone 15'], isMobile:true, hasTouch:true }],
  ['tablet', { viewport:{width:834,height:1112}, hasTouch:true }],
  ['desk',   { viewport:{width:1440,height:960} }],
]) {
  const ctx=await b.newContext(opts)
  await ctx.addCookies([{name:'trc_tet',value:pass,domain:'localhost',path:'/'}])
  const p=await ctx.newPage()
  const errs=[]; p.on('pageerror',e=>errs.push(e.message.split('\n')[0].slice(0,100)))
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,100)) })
  const bad=[]
  await p.goto('http://localhost:3001/tet',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500)
  // walk the whole page so everything lazy has rendered
  await p.evaluate(async()=>{ for(let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60))} window.scrollTo(0,0) })
  await p.waitForTimeout(1200)

  // 1 — sideways scroll, and what causes it
  const over=await p.evaluate(()=>{
    const vw=document.documentElement.clientWidth
    const o=document.documentElement.scrollWidth-vw
    if (o<=1) return {o:0,who:[]}
    const who=[]
    for (const e of document.querySelectorAll('body *')) {
      const r=e.getBoundingClientRect()
      if (r.width>0 && (r.right>vw+1||r.left<-1)) who.push(`${e.tagName.toLowerCase()}.${(typeof e.className==='string'?e.className:'').trim().split(/\s+/)[0]||''} w=${Math.round(r.width)}`)
    }
    return {o,who:[...new Set(who)].slice(0,4)}
  })
  if (over.o>1) bad.push(`sideways scroll ${over.o}px — ${over.who.join(' | ')}`)

  // 2 — tap targets (phone/tablet only): anything clickable under 40px
  if (name!=='desk') {
    const small=await p.evaluate(()=>{
      const out=[]
      for (const e of document.querySelectorAll('button, a[href], [role=button], input, select')) {
        const r=e.getBoundingClientRect()
        if (r.width===0||r.height===0) continue
        if (getComputedStyle(e).visibility==='hidden') continue
        if (r.height<40||r.width<40) out.push(`${e.tagName.toLowerCase()}.${(typeof e.className==='string'?e.className:'').trim().split(/\s+/)[0]||''} ${Math.round(r.width)}x${Math.round(r.height)} "${(e.textContent||'').trim().slice(0,22)}"`)
      }
      return [...new Set(out)]
    })
    if (small.length) bad.push(`${small.length} tap targets under 40px: ${small.slice(0,6).join(' · ')}`)
  }

  // 3 — images that never loaded
  const broken=await p.evaluate(()=>[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.currentSrc||i.src).slice(0,5))
  if (broken.length) bad.push(`broken images: ${broken.join(', ')}`)

  // 4 — text clipped by its own box
  const clipped=await p.evaluate(()=>{
    const out=[]
    for (const e of document.querySelectorAll('h1,h2,h3,p,span,button,div')) {
      if (e.children.length) continue
      const cs=getComputedStyle(e)
      if (cs.overflow==='visible') continue
      if (e.scrollWidth>e.clientWidth+2 && cs.textOverflow!=='ellipsis' && cs.overflowX!=='auto' && cs.overflowX!=='scroll')
        out.push(`${e.tagName.toLowerCase()} "${(e.textContent||'').trim().slice(0,28)}"`)
    }
    return [...new Set(out)].slice(0,5)
  })
  if (clipped.length) bad.push(`text clipped: ${clipped.join(' · ')}`)

  if (errs.length) bad.push(`page errors: ${[...new Set(errs)].slice(0,3).join(' | ')}`)
  report[name]=bad
  await p.screenshot({path:`${S}/tet-${name}.png`, fullPage:false})
  await ctx.close()
}
for (const [k,v] of Object.entries(report)) {
  console.log(`\n── ${k} ──`)
  if (!v.length) console.log('   clean')
  for (const x of v) console.log('   ⚠ '+x)
}
await b.close()
