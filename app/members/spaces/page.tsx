'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Space {
  id: string
  floor: string         // '5', '4', '3', '2', '1', or '—'
  en: string
  vn: string
  descEn: string
  descVn: string
  accent: string        // hex – tints the floor card
  photo?: string        // optional cover image (placeholder until real photos)
}

const SPACES: Space[] = [
  {
    id: 'lab',
    floor: '5',
    en: 'The Source & Origin Lab',
    vn: 'Phòng Thí Nghiệm Nguồn Gốc',
    descEn: "A collaboration with Duncan Taylor — our in-house innovation lab for cutting-edge beverages, experimental blends, and members-only bottlings.",
    descVn: 'Hợp tác với Duncan Taylor — phòng thí nghiệm đổi mới sáng tạo cho đồ uống tiên tiến và các phiên bản đóng chai dành riêng cho thành viên.',
    accent: '#3F5546',
  },
  {
    id: 'rampant-room',
    floor: '4',
    en: 'The Rampant Room',
    vn: 'Phòng Rampant',
    descEn: 'Home to over 300 unique global whiskies. Our bottle-share room where members explore rare and unusual expressions together.',
    descVn: 'Nơi lưu giữ hơn 300 loại whisky độc đáo từ khắp nơi trên thế giới. Phòng chia sẻ chai nơi các thành viên cùng khám phá.',
    accent: '#5E4F3A',
  },
  {
    id: 'dining',
    floor: '3',
    en: 'The Dining Room',
    vn: 'Phòng Ăn',
    descEn: 'Private dining for meetings, birthday soirées, and intimate gatherings. Fine wines, gourmet cuisine, and a space that feels like home.',
    descVn: 'Phòng ăn riêng cho các cuộc họp, tiệc sinh nhật và những buổi họp mặt thân mật. Rượu vang hảo hạng và ẩm thực cao cấp.',
    accent: '#4A3F36',
  },
  {
    id: 'studio',
    floor: '2',
    en: 'The Studio',
    vn: 'Phòng Studio',
    descEn: "A quarterly rotating curated art space featuring immersive installations by Vietnamese and international artists. Each exhibition includes an artist-created member's whisky.",
    descVn: 'Không gian nghệ thuật luân chuyển theo quý với các tác phẩm sắp đặt đắm chìm từ các nghệ sĩ Việt Nam và quốc tế.',
    accent: '#5C4A3E',
  },
  {
    id: 'library-bar',
    floor: '1',
    en: 'The Library Bar',
    vn: 'Quầy Bar Thư Viện',
    descEn: 'A private cocktail bar with seasonal menus, vintage spirits, a curated book collection, board games, and regular live music evenings. The heart of the club.',
    descVn: 'Quầy bar cocktail riêng với thực đơn theo mùa, rượu cổ điển, bộ sưu tập sách, trò chơi board game và các buổi tối nhạc sống.',
    accent: '#3D5043',
  },
  {
    id: 'sports',
    floor: '—',
    en: 'T.R.C Sports Club',
    vn: 'Câu Lạc Bộ Thể Thao',
    descEn: 'Golf, tennis, pickleball, padel, and sailing. Organised outings, friendly competitions, and an active community beyond the bar.',
    descVn: 'Golf, tennis, pickleball, padel và chèo thuyền buồm. Các chuyến đi có tổ chức, thi đấu giao hữu và cộng đồng năng động.',
    accent: '#46553F',
  },
]

