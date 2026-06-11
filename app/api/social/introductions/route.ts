import { NextResponse } from 'next/server'
import { getActor, svc, socialEmit, notify } from '@/lib/social/server'
import { paletteSignature } from '@/lib/whisky/palate-signature'
import { cosineSimilarity, sharedNote, pct } from '@/lib/whisky/palate-twins'

// Introductions — introduction-first, gracious.
//   POST → request an introduction. ALWAYS returns the neutral { status: 'pending' }
//          — whether new, a re-request (23505 caught), or a block (no insert). The
//          flow must never reveal a decline, a prior request, or a block.
//   GET  → incoming (pending requests addressed to me, via the recipient RLS) +
//          sent (introductions_for_me() — declined masked to 'pending', proven S0).

export const dynamic = 'force-dynamic'

const NEUTRAL = { status: 'pending' as const }

export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ error: 'Members only.' }, { status: 403 })

  const p = await req.json().catch(() => null)
  const recipient: unknown = p?.recipient
  const ctxRaw: unknown = p?.context
  if (typeof recipient !== 'string' || recipient === actor.id) return NextResponse.json({ error: 'No such member.' }, { status: 400 })
  const context = typeof ctxRaw === 'string' ? ctxRaw.trim().slice(0, 280) || null : null
  const a = svc()

  // recipient must be a linked member
  const { data: rprof } = await a.from('profiles').select('member_no').eq('id', recipient).maybeSingle()
  if (!rprof?.member_no) return NextResponse.json({ error: 'No such member.' }, { status: 404 })

  // BLOCK → neutral pending, no insert (never reveal a block)
  const { data: blk } = await a.from('member_blocks').select('blocker')
    .or(`and(blocker.eq.${actor.id},blocked.eq.${recipient}),and(blocker.eq.${recipient},blocked.eq.${actor.id})`).maybeSingle()
  if (blk) return NextResponse.json(NEUTRAL)

  // rate-limit
  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await a.from('introductions').select('id', { count: 'exact', head: true }).eq('requester', actor.id).gte('created_at', since)
  if ((count ?? 0) >= 15) return NextResponse.json({ error: 'You’ve sent a few already — give them a moment.' }, { status: 429 })

  const ins = await a.from('introductions').insert({ requester: actor.id, recipient, context, status: 'pending' }).select('id').single()
  if (ins.error) {
    if (ins.error.code === '23505') return NextResponse.json(NEUTRAL)   // re-request → same neutral, no leak
    return NextResponse.json({ error: 'Could not send.' }, { status: 500 })
  }
  await socialEmit(actor.sb, 'introduction.requested', 'introduction', ins.data.id, {})
  await notify(a, recipient, 'introduction_request', { link: '/members/introductions', label: 'An introduction awaits' })
  return NextResponse.json(NEUTRAL)
}

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ incoming: [], sent: [] })
  const a = svc()

  // INCOMING via the SESSION client → recipient RLS (pending, addressed to me, not blocked).
  const { data: inc } = await actor.sb.from('introductions').select('id, requester, context, created_at, via')
  // SENT via the masking fn (declined → pending; never a base-table read as requester).
  const { data: sentRaw } = await actor.sb.rpc('introductions_for_me')
  const sent = (sentRaw || []) as Array<{ id: string; recipient: string; context: string | null; status: string; created_at: string }>

  const ids = new Set<string>()
  for (const r of inc || []) ids.add(r.requester)
  for (const s of sent) ids.add(s.recipient)
  const who: Record<string, { name: string; sig: string }> = {}
  const vecById: Record<string, Record<string, number>> = {}
  if (ids.size) {
    const { data: profs } = await a.from('profiles').select('id, display_name, member_no').in('id', [...ids])
    const memberNos = (profs || []).map(p => p.member_no).filter(Boolean)
    const { data: tps } = await a.from('member_taste_profiles').select('member_no, vector').in('member_no', memberNos.length ? memberNos : ['_'])
    const vecOf: Record<string, Record<string, number>> = {}
    for (const t of tps || []) vecOf[t.member_no] = (t.vector || {}) as Record<string, number>
    for (const pr of profs || []) { who[pr.id] = { name: pr.display_name || 'A member', sig: paletteSignature(pr.member_no ? vecOf[pr.member_no] : {}) }; vecById[pr.id] = pr.member_no ? (vecOf[pr.member_no] || {}) : {} }
  }
  // my own vector — for the palate-match %, computed against the (still-hidden) requester
  const { data: myTp } = await a.from('member_taste_profiles').select('vector').eq('member_no', actor.memberNo).maybeSingle()
  const myVec = (myTp?.vector || {}) as Record<string, number>

  // via for my SENT rows (the fn doesn't carry it) — so a pending palate match
  // masks the recipient too (the requester is also blind until B accepts).
  const sentIds = sent.map(s => s.id)
  const { data: sentVia } = await a.from('introductions').select('id, via').in('id', sentIds.length ? sentIds : ['_'])
  const viaOf: Record<string, string> = {}
  for (const v of sentVia || []) viaOf[v.id] = v.via

  return NextResponse.json({
    incoming: (inc || []).map(r => {
      if (r.via === 'palate_match') {
        // DOUBLE-BLIND: the requester is NEVER named here — only the match framing.
        const theirVec = vecById[r.requester] || {}
        return { id: r.id, via: 'palate_match', created_at: r.created_at, match_pct: pct(cosineSimilarity(myVec, theirVec)), shared_note: sharedNote(myVec, theirVec) }
      }
      return { id: r.id, via: 'directory', context: r.context, created_at: r.created_at, from_name: who[r.requester]?.name || 'A member', from_sig: who[r.requester]?.sig || '' }
    }),
    sent: sent.map(s => {
      const palate = viaOf[s.id] === 'palate_match'
      const masked = palate && s.status !== 'accepted'   // reveal the name only once connected
      return { id: s.id, via: palate ? 'palate_match' : 'directory', context: palate ? null : s.context, created_at: s.created_at, status: s.status, to_name: masked ? null : (who[s.recipient]?.name || 'A member') }
    }),
  })
}
