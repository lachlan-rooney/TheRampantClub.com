import Anthropic from '@anthropic-ai/sdk'
import type { AutoData } from './gather'
import type { Financials } from './financials'

// ═══════════════════════════════════════════════════════════════════════════
// THE REPORT WRITES ITSELF (2026-09-17).
// ───────────────────────────────────────────────────────────────────────────
// The owner: "it's ugly, clunky… involves a lot of text boxes". Eight of them,
// and a report only goes out when a human has filled them in — which is why two
// drafts sat unsent for a fortnight. So the prose is drafted from the numbers
// that were already gathered, and the owner's job becomes reading it.
//
// FOUR RULES, and the first is the one that matters:
//
//   1. IT NEVER INVENTS. The model sees ONLY the figures below and is told that
//      anything not in them does not exist. No revenue it wasn't given, no
//      reason for a number, no guess at why a night was quiet. A weekly report
//      to an investor that embellishes is worse than no report.
//   2. IT SAYS ZERO OUT LOUD. A quiet week, an untouched shift board, no fees
//      taken — those are the useful sentences, not the ones to dress up.
//   3. IT NEVER OVERWRITES A PERSON. This module only DRAFTS; the caller
//      decides what to keep, and never replaces text a human has edited.
//   4. IT CLAIMS NO PROFIT. The club records membership fees and card top-ups;
//      there is no till feed and no expense table, so the model is told to call
//      it revenue recorded, never profit, takings or turnover.
//
// Sonnet rather than Haiku, deliberately: this is the one piece of writing the
// club's investor actually reads, and it is ~2k tokens once a week. The house's
// cheap-model rule (see app/api/admin/translate) is about bulk translation.

const MODEL = 'claude-sonnet-5'
// SONNET THINKS BEFORE IT ANSWERS, and those reasoning blocks are billed against
// max_tokens. At 1,400 the entire budget went on thinking and the reply came back
// with NO text block at all — which read here as "the draft came back in a form we
// could not read". 4,000 leaves room for both (a real run used 1,852).
const MAX_TOKENS = 4000

export interface DraftedNarrative {
  headline: string
  summary: string[]          // three short lines — the week at a glance
  people: string
  money: string
  members: string
  operations: string
  /** Figures the draft used that are NOT in the gathered data. Empty is the
   *  normal case; anything here is shown to whoever approves the report. */
  warnings: string[]
}

const SYSTEM = `You write the weekly report of a private members' whisky club in Ho Chi Minh City, for its investor.

WHAT YOU ARE GIVEN
A JSON object of figures gathered from the club's own systems for one week. That is the entire world. Anything not in it did not happen as far as you are concerned.

ABSOLUTE RULES
- Never state a number that is not in the JSON. Never estimate, extrapolate or infer a cause.
- A field whose name contains "change" is a DIFFERENCE from the previous week, not a total. Never write it as if it were last week's figure. Where a previous-week total is given, use that.
- Use each figure for exactly what its name says: people who came in are not "visits", a booking is not an arrival, and an estimate is not a count.
- Never explain WHY something happened. You do not know.
- If a figure is zero or missing, say so plainly and briefly. A quiet week is information.
- Money: the club records membership fees and member card top-ups only. There is no till feed and no expense table. Call it "revenue recorded", never profit, takings, turnover or sales. Never imply the club's total income is known.
- Do not congratulate, sell, or use marketing language. No "exciting", "fantastic", "momentum".
- Do not give advice or next steps unless a figure directly implies an obvious one (e.g. an untouched task board).

VOICE
British English. Plain, exact, unhurried — the register of a good club secretary writing to one person who owns part of the business. Short sentences. No adjectives doing work a number should do. Amounts in VND, written as e.g. 130,000,000₫.

OUTPUT
Return ONLY a JSON object, no preamble and no code fence:
{
  "headline": "under 9 words, specific to this week, no colon",
  "summary": ["line", "line", "line"],
  "people": "2-3 sentences on who came in, bookings and guests. Say 'came in', not 'visits'.",
  "money": "2-3 sentences on fees and card top-ups, and month to date against target if given.",
  "members": "2-3 sentences on who joined, leads and the pipeline.",
  "operations": "2-3 sentences on the shift board, staff actions, complaints and who is away."
}
Each summary line is under 12 words and carries a figure. If a section has no data at all, write one sentence saying nothing was recorded for it this week.`

/** The facts the model is allowed to see. Deliberately narrow: the full snapshot
 *  carries names and ids the prose has no business repeating. */
