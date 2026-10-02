-- ═══════════════════════════════════════════════════════════════════════════
-- PRIVACY NOTICE v1.3 — LR Growth Solutions joins the processors.
--                                                        REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-10-02: "LR Growth Solutions sees it too as they provide the SaaS
-- for this system." The notice lists three processors — Supabase, Resend,
-- Anthropic — and not the company whose platform the whole system runs on. A
-- processor the notice does not name is the one thing a privacy notice is for.
--
-- v1.2 stays exactly as it is. This publishes v1.3 beside it, by the same
-- replace()-on-the-previous-version method as db/privacy_v1_2_snug.sql: the
-- bullet is inserted after Anthropic in both languages, and the file refuses
-- unless the anchor line appears exactly once in each.
--
-- ═══ ⚠ TWO THINGS TO DECIDE BEFORE RUNNING THIS ════════════════════════════
--
-- 1 · THE REGISTERED NAME. This writes "LR Growth Solutions Pte Ltd". The
--     licence line that used to sit on the admin pages read "LR Growth
--     Solutions PTE LTD". A privacy notice should name the entity exactly as it
--     is registered — change the two literals below if that is not it.
--
-- 2 · THE SENTENCE DIRECTLY ABOVE THE LIST, which is NOT changed here:
--
--       "Nobody else. We do not sell member data, we do not share it with
--        advertisers, and we do not pass it to other businesses — including
--        those connected to the club by ownership or supply."
--
--     LR Growth Solutions is connected to the club by BOTH ownership and
--     supply. Strictly there is no contradiction: a processor acts on the
--     club's instructions and is not a business the data is "passed to" in the
--     sharing sense, which is why the list is introduced as the exception to
--     that sentence. But it is the kind of tension a member could reasonably
--     raise, and the sentence was written to be read by somebody looking for
--     exactly this.
--
--     Rewording a clause in a notice three members have consented to is the
--     owner's call, not a migration's. Two options if you want it closed:
--       (a) leave it — the list already states the exception, or
--       (b) publish v1.4 adding to that sentence, e.g.
--           "… by ownership or supply. The suppliers below are processors: they
--            hold data to run the club's systems on our instructions, and that
--            includes one business connected to the club by ownership."
--     Say which and it is another file like this one.
--
-- ═══ ⚠ WHAT THIS DOES TO MEMBERS ═══════════════════════════════════════════
-- privacy is required: true, and my_consent_state() marks a member behind the
-- moment the current version changes; middleware redirects anybody behind on a
-- required document to /members/agree before the portal.
--
-- FOUR consent rows exist, for THREE members (TRC-M005, TRC-M011, TRC-DEMO
-- twice). Twelve members are behind already and this changes nothing for them.
-- The effect of running this is that those three are asked once more — which
-- for a notice that has gained a processor is not merely correct, it is the
-- point.
--
-- Nothing about the club, the kiosk or a member's card is gated. No deploy
-- follows: /privacy reads the register, so running this file updates the
-- public page.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
declare
  v_body    text;
  v_body_vn text;
  -- The anchor is the LAST line of the list in each language; the new bullet
  -- goes after it. Anchoring on the Anthropic line rather than on the blank
  -- line that follows, because a blank line is not unique.
  v_en  constant text := '- **Anthropic** — the AI processing described above (United States)';
  v_vn  constant text := '- **Anthropic** — phần xử lý AI mô tả ở trên (Hoa Kỳ)';
