-- ═══════════════════════════════════════════════════════════════════════════
-- membership_terms v2.1 — THE VAT PLACEHOLDER IS ANSWERED
-- ───────────────────────────────────────────────────────────────────────────
-- v2.0 shipped with a drafting placeholder still in it, in both languages:
--
--   8.8  …are [inclusive/exclusive] of Value-Added Tax (VAT)…
--   8.8  …là [đã bao gồm/chưa bao gồm] thuế giá trị gia tăng (VAT)…
--
-- Lachlan's answer, 2026-09-13: INCLUSIVE. The Vietnamese is not translated
-- here — the document offered both readings itself, and this picks the one that
-- matches the English. Choosing between a document's own two options is not the
-- same as writing new Vietnamese, which remains a person's job.
--
-- WHY A NEW VERSION FOR A TWO-WORD FIX. The attempt to correct v2.0 in place
-- was REFUSED by the database:
--
--   'a published version is immutable — publish a new version instead'
--   HINT: 'Correcting a typo means a new row in terms_versions, not an edit.'
--
-- That guard is right and it did its job. A published clause is what somebody
-- may have read and relied on; the register's value is that yesterday's text is
-- still retrievable. So v2.0 stays exactly as published, and v2.1 supersedes it
-- from the same date.
--
-- NOBODY HAD SIGNED v2.0, which is the only reason this is a quiet correction
-- rather than a re-signing exercise. Check that before assuming the same of the
-- next one:  select count(*) from signed_agreements where terms_version = '2.0';
--
-- ⚠ THE MASTER DOCUMENT STILL HAS THE PLACEHOLDER. "The Rampant Club TC V5
-- 24.03.26 (1).docx" in ~/Documents/TRC Web is unchanged, so the next import
-- from it will reintroduce [inclusive/exclusive] unless it is fixed there too.
--
-- Applied 2026-09-13 as a copy of v2.0 with the two substitutions.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_20 uuid; v_signed int;
begin
  select id into v_20 from terms_versions where doc_key = 'membership_terms' and version = '2.0';
  if v_20 is null then raise exception 'v2.0 is missing — this file supersedes it and cannot run without it'; end if;
  select count(*) into v_signed from signed_agreements where terms_version_id = v_20;
  if v_signed > 0 then
    raise exception 'v2.0 carries % signature(s) — superseding it is fine, but read them first', v_signed;
  end if;
  if exists (select 1 from terms_versions where doc_key = 'membership_terms' and version = '2.1') then
    raise exception 'v2.1 already exists — do not run this twice';
  end if;
end $$;

insert into terms_versions (doc_key, version, effective_date, title_en, title_vn, body, body_vn)
select doc_key,
       '2.1',
       (now() at time zone 'Asia/Ho_Chi_Minh')::date,
       title_en,
       title_vn,
       replace(body,    '[inclusive/exclusive]',        'inclusive'),
       replace(body_vn, '[đã bao gồm/chưa bao gồm]',    'đã bao gồm')
  from terms_versions
 where doc_key = 'membership_terms' and version = '2.0';

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_cur uuid; v_ver text; v_left int;
begin
  v_cur := current_terms_version('membership_terms');
  select version into v_ver from terms_versions where id = v_cur;
  select coalesce(array_length(regexp_split_to_array(body, '\[[^\]]{2,40}\]'), 1), 1) - 1
    into v_left from terms_versions where id = v_cur;
  raise notice 'current membership_terms is now v% · % drafting placeholder(s) left in the English', v_ver, v_left;
  if v_ver <> '2.1' then raise exception 'v2.1 is not current'; end if;
  if v_left <> 0 then raise exception 'a placeholder survives in the published English'; end if;
end $$;
