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

export const OBSERVATORY_SAMPLES: SampleTranscript[] = [CALLUM_MACKENZIE]
