import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readUnsub } from '@/lib/popup/ticket'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ONE CLICK, NO LOGIN, NO FORM, NO "ARE YOU SURE".
// A signed token carrying the address. An invalid one says the same calm thing
// as a valid one — telling a stranger whether an address is on our list would
// make this an address-checking service.

const page = (line: string) => new NextResponse(
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <title>The Rampant Club</title></head>
   <body style="margin:0;background:#052E20;color:#E5D4C2;font-family:Georgia,serif;
                display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
     <p style="font-size:22px;line-height:1.5;max-width:28ch;text-align:center;">${line}</p>
   </body></html>`,
  { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })

export async function GET(req: NextRequest) {
  const key = readUnsub(req.nextUrl.searchParams.get('t') || '')
  const done = 'You will not hear from us about this again.'
  if (!key) return page(done)

  const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } })
  // Upsert, not insert: clicking twice is normal and must not look like a fault.
  await a.from('popup_unsubscribes').upsert({ email_key: key }, { onConflict: 'email_key' })
  return page(done)
}
