-- SUPERSEDED by db/terms_documents.sql, which folds this in. Do not run.
-- Kept only so the history of the evidence column is legible.

-- ═══════════════════════════════════════════════════════════════════════════
-- CONSENT: record that they reached the bottom  ·  REVIEW, then run
-- ───────────────────────────────────────────────────────────────────────────
-- One additive column. Scroll-to-agree is weak evidence, but it is better than a
-- checkbox and it costs nothing to keep — and evidence is the entire point of the
-- record. A consent row that cannot say how it was obtained is a tick again.
--
-- jsonb rather than a boolean so the next thing worth recording (time on page, the
-- rendered version hash) does not need another migration.
-- Additive + idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

alter table member_terms_consents add column if not exists evidence jsonb not null default '{}'::jsonb;

comment on column member_terms_consents.evidence is
  'How the consent was obtained. e.g. {"scrolled_to_end": true, "seconds_on_page": 42}. '
  'Weak evidence, deliberately kept: a record that cannot say how it was obtained is a tick.';

-- record_my_consent gains the evidence argument. The OLD two/three-arg signature is
-- left in place so nothing breaks mid-deploy; it simply records empty evidence.
create or replace function record_my_consent(p_doc_key text, p_granted boolean,
                                             p_user_agent text default null,
                                             p_evidence jsonb default '{}'::jsonb)
  returns void language plpgsql security definer set search_path = public as $fn$
declare v_member_no varchar(12); v_version uuid;
begin
  if p_doc_key not in ('membership_terms','privacy','marketing') then
    raise exception 'unknown document';
  end if;
  select pr.member_no into v_member_no from profiles pr where pr.id = auth.uid();
  if v_member_no is null then raise exception 'no member linked to this account'; end if;
  v_version := current_terms_version(p_doc_key);
  if v_version is null then raise exception 'no current version of %', p_doc_key; end if;

  insert into member_terms_consents (member_no, terms_version_id, doc_key, granted, method, user_agent, evidence)
  values (v_member_no, v_version, p_doc_key, p_granted, 'portal', p_user_agent, coalesce(p_evidence, '{}'::jsonb));
end $fn$;
revoke all on function record_my_consent(text, boolean, text, jsonb) from public;
grant execute on function record_my_consent(text, boolean, text, jsonb) to authenticated;

do $check$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='member_terms_consents'
                    and column_name='evidence')
    then raise exception 'consent_scroll_evidence self-check FAILED — evidence column missing'; end if;
  raise notice 'consent_scroll_evidence self-check passed.';
end $check$;
