// A showcase link for the room tablet — mint one, print it, hand it over.
//   node scripts/showcase-link.mjs [--days 60] [--local]
//
// The pass is an HMAC of its own expiry (lib/showcase/gate), so there is no row
// to create and nothing to clean up afterwards: it simply stops working.
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const days = process.argv.includes('--days') ? Number(process.argv[process.argv.indexOf('--days') + 1]) : 60
const base = process.argv.includes('--local') ? 'http://localhost:3001' : 'https://therampantclub.com'
const exp = String(Date.now() + days * 24 * 60 * 60 * 1000)
const pass = `${exp}.${createHmac('sha256', env.SUPABASE_JWT_SECRET).update(exp).digest('base64url')}`

console.log(`${base}/showcase/kiosk/enter?k=${pass}`)
console.log(`\nopens until ${new Date(Number(exp)).toDateString()} · ${days} days`)
