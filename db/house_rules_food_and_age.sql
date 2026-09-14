-- ═══════════════════════════════════════════════════════════════════════════
-- TWO HOUSE RULES: ORDERING FOOD IN, AND AGE
-- ───────────────────────────────────────────────────────────────────────────
-- Both approved by Lachlan 2026-09-13.
--
-- WHY HERE AND NOT IN THE TERMS. A plating fee is a PRICE, and prices do not
-- belong in a document that needs a lawyer and a re-signature to change — the
-- Terms already carry "the joining fees for 2025" as a hostage to that fact.
-- House Rules are DB-backed and change in a click. The Terms make the charge
-- collectable (§3.5, "fees and charges for services consumed", and Schedule
-- Part 2 §13, settlement of charges); this says what the charge IS.
--
-- The age rule is the opposite case: it IS in the Terms, at §5.5 and §5.6
-- (members 21+, guests 18+, proof of age on request). This restates it in the
-- words a member actually meets at the door. If the two ever disagree, the
-- Terms prevail and this row is the one that is wrong.
--
-- Age sits at 6, beside Guest Policy at 5, because a member reading about
-- guests should meet the age rule in the same breath. Food takes 7, and
-- Complaints moves to 9 so it stays last, where it was.
--
-- ⚠ section_title_vn IS DELIBERATELY NULL ON BOTH. Every other row has a
-- Vietnamese title. These two do not, because nobody has written one yet — the
-- house rule is that member-facing Vietnamese is written by a person, and the
-- page renders the English alone rather than an empty heading. Miss Châu.
-- The BODY column is English-only for every row in this table; a Vietnamese
-- body needs a schema change, not a translation.
--
-- ALSO APPLIED 2026-09-13: the Guest Policy row said "up to two guests per
-- visit" while Terms §14.3 says FOUR. The Terms are the contract, so the rule
-- was the one that was wrong; it now cites the clause it follows, which is what
-- should stop the two drifting apart again.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.house_rules') is null then
    raise exception 'house_rules does not exist here — wrong database?';
  end if;
end $$;

delete from house_rules where section_title in ('Ordering Food In', 'Age & Identification');

insert into house_rules (section_title, section_title_vn, body, sort_order) values
(
  'Ordering Food In', null,
  'You are welcome to have food delivered to the Club, and we will plate and serve it for you. '
  'There is a charge of 100,000 VND per person eating, added to your bill on the night. '
  'Meals are served in the Private Dining Room, and snacks may come to the Rampant Room — telling us when you book is notice enough. '
  'Food is not taken into The Studio, where the artworks and the scent of the room are part of the exhibition. '
  'Drinks remain ours to pour. And as we have not prepared the food ourselves, we cannot take responsibility for its ingredients or its handling before it reaches us.',
  7
),
(
  'Age & Identification', null,
  'No guest under the age of eighteen may enter the Club, and members themselves must be twenty-one or above. '
  'Staff will ask for a passport or ID card wherever there is any doubt at all, and will do so without apology — being asked is a compliment. '
  'A guest who cannot produce identification will not be admitted, and the member who introduced them is asked to have that conversation rather than leaving it to the staff. '
  'This is not discretion the Committee is able to exercise: it is the law, and the Club''s licence depends on it.',
  6
);

update house_rules set sort_order = 9 where section_title = 'Complaints & Suggestions';

-- ── ADDED 2026-09-14 ──────────────────────────────────────────────────────
-- THE DOOR. The club now opens at three, takes its last entry at 10:30pm,
-- calls last orders at 11pm and closes at midnight, seven days.
delete from house_rules where section_title = 'Last Entry & Closing';
insert into house_rules (section_title, section_title_vn, body, sort_order) values
(
  'Last Entry & Closing', null,
  'The Club opens at three and closes at midnight, seven days a week. Last entry is 10:30pm and last call is 11pm; '
  'the room is cleared by 11:30. Members already inside may come and go as they please — last entry means the last '
  'new arrival, not the last cigarette. No guest may be signed in after 10:30pm, with or without the member present. '
  'A booked party running late is the duty manager''s to admit: we knew you were coming.',
  9
);

-- THE RAMPANT ROOM'S PRICE, which the 14.09 Terms dropped. v2.1 carried
-- "1,000,000 VND per hour, per person" inside the description of the room; the
-- new document names the room four times and never prices it, so the figure
-- existed nowhere a member could read it. It belongs here anyway — a price
-- should not need a lawyer to change.
--
-- The CAP is Lachlan's, 2026-09-14: three million per person, however long
-- they stay. Nine hours of trading at an uncapped hourly rate would have been
-- a nine-million surprise on somebody's first long evening.
delete from house_rules where section_title = 'The Rampant Room';
insert into house_rules (section_title, section_title_vn, body, sort_order) values
(
  'The Rampant Room', null,
  'The bottle-share room is charged at 1,000,000 VND per person per hour, added to your bill on the night — '
  'capped at 3,000,000 VND per person however long you stay. Three hours or nine, the most anyone pays is three '
  'million. No laptops, and no photography: the room is private, and that is most of what you are paying for.',
  5
);

-- The rooms read together, so everything below the Rampant Room moves down one.
update house_rules set sort_order = 6  where section_title = 'Guest Policy';
update house_rules set sort_order = 7  where section_title = 'Age & Identification';
update house_rules set sort_order = 8  where section_title = 'Ordering Food In';
update house_rules set sort_order = 9  where section_title = 'Last Entry & Closing';
update house_rules set sort_order = 10 where section_title = 'Complaints & Suggestions';

update house_rules
   set body = 'Each member may introduce up to four guests at a time, as set out in the Terms and Conditions (§14.3). '
              'Additional guests can be arranged in advance with the Member Experience Manager. '
              'Guests must be signed in at reception, and the introducing member is responsible for them throughout — '
              'the Committee trusts members to exercise judgement.'
 where section_title = 'Guest Policy';

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_n int; v_food text; v_age text;
begin
  select count(*) into v_n from house_rules;
  select body into v_food from house_rules where section_title = 'Ordering Food In';
  select body into v_age  from house_rules where section_title = 'Age & Identification';
  raise notice 'house_rules now holds % sections · food rule % chars · age rule % chars',
    v_n, length(v_food), length(v_age);
  if v_food is null or v_age is null then raise exception 'one of the two rules did not land'; end if;
  if position('100,000 VND' in v_food) = 0 then raise exception 'the fee is missing from the food rule'; end if;
  if position('minimum' in lower(v_food)) > 0 then raise exception 'the minimum was removed on 2026-09-13 — it should not be back'; end if;
end $$;
