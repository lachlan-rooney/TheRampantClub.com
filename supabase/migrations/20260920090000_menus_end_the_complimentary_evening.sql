-- ═══════════════════════════════════════════════════════════════════════════
-- THE COMPLIMENTARY EVENING WAS THURSDAY. IT IS NOW SUNDAY.
-- ───────────────────────────────────────────────────────────────────────────
-- "Complimentary this evening" has been on the bar menu since the 18th,
-- telling every member who opened a tablet that their drinks were on the club
-- — for two days after the evening it referred to.
--
-- That is my fault in design, not just in housekeeping. `arriving_on` is a
-- DATE precisely so a restaurant stops announcing itself once the day comes;
-- I then put a time-bound offer into a free-text tagline that has no expiry
-- and no way to know what "this evening" meant. A sentence nobody remembers to
-- delete is exactly the failure that column exists to prevent.
--
-- Clearing it is one line. The lesson is worth more than the line: anything
-- that says "tonight", "this week" or "until Friday" needs a date beside it,
-- or it outlives the thing it describes.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

update public.menu_venues
   set tagline_en = null, tagline_vn = null
 where slug = 'the-rampant-club';

-- Anything else still making a time-bound promise in free text.
select slug, tagline_en
  from public.menu_venues
 where tagline_en ~* 'tonight|this evening|today|this week|tối nay|hôm nay|tuần này';
