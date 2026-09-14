-- ═══════════════════════════════════════════════════════════════════════════
-- membership_terms v3.0 — the 14.09.26 Terms & Conditions
-- ───────────────────────────────────────────────────────────────────────────
-- Source: "The Rampant Club Terms & Conditions Document 14.09.26.docx"
-- (~/Downloads), supplied 2026-09-14. Extracted mechanically from the .docx —
-- 15 two-column tables, 163 rows, English left cell, Vietnamese right — as
-- v2.0 was. Never retyped.
--
-- WHAT CHANGED from v2.1, clause by clause:
--   + 18.5  Management Discretion — management may make reasonable decisions
--           on anything the Rules and House Rules do not expressly cover
--   + 19.3  Intoxication & Cleaning Fee — VND 3,000,000 per incident, with
--           specialist cleaning or replacement charged at actual cost
--   Nothing was removed. Every other clause is identical.
--
-- ⚠ TWO ARTICLE HEADINGS ARE MISSING FROM THE SOURCE DOCUMENT.
-- v2.1 had "ARTICLE 20. PROHIBITED SUBSTANCES" and "ARTICLE 23. SURVEILLANCE
-- AND SECURITY MONITORING". In the 14.09 document those headings are gone but
-- their clauses remain — 20.1 and 20.2 now sit under Article 19 (alcohol), and
-- 23.1 and 23.2 under Article 22 (data protection).
--
-- It is published AS WRITTEN rather than repaired here, because restoring a
-- heading to a contract is the author's decision, not this file's. But it
-- should be fixed in the .docx: as it stands, the drugs prohibition reads as a
-- sub-clause of "member responsibility after alcohol", and CCTV as a
-- sub-clause of personal data — and clause numbering that jumps from 19.3 to
-- 20.1 with no Article 20 is the kind of thing a member's lawyer notices.
--
-- ⚠ THE VAT PLACEHOLDER IS CARRIED FORWARD, NOT REINTRODUCED.
-- The source still reads "[inclusive/exclusive]" / "[đã bao gồm/chưa bao gồm]"
-- at 8.8. Lachlan answered that on 2026-09-13: INCLUSIVE. Publishing the raw
-- document would have un-answered it in front of members, so the same two
-- substitutions are applied here. The .docx still needs the fix at source.
--
-- v2.1 and v2.0 stay in the register as history; a published version is
-- immutable and the database enforces that.
--
-- Applied 2026-09-14.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare v_cur uuid; v_ver text; v_left int;
begin
  v_cur := current_terms_version('membership_terms');
  select version into v_ver from terms_versions where id = v_cur;
  select coalesce(array_length(regexp_split_to_array(body, '\[[^\]]{2,40}\]'), 1), 1) - 1
    into v_left from terms_versions where id = v_cur;
  raise notice 'current membership_terms is v% · % drafting placeholder(s) left', v_ver, v_left;
  if v_ver <> '3.0' then raise exception 'v3.0 is not current — it was published 2026-09-14'; end if;
  if v_left <> 0 then raise exception 'a placeholder survives in the published English'; end if;
end $$;
