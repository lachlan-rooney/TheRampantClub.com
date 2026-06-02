/**
 * observatory-samples.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bundled fictional transcripts for the Observatory's live-extraction demo.
 *
 * Static content. NOT a DB row. The demo route at
 * /api/admin/observatory/extract-demo accepts a `transcript` field in the
 * request body — the UI loads one of these into a textarea, then sends it.
 * Bundling them in code means the presenter never types or pastes a real
 * member transcript in front of an audience by accident.
 *
 * Each sample is engineered to exercise the showcase beats:
 *   - at least one allergy / medical signal (medical guardrail fires)
 *   - the "medicinal" tasting-note trap (must NOT force medical)
 *   - hedged vs emphatic confidence (confidence inference visible)
 *   - spread across the 9 canonical categories.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SampleTranscript {
  id: string
  member_name: string
  label: string
  description: string
  transcript: string
}

const CALLUM_MACKENZIE: SampleTranscript = {
  id: 'callum-mackenzie',
  member_name: 'Callum Mackenzie',
  label: 'Callum Mackenzie · whisky, shellfish allergy, evening person',
  description:
    "Library Bar interview. Includes the medical guardrail beat (shellfish allergy with throat tightening) AND the 'medicinal' tasting-note trap on Islay whisky — which must NOT force medical. Spreads across Whisky / F&B / Personal & Lifestyle / Social / Cultural / Family / Travel.",
  transcript: `RAMPANT CLUB — MEMBER PREFERENCE INTERVIEW
Member (prospective): Callum Mackenzie
Interviewer: Miss Chau (Member Experience)
Location: Library Bar
Note: Transcript for Member Intelligence System demonstration. Fictional member.

─────────────────────────────────────────────────────────────────────────────

CHAU: Thanks for coming in, Callum. There's no script to this — I just want to get a feel
for how you like things, so the team knows you before you've even sat down. Start wherever.

CALLUM: [laughs] Right, no pressure. Where do I — okay. Whisky. We should probably start
with whisky, given where we are.

CHAU: Given where we are.

CALLUM: I'm a peat man. Always have been. [leans in] I mean it — if there's an Islay on the
list, that's where I'm going, every single time. Laphroaig, Lagavulin, the big smoky ones.
My father drank Laphroaig, so. It's not really a preference, it's more… it's him, you know?
I can't smell it without being eight years old again in his study. So yeah. That one's not
negotiable.

CHAU: That's a lovely thing to carry.

CALLUM: [quieter] Aye. It is. Anyway — [clears throat] — neat, always. Never with ice, never
with water unless it's a cask-strength that genuinely needs opening up, and even then I'll do
it myself, thanks. A drop. Not a splash.

CHAU: Noted. Neat, you pour your own water.

CALLUM: You're learning already. [grins] Some of the Islays can get a bit — people call them
medicinal, that iodine, TCP sort of note? Love that. Other people can't stand it. I think
it's the best thing about them, honestly.

CHAU: And beyond whisky?

CALLUM: I've been on a bit of a sherry-cask kick lately, actually. Last few months. GlenDronach,
the Spanish oak stuff. I don't know if it'll last — I go through phases — but right now, yeah,
pour me something sherried and I'm happy. Ask me again in spring, might've moved on entirely.

CHAU: [laughs] We'll keep a note with a question mark on it.

CALLUM: Probably wise.

CHAU: Let's talk food. Anything we should know?

CALLUM: Yeah — and this one matters, so. I'm a bit funny with shellfish. Prawns, crab, the
whole lot. It's not a — I don't love talking about it, but if I have it my face goes, my
throat gets tight, it's not pretty. So just… no shellfish, anywhere near anything. I carry
something for it but I'd rather not test the theory, you know?

CHAU: [serious] Understood completely. That's exactly the kind of thing we need to know.

CALLUM: Appreciated. Beyond that I'm easy. I love a bit of heat — Sichuan, proper spicy, the
more the better. And I'm big on natural wine and good sourdough, if the kitchen ever does a
board. [pause] Actually, write those as two things, the wine and the bread, they're not
the same mood.

CHAU: Two things. Done.

CALLUM: I'm not fussy otherwise. I'll try anything once. Well — once. Twice if it's good.

CHAU: What about the space itself? How do you like to be in a room?

CALLUM: Corner. Back to the wall, always. [slightly sheepish] I know how that sounds, very
dramatic, but I just — I like to see the room, see who's coming and going. Can't relax with
my back to a door. It's a thing.

CHAU: It's a common thing. We can do that.

CALLUM: And — this is more of a preference than a rule — I tend to come in the evenings.
After seven, usually. Mornings I'm useless, I'm not a morning person, so don't ever schedule
me anything before ten if you can help it. [laughs] Evenings I'm a different animal.

CHAU: Evening person. Noted with feeling.

CALLUM: Music — can I say something about music? The playlists in places like this are
always either too loud or it's, you know, lift music. If you ever do anything ambient,
something with a bit of texture, low and warm — I'd notice. I really would. I'm quite into
the more electronic, downtempo end of things. But that's a soft one, don't build the whole
club around me.

CHAU: [laughs] Just you, then. Anything on the personal side — family, occasions, things
we might mark?

CALLUM: [warmly] Yeah, my wife — Sophie. Our anniversary's the fourteenth of October, and
I always, always forget to plan anything good, so honestly if the club could nudge me a week
out you'd be saving my marriage. [laughs] That's a real one. Put a star on it.

CHAU: A star on Sophie. We've got you.

CALLUM: And I travel a fair bit for work, through the back half of the year especially —
so I might vanish for a stretch and then I'm back. Don't take it personally if I'm quiet
September, October.

CHAU: We'll keep the corner warm. Last thing — how do you like us to reach you?

CALLUM: Message, never call. I'll ignore a call, I'll answer a message in thirty seconds.
WhatsApp or whatever you use. And — light touch, yeah? I don't need a newsletter. Tell me
when there's something I'd actually care about and otherwise leave me be. That's the whole
trick with me, honestly. Don't crowd me and I'm yours for life.

CHAU: That, I think, we can manage.

CALLUM: [stands, then] Oh — one thing, since you mentioned occasions. I don't do birthdays.
Mine, I mean. Please don't ever do the candle-and-singing thing, I'll walk straight out.
[laughs] That's the one rule. Everything else, surprise me.

CHAU: No singing. Possibly the most important note of the day.

CALLUM: Now you understand me.

─────────────────────────────────────────────────────────────────────────────
END OF INTERVIEW`,
}

// ── Probe transcripts (Pass-8) ───────────────────────────────────────
// Short, single-purpose transcripts that stress specific behaviours of the
// extraction pipeline. Use them back-to-back in the Observatory to see the
// guardrail and confidence logic working (or — the whole point of probing —
// failing).

const PROBE_KEYWORD_FREE_ALLERGIES: SampleTranscript = {
  id: 'probe-keyword-free-allergies',
  member_name: 'Probe · keyword-free allergies',
  label: 'Probe — keyword-free allergies (every line SHOULD lock)',
  description:
    'Six allergies phrased without any of the obvious words (allergy, allergic, anaphylactic). Tests the phrase-pattern side of the content guardrail. Every line should land as MEDICAL — LOCKED. If any one shows up as MEDICAL-ADJACENT · UNLOCKED · VERIFY instead, that is a real miss — exactly what probe mode exists to catch.',
  transcript: `Probe transcript — phrasing without medical keywords. Fictional.

INTERVIEWER: Anything we should know on the food side?
MEMBER: Shellfish and I don't get along. Not even a little.

INTERVIEWER: Noted. Anything else?
MEMBER: Peanuts — I come out in a rash if I'm near them.

INTERVIEWER: Got it. Dairy?
MEMBER: Dairy doesn't agree with me, I'd avoid it.

INTERVIEWER: Eggs?
MEMBER: My throat closes up around eggs. Not pleasant.

INTERVIEWER: Anything I should mark a star next to?
MEMBER: Sesame is a hard no. I went to A&E once after a sesame bun and I'm not doing that again.

INTERVIEWER: Last one — any drinks to flag?
MEMBER: Grapefruit — interferes with my heart medication, so I keep it off the list.

END.`,
}

const PROBE_FIGURATIVE_MEDICAL: SampleTranscript = {
  id: 'probe-figurative-medical',
  member_name: 'Probe · figurative medical',
  label: 'Probe — figurative medical (none SHOULD lock)',
  description:
    'Six lines containing medical-ish words used figuratively or as tasting notes. NONE should land as MEDICAL — LOCKED. They should show up as MEDICAL-ADJACENT · UNLOCKED · VERIFY (advisory, attention-only) so you can confirm each non-firing is correct. If any one of these locks, the guardrail over-fired and the trap was missed.',
  transcript: `Probe transcript — figurative medical language. Fictional.

INTERVIEWER: Tell me about your whisky preferences.
MEMBER: I love the medicinal Islays — that iodine, TCP note, you know. Friends hate it; I think it's the point.

INTERVIEWER: What about long days at work?
MEMBER: An Old Fashioned at six is medicine after a Tuesday like that. Nothing fixes it faster.

INTERVIEWER: Pet peeves?
MEMBER: I'm allergic to small talk, honestly. If I'm here I'd rather sit quietly than chat about the weather.

INTERVIEWER: Anything you find unbearable?
MEMBER: Bad service is my kryptonite. I can forgive almost anything else.

INTERVIEWER: How do you feel about loud rooms?
MEMBER: Noise gives me hives. Not literally — I just mean I can't stand it.

INTERVIEWER: Last one — favourite tea?
MEMBER: Chamomile. I drink it like medicine before bed.

END.`,
}

const PROBE_CONFLICTING_CONFIDENCE: SampleTranscript = {
  id: 'probe-conflicting-confidence',
  member_name: 'Probe · conflicting confidence',
  label: 'Probe — conflicting / hedged confidence',
  description:
    'Six lines that contradict themselves or hedge mid-sentence. Tests whether confidence (C) drops appropriately when the member walks back their own statement. Watch for C ≤ 0.50 markers — those should appear on the contradicted lines, not on the firm ones.',
  transcript: `Probe transcript — confidence under contradiction. Fictional.

INTERVIEWER: Drinks?
MEMBER: I never drink gin. Well — occasionally a Negroni, but only with friends.

INTERVIEWER: Food preferences?
MEMBER: I'm obsessed with natural wine right now. Though I might hate it next month, I go through phases.

INTERVIEWER: Music?
MEMBER: Jazz, always. Although — actually — not the smooth stuff. The harder stuff. I think.

INTERVIEWER: Coffee?
MEMBER: I quit coffee. Mostly. Maybe a flat white at the weekend if I'm honest.

INTERVIEWER: Late-night habits?
MEMBER: I never stay past eleven. Unless someone interesting is talking, in which case all bets are off.

INTERVIEWER: Anything else firm?
MEMBER: Springbank 15 is the dram for me. That one I'm sure about.

END.`,
}

const PROBE_ADVERSARIAL_THIN: SampleTranscript = {
  id: 'probe-adversarial-thin',
  member_name: 'Probe · adversarial-thin',
  label: 'Probe — interviewer chatter with one real preference',
  description:
    'Mostly interviewer talking. A few member replies are just acknowledgements ("mm-hmm", "right"). ONE genuine offhand preference is buried in the chatter. Tests whether the system stays calm and extracts ~1 preference rather than padding the quota with hallucinated ones. If you see 10+ extracted preferences, the system is inventing.',
  transcript: `Probe transcript — thin signal with one real preference. Fictional.

INTERVIEWER: Thanks for coming in. The club's been here three years now, hard to believe.

MEMBER: Mm-hmm.

INTERVIEWER: We've been making some changes recently — new sofas, the lighting, you'll have seen.

MEMBER: Yeah.

INTERVIEWER: Anyway, the whole point of these is for me to get a sense of how you like things. So — tell me anything that comes to mind.

MEMBER: Honestly, I'm easy. I'll figure it out as I go.

INTERVIEWER: Fair enough. Is there anything that would put you off coming in?

MEMBER: Not really. As long as it's not too loud — actually that's the one, I really can't stand it when somewhere's too loud. Other than that I'm easy.

INTERVIEWER: Got it. And — how do you take your coffee, just so the bar knows?

MEMBER: Whatever's going.

INTERVIEWER: [laughs] Helpful.

MEMBER: Sorry. I'm not trying to be difficult, I just don't have a long list.

INTERVIEWER: It's fine. We'd rather know less and get it right than guess.

MEMBER: Appreciated.

INTERVIEWER: Alright — I won't keep you. Welcome to the club.

END.`,
}

export const OBSERVATORY_SAMPLES: SampleTranscript[] = [
  CALLUM_MACKENZIE,
  PROBE_KEYWORD_FREE_ALLERGIES,
  PROBE_FIGURATIVE_MEDICAL,
  PROBE_CONFLICTING_CONFIDENCE,
  PROBE_ADVERSARIAL_THIN,
]
