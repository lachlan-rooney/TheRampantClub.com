# Schedule Part 2 — Conduct and Etiquette (DRAFT)

**Status: not published.** Referenced by clause 14.1 of the Membership Agreement, which currently
points at a document that does not exist. Part 1 (benefits) is referenced by 3.3, 5.2 and 12.1 and
does not exist either — 5.2 and 12.1 are the more exposed of the two, since they define what a
member is owed.

This schedule is on the **signing path**, not the scroll-and-agree path: it is referenced by the
Agreement and binds through it, so `satisfied_by = 'signature'` when it is registered.

---

## Costs — Accidents

> **Accidents**
>
> Members are responsible for the cost of cleaning where they or their guests are sick in the club.
> A charge of VND 3,000,000 is applied to the member's account to cover that cleaning.
>
> This is a cleaning cost, not a penalty, and it is not a judgement. Tell a member of staff. Nobody
> will be embarrassed, nothing will be discussed afterwards, and a member who says early that they
> are unwell will always be looked after first.

**Why the second paragraph is not decoration.** A charge for being sick creates an incentive to hide
it — to slip off to a bathroom alone, or for a friend to say nothing. In a five-floor building with a
self-pour room, someone quietly unwell on their own is the outcome the club least wants. Saying
plainly that help comes first and the charge is administrative removes that incentive at no cost.

Consistent with what the Agreement already says: the guest rule makes the member responsible for
their guest's bill, and the intoxication clause already provides that a member who cannot conduct
themselves is seen home and it is not discussed afterwards.

### Two constraints on this clause

1. **Cost recovery, not a penalty — in the wording, not merely the framing.** "The cost of cleaning",
   with the 3m stated as the charge for that cleaning. Vietnamese law limits contractual penalties in
   ways it does not limit recovery of a real cost. **Ask TNJ Law rather than assuming**; 3m reads as
   a plausible deep-clean cost, so the number supports the framing.

2. **It cannot bind members who have already signed.** The Agreement is executed and TNJ-reviewed;
   a charge added to the schedules afterwards binds new members only. Either it goes into the next
   version that everyone re-signs, or existing members are notified and it applies from a stated
   date. There is at least one signed agreement on record already (`signed_agreements`), so this is
   a live constraint, not a theoretical one.

### Operational

Applied by the **duty manager**, charged to the account **the next day** — not argued about on the
night. Nobody negotiates well at 2am and the club looks better for not trying.

---

## Still to write

The rest of Part 2, and the whole of Part 1. When they are written they register in
`terms_documents` with `satisfied_by = 'signature'` and publish through
`publish_terms_version()` — one row each, no code change.
