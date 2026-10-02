-- ═══════════════════════════════════════════════════════════════════════════
-- PRIVACY NOTICE v1.4 — saying out loud that one processor is ours.
--                                                        REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- RUN db/privacy_v1_3_processor.sql FIRST. This file builds on v1.3 and refuses
-- without it.
--
-- v1.3 names LR Growth Solutions Pte Ltd as a processor. The paragraph directly
-- above that list says the club does not pass data to other businesses
-- "— including those connected to the club by ownership or supply", and LR
-- Growth Solutions is connected by both.
--
-- There was never a contradiction: a processor holds data on the club's
-- instructions and is not a business the data is "passed to" in the sharing
-- sense, which is why the list is introduced as the exception. But a member
-- reading that sentence and then that list is entitled to wonder, and the
-- sentence was written to be read by somebody looking for exactly this. Owner's
-- decision, 2026-10-02: close it.
--
-- So the paragraph now says it itself, rather than leaving the reader to work
-- out that the list is the exception.
--
-- ── WHAT CHANGES ──────────────────────────────────────────────────────────
-- One sentence appended to one paragraph. Nothing is removed and nothing else
-- is touched.
--
--   EN  … by ownership or supply. The suppliers listed below are different:
--       they are processors, holding data only to run the club's systems on our
--       instructions, and one of them is connected to the club by ownership.
--
--   VN  … qua sở hữu hay cung ứng. Các nhà cung cấp liệt kê bên dưới thì khác:
--       họ là đơn vị xử lý dữ liệu, chỉ lưu giữ dữ liệu để vận hành hệ thống
--       của câu lạc bộ theo chỉ dẫn của chúng tôi, và một trong số đó có liên
--       hệ với câu lạc bộ qua sở hữu.
--
-- ⚠ THE VIETNAMESE IS MINE, NOT A TRANSLATOR'S. It follows the notice's own
--   register and reuses its own phrases — "có liên hệ với câu lạc bộ qua sở
--   hữu" from the sentence it extends, and "theo chỉ dẫn của chúng tôi" from
--   the line introducing the list — so it should read as part of the same
--   document. It is still a legal sentence written by me and worth a
--   Vietnamese reader's eye before anybody is asked to consent to it. It is
--   NFC, like the rest of the body.
--
-- ═══ ⚠ WHAT THIS DOES TO MEMBERS ═══════════════════════════════════════════
-- The same as v1.3: the three members who have consented (TRC-M005, TRC-M011,
-- TRC-DEMO) are asked once more; the other twelve are behind already.
--
-- NOTE, since v1.3 and v1.4 are being published separately: those three are
-- asked TWICE, once per version. Folding both into a single version would have
-- asked them once — that option was on the table and separate versions were
-- chosen deliberately, so the register reads as two distinct decisions rather
-- than one combined edit. Running both files back to back before anybody signs
-- in means only the later prompt is ever seen in practice.
--
-- No deploy follows: /privacy reads the register.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $prereq$
declare
  v_body    text;
  v_body_vn text;
  -- The END of the paragraph being extended, in each language. Anchored on the
  -- full tail rather than on "ownership or supply" alone, so the sentence can
  -- only be appended where the paragraph actually finishes.
  v_en constant text := 'including those connected to the club by ownership or supply.';
  v_vn constant text := 'kể cả những đơn vị có liên hệ với câu lạc bộ qua sở hữu hay cung ứng.';
