-- ═══════════════════════════════════════════════════════════════════════════
-- RECORD WHICH TERMS WERE SIGNED
-- ───────────────────────────────────────────────────────────────────────────
-- signed_agreements records WHO signed and WHEN, and stores a PDF — but the
-- PDF is a one-page certificate of details, declarations and a signature. It
-- says "Accepted the Terms and Conditions of Membership" without saying WHICH
-- terms, and the table had no version column at all.
--
-- That was survivable while one document sat in the register and never moved.
-- It stopped being survivable on 2026-09-13, when membership_terms v2.0 was
-- published: from that day the register holds two versions, and "they accepted
-- the terms" is an ambiguous sentence about a contract.
--
-- Two columns, both nullable, neither backfilled:
--   terms_version_id  the exact row in terms_versions that the applicant read
--   terms_version     its label ('2.0'), kept beside it so the answer survives
--                     even if a version row is ever removed
--
-- NOT BACKFILLED, deliberately. One signature predates this column. Writing
-- '1.0' into it would be a guess presented as a record — and a guess about
-- which contract somebody signed is precisely the thing this column exists to
-- stop. Null means "not recorded", which is the truth.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.signed_agreements') is null then
    raise exception 'signed_agreements does not exist here — wrong database?';
  end if;
  if to_regclass('public.terms_versions') is null then
    raise exception 'terms_versions does not exist here — the reference would dangle';
  end if;
end $$;

alter table signed_agreements add column if not exists terms_version_id uuid references terms_versions(id);
alter table signed_agreements add column if not exists terms_version    text;

comment on column signed_agreements.terms_version_id is
  'The exact terms_versions row this person read and signed. Null = signed before the column existed (not a guess).';
comment on column signed_agreements.terms_version is
  'The version label as shown to them, e.g. "2.0". Kept alongside the id so the answer survives the row.';

create index if not exists idx_signed_agreements_terms_version on signed_agreements (terms_version_id);

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_cols int; v_rows int; v_recorded int;
begin
  select count(*) into v_cols from information_schema.columns
   where table_name = 'signed_agreements' and column_name in ('terms_version_id', 'terms_version');
  select count(*) into v_rows from signed_agreements;
  select count(*) into v_recorded from signed_agreements where terms_version_id is not null;
  raise notice 'signed_agreements: % columns added (expect 2) · % signatures on file · % with a version recorded',
    v_cols, v_rows, v_recorded;
  if v_cols <> 2 then raise exception 'the columns are not both there'; end if;
end $$;
