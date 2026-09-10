-- ═══════════════════════════════════════════════════════════════════════════
-- PRIVACY NOTICE · PUT THE GATE BACK UP.  REVIEW, then run. Idempotent.
-- ───────────────────────────────────────────────────────────────────────────
-- The reverse of db/privacy_gate_stand_down.sql, and the line that was
-- deliberately LEFT OUT of db/publish_privacy_v1.1.sql so that publishing a
-- translation could never, by itself, start gating anyone.
--
-- ═══ DO NOT RUN THIS UNTIL A FLUENT READER HAS BEEN THROUGH THE VIETNAMESE ══
-- Not "has seen it" — has READ it, as a Vietnamese speaker checking the
-- language, and specifically these five, which are where a machine translation
-- of a consent document goes wrong:
--
--   1. The AI-processing paragraph. Longest and most consequential. A stiff
--      translation there reads as evasive rather than forthcoming, which
--      inverts the entire purpose of the section.
--   2. "Những người chưa phải hội viên". Written to be read by someone who is
--      NOT a member and may not know they are in a database.
--   3. Form of address: `quý vị` throughout. If the club says anh/chị or
--      quý hội viên in practice, that must carry through consistently.
--   4. "Ghép khẩu vị" for palate matching; "dram" left untranslated.
--   5. "The Snug" left in English as a room name.
--
-- "Happy with it" is not the same answer as "I read the Vietnamese". This file
-- gates every /members page for the whole membership on the strength of that
-- distinction, which is why it is written down here rather than remembered.
--
-- ═══ ORDER ═════════════════════════════════════════════════════════════════
--   1. db/publish_privacy_v1.1.sql   (refuses if required is already true)
--   2. THIS FILE                     (refuses if v1.1 is not current with VN)
--   3. Invite the members.
--
-- On step 3 — the first login after this is the first real use of the
-- scroll-and-agree path by anyone who is not a test. Send ONE invitation
-- first, to someone who will say if it is awkward, before the rest.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $enable$
declare
  v_cur uuid;
  v_version text;
  v_vn_len int;
  v_en_len int;
begin
  select current_terms_version('privacy') into v_cur;
  if v_cur is null then
    raise exception 'ENABLE: no current privacy version — nothing to require.'
      using hint = 'Run db/publish_privacy_v1.1.sql first. Nothing applied.';
  end if;

  select version, coalesce(length(btrim(body_vn)), 0), coalesce(length(btrim(body)), 0)
    into v_version, v_vn_len, v_en_len
    from terms_versions where id = v_cur;

  -- THE WHOLE REASON THE GATE CAME DOWN. A required consent document whose
  -- current version has no Vietnamese body makes a Vietnamese-reading member's
  -- next login a forced English-only agreement. Refuse rather than warn.
  if v_vn_len = 0 then
    raise exception 'ENABLE: current privacy version % has NO Vietnamese body — this is exactly the state the gate was stood down for.', v_version
      using hint = 'Publish a version carrying body_vn first. Nothing applied.';
  end if;

  if v_en_len = 0 then
    raise exception 'ENABLE: current privacy version % has no English body.', v_version
      using hint = 'Nothing applied.';
  end if;

  update terms_documents set required = true where doc_key = 'privacy';
  if not found then
    raise exception 'ENABLE: no terms_documents row for privacy.' using hint = 'Nothing applied.';
  end if;

  raise notice 'Gate UP — privacy v% is now required (% chars EN / % chars VN).', v_version, v_en_len, v_vn_len;
end $enable$;

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
-- The same assertion db/terms_versions_hardening.sql makes, re-run here so this
-- file proves its own result rather than trusting the one that ran days ago.
do $check$
declare v_bad text[]; v_req boolean;
begin
  select required into v_req from terms_documents where doc_key = 'privacy';
  if not v_req then raise exception 'SELF-CHECK: privacy.required is still false'; end if;

  select array_agg(d.doc_key order by d.doc_key) into v_bad
    from terms_documents d
   where d.required
     and d.satisfied_by = 'consent'
     and coalesce((select nullif(btrim(v.body_vn), '')
                     from terms_versions v
                    where v.id = current_terms_version(d.doc_key)), '') = '';

  if v_bad is not null then
    raise exception 'SELF-CHECK: ENGLISH-ONLY GATE — required consent document(s) with no Vietnamese: %',
      array_to_string(v_bad, ', ');
  end if;

  raise notice 'Verified — every required consent document exists in both languages.';
end $check$;

commit;
