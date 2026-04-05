'use client'

import Link from 'next/link'

const SPACES = [
  {
    en: 'The Library Bar',
    vn: 'Quầy Bar Thư Viện',
    descEn: 'A private cocktail bar with seasonal menus, vintage spirits, a curated book collection, board games, and regular live music evenings. The heart of the club.',
    descVn: 'Quầy bar cocktail riêng với thực đơn theo mùa, rượu cổ điển, bộ sưu tập sách, trò chơi board game và các buổi tối nhạc sống.',
  },
  {
    en: 'The Studio',
    vn: 'Phòng Studio',
    descEn: 'A quarterly rotating curated art space featuring immersive installations by Vietnamese and international artists. Each exhibition includes an artist-created member\'s whisky.',
    descVn: 'Không gian nghệ thuật luân chuyển theo quý với các tác phẩm sắp đặt đắm chìm từ các nghệ sĩ Việt Nam và quốc tế.',
  },
  {
    en: 'The Dining Room',
    vn: 'Phòng Ăn',
    descEn: 'Private dining for meetings, birthday soirées, and intimate gatherings. Fine wines, gourmet cuisine, and a space that feels like home.',
    descVn: 'Phòng ăn riêng cho các cuộc họp, tiệc sinh nhật và những buổi họp mặt thân mật. Rượu vang hảo hạng và ẩm thực cao cấp.',
  },
  {
    en: 'The Rampant Room',
    vn: 'Phòng Rampant',
    descEn: 'Home to over 300 unique global whiskies. Our bottle-share room where members explore rare and unusual expressions together.',
    descVn: 'Nơi lưu giữ hơn 300 loại whisky độc đáo từ khắp nơi trên thế giới. Phòng chia sẻ chai nơi các thành viên cùng khám phá.',
  },
  {
    en: 'T.R.C Sports Club',
    vn: 'Câu Lạc Bộ Thể Thao',
    descEn: 'Golf, tennis, pickleball, padel, and sailing. Organised outings, friendly competitions, and an active community beyond the bar.',
    descVn: 'Golf, tennis, pickleball, padel và chèo thuyền buồm. Các chuyến đi có tổ chức, thi đấu giao hữu và cộng đồng năng động.',
  },
  {
    en: 'The Source & Origin Lab',
    vn: 'Phòng Thí Nghiệm Nguồn Gốc',
    descEn: 'A collaboration with Duncan Taylor — our in-house innovation lab for cutting-edge beverages, experimental blends, and members-only bottlings.',
    descVn: 'Hợp tác với Duncan Taylor — phòng thí nghiệm đổi mới sáng tạo cho đồ uống tiên tiến và các phiên bản đóng chai dành riêng cho thành viên.',
  },
]