function facts(auto: AutoData, financials: Financials | null) {
  const u = auto.usage
  // A DIFFERENCE IS NOT A TOTAL. Given a field called change_vs_last_week: 6, the
  // first real draft wrote "up from 6 last week" — last week was 1. So last week's
  // actual figure is worked out here and handed over beside the change, and the
  // day counts say what they are: people in, not recorded visits.
  const cameIn = u.attendance ?? u.visits
  const change = auto.deltas.attendance ?? auto.deltas.visits ?? null
  return {
    week: auto.period.label,
    people: {
      came_in: cameIn,
      came_in_previous_week: change == null ? null : cameIn - change,
      change_vs_previous_week: change,
      different_members: u.unique_members,
      bookings: u.bookings,
      people_booked: u.booked_people,
      arrived: u.arrived,
      guests_logged: u.guest_heads,
      guests_estimated_from_party_sizes: u.guest_proxy,
      people_in_by_day: u.visits_by_day.filter(d => d.count > 0).map(d => `${d.label}: ${d.count} people in`),
    },
    money: auto.money ? {
      fees_this_week_vnd: auto.money.week.membership_total,
      fees_count: auto.money.week.membership_count,
      card_topups_this_week_vnd: auto.money.week.card_topups,
      card_spend_this_week_vnd: auto.money.week.card_charges,
      month: auto.money.mtd.month_label,
      month_to_date_revenue_vnd: auto.money.mtd.total,
      month_target_vnd: auto.money.mtd.target_vnd,
      month_pct_of_target: auto.money.mtd.pct_of_target,
      note: 'membership fees and card top-ups only; no till or expense data exists',
    } : null,
    members: {
      joined: auto.pipeline.onboarded?.map(o => `${o.name} (${o.tier})`) ?? [],
      joined_count: auto.members.new_total,
      new_leads_this_week: auto.pipeline.new_leads,
      pipeline_by_stage: auto.pipeline.funnel.map(f => `${f.stage}: ${f.count}`),
      interviews_this_week: auto.pipeline.interviews.length,
      agreements_signed: auto.pipeline.signed,
    },
    operations: auto.ops ? {
      shift_tasks_set: auto.ops.tasks.total,
      shift_tasks_done: auto.ops.tasks.done,
      shift_tasks_untouched: auto.ops.tasks.not_started,
      staff_actions_recorded: auto.ops.staff_actions,
      most_common_actions: auto.ops.top_actions.map(a => `${a.what} ×${a.count}`),
      complaints_opened: auto.ops.complaints.opened,
      complaints_resolved: auto.ops.complaints.resolved,
      complaints_still_open: auto.ops.complaints.open_now,
      away: auto.ops.away.map(a => `${a.name} (${a.kind}, ${a.start} to ${a.end})`),
    } : null,
    events: {
      fixtures: auto.events.fixtures.map(f => `${f.title} — ${f.signups} signed up`),
      house_entries_by_kind: auto.events.calendar_by_kind,
    },
    press_this_week: (auto.press || []).map(p => `${p.title}${p.outlet ? ` (${p.outlet})` : ''}`),
    // ONE MONTH-TO-DATE FIGURE, NOT TWO. money.mtd and financials both total the
    // month by slightly different rules, and given both the model quoted each in
    // turn — 180,000,000₫ in one sentence and 185,000,000₫ in the next, neither
    // invented. The month block is only added when there is no money block; the
    // month-on-month change is kept either way, because nothing else carries it.
    month_change_vs_prior_pct: financials?.delta_pct ?? null,
    month_financials: !auto.money && financials ? {
      month: financials.month_label,
      membership_vnd: financials.membership.total,
      card_topups_vnd: financials.card.topups,
      total_revenue_vnd: financials.total_revenue,
    } : null,
  }
}

// ── THE FIGURE CHECK ────────────────────────────────────────────────────────
// "Never invent" is a rule in the prompt; this is the rule with teeth. Every
// number the draft uses must appear in the facts it was given — as written, or
// as a plain-language rounding of a VND amount (2,200,000₫ → "2.2 million").
// Years, percentages of a figure already present and single digits from ordinary
// prose ("two members joined") are not worth flagging, so only numbers of two
// digits or more are checked.
function unsupportedFigures(prose: string, factsJson: string): string[] {
  const known = new Set<string>()
  for (const m of factsJson.matchAll(/\d+(?:\.\d+)?/g)) {
    const n = Number(m[0])
    known.add(m[0])
    known.add(String(n))
    if (n >= 1e6) { known.add(String(n / 1e6)); known.add(String(Math.round(n / 1e6))) }
    if (n >= 1e3) known.add(String(Math.round(n / 1e3)))
  }
  const out = new Set<string>()
  for (const m of prose.matchAll(/\d[\d,.]*/g)) {
    const raw = m[0].replace(/[.,]$/, '')
    const plain = raw.replace(/,/g, '')
    if (plain.length < 2) continue
    if (/^(19|20)\d\d$/.test(plain)) continue          // a year
    if (known.has(plain) || known.has(String(Number(plain)))) continue
    out.add(raw)
  }
  return [...out]
}

/** Reads as a failure the caller can act on: an exhausted balance is a thing you
 *  fix in a minute, and "draft failed" is not. Mirrors the translate route. */
function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/credit balance|billing/i.test(m)) return 'the Anthropic balance is exhausted'
  if (/rate limit|429/i.test(m)) return 'the Anthropic rate limit was hit — try again shortly'
  return m.slice(0, 160)
}

export async function draftNarrative(auto: AutoData, financials: Financials | null): Promise<DraftedNarrative> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('No Anthropic key is configured.')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const given = JSON.stringify(facts(auto, financials), null, 1)

  let text: string
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: given }],
    })
    text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('').trim()
  } catch (e) {
    throw new Error(friendly(e))
  }

  // Tolerate a fenced block, refuse anything that isn't the shape we asked for —
  // half a draft silently saved would be worse than none.
  const json = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  let parsed: Partial<DraftedNarrative>
  try { parsed = JSON.parse(json) } catch { throw new Error('The draft came back in a form we could not read.') }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const out: DraftedNarrative = {
    headline: str(parsed.headline),
    summary: Array.isArray(parsed.summary) ? parsed.summary.map(str).filter(Boolean).slice(0, 3) : [],
    people: str(parsed.people),
    money: str(parsed.money),
    members: str(parsed.members),
    operations: str(parsed.operations),
    warnings: [],
  }
  if (!out.headline || !out.summary.length) throw new Error('The draft came back incomplete.')

  const bad = unsupportedFigures([out.headline, ...out.summary, out.people, out.money, out.members, out.operations].join(' '), given)
  if (bad.length) out.warnings.push(`Check these figures — they are not in the week's data: ${bad.join(', ')}`)
  return out
}
