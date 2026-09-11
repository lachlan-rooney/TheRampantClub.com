'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'
import type { Whisky } from '@/lib/types'
import MemberPage from '@/components/MemberPage'
import FlavourRadar from '@/components/whisky/FlavourRadar'
import WhiskyNotes from '@/components/whisky/WhiskyNotes'
import { WhiskyStyle, RADAR } from '@/components/whisky/WhiskyStyle'
import { Rise, CREAM, GOLD, MONO } from '@/components/public/kit'
import { CreamInk } from '@/components/public/CreamInk'
import { useLang } from '@/lib/lang'

// A bottle's living story — its own data + the FlavourRadar + the members'
// conversation (WhiskyNotes: own notes any visibility, others' SNUG notes only —
// RLS-enforced; private notes never appear here). Provenance shows the house note
// when present, a graceful space when not — never fabricated.
//
// Set as a page from the house's own bottle list: the particulars and the house
// note on the left, the radar given the right half, then the room's
// conversation beneath with a toast drawn in cream.

// A house note written "Nose: … Palate: … Finish: …" reads better as three
// lines than one paragraph. Split ONLY on the words the note itself uses, and
// only when it starts with one of them — anything else stays as written.
function splitNote(s: string): { label: string; text: string }[] | null {
  const hits = [...s.matchAll(/\b(Nose|Palate|Finish)\s*:\s*/gi)]
  if (hits.length < 2 || (hits[0].index ?? 0) !== 0) return null
  return hits.map((m, i) => ({
    label: m[1],
    text: s.slice((m.index ?? 0) + m[0].length, i + 1 < hits.length ? hits[i + 1].index : undefined).trim(),
  }))
}

const CSS = `
  .wb-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 72px; align-items: start; }
  .wb-spec { font-family: ${MONO}; font-size: 12.5px; letter-spacing: .16em; text-transform: uppercase; color: ${GOLD}; margin-bottom: 26px; }
  .wb-note { margin: 0; max-width: 600px; }
  .wb-note > div { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 18px; padding: 16px 0 18px;
                   border-top: 1px solid rgba(229,212,194,.16); }
  .wb-note > div:last-child { border-bottom: 1px solid rgba(229,212,194,.16); }
  .wb-note dt { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; color: ${GOLD}; padding-top: 4px; }
  .wb-note dd { margin: 0; font-family: ${MONO}; font-size: 13.5px; line-height: 1.95; color: ${CREAM}; opacity: .9; }
  .wb-house { font-family: ${MONO}; font-size: 14px; line-height: 2; color: ${CREAM}; opacity: .9; max-width: 600px; margin: 0; }
  .wb-house.is-empty { opacity: .72; }
  .wb-radar { max-width: 540px; justify-self: end; }

  .wb-room { margin-top: 96px; }
  .wb-room-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end;
                  padding-bottom: 8px; }
  .wb-room-ink { width: clamp(110px, 11vw, 150px); margin-right: 4%; }

  @media (max-width: 860px) {
    .wb-grid { grid-template-columns: minmax(0, 1fr); gap: 44px; }
    .wb-radar { justify-self: stretch; max-width: 480px; }
    .wb-room { margin-top: 72px; }
  }
  @media (max-width: 600px) {
    .wb-note > div { grid-template-columns: minmax(0, 1fr); gap: 6px; }
    .wb-house { font-size: 13.5px; line-height: 1.95; }
    .wb-room-ink { width: 96px; margin-right: 0; }
  }
`

export default function BottleStory() {
  const { t } = useLang()
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''
  const [w, setW] = useState<Whisky | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    createBrowserSupabaseClient().from('whiskies').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { setW((data as Whisky) || null); setLoading(false) })
  }, [id])

  if (loading) return <MemberPage title="…" subtitle=""><WhiskyStyle /><p className="wl-text">{t('Pouring…', 'Đang rót…')}</p></MemberPage>
  if (!w) return <MemberPage title={t('Not found', 'Không tìm thấy')} subtitle=""><WhiskyStyle /><p className="wl-text">{t('We couldn’t find that bottle.', 'Chúng tôi không tìm thấy chai này.')}</p></MemberPage>

  const meta = [w.distillery, w.region].filter(Boolean).join(' · ')
  const spec = [w.cask_type, w.age, w.abv].filter(Boolean).join(' · ')
  const parts = w.tasting_notes ? splitNote(w.tasting_notes) : null

  return (
    <MemberPage title={w.name} subtitle={meta.toUpperCase() || 'A BOTTLE FROM THE SHELF'}>
      <WhiskyStyle />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <section className="wb-grid">
        <Rise>
          {spec && <div className="wb-spec">{spec}</div>}

          {w.tasting_notes ? (
            parts ? (
              <dl className="wb-note">
                {parts.map((p, i) => <div key={i}><dt>{p.label}</dt><dd>{p.text}</dd></div>)}
              </dl>
            ) : (
              <p className="wb-house">{w.tasting_notes}</p>
            )
          ) : (
            <p className="wb-house is-empty">{t('No house note for this bottle yet — but the radar shows its shape, and the room may have something to say below.', 'Chai này chưa có ghi chú của câu lạc bộ — nhưng biểu đồ đã cho thấy hình dáng hương vị, và các hội viên có thể đã chia sẻ cảm nhận bên dưới.')}</p>
          )}
        </Rise>

        <Rise delay={.1} className="wb-radar wl-radar">
          <FlavourRadar whiskyId={w.id} size={RADAR} />
        </Rise>
      </section>

      <section className="wb-room">
        <div className="wb-room-head">
          <Rise><h2 className="wl-h is-2">{t('The room on this bottle', 'Hội viên nói về chai này')}</h2></Rise>
          <Rise delay={.1} className="wb-room-ink"><CreamInk name="gent-toast" width="100%" rot={4} dur={8} /></Rise>
        </div>
        <WhiskyNotes whiskyId={w.id} />
      </section>
    </MemberPage>
  )
}