begin
  if to_regclass('public.terms_versions') is null then
    raise exception 'PREREQUISITES MISSING — terms_versions' using hint = 'Nothing applied.';
  end if;

  select body, body_vn into v_body, v_body_vn
    from public.terms_versions where doc_key = 'privacy' and version = '1.3';
  if v_body is null then
    raise exception 'privacy v1.3 not found'
      using hint = 'Run db/privacy_v1_3_processor.sql first. Nothing applied.';
  end if;

  -- The thing this sentence is ABOUT must already be in the document. Without
  -- it, v1.4 would explain an entry that is not there.
  if v_body not like '%LR Growth%' or v_body_vn not like '%LR Growth%' then
    raise exception 'v1.3 does not name LR Growth Solutions in both languages'
      using hint = 'Nothing applied. This sentence explains that entry.';
  end if;

  if (length(v_body) - length(replace(v_body, v_en, ''))) / length(v_en) <> 1 then
    raise exception 'the English paragraph ending does not appear exactly once in v1.3'
      using hint = 'Nothing applied. Re-read the notice before editing it.';
  end if;
  if (length(v_body_vn) - length(replace(v_body_vn, v_vn, ''))) / length(v_vn) <> 1 then
    raise exception 'the Vietnamese paragraph ending does not appear exactly once in v1.3'
      using hint = 'Nothing applied. Re-read the notice before editing it.';
  end if;

  if v_body like '%The suppliers listed below are different%' then
    raise exception 'the clarification is already in v1.3' using hint = 'Nothing applied.';
  end if;

  if exists (select 1 from public.terms_versions where doc_key = 'privacy' and version = '1.4') then
    raise exception 'privacy v1.4 already exists'
      using hint = 'Nothing applied. A published version is never edited — publish 1.5.';
  end if;
end $prereq$;

insert into public.terms_versions (doc_key, version, effective_date, title_en, title_vn, body, body_vn)
select 'privacy', '1.4', (now() at time zone 'Asia/Ho_Chi_Minh')::date,
       title_en, title_vn,
       replace(body,
         'including those connected to the club by ownership or supply.',
         'including those connected to the club by ownership or supply.'
         || ' The suppliers listed below are different: they are processors,'
         || ' holding data only to run the club''s systems on our instructions,'
         || ' and one of them is connected to the club by ownership.'),
       replace(body_vn,
         'kể cả những đơn vị có liên hệ với câu lạc bộ qua sở hữu hay cung ứng.',
         'kể cả những đơn vị có liên hệ với câu lạc bộ qua sở hữu hay cung ứng.'
         || ' Các nhà cung cấp liệt kê bên dưới thì khác: họ là đơn vị xử lý dữ liệu,'
         || ' chỉ lưu giữ dữ liệu để vận hành hệ thống của câu lạc bộ theo chỉ dẫn'
         || ' của chúng tôi, và một trong số đó có liên hệ với câu lạc bộ qua sở hữu.')
  from public.terms_versions
 where doc_key = 'privacy' and version = '1.3';

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
-- Read the paragraph and the list together, which is the only check that
-- actually matters — it should now answer the question it used to raise:
--   select substring(body from position('Nobody else' in body) for 700)
--     from public.terms_versions where doc_key='privacy' and version='1.4';
--   select substring(body_vn from position('Không ai khác' in body_vn) for 760)
--     from public.terms_versions where doc_key='privacy' and version='1.4';
--
-- One sentence added, in each language, and nothing else moved:
--   select length(b.body) - length(a.body)       as en_chars_added,
--          length(b.body_vn) - length(a.body_vn) as vn_chars_added
--     from public.terms_versions a, public.terms_versions b
--    where a.doc_key='privacy' and a.version='1.3'
--      and b.doc_key='privacy' and b.version='1.4';
--   → 183 and 213
--
-- Said once, not twice:
--   select version,
--          (length(body) - length(replace(body, 'are processors', ''))) / 14 as en_mentions
--     from public.terms_versions where doc_key='privacy' order by version;
--   → 0 for 1.0–1.3, and 1 for 1.4
--
-- v1.4 is current, and who will be asked again:
--   select version from public.terms_versions where id = public.current_terms_version('privacy');
--   select * from public.member_consent_gaps() where doc_key = 'privacy';
--
-- Then reload /privacy.

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- Only before anybody consents to 1.4 — deleting a version somebody agreed to
-- would orphan their consent row:
--   delete from public.terms_versions
--    where doc_key = 'privacy' and version = '1.4'
--      and not exists (
--        select 1 from public.member_terms_consents c
--         where c.terms_version_id = (select id from public.terms_versions
--                                      where doc_key='privacy' and version='1.4'));
-- current_terms_version() falls back to 1.3, which still NAMES the processor —
-- so stepping back loses the explanation and not the disclosure. That is the
-- right way round.