export default function SpacesPage() {
  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap');

        .spaces-page {
          min-height: 100vh;
          background: #052E20;
          font-family: 'DM Mono', monospace;
          position: relative;
        }

        .spaces-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 200px;
        }

        .spaces-container {
          position: relative; z-index: 2;
          max-width: 680px; margin: 0 auto;
          padding: 100px 24px 80px;
        }

        .spaces-back {
          font-size: 11px;
          color: #B2AA98; opacity: 0.35;
          text-decoration: none;
          letter-spacing: 0.06em;
          transition: opacity 0.2s;
          display: inline-block;
          margin-bottom: 32px;
        }
        .spaces-back:hover { opacity: 0.6; }

        .spaces-title {
          font-family: 'Rampant Sans', serif;
          font-size: 28px; font-weight: 600;
          color: #E5D4C2; letter-spacing: 0.02em;
          margin-bottom: 4px;
        }
        .spaces-subtitle {
          font-size: 11px; color: #B2AA98;
          opacity: 0.35; letter-spacing: 0.06em;
          margin-bottom: 48px;
        }

        .space-card {
          padding: 32px 0;
          border-bottom: 1px solid rgba(229, 212, 194, 0.08);
        }
        .space-card:first-of-type {
          border-top: 1px solid rgba(229, 212, 194, 0.08);
        }

        .space-name-en {
          font-family: 'Rampant Sans', serif;
          font-size: 22px; font-weight: 600;
          color: #E5D4C2; letter-spacing: 0.02em;
          margin-bottom: 4px;
        }
        .space-name-vn {
          font-size: 10px; color: #B2AA98;
          opacity: 0.5; letter-spacing: 0.06em;
          margin-bottom: 16px;
        }

        .space-desc-en {
          font-size: 12px; line-height: 1.7;
          color: #B2AA98; opacity: 0.55;
          letter-spacing: 0.02em;
          margin-bottom: 8px;
        }
        .space-desc-vn {
          font-size: 11px; line-height: 1.6;
          color: #B2AA98; opacity: 0.5;
          letter-spacing: 0.02em;
        }

        .spaces-diamond {
          width: 6px; height: 6px;
          background: #E5D4C2;
          transform: rotate(45deg);
          opacity: 0.2;
          margin: 48px auto 0;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #052E20; }
        ::-webkit-scrollbar-thumb { background: rgba(229, 212, 194, 0.2); border-radius: 3px; }

        @media (max-width: 768px) {
          .spaces-container { padding: 80px 20px 60px; }
          .spaces-title { font-size: 24px; }
        }
      ` }} />

      <div className="spaces-page">
        <div className="spaces-grain" />
        <div className="spaces-container">
          <Link href="/members" className="spaces-back">&larr; Back</Link>

          <h1 className="spaces-title">Our Spaces</h1>
          <p className="spaces-subtitle">Không gian của câu lạc bộ</p>

          {SPACES.map((space) => (
            <div key={space.en} className="space-card">
              <h2 className="space-name-en">{space.en}</h2>
              <p className="space-name-vn">{space.vn}</p>
              <p className="space-desc-en">{space.descEn}</p>
              <p className="space-desc-vn">{space.descVn}</p>
              {space.en === 'The Studio' && (
                <>
                  <div style={{
                    marginTop: 24, padding: '20px 0',
                    borderTop: '1px solid rgba(229,212,194,0.08)',
                  }}>
                    <div style={{
                      fontFamily: "'Rampant Sans', serif", fontSize: 16, fontWeight: 600,
                      color: '#E5D4C2', marginBottom: 4, fontStyle: 'italic',
                    }}>
                      Now Showing: Terroir of Memories
                    </div>
                    <div style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 10,
                      color: '#B2AA98', opacity: 0.5, marginBottom: 14,
                    }}>
                      Quỳnh Anh Lê &times; The Octave by Duncan Taylor
                    </div>
                    <p style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                      color: '#B2AA98', lineHeight: 1.75, opacity: 0.7, marginBottom: 12,
                    }}>
                      A collaboration between Vietnamese contemporary artist Quỳnh Anh Lê and The Octave, exploring how place becomes character — through whisky, through paint, through the slow work of time. Centred on 88 artist-labelled bottles, the exhibition is a multi-sensory experience with bespoke soundscape, signature scent, and curated canapés.
                    </p>
                    <p style={{
                      fontFamily: "'Google Sans Code', 'DM Mono', monospace", fontSize: 11,
                      color: '#B2AA98', lineHeight: 1.75, opacity: 0.7, marginBottom: 0,
                    }}>
                      A members-only whisky has been created for the occasion — available at the bar while the exhibition is on display.
                    </p>
                  </div>
                  <div style={{
                    marginTop: 20, borderRadius: 8, overflow: 'hidden',
                    position: 'relative', paddingBottom: '56.25%', height: 0,
                  }}>
                    <iframe
                      src="https://www.youtube.com/embed/DOY4fYCpQC0"
                      title="Terroir of Memories — Process Film"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{
                        position: 'absolute', top: 0, left: 0,
                        width: '100%', height: '100%', border: 'none',
                      }}
                    />
                  </div>
                </>
              )}
              {space.en === 'The Rampant Room' && (
                <Link
                  href="/members/whisky"
                  style={{
                    display: 'inline-block', marginTop: 16,
                    fontFamily: "'Rampant Sans', serif", fontSize: 11,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: '#E5D4C2', background: 'rgba(229,212,194,0.08)',
                    padding: '10px 24px', borderRadius: 4,
                    textDecoration: 'none', transition: 'background 0.2s',
                  }}
                >
                  Current Whisky Stock →
                </Link>
              )}
              {space.en === 'The Library Bar' && (
                <a
                  href="/documents/Library%20Bar%20Menu.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', marginTop: 16,
                    fontFamily: "'Rampant Sans', serif", fontSize: 11,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: '#E5D4C2', background: 'rgba(229,212,194,0.08)',
                    padding: '10px 24px', borderRadius: 4,
                    textDecoration: 'none', transition: 'background 0.2s',
                  }}
                >
                  Library Bar Menu ↗
                </a>
              )}
            </div>
          ))}

          <div className="spaces-diamond" />
        </div>
      </div>
    </>
  )
}
