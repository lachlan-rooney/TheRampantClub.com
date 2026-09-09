# Schedule Part 1 — source material

Extracted from **`~/Documents/Membership to The Rampant Club x.pdf`** (8 pages),
the document members were actually shown. This is the raw answer to "what were
they promised", **not** a draft of Part 1.

> ⚠️ **Check the numbers against the original before they enter a contract.**
> The PDF uses a subsetted font with no space glyphs, so this was recovered by
> undoing a character offset and reinstating word breaks. The prose is reliable;
> a digit that came through wrong would be silent. Every figure below is quoted,
> and every one should be eyeballed once.

---

## 1 · The whisky benefit — ANSWERED, with figures

| Promise | As written |
|---|---|
| Monthly credit | **5,000,000 VND per member, per month**, in club credit |
| What it covers | "Valid on all food, beverages, and room experiences" |
| Expiry | "**Monthly reset (no rollover)**" |
| Room charge | Rampant Room Experience **1,000,000 VND per hour, per head** |
| Worked example | "spend their 5M VND monthly credit bringing four friends to the bottle share room for an hour. Alternatively… book a space in The Rampant Room themselves for five hours" |
| Club Picks | Quarterly. Whisky Committee members select a single cask bottled exclusively for the club |
| Blending | Private blending sessions for members **and their guests**; members make their own small bottlings |
| Private cask | Purchase an entire private cask; may include a selection trip to the Duncan Taylor warehouses, personalised labelling, full management by the whisky team until it arrives in Vietnam |
| Rarest Reserve | **First right of refusal** on rare, aged stocks from Duncan Taylor's Rarest Reserve releases |
| Private labelling | Duncan Taylor Blends range, **minimum 10 bottles** |
| Retail | **20% discount** at the retail whisky shop; takeaway bottles from the Duncan Taylor store below the club at a discounted member price |

## 2 · Event access — PARTLY answered

Answered:
- The club curates **at least four** exceptional gatherings a year (castle takeover, Mekong cruise, charity galas, golf at The Bluffs).
- **Members are *expected* to take part in at least two events each year.** Note this is an *obligation on the member*, not a benefit — it needs care in a schedule.
- **Event tickets are chargeable**, listed under itemised pricing (CEO round table, whisky journeys, dinners).
- Round tables run under **Chatham House rules**, in Vietnamese and English.
- **Guests: up to four at a time.** More requires consulting about private hire.
- Unsupervised guests may be authorised **in advance** with the Member Experience team; **the sponsoring member is responsible for guest behaviour**.
- **Unsupervised guests may not use member credit.**

Not answered:
- How places are allocated when an event is oversubscribed.
- Cancellation, refunds, or no-show consequences for a paid ticket.
- What follows if a member does **not** attend two events. "Expected to" carries no stated consequence.
- Whether guests may attend events, or only the clubhouse.

## 3 · The Annual Dram — **DECIDED: REMOVED** (2026-09-09)

The word "dram" does not appear anywhere in the 8 pages. Members were not
promised it here.

A search of the whole system found **nothing to remove**: no code, no database
row, no reference in the signed Membership Agreement. The only occurrence
anywhere is the phrase "the drams you've enjoyed" in the Privacy Notice, which
is ordinary usage and unrelated.

So the Annual Dram was an idea that never reached the members or the system.
**Part 1 does not mention it.** Nothing was deleted because nothing existed.

## 4 · Locker terms — **MOSTLY SETTLED** (2026-09-09)

Decided, and enough to write the section:

| Question | Answer |
|---|---|
| Cost | **Free** |
| Capacity | **Roughly six bottles** |
| On leaving | Bottles are **returned to the member**, and **held until collected** |
| Liability | The club takes **no responsibility**; a **waiver is signed on entry** |
| Mid-membership | A member may **remove bottles at any time** |
| Allocation | **Not every member — allocated from a fixed stock.** The admin locker system holds **42 physical lockers** (grid-positioned, A-01 …), 24 currently occupied and 18 empty |

### The number that decides the wording: 42 lockers, 99 members

The signed agreement caps membership at **99**. There are **42 lockers**. So a
locker cannot be a membership benefit in the way the brochure sentence implies —
at anything above 42 members it is a **finite allocation**, and the section must
say "a locker" rather than "your locker".

It is not scarce yet (9 active members), which is exactly why it is worth
writing the rule now. **Part 1 needs to state how one is allocated** — first
come, on request, by tier, or at the club's discretion — because a free benefit
that runs out without a stated rule stops looking like a benefit and starts
looking like a favour, and members compare notes.

**Capacity is confirmed by the data, not just by recollection:** the fullest
locker holds **6 bottles**, three hold exactly 6, the median is 2, across 53
bottles in 23 lockers. "Roughly six" is right.

### ⚠ A gap that blocks the promise as written

The promise is that **bottles are returned to the member when they leave**.
The data cannot currently say whose bottles they are.

- 24 lockers are marked occupied
- **1** carries a `member_no`
- 19 carry a free-text label instead — `"LACHLAN"`, `"SHAWN"`, `"Brandon"`
- `profiles.locker_number` exists and is **empty for every member** — a dead field

So a first name written on a locker is the only record of ownership for 23 of
24. That is fine while there are nine members and everyone knows everyone. It
stops being fine at the first departure, the first dispute, or the first member
who shares a first name with another — and it is the kind of thing that is much
cheaper to fix before it matters than after.

Linking each occupied locker to a `member_no` is a short piece of work and
should happen before Part 1 promises a return.

### What the source document actually said



The entire text is:

> "Enhance your membership with a private locker to store your exceptional
> bottles, ensuring your finest spirits are always here for you to enjoy with
> friends."

Nothing on: whether a locker is included or charged, how one is allocated or
requested, size or bottle limit, term and renewal, what happens to the contents
when a membership lapses or is terminated, liability for loss or breakage, or
whether stored bottles remain the member's property. **Every one of those is a
question a member will eventually ask**, and four of them are the kind that
arrive with a lawyer.

---

## Also promised here — Part 1 will need to cover these too

- **Referral reward:** 10,000,000 VND in club credit, a rare bottle from the
  reserves, and a personalised luxury gift — payable on a candidate who passes
  interview **and** accepts an invitation.
- **Reciprocal club access:** vetted global network; London, New York, Tokyo,
  Singapore named.
- **Scottish castle:** "slated to open late 2026 / early 2027", exclusive
  discounts on stays, activities and dining. ⚠️ It is now September 2026 — a
  dated promise close to its own deadline.
- **Huntly apartment:** *complimentary* stay, advance reservation required,
  furnished with cask samples.
- **Luxury transport:** chauffeur to collect and return, "**available to you free
  of charge, subsidised by the club**"; airport security fast-track.
- **Concierge:** Zalo/WhatsApp hotline for bookings, event RSVPs, requests.

Three of those are **unbounded promises** — complimentary stays, free chauffeur,
first right of refusal — and a schedule is where limits belong if there are any.

## What Part 1 still needs a human decision on

1. ~~The Annual Dram~~ — settled: it exists nowhere and Part 1 omits it.
2. Locker terms — **the terms are settled**; two things remain and neither is a
   drafting question. (a) The ALLOCATION RULE, because 42 lockers cannot cover
   99 members. (b) Linking occupied lockers to a `member_no` — 23 of 24 record
   only a first name, so "returned to the member" cannot currently be executed
   from the data. See section 4.
3. Limits on the unbounded promises above, or an explicit statement there are none.
4. The consequence, if any, of missing the two-event expectation.
5. Whether the castle promise survives as written now the date is upon it.
