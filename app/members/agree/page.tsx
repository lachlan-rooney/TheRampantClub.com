'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Doc {
  doc_key: string; name_en: string; name_vn: string | null
  required: boolean; satisfied_by: string; needs_action: boolean; granted: boolean | null
  version: string | null; effective_date: string | null
  title_en: string | null; title_vn: string | null
  html_en: string | null; html_vn: string | null
  markdown_en: string | null; markdown_vn: string | null
}

export default function AgreePage() {
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [lang, setLang] = useState<'en' | 'vn'>('en')
  const [reached, setReached] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/members/documents', { cache: 'no-store' })
    if (r.ok) setDocs((await r.json()).documents || [])
  }, [])
  useEffect(() => { load() }, [load])

  const agree = async (d: Doc, granted = true) => {
    setBusy(d.doc_key); setMsg('')
    const r = await fetch('/api/members/documents/agree', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_key: d.doc_key, granted, language: lang, scrolled_to_end: !!reached[d.doc_key] }),
    })
    setBusy(null)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return setMsg(j.error || 'Could not record that.')
    setMsg(j.emailed ? 'Recorded. A copy is on its way to your email.' : 'Recorded.')
    await load()
    const left = (docs || []).filter(x => x.doc_key !== d.doc_key && x.needs_action)
    if (left.length === 0) setTimeout(() => router.push('/members'), 1200)
  }

  const pending = (docs || []).filter(d => d.needs_action)
  const optional = (docs || []).filter(d => !d.required && d.satisfied_by === 'consent')
  const signed = (docs || []).filter(d => d.satisfied_by === 'signature')

  return (
    // paddingBottom clears the fixed BottomTabBar (70px, z-index 8998). The layout
    // pads the document, but an element scrolled to the viewport's bottom EDGE can
    // still land under the bar — which is exactly what intercepted a real tap on the
    // agree control during verification.
    <div style={{ maxWidth: 760, paddingBottom: 96 }}>
      <h1 style={h1}>Before you go on</h1>
      <p style={intro}>
        Two documents, read at your own pace. You can keep a copy of either without agreeing to it,
        and we&rsquo;ll email you what you agreed to and when.
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '22px 0 6px' }}>
        {(['en', 'vn'] as const).map(l => (
          <button key={l} onClick={() => setLang(l)}
            style={{ ...tab, ...(lang === l ? tabOn : null) }}>{l === 'en' ? 'English' : 'Tiếng Việt'}</button>
        ))}
      </div>
      {/* Surfaced, not buried at paragraph six where the source document puts it. */}
      <p style={prevails}>
        Reading either language is enough. Where the two differ, the English version prevails.
        <span style={{ opacity: .7 }}> · Đọc một trong hai ngôn ngữ là đủ. Nếu có khác biệt, bản tiếng Anh được ưu tiên.</span>
      </p>

      {docs === null && <p style={{ opacity: .6, fontSize: 14 }}>Loading…</p>}

      {docs && pending.length === 0 && (
        <div style={done}>You&rsquo;re up to date. Nothing to agree to.</div>
      )}

      {pending.map(d => (
        <DocumentBlock key={d.doc_key} doc={d} lang={lang} busy={busy === d.doc_key}
          reached={!!reached[d.doc_key]}
          onReached={() => setReached(s => (s[d.doc_key] ? s : { ...s, [d.doc_key]: true }))}
          onAgree={() => agree(d, true)} />
      ))}

      {optional.length > 0 && docs && (
        <div style={{ marginTop: 40 }}>
          <div style={sectionLabel}>Optional</div>
          {optional.map(d => (
            <div key={d.doc_key} style={optRow}>
              <div>
                <div style={{ fontFamily: SERIF, fontSize: 17 }}>{lang === 'vn' && d.name_vn ? d.name_vn : d.name_en}</div>
                <div style={{ fontSize: 13, opacity: .65, marginTop: 3 }}>
                  Optional, and it never affects your membership. You&rsquo;ll still hear about anything
                  affecting your membership either way — that isn&rsquo;t marketing.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => agree(d, true)} style={smallBtn}>{d.granted ? 'On' : 'Turn on'}</button>
                <button onClick={() => agree(d, false)} style={smallGhost}>{d.granted === false ? 'Off' : 'No thanks'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {signed.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={sectionLabel}>Signed</div>
          {signed.map(d => (
            <div key={d.doc_key} style={{ ...optRow, display: 'block' }}>
              <div style={{ fontFamily: SERIF, fontSize: 17 }}>{lang === 'vn' && d.name_vn ? d.name_vn : d.name_en}</div>
              <div style={{ fontSize: 13, opacity: .65, marginTop: 3 }}>
                Executed by signature, not agreed here. Your signed copy is the record.
              </div>
            </div>
          ))}
        </div>
      )}

      {msg && <div style={{ marginTop: 20, fontSize: 13, color: '#2E7D52' }}>{msg}</div>}
    </div>
  )
}

function DocumentBlock({ doc, lang, reached, onReached, onAgree, busy }: {
  doc: Doc; lang: 'en' | 'vn'; reached: boolean; onReached: () => void; onAgree: () => void; busy: boolean
}) {
  const sentinel = useRef<HTMLDivElement | null>(null)
  const box = useRef<HTMLDivElement | null>(null)
  // onReached is a new closure on every parent render. Depending on it re-created
  // the observer each pass, which fired again, which set state again — a render
  // loop that never let the control settle. Hold it in a ref so the effect depends
  // only on the language.
  const reachedCb = useRef(onReached)
  reachedCb.current = onReached

  // THE SCROLL GATE. IntersectionObserver on a sentinel at the foot of the body —
  // NOT scrollTop/scrollHeight arithmetic, which is unreliable on mobile browsers
  // with dynamic toolbars and strands a member who cannot enable the button.
  //
  // The short-document case falls out for free: if the content fits the viewport
  // the sentinel is already intersecting, the observer fires on its first callback,
  // and the control enables immediately. No special case to get wrong.
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    // ROOT IS THE SCROLLING BOX, not the viewport — and the sentinel lives INSIDE
    // it. It was a sibling of the box at first, which meant scrolling the document
    // to its end never moved the sentinel and the control stayed disabled forever:
    // precisely the "member who cannot enable the button has no way forward"
    // failure. Caught by driving it in a real browser rather than reasoning about it.
    const io = new IntersectionObserver(
      es => { if (es.some(e => e.isIntersecting)) { reachedCb.current(); io.disconnect() } },
      { root: box.current ?? null, threshold: 0.01 })
    io.observe(el)
    return () => io.disconnect()
  }, [lang])

  const html = lang === 'vn' ? (doc.html_vn || doc.html_en) : doc.html_en
  const markdown = lang === 'vn' ? (doc.markdown_vn || doc.markdown_en) : doc.markdown_en
  const title = (lang === 'vn' ? doc.title_vn : doc.title_en) || (lang === 'vn' && doc.name_vn ? doc.name_vn : doc.name_en)

  const download = () => {
    const blob = new Blob([markdown || ''], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${doc.doc_key}-${doc.version || 'current'}.md`
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <section style={{ marginTop: 30 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>{title}</h2>
        <div style={{ fontFamily: MONO, fontSize: 11, opacity: .6 }}>
          version {doc.version}{doc.effective_date ? ` · ${doc.effective_date}` : ''}
        </div>
      </div>

      <div ref={box} style={body}>
        <div dangerouslySetInnerHTML={{ __html: html || '' }} />
        {/* The foot of the document, INSIDE the scrolling box. A short document
            leaves this already intersecting, so the control enables on the first
            observer callback with no special case. */}
        <div ref={sentinel} aria-hidden style={{ height: 1 }} />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
        <button onClick={onAgree} disabled={!reached || busy}
          style={{ ...btn, opacity: reached && !busy ? 1 : .35, cursor: reached && !busy ? 'pointer' : 'not-allowed' }}>
          {busy ? 'Recording…' : 'I agree'}
        </button>
        <button onClick={download} style={smallGhost}>Download a copy</button>
        {!reached && <span style={{ fontSize: 12, opacity: .55 }}>Read to the end to continue.</span>}
      </div>
    </section>
  )
}

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', monospace"
const h1: React.CSSProperties = { fontFamily: SERIF, fontSize: 30, marginBottom: 8 }
const intro: React.CSSProperties = { fontSize: 14, lineHeight: 1.75, opacity: .8, maxWidth: 620 }
const prevails: React.CSSProperties = { fontSize: 12.5, lineHeight: 1.7, opacity: .7, margin: '0 0 6px', maxWidth: 620 }
const body: React.CSSProperties = {
  marginTop: 18, padding: '22px 24px', maxHeight: '58vh', overflowY: 'auto',
  border: '1px solid rgba(5,46,32,.14)', borderRadius: 8, background: '#fff',
  fontSize: 15, lineHeight: 1.8,
}
const tab: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(5,46,32,.2)', borderRadius: 6,
  padding: '8px 16px', fontFamily: MONO, fontSize: 12, cursor: 'pointer', color: '#052E20',
}
const tabOn: React.CSSProperties = { background: '#052E20', color: '#E5D4C2', borderColor: '#052E20' }
const btn: React.CSSProperties = {
  background: '#052E20', color: '#E5D4C2', border: 'none', borderRadius: 6,
  padding: '14px 30px', fontFamily: MONO, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase',
}
const smallBtn: React.CSSProperties = { ...btn, padding: '10px 18px', fontSize: 12, cursor: 'pointer' }
const smallGhost: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(5,46,32,.25)', borderRadius: 6, color: '#052E20',
  padding: '10px 18px', fontFamily: MONO, fontSize: 12, cursor: 'pointer',
}
const sectionLabel: React.CSSProperties = {
  fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .55, marginBottom: 10,
}
const optRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
  border: '1px solid rgba(5,46,32,.12)', borderRadius: 8, padding: '14px 16px', marginBottom: 10,
}
const done: React.CSSProperties = {
  marginTop: 26, padding: '16px 18px', border: '1px solid rgba(46,125,82,.35)',
  background: 'rgba(46,125,82,.08)', borderRadius: 8, fontSize: 14,
}
