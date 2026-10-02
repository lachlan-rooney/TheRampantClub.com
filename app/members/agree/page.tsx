'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [docs, setDocs] = useState<Doc[] | null>(null)
  // Folded onto the shared context. BEHAVIOUR IS UNCHANGED: `lang` still drives
  // what is rendered AND what goes into the consent payload, so `evidence` keeps
  // recording the language actually read — which is the whole point of capturing
  // it. Reading one language still suffices; that decision is untouched.
  const { lang, setLang, t } = useLang()
  const through = useRef<HTMLAnchorElement | null>(null)
  const [reached, setReached] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  // Returns the list as well as storing it: `agree` below needs the FRESH
  // documents to decide whether anything is still outstanding, and reading the
  // `docs` state straight after setting it reads the previous render's value.
  const load = useCallback(async (): Promise<Doc[]> => {
    const r = await fetch('/api/members/documents', { cache: 'no-store' })
    if (!r.ok) return []
    const next = (await r.json()).documents || []
    setDocs(next)
    return next
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

    // ── GETTING OFF THIS PAGE (owner, 2026-10-02: "it's hard to navigate off
    // it when agreed. You have to reload the page") ─────────────────────────
    // It was router.push('/members'), and middleware redirects anybody behind
    // on a required document to /members/agree. The App Router had that
    // redirect in its client cache, so pushing /members bounced straight back
    // here and the page looked stuck — a hard reload was the only way through.
    // A member who has just agreed to a legal document and appears to be
    // trapped on the agreement page is the worst possible moment for that.
    //
    // A FULL NAVIGATION, so middleware re-runs against the consent row that now
    // exists and nothing is served from a cache that predates it. The same
    // reason components/NavOverlay signs out with location.href rather than
    // router.push.
    //
    // Decided from the FRESHLY loaded list, not the `docs` in this closure,
    // which is the value from before the agreement was recorded.
    const next = await load()
    if (!next.some(x => x.needs_action)) {
      setMsg(t('Thank you. That is everything.', 'Xin cảm ơn. Vậy là xong.'))
      // THE BUTTON, NOT A TIMED JUMP. It used to navigate itself after 1.2s,
      // which is both unreliable — it was bouncing off the cached redirect —
      // and wrong: the optional settings sit below this, and throwing somebody
      // past them the moment they agree is not a kindness. Brought into view
      // instead, and they decide when to go.
      setTimeout(() => through.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
    }
  }

  const pending = (docs || []).filter(d => d.needs_action)
  const optional = (docs || []).filter(d => !d.required && d.satisfied_by === 'consent')
  const signed = (docs || []).filter(d => d.satisfied_by === 'signature')
  // FALSE WHILE LOADING, not true. Showing "Before you go on · Two documents,
  // read at your own pace" and then taking it away is worse than a moment with
  // no heading: it is wrong information, briefly, to somebody who has nothing
  // to read. The body prints "Loading…" meanwhile.
  const hasWork = docs !== null && pending.length > 0

  return (
    <PublicPage ground="#052E20" ink="#E5D4C2">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <CreamInkDefs />
      {/* paddingBottom clears the fixed BottomTabBar (70px, z-index 8998). The layout
          pads the document, but an element scrolled to the viewport's bottom EDGE can
          still land under the bar — which is exactly what intercepted a real tap on the
          agree control during verification. */}
      <div className="ag-wrap" style={{ paddingBottom: 96 }}>
        {/* ── THE PREAMBLE IS FOR PEOPLE WITH SOMETHING TO READ ─────────────
            Owner, 2026-10-02: once "You're up to date" shows, all of this
            should be gone "except the language toggle".
            "Before you go on", "Two documents, read at your own pace" and the
            which-language-prevails line are instructions for a task. With
            nothing outstanding they describe work that does not exist, and they
            sat ABOVE the one thing left to do — so the way out was below a
            screenful of text about documents that were already agreed.
            The toggle stays, because the optional settings and the signed list
            below are still worth reading in either language. */}
        <header className="ag-mast">
          <div className="ag-words">
            {hasWork && (
              <>
                <h1 className="ag-h1 ag-rise">{t('Before you go on', 'Trước khi tiếp tục')}</h1>
                <p className="ag-intro ag-rise" style={{ animationDelay: '.08s' }}>
                  {/* It used to promise "we'll email you what you agreed to and
                      when". The Privacy Notice is no longer emailed — it is
                      kept here and public at /privacy — so the promise was
                      about to be half true. What is always true is that the
                      club records it and you can take a copy. */}
                  {t('Two documents, read at your own pace. You can keep a copy of either without agreeing to it, and we record what you agreed to and when.',
                    'Hai văn bản, xin bạn cứ đọc thong thả. Bạn có thể lưu bản sao của từng văn bản mà không cần đồng ý, và chúng tôi ghi lại nội dung bạn đã đồng ý cùng thời điểm đồng ý.')}
                </p>
              </>
            )}

            <div className="ag-tabs ag-rise" style={{ animationDelay: '.14s' }}>
              {(['en', 'vn'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={`ag-tab ${lang === l ? 'is-on' : ''}`}>{l === 'en' ? 'English' : 'Tiếng Việt'}</button>
              ))}
            </div>
            {/* Surfaced, not buried at paragraph six where the source document
                puts it — but only while there is a document to read. */}
            {hasWork && (
              <p className="ag-prevails ag-rise" style={{ animationDelay: '.18s' }}>
                {/* Both languages stay on screen; the chosen one leads. */}
                {t(PREVAILS_EN, PREVAILS_VN)}
                <span style={{ opacity: .7 }}> · {t(PREVAILS_VN, PREVAILS_EN)}</span>
              </p>
            )}
          </div>
          <div className="ag-art ag-rise" style={{ animationDelay: '.2s' }}>
            <CreamInk name="lion-suit" width="100%" rot={4} dur={9} />
          </div>
        </header>

        <div className="ag-body">
          {docs === null && <p className="ag-quiet">{t('Loading…', 'Đang tải…')}</p>}

          {/* ── A WAY THROUGH, ALWAYS (owner, 2026-10-02: "I just dont see a
              button to go past when your terms are done") ──────────────────
              This was ONE SENTENCE and nothing else — no link, no button. The
              only way onward was a timed router.push inside agree(), which
              fired only if you had just agreed in that same session and was
              bouncing off the cached middleware redirect anyway. Arrive here
              already up to date and you were simply stranded on a full stop.
              A plain <a>, not <Link>: a real navigation, so middleware
              re-evaluates instead of the App Router serving the redirect it
              cached on the way in. */}
          {docs && pending.length === 0 && (
            <div className="ag-through">
              <p className="ag-done">{t('You’re up to date. Nothing to agree to.', 'Bạn đã hoàn tất. Không còn văn bản nào cần đồng ý.')}</p>
              <a href="/members" ref={through} className="pk-cta ag-enter">
                {t('Go to the portal', 'Vào cổng hội viên')} <span className="pk-go">→</span>
              </a>
            </div>
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

  /* Tighter padding to match the smaller type — 56px of margin around 11.5px
     text reads as a large sheet with a little writing on it. */
  .ag-sheet { max-height: 58vh; overflow-y: auto; background: ${PAPER}; color: ${INK}; border-radius: 4px;
              padding: clamp(20px, 3vw, 34px) clamp(18px, 3.4vw, 40px);
              box-shadow: 0 30px 70px rgba(0,0,0,.36), 0 8px 22px rgba(0,0,0,.2);
              scrollbar-width: thin; scrollbar-color: rgba(5,46,32,.3) transparent; }
  /* ── SET AS FINE PRINT (owner, 2026-10-02: "the terms should be tiny not
     huge") ─────────────────────────────────────────────────────────────────
     The sheet was set editorially — body at 13.5/2 with headings running to
     48px — inside a box 58vh tall. On a 33,000-character agreement that makes
     every clause a screenful and the scroll feel bottomless, which is the
     opposite of what this page asks of somebody: read it, reach the end, agree.
     A contract looks like a contract. Small, dense, close-set, with the
     headings just large enough to find — so the document can be taken in and
     scrolled through rather than toured.
     NOTHING IS HIDDEN BY THIS. Every word is still on the sheet and still
     scrolled past before the control enables; only its setting changed. */
  .ag-html { font-family: ${MONO}; font-size: 11.5px; line-height: 1.75; overflow-wrap: anywhere; }
  /* The document's own title. The head above the sheet already prints it, and
     twice over is how the first screenful became a title page. */
  .ag-html h1 { display: none; }
  .ag-html h2 { font-family: ${SERIF}; font-weight: 400; font-size: 16px; line-height: 1.2;
                margin: 26px 0 8px; overflow-wrap: normal; }
  .ag-html > h2:first-of-type { margin-top: 0; }
  .ag-html h3 { font-family: ${MONO}; font-weight: 400; font-size: 9.5px; letter-spacing: .14em;
                text-transform: uppercase; opacity: .62; margin: 16px 0 6px; }
  .ag-html p { margin: 0 0 9px; opacity: .9; }
  .ag-html ul, .ag-html ol { margin: 0 0 10px; padding-left: 17px; opacity: .9; }
  .ag-html li { margin-bottom: 4px; padding-left: 2px; }
  .ag-html li::marker { color: rgba(5,46,32,.55); }
  .ag-html em { opacity: .75; }
  .ag-html strong { font-weight: 600; }
  .ag-html a { color: inherit; text-underline-offset: 3px; }
  .ag-html hr { border: none; border-top: 1px solid rgba(5,46,32,.16); margin: 18px 0; }
  .ag-html table { width: 100%; border-collapse: collapse; margin: 0 0 10px; font-size: 10.5px; line-height: 1.6; }
  .ag-html td, .ag-html th { border-top: 1px solid rgba(5,46,32,.16); border-bottom: 1px solid rgba(5,46,32,.16); padding: 10px 12px 10px 0; vertical-align: top; text-align: left; }

  .ag-actions { display: flex; align-items: center; gap: 16px 28px; flex-wrap: wrap; margin-top: 26px; }

  /* ── THE TWO BUTTONS THAT MATTER, MADE OBVIOUS ──────────────────────────
     Owner, 2026-10-02: "make the agree button very easy to see". It was the
     site's standard pk-cta — a 13px gold word with a sliding arrow, which is
     right for "Read more" on a public page and wrong for the ONE action
     standing between a member and the portal. Everything else on this screen
     is quiet type on green, so a quiet link disappears into it.
     Filled, in the house gold, with the dark green reading THROUGH it: the
     only solid object on the page. */
  .pk-cta.ag-agree, .pk-cta.ag-enter {
    margin-top: 0; background: #D4B85A; color: #052E20; text-decoration: none;
    border-radius: 2px; padding: 17px 30px;
    font-family: ${MONO}; font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
    box-shadow: 0 10px 26px rgba(0,0,0,.28);
    transition: background .25s ease, box-shadow .25s ease, transform .25s ease;
  }
  .pk-cta.ag-agree:hover:not(:disabled), .pk-cta.ag-enter:hover {
    background: #E2CB77; box-shadow: 0 14px 32px rgba(0,0,0,.34); }
  .pk-cta.ag-agree:active:not(:disabled), .pk-cta.ag-enter:active { transform: translateY(1px); }
  /* The arrow slides on gold too; pk-cta's ::before hit-area expander would
     otherwise sit outside the fill on a touch screen. */
  .pk-cta.ag-agree::before, .pk-cta.ag-enter::before { content: none; }

  /* NOT MERELY FADED WHEN IT CANNOT BE USED. opacity .35 on a filled gold
     button still reads as a button somebody should be able to press. Unfilled,
     outlined and grey says "not yet" — which is what the hint beside it says
     in words. */
  .pk-cta.ag-agree:disabled {
    background: transparent; color: rgba(229,212,194,.45);
    border: 1px solid rgba(229,212,194,.22); box-shadow: none;
    cursor: not-allowed; padding: 16px 29px;
  }
  .pk-cta.ag-agree:disabled .pk-go { transform: none; }

  .ag-through { display: flex; flex-direction: column; align-items: flex-start; gap: 22px; }

  @media (max-width: 560px) {
    /* Full width on a phone: the thing you must press should not be something
       you have to aim at. */
    .pk-cta.ag-agree, .pk-cta.ag-enter { display: block; width: 100%; text-align: center; }
    .ag-actions { gap: 14px; }
  }
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
