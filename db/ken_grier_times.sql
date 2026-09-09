-- ═══════════════════════════════════════════════════════════════════════════
-- KEN GRIER — CORRECT THE TWO TIMESTAMPS.  REVIEW, then run. Idempotent.
-- ───────────────────────────────────────────────────────────────────────────
-- Both times on "An Evening with Ken Grier" are stored exactly 7 hours early —
-- the signature of a double timezone conversion at entry (19:00 → 12:00 UTC →
-- 05:00 UTC). The row's OWN description is the evidence for what was meant:
--
--   "Hosted off-site by Ve De Di, seven until ten."   → 19:00 Vietnam
--   "Sign-ups close Monday 14 September."             → 18:00 Vietnam (your word)
--
--   field             stored          shows in Vietnam     should be
--   date              05:00Z          12:00 NOON           19:00  (12:00Z)
--   signup_deadline   04:00Z          11:00 Monday         18:00  (11:00Z)
--
-- Why it matters: app/members/events/page.tsx formats with toLocaleTimeString
-- and NO timeZone override, so a member in Vietnam reads "12:00 pm" directly
-- above a description promising seven o'clock. And deadlinePassed compares
-- absolute instants, so sign-ups would have closed at 11am Monday — seven hours
-- before anyone expected, with no error anywhere.
--
-- max_signups is already 6 and is NOT touched.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $ken$
declare
  v_id uuid := '5c158445-83fb-481e-a122-b38a7ccb5b9d';
  v_signups int;
  v_before_date timestamptz;
  v_before_dead timestamptz;
begin
  select count(*) into v_signups from fixture_signups where fixture_id = v_id;

  -- A member who has already booked was told a time. Moving it then stops being
  -- a data fix and becomes a message someone has to send. Refuse, and say so.
  if v_signups > 0 then
    raise exception 'REFUSED: % member(s) already signed up. Move the time only after deciding how they are told.', v_signups;
  end if;

  select date, signup_deadline into v_before_date, v_before_dead from fixtures where id = v_id;
  if not found then raise exception 'Ken Grier fixture % not found — nothing changed.', v_id; end if;

  update fixtures set
    date            = timestamptz '2026-09-18 19:00:00+07',   -- seven, Vietnam
    signup_deadline = timestamptz '2026-09-14 18:00:00+07'    -- Monday 18:00, Vietnam
  where id = v_id;

  raise notice 'Ken Grier — event  % → %',
    to_char(v_before_date at time zone 'Asia/Ho_Chi_Minh', 'Dy DD Mon HH24:MI'),
    to_char((timestamptz '2026-09-18 19:00:00+07') at time zone 'Asia/Ho_Chi_Minh', 'Dy DD Mon HH24:MI');
  raise notice 'Ken Grier — closes % → %',
    to_char(v_before_dead at time zone 'Asia/Ho_Chi_Minh', 'Dy DD Mon HH24:MI'),
    to_char((timestamptz '2026-09-14 18:00:00+07') at time zone 'Asia/Ho_Chi_Minh', 'Dy DD Mon HH24:MI');
end $ken$;

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_d timestamptz; v_s timestamptz; v_max int;
begin
  select date, signup_deadline, max_signups into v_d, v_s, v_max
    from fixtures where id = '5c158445-83fb-481e-a122-b38a7ccb5b9d';
  if to_char(v_d at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') <> '19:00' then
    raise exception 'SELF-CHECK: event is % Vietnam, expected 19:00', to_char(v_d at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI');
  end if;
  if to_char(v_s at time zone 'Asia/Ho_Chi_Minh', 'Dy HH24:MI') <> 'Mon 18:00' then
    raise exception 'SELF-CHECK: deadline is % Vietnam, expected Mon 18:00', to_char(v_s at time zone 'Asia/Ho_Chi_Minh', 'Dy HH24:MI');
  end if;
  if v_max <> 6 then raise exception 'SELF-CHECK: seats are %, expected 6', v_max; end if;
  raise notice 'Ken Grier ready — Fri 18 Sep 19:00, six seats, closes Mon 14 Sep 18:00.';
end $check$;

commit;