begin
  if to_regclass('public.terms_versions') is null then
    raise exception 'PREREQUISITES MISSING — terms_versions' using hint = 'Nothing applied.';
  end if;

  select body, body_vn into v_body, v_body_vn
    from public.terms_versions where doc_key = 'privacy' and version = '1.2';
  if v_body is null then
    raise exception 'privacy v1.2 not found'
      using hint = 'Run db/privacy_v1_2_snug.sql first. Nothing applied.';
  end if;

  if (length(v_body) - length(replace(v_body, v_en, ''))) / length(v_en) <> 1 then
    raise exception 'the English processor line does not appear exactly once in v1.2'
      using hint = 'Nothing applied. Re-read the notice before editing it.';
  end if;
  if (length(v_body_vn) - length(replace(v_body_vn, v_vn, ''))) / length(v_vn) <> 1 then
    raise exception 'the Vietnamese processor line does not appear exactly once in v1.2'
      using hint = 'Nothing applied. Re-read the notice before editing it.';
  end if;

  -- Already named? Then this file has already run, or the name arrived another
  -- way, and appending a second bullet would list the company twice.
  if v_body like '%LR Growth%' or v_body_vn like '%LR Growth%' then
    raise exception 'LR Growth Solutions is already named in v1.2'
      using hint = 'Nothing applied.';
  end if;

  if exists (select 1 from public.terms_versions where doc_key = 'privacy' and version = '1.3') then
    raise exception 'privacy v1.3 already exists'
      using hint = 'Nothing applied. A published version is never edited — publish 1.4.';
  end if;
end $prereq$;

insert into public.terms_versions (doc_key, version, effective_date, title_en, title_vn, body, body_vn)
select 'privacy', '1.3', (now() at time zone 'Asia/Ho_Chi_Minh')::date,
       title_en, title_vn,
       replace(body,
         '- **Anthropic** — the AI processing described above (United States)',
         '- **Anthropic** — the AI processing described above (United States)'
         || chr(10) ||
         '- **LR Growth Solutions Pte Ltd** — the software platform the club runs on (Singapore)'),
       replace(body_vn,
         '- **Anthropic** — phần xử lý AI mô tả ở trên (Hoa Kỳ)',
         '- **Anthropic** — phần xử lý AI mô tả ở trên (Hoa Kỳ)'
         || chr(10) ||
         '- **LR Growth Solutions Pte Ltd** — nền tảng phần mềm mà câu lạc bộ vận hành trên đó (Singapore)')
  from public.terms_versions
 where doc_key = 'privacy' and version = '1.2';

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- Named once, in both languages, and only in 1.3:
--   select version,
--          (length(body)    - length(replace(body,    'LR Growth', ''))) / 9 as en_mentions,
--          (length(body_vn) - length(replace(body_vn, 'LR Growth', ''))) / 9 as vn_mentions
--     from public.terms_versions where doc_key = 'privacy' order by version;
--   → 1.0/1.1/1.2 = 0 and 0 · 1.3 = 1 and 1
--
-- Nothing else moved — the bodies differ by exactly the new lines:
--   select length(b.body) - length(a.body)       as en_chars_added,
--          length(b.body_vn) - length(a.body_vn) as vn_chars_added
--     from public.terms_versions a, public.terms_versions b
--    where a.doc_key='privacy' and a.version='1.2'
--      and b.doc_key='privacy' and b.version='1.3';
--   → 87 and 97  (each a newline plus the bullet)
--
-- It reads as the fourth item of the list, not a stray paragraph:
--   select substring(body from position('Some suppliers' in body) for 420)
--     from public.terms_versions where doc_key='privacy' and version='1.3';
--
-- v1.3 is current, and who will be asked again:
--   select version from public.terms_versions where id = public.current_terms_version('privacy');
--   select * from public.member_consent_gaps() where doc_key = 'privacy';
--
-- Then reload /privacy — the public page reads the register, so the new
-- processor appears with "In effect from <today> · v1.3" and no deploy.

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Only before anybody consents to 1.3 — deleting a version somebody agreed to
-- would orphan their consent row:
--   delete from public.terms_versions
--    where doc_key = 'privacy' and version = '1.3'
--      and not exists (
--        select 1 from public.member_terms_consents c
--         where c.terms_version_id = (select id from public.terms_versions
--                                      where doc_key='privacy' and version='1.3'));
-- current_terms_version() falls back to 1.2 and the public page follows it.
-- After anybody has consented, the way back is forward: publish 1.4.
--
-- ⚠ AND IF THE NAME IS WRONG, it is a NEW VERSION, not an UPDATE. A published
-- notice is never edited in place; that is the whole reason this file exists
-- rather than an update to v1.2.
