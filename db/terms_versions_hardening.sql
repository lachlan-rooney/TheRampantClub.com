-- ═══════════════════════════════════════════════════════════════════════════
-- TERMS VERSIONS · CLOSE THE DELETE GAP + ASSERT THE ENGLISH-ONLY-GATE CLASS
-- REVIEW, then run. Idempotent, re-runnable, and SAFE ON A HALF-APPLIED STATE.
-- ───────────────────────────────────────────────────────────────────────────
-- TWO THINGS, both found by the privacy-gate work on 2026-09-09.
--
-- 1 · THE PROTECTION HAD A DOOR IN IT. terms_versions was built so a published
--     version is permanent — that is what makes a member's recorded consent mean
--     something, because it points at a body that cannot have moved. But the
--     guard was BEFORE UPDATE only. Editing was impossible; removing was one
--     statement.
--
-- 2 · A REQUIRED CONSENT DOCUMENT WITH NO VIETNAMESE GATES MEMBERS IN ENGLISH.
--     That is the class. The instance was the Privacy Notice. Left as a query in
--     a file it gets read once; as an assertion it fails the next person who
--     recreates it.
--
-- ═══ IF A PREVIOUS RUN DEADLOCKED, READ THIS ══════════════════════════════
-- The first version of this file was NOT wrapped in a transaction, so a failure
-- part-way could leave the function created and the trigger not. That state is
-- harmless — it is the pre-existing state plus an unused function, and nothing
-- here is destructive — and this file is safe to run again on top of it: every
-- statement is `create or replace`, `drop ... if exists`, or a fresh `create`.
--
-- To see the state before you run, this reads nothing and changes nothing:
--
--   select
--     to_regprocedure('public.terms_versions_no_delete()') is not null as fn_exists,
--     exists (select 1 from pg_trigger
--              where tgrelid = 'terms_versions'::regclass
--                and tgname  = 'trg_terms_versions_no_delete') as delete_guard,
--     exists (select 1 from pg_trigger
--              where tgrelid = 'terms_versions'::regclass
--                and tgname  = 'trg_terms_versions_immutable') as update_guard;
--
-- update_guard should be true either way — this file never touches it.
--
-- And if it deadlocks again, something else is holding the table:
--
--   select pid, state, wait_event_type, left(query,80) as q, xact_start
--     from pg_stat_activity
--    where datname = current_database() and state <> 'idle'
--    order by xact_start;
--
-- Anything `idle in transaction` is the culprit — close that tab, or
-- select pg_terminate_backend(<pid>).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Fail FAST and cleanly on a lock conflict instead of deadlocking. A file should
-- be safe to run at any moment, not only a quiet one — the same reasoning as the
-- self-check asserting its own prerequisites.
set local lock_timeout = '5s';

-- ═══ PREREQUISITES ═════════════════════════════════════════════════════════
do $prereq$
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='terms_versions') then
    raise exception 'PREREQUISITES MISSING — terms_versions'
      using hint = 'Run db/terms_documents.sql first. Nothing in this file has been applied.';
  end if;
end $prereq$;

-- ═══ 1 · A PUBLISHED VERSION CANNOT BE DELETED ═════════════════════════════
-- Same rule as UPDATE, and for the same reason: a correction is a NEW VERSION.
-- The message names the alternative, because whoever hits this is mid-mistake
-- and the useful thing is the way forward, not the refusal.
create or replace function terms_versions_no_delete()
  returns trigger language plpgsql as $fn$
declare v_consents int;
begin
  select count(*) into v_consents from member_terms_consents
   where terms_version_id = old.id;
  raise exception
    'terms_versions rows are permanent — % (v%) has % recorded consent(s) pointing at it',
    old.doc_key, old.version, v_consents
    using hint = 'A correction is a NEW VERSION (publish_terms_version), never a delete. '
                 'To stand a document down without removing it, set '
                 'terms_documents.required = false — see db/privacy_gate_stand_down.sql.';
end $fn$;

drop trigger if exists trg_terms_versions_no_delete on terms_versions;
create trigger trg_terms_versions_no_delete
  before delete on terms_versions for each row execute function terms_versions_no_delete();

-- ═══ 2 · STRUCTURAL SELF-CHECK (inside the transaction) ════════════════════
-- If this fails, the whole thing rolls back and nothing is half-applied.
do $selfcheck$
declare v_n int;
begin
  select count(*) into v_n from pg_trigger
   where tgrelid = 'terms_versions'::regclass and not tgisinternal
     and tgname in ('trg_terms_versions_immutable','trg_terms_versions_no_delete');
  if v_n <> 2 then
    raise exception 'SELF-CHECK: expected BOTH the update and delete guards, found %', v_n;
  end if;
  raise notice 'terms_versions is now permanent against UPDATE and DELETE.';
end $selfcheck$;

commit;

-- ═══ 3 · THE DATA ASSERTION — DELIBERATELY AFTER COMMIT ════════════════════
-- This asserts a fact about the DATA, not about the change above. Inside the
-- transaction, a required-document-with-no-Vietnamese would roll back the delete
-- guard as well — undoing an unrelated and wanted fix to report a separate
-- problem. So the hardening lands first, and this reports second.
--
-- Fails loudly if any REQUIRED consent document's CURRENT version has no
-- Vietnamese body: such a document gates every member behind English-only text.
-- Signature documents are exempt — my_consent_state() returns needs_action=false
-- for them unconditionally, so they never gate.
do $check$
declare v_bad text[];
begin
  select array_agg(d.doc_key order by d.doc_key) into v_bad
    from terms_documents d
   where d.required
     and d.satisfied_by = 'consent'
     and coalesce((select nullif(btrim(v.body_vn), '')
                     from terms_versions v
                    where v.id = current_terms_version(d.doc_key)), '') = '';

  if v_bad is not null then
    raise exception 'ENGLISH-ONLY GATE — required consent document(s) with no Vietnamese body: %',
      array_to_string(v_bad, ', ')
      using hint = 'Publish a version carrying body_vn, or set required = false until it exists. '
                   'Requiring one of these blocks every /members page for a membership that reads Vietnamese.';
  end if;

  raise notice 'OK — no required consent document gates members in English only.';
end $check$;
