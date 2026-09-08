import { redirect } from 'next/navigation'

// BOARD is the idle default and the only route into the other two modes, so bare
// /kiosk lands there rather than 404ing. The installed PWA points here too.
export default function KioskIndex() {
  redirect('/kiosk/board')
}
