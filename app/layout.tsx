import type { Metadata } from 'next'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'The Rampant Club',
  description: 'A private members\' club in the heart of Sài Gòn',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="preload" href="/fonts/MNRampantSans-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/GoogleSansCode-VariableFont_wght.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face {
            font-family: 'Rampant Sans';
            src: url('/fonts/MNRampantSans-Regular.woff2') format('woff2'),
                 url('/fonts/MNRampantSans-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Google Sans Code';
            src: url('/fonts/GoogleSansCode-VariableFont_wght.ttf') format('truetype');
            font-weight: 100 900;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Google Sans Code';
            src: url('/fonts/GoogleSansCode-Italic-VariableFont_wght.ttf') format('truetype');
            font-weight: 100 900;
            font-style: italic;
            font-display: swap;
          }
        ` }} />
      </head>
      <body>
        <style dangerouslySetInnerHTML={{ __html: `
          * { font-feature-settings: 'ss01' on; box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          html { overflow-y: scroll; scrollbar-gutter: auto; }
          html, body { overflow-x: hidden; }
          ::-webkit-scrollbar { width: 6px; background: transparent; }
          ::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; transition: background 0.3s; }
          html:hover::-webkit-scrollbar-thumb { background: rgba(94, 102, 80, 0.2); }
          html { scrollbar-width: thin; scrollbar-color: transparent transparent; }
          html:hover { scrollbar-color: rgba(94, 102, 80, 0.2) transparent; }
        ` }} />
        {children}
        <Footer />
      </body>
    </html>
  )
}