export default function SpacesPage() {
  const [activeIdx, setActiveIdx] = useState(0)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      // pick the entry with the highest intersection ratio that's intersecting
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) {
        const idx = Number((visible.target as HTMLElement).dataset.idx || 0)
        setActiveIdx(idx)
      }
    }, { threshold: [0.3, 0.5, 0.7] })
    sectionRefs.current.forEach(el => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const goTo = (idx: number) => {
    sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        .spaces-page { background: #052E20; min-height: 100vh; position: relative; }
        .spaces-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 200px;
        }

        /* Top header */
        .spaces-head {
          position: relative; z-index: 2;
          padding: 100px 24px 0; max-width: 980px; margin: 0 auto;
        }
        .spaces-back {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px; color: #B2AA98; opacity: 0.7;
          text-decoration: none; letter-spacing: 0.06em;
          display: inline-block; margin-bottom: 28px;
          transition: opacity 0.2s;
        }
        .spaces-back:hover { opacity: 1; }
        .spaces-title {
          font-family: 'Rampant Sans', serif;
          font-size: 32px; font-weight: 500;
          color: #E5D4C2; letter-spacing: 0.02em;
          margin: 0 0 4px;
        }
        .spaces-sub {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px; color: #B2AA98; opacity: 0.6;
          letter-spacing: 0.10em; margin-bottom: 24px;
        }
        .spaces-intro {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 12px; line-height: 1.85;
          color: #B2AA98; opacity: 0.75; max-width: 520px;
          letter-spacing: 0.02em; margin: 0 0 56px;
        }

        /* Sticky floor rail (desktop) */
        .floor-rail {
          position: fixed;
          top: 50%; right: 28px;
          transform: translateY(-50%);
          z-index: 20;
          display: flex; flex-direction: column; gap: 10px;
          background: rgba(5,46,32,0.4);
          backdrop-filter: blur(10px);
          padding: 12px 8px;
          border: 1px solid rgba(229,212,194,0.10);
          border-radius: 18px;
        }
        .floor-rail-btn {
          width: 28px; height: 28px;
          border: none; cursor: pointer;
          background: transparent; color: #B2AA98;
          font-family: 'Rampant Sans', serif;
          font-size: 12px; font-weight: 500;
          border-radius: 50%;
          transition: background 0.25s, color 0.25s, transform 0.25s;
        }
        .floor-rail-btn:hover { color: #E5D4C2; }
        .floor-rail-btn.is-on {
          background: rgba(212,184,90,0.22);
          color: #D4B85A;
          transform: scale(1.08);
        }
        @media (max-width: 768px) { .floor-rail { display: none; } }

        /* Floor sections */
        .floor {
          position: relative; z-index: 2;
          min-height: 90vh;
          padding: 80px 24px;
          display: flex; align-items: center; justify-content: center;
          border-bottom: 1px solid rgba(229,212,194,0.06);
        }
        .floor-inner {
          max-width: 980px; width: 100%;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 56px; align-items: center;
        }
        .floor.is-flipped .floor-inner { direction: rtl; }
        .floor.is-flipped .floor-inner > * { direction: ltr; }

        .floor-image {
          aspect-ratio: 4 / 5;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--accent), rgba(5,46,32,0.55));
          position: relative; overflow: hidden;
          border: 1px solid rgba(229,212,194,0.10);
          box-shadow: 0 24px 56px rgba(0,0,0,0.4);
        }
        .floor-image img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .floor-image-floor {
          position: absolute;
          top: 18px; left: 18px;
          font-family: 'Rampant Sans', serif;
          color: rgba(229,212,194,0.85);
          font-size: 14px; letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .floor-image-num {
          position: absolute;
          right: 22px; bottom: 22px;
          font-family: 'Rampant Sans', serif;
          font-size: 120px; line-height: 1;
          font-weight: 500;
          color: rgba(229,212,194,0.16);
          letter-spacing: -0.02em;
        }

        .floor-eyebrow {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 10px;
          color: #D4B85A;
          letter-spacing: 0.18em; text-transform: uppercase;
          margin-bottom: 12px;
        }
        .floor-name {
          font-family: 'Rampant Sans', serif;
          font-size: 32px; font-weight: 500;
          color: #E5D4C2; letter-spacing: 0.02em;
          margin: 0 0 6px; line-height: 1.15;
        }
        .floor-vn {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px; color: #B2AA98; opacity: 0.7;
          letter-spacing: 0.06em; margin-bottom: 22px;
        }
        .floor-desc {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 12px; line-height: 1.85;
          color: #E5D4C2; opacity: 0.85;
          letter-spacing: 0.01em;
          margin: 0 0 14px;
        }
        .floor-desc-vn {
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px; line-height: 1.75;
          color: #B2AA98; opacity: 0.55;
          letter-spacing: 0.02em;
          margin: 0 0 22px;
        }

        .floor-cta {
          display: inline-block;
          font-family: 'Google Sans Code', 'DM Mono', monospace;
          font-size: 11px; letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 11px 22px; border-radius: 6px;
          background: rgba(212,184,90,0.18);
          color: #E5D4C2;
          border: 1px solid rgba(212,184,90,0.4);
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s, transform 0.2s;
        }
        .floor-cta:hover {
          background: rgba(212,184,90,0.28);
          border-color: rgba(212,184,90,0.6);
          transform: translateY(-1px);
        }
        .floor-cta + .floor-cta { margin-left: 10px; }

        /* Studio embed */
        .floor-studio-extra {
          margin-top: 22px; padding-top: 20px;
          border-top: 1px solid rgba(229,212,194,0.10);
        }
        .floor-studio-title {
          font-family: 'Rampant Sans', serif;
          font-size: 16px; font-weight: 500;
          color: #E5D4C2; font-style: italic;
          margin: 0 0 4px;
        }
        .floor-studio-sub {
          font-family: 'Google Sans Code', monospace;
          font-size: 10px; color: #B2AA98;
          opacity: 0.6; letter-spacing: 0.06em;
          margin: 0 0 14px;
        }
        .floor-studio-body {
          font-family: 'Google Sans Code', monospace;
          font-size: 11px; color: #B2AA98;
          line-height: 1.75; opacity: 0.8;
          margin: 0 0 14px;
        }
        .floor-studio-video {
          margin-top: 16px; border-radius: 8px; overflow: hidden;
          position: relative; padding-bottom: 56.25%; height: 0;
        }
        .floor-studio-video iframe {
          position: absolute; top: 0; left: 0;
          width: 100%; height: 100%; border: none;
        }

        @media (max-width: 768px) {
          .floor { padding: 60px 20px; min-height: auto; }
          .floor-inner { grid-template-columns: 1fr; gap: 28px; }
          .floor-image { aspect-ratio: 16 / 10; }
          .floor-image-num { font-size: 80px; }
          .floor-name { font-size: 28px; }
          .spaces-head { padding: 80px 20px 0; }
          .spaces-title { font-size: 28px; }
        }
      `}} />

      <div className="spaces-page">
        <div className="spaces-grain" />

        <div className="spaces-head">
          <Link href="/members" className="spaces-back">&larr; Back to dashboard</Link>
          <h1 className="spaces-title">Our Spaces</h1>
          <p className="spaces-sub">Không gian của câu lạc bộ</p>
          <p className="spaces-intro">
            Five floors and a sports club. Each space has its own character; each floor, its own purpose.
            Scroll through to walk the building, top to bottom.
          </p>
        </div>

        {/* Sticky floor rail (desktop) */}
        <nav className="floor-rail" aria-label="Floor navigator">
          {SPACES.map((s, i) => (
            <button
              key={s.id}
              className={'floor-rail-btn' + (activeIdx === i ? ' is-on' : '')}
              onClick={() => goTo(i)}
              aria-label={`Go to ${s.en}`}
              aria-current={activeIdx === i || undefined}
            >
              {s.floor}
            </button>
          ))}
        </nav>

        {SPACES.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            ref={el => { sectionRefs.current[i] = el }}
            data-idx={i}
            className={'floor' + (i % 2 === 1 ? ' is-flipped' : '')}
          >
            <div className="floor-inner">
              <div className="floor-image" style={{ ['--accent' as string]: s.accent } as React.CSSProperties}>
                {s.photo
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photo} alt={s.en} />
                  : null}
                <div className="floor-image-floor">
                  {s.floor === '—' ? 'Off-site' : `Floor ${s.floor}`}
                </div>
                <div className="floor-image-num">{s.floor}</div>
              </div>

              <div>
                <div className="floor-eyebrow">
                  {s.floor === '—' ? '◆ The Sports Club' : `◆ Floor ${s.floor}`}
                </div>
                <h2 className="floor-name">{s.en}</h2>
                <p className="floor-vn">{s.vn}</p>
                <p className="floor-desc">{s.descEn}</p>
                <p className="floor-desc-vn">{s.descVn}</p>

                {s.id === 'library-bar' && (
                  <a href="/documents/Library%20Bar%20Menu.pdf"
                    target="_blank" rel="noopener noreferrer"
                    className="floor-cta">
                    Library Bar Menu ↗
                  </a>
                )}

                {s.id === 'rampant-room' && (
                  <Link href="/members/whisky" className="floor-cta">
                    Current Whisky Stock →
                  </Link>
                )}

                {s.id === 'sports' && (
                  <Link href="/sports" className="floor-cta">
                    Sports calendar →
                  </Link>
                )}

                {s.id === 'studio' && (
                  <div className="floor-studio-extra">
                    <h3 className="floor-studio-title">Now Showing: Terroir of Memories</h3>
                    <div className="floor-studio-sub">
                      Quỳnh Anh Lê &times; The Octave by Duncan Taylor
                    </div>
                    <p className="floor-studio-body">
                      A collaboration between Vietnamese contemporary artist Quỳnh Anh Lê and The Octave,
                      exploring how place becomes character — through whisky, through paint, through the
                      slow work of time. Centred on 88 artist-labelled bottles, the exhibition is a
                      multi-sensory experience with bespoke soundscape, signature scent, and curated canapés.
                    </p>
                    <p className="floor-studio-body">
                      A members-only whisky has been created for the occasion — available at the bar
                      while the exhibition is on display.
                    </p>
                    <div className="floor-studio-video">
                      <iframe
                        src="https://www.youtube.com/embed/DOY4fYCpQC0"
                        title="Terroir of Memories — Process Film"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
