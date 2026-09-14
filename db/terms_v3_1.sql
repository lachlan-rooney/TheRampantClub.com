-- ═══════════════════════════════════════════════════════════════════════════
-- membership_terms v3.1 — LAST ORDERS AT 11PM · OUTSIDE FOOD 100,000 VND A HEAD
-- ───────────────────────────────────────────────────────────────────────────
-- v3.0 (the 14.09.26 document) contradicted the House Rules on two things
-- staff act on every night. Lachlan settled both on 2026-09-14:
--
--   "Last orders is 11pm."
--   "Food is 100 per person, change accordingly."
--
-- The House Rules and the site footer already said both. The Terms are brought
-- into line; nothing else in them moves.
--
--   12.3  was  Last whisky orders are accepted 30 minutes before closing.
--         now  Last whisky orders are accepted until 11pm.
--         (With a midnight close, "30 minutes before" was 11:30pm — half an
--         hour after the last call the House Rules and the footer publish.)
--
--   12.5  was  a group fee — VND 300,000 (2–4 guests), 500,000 (5–8), 700,000 (9+)
--         now  VND 100,000 per person eating
--         (House Rule 8 "Ordering Food In" already charges it this way.)
--
-- ⚠ THE VIETNAMESE IN 12.5 IS NEW WORDING, written for this change, not taken
-- from a translator's document. It follows the sentence it replaces word for
-- word up to the fee. It should be read by a Vietnamese speaker (Miss Châu)
-- before members are pointed at it. 12.3's Vietnamese only swaps the time.
--
-- WHY A NEW VERSION. A published version is immutable and the database refuses
-- edits (trg_terms_versions_immutable). v3.0 stays in the register exactly as
-- published; v3.1 supersedes it from today.
--
-- SIGNATURES. This file does not block if v3.0 has been signed — it reports the
-- count. A fee change is material: anyone who signed v3.0 agreed to the group
-- fee, so tell them, or ask them to accept v3.1.
--
-- ⚠ FIX THE MASTER TOO. "The Rampant Club Terms & Conditions Document
-- 14.09.26.docx" still has the old 12.3 and 12.5, so the next import from it
-- would reintroduce both — along with the VAT placeholder and the two missing
-- article headings noted in db/terms_v3.sql.
--
-- Every substitution is checked to match its old sentence EXACTLY ONCE before
-- anything is written, so a whitespace or punctuation difference fails loudly
-- instead of publishing v3.1 identical to v3.0.
--
-- Not safe to run twice: it refuses if v3.1 already exists.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $$
declare
  v_30 uuid; v_signed int; b text; bv text;
  en_123_old text := 'Last whisky orders are accepted 30 minutes before closing.';
  vn_123_old text := 'Giờ nhận order whisky cuối cùng là 30 phút trước khi đóng cửa.';
  en_125_old text := 'For outside food, a group service fee applies to cover table preparation, serving, and cleaning: VND 300,000 (2–4 guests), VND 500,000 (5–8 guests), and VND 700,000 (9+ guests).';
  vn_125_old text := 'Đối với đồ ăn mang từ bên ngoài, phụ phí phục vụ tính theo nhóm bao gồm: 300.000 VNĐ (nhóm 2–4 khách), 500.000 VNĐ (nhóm 5–8 khách), và 700.000 VNĐ (nhóm từ 9 khách trở lên).';
begin
  select id, body, body_vn into v_30, b, bv
    from terms_versions where doc_key = 'membership_terms' and version = '3.0';
  if v_30 is null then raise exception 'v3.0 is missing — this file supersedes it'; end if;
  if exists (select 1 from terms_versions where doc_key = 'membership_terms' and version = '3.1') then
    raise exception 'v3.1 already exists — do not run this twice';
  end if;

  -- Each old sentence must occur exactly once, or the replace below would either
  -- do nothing or change a second place nobody reviewed.
  if (length(b)  - length(replace(b,  en_123_old, ''))) / length(en_123_old) <> 1 then raise exception 'EN 12.3 old sentence not found exactly once'; end if;
  if (length(bv) - length(replace(bv, vn_123_old, ''))) / length(vn_123_old) <> 1 then raise exception 'VN 12.3 old sentence not found exactly once'; end if;
  if (length(b)  - length(replace(b,  en_125_old, ''))) / length(en_125_old) <> 1 then raise exception 'EN 12.5 old sentence not found exactly once'; end if;
  if (length(bv) - length(replace(bv, vn_125_old, ''))) / length(vn_125_old) <> 1 then raise exception 'VN 12.5 old sentence not found exactly once'; end if;

  select count(*) into v_signed from signed_agreements where terms_version_id = v_30;
  raise notice 'v3.0 carries % signature(s) — they agreed to the group food fee; tell them of v3.1', v_signed;
end $$;

insert into terms_versions (doc_key, version, effective_date, title_en, title_vn, body, body_vn)
select doc_key,
       '3.1',
       (now() at time zone 'Asia/Ho_Chi_Minh')::date,
       title_en,
       title_vn,
       replace(replace(body,
         'Last whisky orders are accepted 30 minutes before closing.',
         'Last whisky orders are accepted until 11pm.'),
         'For outside food, a group service fee applies to cover table preparation, serving, and cleaning: VND 300,000 (2–4 guests), VND 500,000 (5–8 guests), and VND 700,000 (9+ guests).',
         'For outside food, a service fee of VND 100,000 per person eating applies to cover table preparation, serving, and cleaning.'),
       replace(replace(body_vn,
         'Giờ nhận order whisky cuối cùng là 30 phút trước khi đóng cửa.',
         'Giờ nhận order whisky cuối cùng là 11pm.'),
         'Đối với đồ ăn mang từ bên ngoài, phụ phí phục vụ tính theo nhóm bao gồm: 300.000 VNĐ (nhóm 2–4 khách), 500.000 VNĐ (nhóm 5–8 khách), và 700.000 VNĐ (nhóm từ 9 khách trở lên).',
         'Đối với đồ ăn mang từ bên ngoài, phụ phí phục vụ là 100.000 VNĐ cho mỗi người dùng bữa.')
  from terms_versions
 where doc_key = 'membership_terms' and version = '3.0';

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_cur uuid; v_ver text; b text; bv text; b30 text;
begin
  v_cur := current_terms_version('membership_terms');
  select version, body, body_vn into v_ver, b, bv from terms_versions where id = v_cur;
  select body into b30 from terms_versions where doc_key = 'membership_terms' and version = '3.0';

  if v_ver <> '3.1' then raise exception 'v3.1 is not current (current is v%)', v_ver; end if;
  if position('until 11pm' in b) = 0 or position('VND 100,000 per person eating' in b) = 0 then
    raise exception 'the new English wording is not in v3.1';
  end if;
  if position('30 minutes before closing' in b) > 0 or position('VND 300,000' in b) > 0 then
    raise exception 'old English wording survives in v3.1';
  end if;
  if position('30 phút trước khi đóng cửa' in bv) > 0 or position('300.000 VNĐ' in bv) > 0 then
    raise exception 'old Vietnamese wording survives in v3.1';
  end if;
  raise notice 'current membership_terms is now v% · English % chars (v3.0 was %)', v_ver, length(b), length(b30);
end $$;

commit;
