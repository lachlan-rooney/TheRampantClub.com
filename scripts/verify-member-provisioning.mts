#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════════════
// PROVISIONING — does signing actually give a member a way in, and can it be
// signed twice?
// ───────────────────────────────────────────────────────────────────────────
// Before this, becoming a member and being able to sign in were unconnected:
// member_no was stamped onto a profile BY HAND or not at all, and an account
// that was never linked looked exactly like a working one. Six founding members
// were about to be invited into that.
//
// This drives the REAL function the signing handler calls, not a copy of it.
// Touches no real member: it makes its own member_no and its own inbox address,
// and removes both — three throwaways have survived their own cleanup in this
// project already, and one held admin rights, so teardown asserts.
//
//   npx tsx scripts/verify-member-provisioning.mts
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { provisionMemberAccount } from '../lib/members/provision.ts'

const env: Record<string, string> = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

let pass = 0, fail = 0
const check = (c: boolean, l: string, d = '') => {
  if (c) { pass++; console.log(`✓ ${l}${d ? ' — ' + d : ''}`) }
  else { fail++; console.log(`✗ ${l}${d ? ' — ' + d : ''}`) }
}

const NO = `ZZP${Date.now().toString().slice(-6)}`          // varchar(12)
const MAIL = `zz-prov-${Date.now()}@example.invalid`
const made: string[] = []

try {
  console.log('\n── a membership with no account, as the six are today ──')
  const { error: me } = await sb.from('members').insert({
    member_no: NO, full_name: 'ZZ Provisioning Probe', status: 'Active', tier: 'Legacy',
  })
  if (me) throw new Error(`could not create the throwaway member: ${me.message}`)
  console.log(`  ${NO}, no account`)

  // ── SIGNING ──────────────────────────────────────────────────────────────
  console.log('\n── they sign ──')
  const first = await provisionMemberAccount(sb, { email: MAIL, fullName: 'ZZ Provisioning Probe', memberNo: NO })
  check(first.ok, 'signing creates their account', first.ok ? 'created' : first.error)
  if (first.ok) made.push(first.account_id)
  check(first.ok && first.created, '…a new one, not adopted')

  const { data: prof } = await sb.from('profiles').select('member_no').eq('id', first.ok ? first.account_id : '').maybeSingle()
  check(prof?.member_no === NO, 'and it is STAMPED with their member number',
        `member_no=${prof?.member_no}`)

  // ── SIGNED TWICE ─────────────────────────────────────────────────────────
  // A retry after a timeout, or someone opening the link on a second device.
  console.log('\n── they sign again ──')
  const second = await provisionMemberAccount(sb, { email: MAIL, fullName: 'ZZ Provisioning Probe', memberNo: NO })
  check(second.ok, 'signing twice does NOT fail the member', second.ok ? 'accepted' : second.error)
  check(second.ok && second.account_id === (first.ok ? first.account_id : ''),
        '…and returns the SAME account', 'no second login made')

  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const dupes = (users?.users || []).filter(u => u.email?.toLowerCase() === MAIL.toLowerCase())
  check(dupes.length === 1, 'exactly one account exists for that address', `${dupes.length}`)

  // ── ALREADY REGISTERED ───────────────────────────────────────────────────
  // Someone who had a login before they joined — adopt it rather than refuse
  // them at the moment they become a member.
  console.log('\n── an address that was already registered ──')
  const NO2 = `ZZQ${Date.now().toString().slice(-6)}`
  await sb.from('members').insert({ member_no: NO2, full_name: 'ZZ Adopt Probe', status: 'Active', tier: 'Legacy' })
  const MAIL2 = `zz-adopt-${Date.now()}@example.invalid`
  const { data: pre } = await sb.auth.admin.createUser({ email: MAIL2, email_confirm: true })
  if (pre?.user) made.push(pre.user.id)
  const adopt = await provisionMemberAccount(sb, { email: MAIL2, fullName: 'ZZ Adopt Probe', memberNo: NO2 })
  check(adopt.ok, 'an existing login is ADOPTED, not refused', adopt.ok ? 'adopted' : adopt.error)
  check(adopt.ok && adopt.adopted && adopt.account_id === pre?.user?.id, '…and it is the same account')
  await sb.from('members').delete().eq('member_no', NO2)

  // ── THE REFUSAL THAT MATTERS ─────────────────────────────────────────────
  // Two people sharing a dossier is the worst outcome available here.
  console.log('\n── the same account, a second membership ──')
  const NO3 = `ZZR${Date.now().toString().slice(-6)}`
  await sb.from('members').insert({ member_no: NO3, full_name: 'ZZ Clash Probe', status: 'Active', tier: 'Legacy' })
  const clash = await provisionMemberAccount(sb, { email: MAIL, fullName: 'x', memberNo: NO3 })
  check(!clash.ok, 'one account cannot be linked to a second membership',
        clash.ok ? 'ALLOWED — two people would share a dossier' : clash.error)
  await sb.from('members').delete().eq('member_no', NO3)
} catch (e) {
  fail++; console.log('✗ threw —', (e as Error).message)
} finally {
  console.log('\n── teardown ──')
  for (const id of made) {
    await sb.from('profiles').update({ member_no: null }).eq('id', id)
    await sb.auth.admin.deleteUser(id).catch(() => {})
  }
  await sb.from('members').delete().ilike('member_no', 'ZZP%')
  await sb.from('members').delete().ilike('member_no', 'ZZQ%')
  await sb.from('members').delete().ilike('member_no', 'ZZR%')
  const { data: left } = await sb.from('members').select('member_no').or('member_no.ilike.ZZP%,member_no.ilike.ZZQ%,member_no.ilike.ZZR%')
  if (left?.length) { fail++; console.log('✗ throwaway members survived:', left.map(l => l.member_no).join(', ')) }
  const { data: u } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const stray = (u?.users || []).filter(x => /zz-(prov|adopt)-/.test(x.email || ''))
  if (stray.length) { fail++; console.log('✗ throwaway accounts survived:', stray.map(x => x.email).join(', ')) }
  if (!left?.length && !stray.length) console.log('  every throwaway member and account removed')
  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass} passed, ${fail} failed\n`)
  process.exit(fail === 0 ? 0 : 1)
}
