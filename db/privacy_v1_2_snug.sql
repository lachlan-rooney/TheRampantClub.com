-- ═══════════════════════════════════════════════════════════════════════════
-- PRIVACY NOTICE v1.2 — the Snug comes out.   REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- The Snug was stood down on 1 October, having never held a row. The Privacy
-- Notice still tells members we keep "anything you post in The Snug", which is
-- now a statement about a thing that does not exist. A privacy notice that
-- describes the wrong system is the one document where being out of date is not
-- merely untidy.
--
-- v1.1 is IMMUTABLE and stays exactly as it is: three members consented to that
-- text and the record of what they agreed to must not be edited underneath
-- them. This publishes v1.2 instead.
--
-- ── IT EDITS THE DOCUMENT, IT DOES NOT RETYPE IT ──────────────────────────
-- The new bodies are v1.1's with one clause removed by replace(). Pasting
-- 9,507 characters of English and 10,895 of Vietnamese into a migration to
-- change eleven words is how a legal text picks up a silent corruption, and
-- nobody proofreads a diff that size. The clause is removed in both languages,
-- and the file REFUSES if either one does not appear exactly once.
--
-- ⚠ THE VIETNAMESE LITERAL IS NFC. The stored body is NFC and the literal below
-- matches it exactly (31 characters of English, 37 of Vietnamese, one
-- occurrence each — verified 2026-10-01). Paste the same words from a source
-- that uses NFD and "điều" becomes six code points instead of four, replace()
-- finds nothing, and the guard above raises with a message about the clause not
-- appearing. That is the right failure, but this is the reason for it.
--
-- The surrounding list already carries its own commas and its "and" / "và", so
-- nothing is reworded. What remains reads:
--   EN  … events you've signed up for, and any other member you've asked …
--   VN  … các sự kiện quý vị đăng ký, và tên bất kỳ hội viên nào quý vị …
--
-- ═══ ⚠ WHAT THIS DOES TO MEMBERS ═══════════════════════════════════════════
-- privacy is required: true in terms_documents, and my_consent_state() marks a
-- member behind the moment the current version changes. middleware.ts redirects
-- anybody behind on a required document to /members/agree before they can reach
-- the portal.
--
-- Only THREE consents exist (TRC-M005, TRC-M011, TRC-DEMO), so thirteen members
-- are behind already and this changes nothing for them. The effect of running
-- this file is that those three are asked once more — which is the correct
-- outcome for a notice whose text has changed, and the reason a version
-- register exists at all.
--
-- It does NOT lock anyone out of the club, the kiosk or their card: the gate is
-- /members/* only, and /kiosk is deliberately never checked.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
declare
  v_body    text;
  v_body_vn text;
  v_en  constant text := 'anything you post in The Snug, ';
  v_vn  constant text := 'mọi điều quý vị đăng trong The Snug, ';
begin
  if to_regclass('public.terms_versions') is null then
    raise exception 'PREREQUISITES MISSING — terms_versions' using hint = 'Nothing applied.';
  end if;

  select body, body_vn into v_body, v_body_vn
    from public.terms_versions where doc_key = 'privacy' and version = '1.1';
  if v_body is null then
    raise exception 'privacy v1.1 not found' using hint = 'Nothing applied.';
  end if;

  -- EXACTLY ONCE, IN BOTH LANGUAGES. A clause that appears twice would be half
  -- removed; one that appears not at all means the text has moved on and this
  -- file is reasoning about a document it has not read.
  if (length(v_body) - length(replace(v_body, v_en, ''))) / length(v_en) <> 1 then
    raise exception 'the English clause does not appear exactly once in v1.1'
      using hint = 'Nothing applied. Re-read the notice before editing it.';
  end if;
  if (length(v_body_vn) - length(replace(v_body_vn, v_vn, ''))) / length(v_vn) <> 1 then
    raise exception 'the Vietnamese clause does not appear exactly once in v1.1'
      using hint = 'Nothing applied. Re-read the notice before editing it.';
  end if;

  if exists (select 1 from public.terms_versions where doc_key = 'privacy' and version = '1.2') then
    raise exception 'privacy v1.2 already exists'
      using hint = 'Nothing applied. A published version is never edited — publish 1.3.';
  end if;
end $prereq$;

insert into public.terms_versions (doc_key, version, effective_date, title_en, title_vn, body, body_vn)
select 'privacy', '1.2', (now() at time zone 'Asia/Ho_Chi_Minh')::date,
       title_en, title_vn,
       replace(body,    'anything you post in The Snug, ',          ''),
       replace(body_vn, 'mọi điều quý vị đăng trong The Snug, ',    '')
  from public.terms_versions
 where doc_key = 'privacy' and version = '1.1';

-- The register decides what is current, and nothing needs pointing at the new
-- row: current_terms_version() takes the latest effective_date not in the
-- future, tie-broken by created_at. v1.2 is dated today and v1.1 is dated
-- 9 September, so v1.2 wins on the date alone — checked, not assumed.

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- The Snug is gone from v1.2, and still present in v1.1:
--   select version,
--          (body    like '%Snug%') as en_has_snug,
--          (body_vn like '%Snug%') as vn_has_snug
--     from public.terms_versions where doc_key = 'privacy' order by version;
--   → 1.0/1.1 may be true; 1.2 must be FALSE, FALSE
--
-- Nothing else changed — the two bodies differ by exactly the clause lengths:
--   select length(a.body) - length(b.body)       as en_chars_removed,
--          length(a.body_vn) - length(b.body_vn) as vn_chars_removed
--     from public.terms_versions a, public.terms_versions b
--    where a.doc_key='privacy' and a.version='1.1'
--      and b.doc_key='privacy' and b.version='1.2';
--   → 31 and 37
--
-- v1.2 is what the register calls current:
--   select version from public.terms_versions
--    where id = public.current_terms_version('privacy');
--   → 1.2
--
-- And who will be asked again (expect the three who had consented):
--   select * from public.member_consent_gaps() where doc_key = 'privacy';
--
-- Then reload /privacy — the public page reads the register, so it should print
-- the new text and "In effect from <today> · v1.2" with no deploy.

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Only before anybody consents to 1.2. Deleting a version somebody has agreed
-- to would orphan their consent row:
--   delete from public.terms_versions
--    where doc_key = 'privacy' and version = '1.2'
--      and not exists (select 1 from public.member_terms_consents c
--                       where c.terms_version_id = (select id from public.terms_versions
--                                                    where doc_key='privacy' and version='1.2'));
-- current_terms_version() falls back to 1.1 and the public page follows it.
-- After anybody has consented, the way back is forward: publish 1.3.
