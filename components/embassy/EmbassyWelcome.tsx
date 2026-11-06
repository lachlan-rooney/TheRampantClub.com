'use client'

import { useLang } from '@/lib/lang'
import LangToggle from './LangToggle'
import EmbassySignup from './EmbassySignup'
import { GROUND, CREAM, GOLD, TSE_LOGO } from './palette'

// THE PHONE'S FRONT DOOR — scanned from the tablet at the Tết event.
//
// One job: explain in a line what this is, take the details, and open the cask
// board. EmbassySignup does the form and, on success, sends them on — so this
// page is the frame around it and nothing more.
//
// No QR on this page: the guest is already here, on the device they scanned
// with. Showing them a code to scan would be absurd.

export default function EmbassyWelcome() {
  const { t } = useLang()
  return (
    <main style={{ background: GROUND, minHeight: '100vh', color: CREAM, overflowX: 'clip' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="ew-head">
        <div className="ew-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TSE_LOGO} alt="The Spirits Embassy" className="ew-logo" />
          <LangToggle />
        </div>
        <h1 className="ew-title">{t('Tết Đinh Mùi 2027', 'Tết Đinh Mùi 2027')}</h1>
        <p className="ew-lede">
          {t('Ten single casks from Duncan Taylor. Leave your details and the board opens — prices, outturns and tasting notes, on your own phone.',
             'Mười thùng rượu đơn từ Duncan Taylor. Để lại thông tin của bạn và bảng giá sẽ mở ra — giá, số chai và hương vị, ngay trên điện thoại của bạn.')}
        </p>
      </header>

      <EmbassySignup unlockTo="/embassy/tet" />
    </main>
  )
}

const SERIF = "'Rampant Sans', Georgia, serif"
const MONO = "'Google Sans Code', 'DM Mono', monospace"

const CSS = `
  .ew-head { max-width: 760px; margin: 0 auto; padding: clamp(22px,4vw,44px) clamp(18px,4vw,48px) 0; }
  .ew-mark { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .ew-logo { height: clamp(34px,8vw,48px); width: auto; display: block; }
  .ew-title { font-family: ${SERIF}; font-size: clamp(30px,7vw,52px); line-height: 1.05; color: ${CREAM};
              margin: clamp(22px,4vh,38px) 0 0; font-weight: 400; }
  .ew-lede { font-family: ${SERIF}; font-size: clamp(16px,4vw,19px); line-height: 1.6; color: ${CREAM};
             opacity: .82; max-width: 46ch; margin: 14px 0 0; }
  .ew-lede::after { content: ''; display: block; width: 46px; height: 1px;
                    background: ${GOLD}; opacity: .5; margin-top: clamp(18px,3vh,28px); }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`
