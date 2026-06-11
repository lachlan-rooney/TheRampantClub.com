import { NextResponse } from 'next/server'
import { getActor, svc } from '@/lib/social/server'
import { cosineSimilarity, sharedNote, pct, PALATE_TWIN_THRESHOLD } from '@/lib/whisky/palate-twins'
import { encryptMatch } from '@/lib/social/match-token'

// Anonymous palate matches. Computed server-side between the caller and OTHER
// members who BOTH hold the palate_twin consent. Returns ONLY { token, pct,
// shared_note } per match — never a name, uid, member_no, or vector. The token is
// the candidate's encrypted uid (bound to the caller); the client cannot reverse it.

export const dynamic = 'force-dynamic'

type Vec = Record<string, number>

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  if (!actor.memberNo) return NextResponse.json({ consented: false, matches: [] })
  const a = svc()

  // Caller must hold the palate_twin consent.
  const { data: myConsent } = await a.from('member_consents').select('enabled').eq('member', actor.id).eq('feature', 'palate_twin').maybeSingle()
  if (!myConsent?.enabled) return NextResponse.json({ consented: false, matches: [] })

  // Caller's vector.
  const { data: myTp } = await a.from('member_taste_profiles').select('vector').eq('member_no', actor.memberNo).maybeSingle()
  const myVec = (myTp?.vector || {}) as Vec
  if (!Object.keys(myVec).length) return NextResponse.json({ consented: true, matches: [], reason: 'no_vector' })

  // Other consenters (server-enforced mutual opt-in).
  const { data: consenters } = await a.from('member_consents').select('member').eq('feature', 'palate_twin').eq('enabled', true)
  const otherIds = (consenters || []).map(c => c.member).filter(id => id !== actor.id)
  if (!otherIds.length) return NextResponse.json({ consented: true, matches: [] })

  // Their vectors (via member_no) — never returned to the client.
  const { data: profs } = await a.from('profiles').select('id, member_no').in('id', otherIds)
  const memberNos = (profs || []).map(p => p.member_no).filter(Boolean)
  const { data: tps } = await a.from('member_taste_profiles').select('member_no, vector').in('member_no', memberNos.length ? memberNos : ['_'])
  const vecByNo: Record<string, Vec> = {}
  for (const t of tps || []) vecByNo[t.member_no] = (t.vector || {}) as Vec

  // Exclude blocked pairs + anyone we already have an introduction with (either way).
  const { data: blocks } = await a.from('member_blocks').select('blocker, blocked').or(`blocker.eq.${actor.id},blocked.eq.${actor.id}`)
  const blockedWith = new Set<string>()
  for (const b of blocks || []) { blockedWith.add(b.blocker === actor.id ? b.blocked : b.blocker) }
  const { data: existingIntros } = await a.from('introductions').select('requester, recipient').or(`requester.eq.${actor.id},recipient.eq.${actor.id}`)
  const introWith = new Set<string>()
  for (const i of existingIntros || []) { introWith.add(i.requester === actor.id ? i.recipient : i.requester) }

  const matches: { token: string; pct: number; shared_note: string }[] = []
  for (const p of profs || []) {
    if (!p.member_no || blockedWith.has(p.id) || introWith.has(p.id)) continue
    const theirVec = vecByNo[p.member_no]
    if (!theirVec || !Object.keys(theirVec).length) continue
    const cos = cosineSimilarity(myVec, theirVec)
    if (cos < PALATE_TWIN_THRESHOLD) continue
    matches.push({ token: encryptMatch(actor.id, p.id), pct: pct(cos), shared_note: sharedNote(myVec, theirVec) })
  }
  matches.sort((x, y) => y.pct - x.pct)
  return NextResponse.json({ consented: true, matches })
}
