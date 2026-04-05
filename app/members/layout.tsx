import NavOverlay from '@/components/NavOverlay'
import LoginTicker from '@/components/LoginTicker'

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body { background: #052E20 !important; }
      ` }} />
      <NavOverlay variant="members" dark />
      <LoginTicker />
      {children}
    </>
  )
}
