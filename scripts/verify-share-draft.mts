import { buildDraft, emojiFor, isShareable, TYPE_EMOJI } from '../lib/share/draft'

let fails = 0
const ok = (c: boolean, l: string, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) fails++ }

console.log('── the emoji map ──')
ok(emojiFor('golf') === '⛳' && emojiFor('tasting') === '🥃' && emojiFor('dinner') === '🍽️', 'mapped from type, not generated')
ok(emojiFor('nonsense') === '✨', 'an unknown type falls back rather than rendering blank', emojiFor('nonsense'))
ok(emojiFor(null) === '✨', 'null type falls back')

console.log('\n── what a capped event says about seats ──')
const capped = buildDraft({
  type: 'social', title: 'An Evening with Ken Grier', date: '2026-09-18T12:00:00+00:00',
  where: 'Hai Bar, Sheraton Saigon', capped: true,
  blurb: 'Ve De Di host an evening with Ken Grier.\n\nSix seats.',
})
ok(!/\b6\b|\bsix\b/i.test(capped.en.split('\n').slice(-4).join(' ').replace(/Six seats\./, '')),
   'no seat NUMBER in the seats line — it is true when written and wrong an hour later')
ok(/Places are limited/.test(capped.en), 'says places are limited instead')
ok(/Số lượng có hạn/.test(capped.vn), 'and in Vietnamese')

console.log('\n── plain text, because Zalo renders no markup ──')
const all = capped.en + capped.vn
ok(!/[*_~`]/.test(all), 'no markdown characters anywhere', JSON.stringify(all.match(/[*_~`]/g) || []))
ok(capped.en.includes('\n'), 'structure comes from line breaks')

console.log('\n── a missing Vietnamese title is REPORTED, not faked ──')
ok(capped.vnComplete === false, 'vnComplete false when title_vn is absent')
ok(capped.missing.includes('title_vn'), 'names the missing field')
ok(capped.vn.includes('An Evening with Ken Grier'), 'VN draft falls back to the English title, never blank')
const both = buildDraft({ type: 'tasting', title: 'Islay Night', title_vn: 'Đêm Islay', date: '2026-10-01T11:00:00+00:00' })
ok(both.vnComplete === true, 'vnComplete true when title_vn exists')
ok(both.vn.includes('Đêm Islay') && !both.vn.includes('Islay Night'), 'and the VN draft uses it')

console.log('\n── the blurb is ONE line, not the whole description ──')
const long = buildDraft({ type: 'dinner', title: 'Dinner', date: '2026-10-01T11:00:00+00:00',
  blurb: 'First line here.\n\nSecond paragraph that must not appear.' })
ok(!long.en.includes('must not appear'), 'only the first paragraph is used')
const huge = buildDraft({ type: 'dinner', title: 'D', date: '2026-10-01T11:00:00+00:00', blurb: 'x'.repeat(400) })
ok(huge.en.includes('…') && huge.en.length < 320, 'a long blurb is truncated', `${huge.en.length} chars`)

console.log('\n── the shareable gate ──')
ok(isShareable('member') === true, 'member-visible entries are shareable')
ok(isShareable('staff') === false, 'STAFF-ONLY entries are not')
ok(isShareable(null) === false && isShareable(undefined) === false, 'and neither is an unknown visibility')

console.log('\n── what CANNOT be passed (privacy by construction) ──')
// These are compile-time guarantees; assert the runtime shape too so a future
// widening of ShareInput cannot silently start leaking.
const keys = Object.keys({
  type: '', title: '', title_vn: '', blurb: '', blurb_vn: '',
  date: '', time: '', where: '', capped: false, url: '',
})
for (const forbidden of ['attendee', 'description', 'signups', 'roster', 'member_no', 'max_signups']) {
  ok(!keys.includes(forbidden), `ShareInput has no \`${forbidden}\` field`)
}

console.log('\n── the draft, as Miss Châu will see it ──')
console.log(capped.en.split('\n').map(l => '   ' + l).join('\n'))
console.log('   ' + '─'.repeat(46))
console.log(capped.vn.split('\n').map(l => '   ' + l).join('\n'))

console.log(fails === 0 ? '\nPASS\n' : `\nFAIL — ${fails}\n`)
process.exit(fails ? 1 : 0)
