'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/lang'
import { PublicPage } from '@/components/public/kit'
import { CreamInk, CreamInkDefs } from '@/components/public/CreamInk'

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
  // Folded onto the shared context. BEHAVIOUR IS UNCHANGED: `lang` still drives
  // what is rendered AND what goes into the consent payload, so `evidence` keeps
  // recording the language actually read — which is the whole point of capturing
  // it. Reading one language still suffices; that decision is untouched.
  const { lang, setLang, t } = useLang()
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
    if (!r.ok) return setMsg(j.error || t('Could not record that.', 'Chưa ghi nhận được.'))
    setMsg(j.emailed ? t('Recorded. A copy is on its way to your email.', 'Đã ghi nhận. Một bản sao đang được gửi đến email của bạn.') : t('Recorded.', 'Đã ghi nhận.'))
    await load()
    const left = (docs || []).filter(x => x.doc_key !== d.doc_key && x.needs_action)
    if (left.length === 0) setTimeout(() => router.push('/members'), 1200)
  }

  const pending = (docs || []).filter(d => d.needs_action)
  const optional = (docs || []).filter(d => !d.required && d.satisfied_by === 'consent')
  const signed = (docs || []).filter(d => d.satisfied_by === 'signature')

  return (
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <CreamInkDefs />
      {/* paddingBottom clears the fixed BottomTabBar (70px, z-index 8998). The layout
          pads the document, but an element scrolled to the viewport's bottom EDGE can
          still land under the bar — which is exactly what intercepted a real tap on the
          agree control during verification. */}
      <div className="ag-wrap" style={{ paddingBottom: 96 }}>
        <header className="ag-mast">
          <div className="ag-words">
            <h1 className="ag-h1 ag-rise">{t('Before you go on', 'Trước khi tiếp tục')}</h1>
            <p className="ag-intro ag-rise" style={{ animationDelay: '.08s' }}>
              {t('Two documents, read at your own pace. You can keep a copy of either without agreeing to it, and we’ll email you what you agreed to and when.',
                'Hai văn bản, xin bạn cứ đọc thong thả. Bạn có thể lưu bản sao của từng văn bản mà không cần đồng ý, và chúng tôi sẽ gửi email xác nhận nội dung bạn đã đồng ý cùng thời điểm đồng ý.')}
            </p>

            <div className="ag-tabs ag-rise" style={{ animationDelay: '.14s' }}>
              {(['en', 'vn'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={`ag-tab ${lang === l ? 'is-on' : ''}`}>{l === 'en' ? 'English' : 'Tiếng Việt'}</button>
              ))}
            </div>
            {/* Surfaced, not buried at paragraph six where the source document puts it. */}
            <p className="ag-prevails ag-rise" style={{ animationDelay: '.18s' }}>
              {/* Both languages stay on screen; the chosen one leads. */}
              {t(PREVAILS_EN, PREVAILS_VN)}
              <span style={{ opacity: .7 }}> · {t(PREVAILS_VN, PREVAILS_EN)}</span>
            </p>
          </div>
          <div className="ag-art ag-rise" style={{ animationDelay: '.2s' }}>
            <CreamInk name="lion-suit" width="100%" rot={4} dur={9} />
          </div>
        </header>

        <div className="ag-body">
          {docs === null && <p className="ag-quiet">{t('Loading…', 'Đang tải…')}</p>}

          {docs && pending.length === 0 && (
            <p className="ag-done">{t('You’re up to date. Nothing to agree to.', 'Bạn đã hoàn tất. Không còn văn bản nào cần đồng ý.')}</p>
          )}

          {pending.map(d => (
            <DocumentBlock key={d.doc_key} doc={d} lang={lang} busy={busy === d.doc_key}
              reached={!!reached[d.doc_key]}
              onReached={() => setReached(s => (s[d.doc_key] ? s : { ...s, [d.doc_key]: true }))}
              onAgree={() => agree(d, true)} />
          ))}

          {optional.length > 0 && docs && (
            <div className="ag-group">
              <h2 className="ag-h2">{t('Optional', 'Tuỳ chọn')}</h2>
              {optional.map(d => (
                <div key={d.doc_key} className="ag-row">
                  <div>
                    <div className="ag-row-t">{lang === 'vn' && d.name_vn ? d.name_vn : d.name_en}</div>
                    <div className="ag-row-s">
                      {t('Optional, and it never affects your membership. You’ll still hear about anything affecting your membership either way — that isn’t marketing.',
                        'Không bắt buộc, và không bao giờ ảnh hưởng đến tư cách thành viên của bạn. Dù chọn thế nào, bạn vẫn nhận được mọi thông tin liên quan đến tư cách thành viên — đó không phải là tiếp thị.')}
                    </div>
                  </div>
                  <div className="ag-opts">
                    <button onClick={() => agree(d, true)} className={`ag-opt ${d.granted ? 'is-on' : ''}`}>{d.granted ? t('On', 'Đang bật') : t('Turn on', 'Bật')}</button>
                    <button onClick={() => agree(d, false)} className={`ag-opt ${d.granted === false ? 'is-on' : ''}`}>{d.granted === false ? t('Off', 'Đã tắt') : t('No thanks', 'Không, cảm ơn')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {signed.length > 0 && (
            <div className="ag-group">
              <h2 className="ag-h2">{t('Signed', 'Đã ký')}</h2>
              {signed.map(d => (
                <div key={d.doc_key} className="ag-row is-block">
                  <div className="ag-row-t">{lang === 'vn' && d.name_vn ? d.name_vn : d.name_en}</div>
                  <div className="ag-row-s">
                    {t('Executed by signature, not agreed here. Your signed copy is the record.', 'Được xác lập bằng chữ ký, không đồng ý tại đây. Bản đã ký của bạn là văn bản lưu hồ sơ.')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {msg && <div className="ag-msg">{msg}</div>}
        </div>
      </div>
    </PublicPage>
  )
}

function DocumentBlock({ doc, lang, reached, onReached, onAgree, busy }: {
  doc: Doc; lang: 'en' | 'vn'; reached: boolean; onReached: () => void; onAgree: () => void; busy: boolean
}) {
  const { t } = useLang()
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
    <section className="ag-doc">
      <div className="ag-doc-head">
        <h2 className="ag-h2">{title}</h2>
        <div className="ag-ver">
          {t('version', 'phiên bản')} {doc.version}{doc.effective_date ? ` · ${doc.effective_date}` : ''}
        </div>
      </div>

      {/* The document on a sheet of the house paper — the sheet IS the
          scrolling box the gate observes. */}
      <div ref={box} className="ag-sheet">
        <div className="ag-html" dangerouslySetInnerHTML={{ __html: html || '' }} />
        {/* The foot of the document, INSIDE the scrolling box. A short document
            leaves this already intersecting, so the control enables on the first
            observer callback with no special case. */}
        <div ref={sentinel} aria-hidden style={{ height: 1 }} />
      </div>

      <div className="ag-actions">
        <button onClick={onAgree} disabled={!reached || busy} className="pk-cta ag-agree">
          {busy ? t('Recording…', 'Đang ghi nhận…') : <>{t('I agree', 'Tôi đồng ý')} <span className="pk-go">→</span></>}
        </button>
        <button onClick={download} className="ag-quietbtn">{t('Download a copy', 'Tải bản sao')}</button>
        {!reached && <span className="ag-hint">{t('Read to the end to continue.', 'Đọc đến cuối để tiếp tục.')}</span>}
      </div>
    </section>
  )
}

const PREVAILS_EN = 'Reading either language is enough. Where the two differ, the English version prevails.'
const PREVAILS_VN = 'Đọc một trong hai ngôn ngữ là đủ. Nếu có khác biệt, bản tiếng Anh được ưu tiên.'
const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"
const PAPER = '#F3E9DA'
const INK = '#052E20'
const LINE = 'rgba(229,212,194,.18)'

const CSS = `
  /* the fixed lion (NavOverlay) sits at the right edge, mid-height, on a desk
     wider than 1024 — keep the column clear of it at any width */
  .ag-wrap { max-width: 1180px; margin: 0 auto; box-sizing: border-box; color: #E5D4C2;
             padding-left: 24px; padding-right: max(24px, calc(150px - (100vw - 1180px) / 2)); }
  .ag-mast { display: grid; grid-template-columns: minmax(0, 1fr) clamp(150px, 19vw, 250px); gap: 48px; align-items: end;
             padding-top: 140px; padding-bottom: 64px; }
  .ag-h1 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(48px, 6.6vw, 96px); line-height: .92; margin: 0; text-wrap: balance; }
  .ag-intro { font-family: ${MONO}; font-size: 14px; line-height: 1.95; opacity: .9; max-width: 620px; margin: 26px 0 0; }
  .ag-art { align-self: end; padding-bottom: 6px; }
  .ag-rise { opacity: 0; transform: translateY(22px); animation: pk-rise .9s cubic-bezier(.16,.84,.44,1) both; }

  .ag-tabs { display: flex; gap: 28px; margin-top: 34px; }
  .ag-tab { position: relative; background: none; border: none; padding: 0 0 7px; cursor: pointer; color: #E5D4C2;
            font-family: ${MONO}; font-size: 12.5px; letter-spacing: .1em; opacity: .6; transition: opacity .3s ease; }
  .ag-tab::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.5px; background: #D4B85A;
                   transform: scaleX(0); transform-origin: left; transition: transform .45s cubic-bezier(.16,.84,.44,1); }
  .ag-tab:hover { opacity: .9; }
  .ag-tab.is-on { opacity: 1; color: #D4B85A; }
  .ag-tab.is-on::after { transform: scaleX(1); }
  .ag-prevails { font-family: ${MONO}; font-size: 13px; line-height: 1.9; opacity: .82; max-width: 620px; margin: 18px 0 0; }

  .ag-body { max-width: 880px; }
  .ag-quiet { font-family: ${MONO}; font-size: 14px; line-height: 1.95; opacity: .8; margin: 0; }
  .ag-done { font-family: ${SERIF}; font-size: clamp(28px, 3.4vw, 42px); line-height: 1.05; margin: 0; }

  .ag-doc + .ag-doc { margin-top: 88px; }
  .ag-doc-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
  .ag-h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(30px, 3.6vw, 46px); line-height: 1; margin: 0; }
  .ag-ver { font-family: ${MONO}; font-size: 12px; letter-spacing: .04em; opacity: .75; }

  .ag-sheet { max-height: 58vh; overflow-y: auto; background: ${PAPER}; color: ${INK}; border-radius: 4px;
              padding: clamp(28px, 4.5vw, 56px) clamp(22px, 5vw, 64px);
              box-shadow: 0 30px 70px rgba(0,0,0,.36), 0 8px 22px rgba(0,0,0,.2);
              scrollbar-width: thin; scrollbar-color: rgba(5,46,32,.3) transparent; }
  .ag-html { font-family: ${MONO}; font-size: 13.5px; line-height: 2; overflow-wrap: anywhere; }
  .ag-html h1 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(30px, 4vw, 48px); line-height: 1; margin: 0 0 16px; overflow-wrap: normal; }
  .ag-html h2 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(22px, 2.6vw, 30px); line-height: 1.05; margin: 44px 0 14px; overflow-wrap: normal; }
  .ag-html h3 { font-family: ${SERIF}; font-weight: 400; font-size: clamp(19px, 2vw, 23px); line-height: 1.15; margin: 30px 0 10px; }
  .ag-html p { margin: 0 0 16px; opacity: .9; }
  .ag-html ul, .ag-html ol { margin: 0 0 18px; padding-left: 20px; opacity: .9; }
  .ag-html li { margin-bottom: 8px; padding-left: 4px; }
  .ag-html li::marker { color: rgba(5,46,32,.55); }
  .ag-html em { opacity: .75; }
  .ag-html strong { font-weight: 600; }
  .ag-html a { color: inherit; text-underline-offset: 3px; }
  .ag-html hr { border: none; border-top: 1px solid rgba(5,46,32,.16); margin: 32px 0; }
  .ag-html table { width: 100%; border-collapse: collapse; margin: 0 0 18px; font-size: 12.5px; line-height: 1.7; }
  .ag-html td, .ag-html th { border-top: 1px solid rgba(5,46,32,.16); border-bottom: 1px solid rgba(5,46,32,.16); padding: 10px 12px 10px 0; vertical-align: top; text-align: left; }

  .ag-actions { display: flex; align-items: baseline; gap: 18px 32px; flex-wrap: wrap; margin-top: 28px; }
  .pk-cta.ag-agree { margin-top: 0; color: #D4B85A; font-size: 13px; }
  .pk-cta.ag-agree:disabled { opacity: .35; cursor: not-allowed; }
  .pk-cta.ag-agree:disabled .pk-go { transform: none; }
  .ag-quietbtn { background: none; border: none; padding: 0 0 5px; cursor: pointer; color: #E5D4C2; opacity: .8;
                 border-bottom: 1px solid rgba(229,212,194,.35); border-radius: 0;
                 font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; transition: opacity .2s ease; }
  .ag-quietbtn:hover { opacity: 1; }
  .ag-hint { font-family: ${MONO}; font-size: 12.5px; line-height: 1.7; opacity: .75; }

  .ag-group { margin-top: 88px; }
  .ag-group > .ag-h2 { margin-bottom: 22px; }
  .ag-row { display: flex; justify-content: space-between; align-items: center; gap: 16px 32px; flex-wrap: wrap;
            padding: 22px 0; border-top: 1px solid ${LINE}; }
  .ag-row:last-child { border-bottom: 1px solid ${LINE}; }
  .ag-row.is-block { display: block; }
  .ag-row > div:first-child { flex: 1 1 380px; min-width: 0; }
  .ag-row-t { font-family: ${SERIF}; font-size: clamp(22px, 2.4vw, 28px); line-height: 1.1; }
  .ag-row-s { font-family: ${MONO}; font-size: 13px; line-height: 1.85; opacity: .8; margin-top: 8px; max-width: 600px; }
  .ag-opts { display: flex; gap: 24px; }
  .ag-opt { background: none; border: none; border-bottom: 1px solid rgba(229,212,194,.3); border-radius: 0; padding: 0 0 5px; cursor: pointer;
            color: #E5D4C2; opacity: .78; font-family: ${MONO}; font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
            transition: opacity .2s ease, color .2s ease, border-color .2s ease; }
  .ag-opt:hover { opacity: 1; }
  .ag-opt.is-on { color: #D4B85A; opacity: 1; border-bottom-color: #D4B85A; }

  .ag-msg { margin-top: 28px; font-family: ${MONO}; font-size: 13.5px; line-height: 1.8; color: #D4B85A; }

  @media (max-width: 1024px) { .ag-wrap { padding-right: 24px; } }
  @media (max-width: 860px) {
    .ag-wrap { padding-left: 20px; padding-right: 20px; }
    .ag-mast { grid-template-columns: minmax(0, 1fr); gap: 0; padding-top: 118px; padding-bottom: 48px; }
    .ag-art { display: none; }
    .ag-h1 { font-size: clamp(44px, 13vw, 64px); }
    .ag-intro { font-size: 13.5px; line-height: 1.9; }
    .ag-sheet { padding: 28px 20px; }
    .ag-html { font-size: 13px; line-height: 1.95; }
    .ag-doc + .ag-doc, .ag-group { margin-top: 72px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ag-rise { opacity: 1; transform: none; animation: none; }
    .ag-tab::after { transition: none; }
  }
`
