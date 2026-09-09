-- ═══════════════════════════════════════════════════════════════════════════
-- MEMBER DOCUMENTS  ·  REVIEW, then run.  Additive + idempotent + re-runnable.
-- ───────────────────────────────────────────────────────────────────────────
-- Three things, all of them closing something that was wrong:
--
--  1. THE DOCUMENT LIST WAS HARDCODED IN SIX PLACES — two CHECK constraints, two
--     IF guards and two VALUES lists. Publishing a new document was a migration,
--     not a row. It is now a table, and everything iterates it.
--
--  2. A PUBLISHED VERSION WAS EDITABLE. The admin policy was FOR ALL, so a body
--     could be rewritten under consents already pointing at it — which makes the
--     whole version record worthless, silently. Now insert-only, with a trigger,
--     because a rule that is not mechanical is eventually broken by someone who
--     never read the comment.
--
--  3. SOME DOCUMENTS ARE SIGNED, NOT AGREED. The Membership Agreement is executed
--     through the signing flow with a name, position and date — stronger evidence
--     than a scroll and a click, and the version TNJ reviewed. A second, weaker
--     record of the same agreement would only raise a question about which
--     governs. `satisfied_by` makes that a property of the document rather than an
--     exception in the middleware.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1 · THE DOCUMENT REGISTER ═════════════════════════════════════════════
create table if not exists terms_documents (
  doc_key      text primary key,
  name_en      text not null,
  name_vn      text,
  -- 'consent'   → agreed in the portal, scroll-and-agree, recorded in member_terms_consents
  -- 'signature' → executed through the signing flow; NEVER chased for a consent row
  satisfied_by text not null default 'consent' check (satisfied_by in ('consent','signature')),
  required     boolean not null default true,   -- false = optional (marketing)
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
alter table terms_documents enable row level security;
drop policy if exists "authenticated read terms_documents" on terms_documents;
create policy "authenticated read terms_documents" on terms_documents for select
  using (auth.uid() is not null);
drop policy if exists "admins write terms_documents" on terms_documents;
create policy "admins write terms_documents" on terms_documents for all
  using (is_admin_uid(auth.uid())) with check (is_admin_uid(auth.uid()));

insert into terms_documents (doc_key, name_en, name_vn, satisfied_by, required, sort) values
  ('membership_terms', 'Membership Agreement', 'Thỏa Thuận Thành Viên', 'signature', true,  10),
  ('privacy',          'Privacy Notice',       'Thông Báo Quyền Riêng Tư', 'consent',  true,  20),
  ('marketing',        'Marketing',            'Thông tin tiếp thị',       'consent',  false, 30)
on conflict (doc_key) do update
  set name_en = excluded.name_en, name_vn = excluded.name_vn,
      satisfied_by = excluded.satisfied_by, required = excluded.required, sort = excluded.sort;

-- ═══ 2 · terms_versions — bilingual, titled, and FK'd to the register ══════
alter table terms_versions add column if not exists body_vn  text;
alter table terms_versions add column if not exists title_en text;
alter table terms_versions add column if not exists title_vn text;

-- The hardcoded lists go. An FK does the work a CHECK was doing, and it points at
-- something a person can add a row to.
alter table terms_versions        drop constraint if exists terms_versions_doc_key_check;
alter table member_terms_consents drop constraint if exists member_terms_consents_doc_key_check;
do $fk$
begin
  if not exists (select 1 from pg_constraint where conname = 'terms_versions_doc_key_fkey') then
    alter table terms_versions add constraint terms_versions_doc_key_fkey
      foreign key (doc_key) references terms_documents(doc_key);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'member_terms_consents_doc_key_fkey') then
    alter table member_terms_consents add constraint member_terms_consents_doc_key_fkey
      foreign key (doc_key) references terms_documents(doc_key);
  end if;
end $fk$;

-- ═══ 3 · A PUBLISHED VERSION IS IMMUTABLE ══════════════════════════════════
-- Not a convention. A member's recorded agreement points at a version; if the body
-- can move underneath it, the record proves nothing and nothing reports the change.
create or replace function terms_versions_immutable()
  returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.doc_key <> old.doc_key or new.version <> old.version
     or new.body is distinct from old.body or new.body_vn is distinct from old.body_vn
     or new.effective_date <> old.effective_date then
    raise exception 'a published version is immutable — publish a new version instead'
      using hint = 'Correcting a typo means a new row in terms_versions, not an edit to this one.';
  end if;
  return new;
end $fn$;
drop trigger if exists trg_terms_versions_immutable on terms_versions;
create trigger trg_terms_versions_immutable
  before update on terms_versions for each row execute function terms_versions_immutable();

-- …and the policy stops granting UPDATE at all, so the trigger is the second line
-- rather than the only one.
drop policy if exists "admins write terms_versions" on terms_versions;
drop policy if exists "admins insert terms_versions" on terms_versions;
create policy "admins insert terms_versions" on terms_versions for insert
  with check (is_admin_uid(auth.uid()));
drop policy if exists "admins read terms_versions" on terms_versions;
create policy "admins read terms_versions" on terms_versions for select
  using (is_admin_uid(auth.uid()));

-- ═══ 4 · THE FUNCTIONS NOW ITERATE THE REGISTER ════════════════════════════
create or replace function record_my_consent(p_doc_key text, p_granted boolean,
                                             p_user_agent text default null,
                                             p_evidence jsonb default '{}'::jsonb)
  returns void language plpgsql security definer set search_path = public as $fn$
declare v_member_no varchar(12); v_version uuid; v_doc terms_documents%rowtype;
begin
  select * into v_doc from terms_documents d where d.doc_key = p_doc_key;
  if not found then raise exception 'unknown document'; end if;
  -- A signed document is never agreed by a click. Refused here, not in the UI.
  if v_doc.satisfied_by = 'signature' then
    raise exception 'this document is executed by signature, not by consent';
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

create or replace function my_consent_state()
  returns table (doc_key text, name_en text, name_vn text, required boolean, satisfied_by text,
                 held_version_id uuid, held_version text, granted boolean, given_at timestamptz,
                 current_version_id uuid, current_version text, needs_action boolean)
  language plpgsql security definer set search_path = public stable as $fn$
declare v_member_no varchar(12);
begin
  select pr.member_no into v_member_no from profiles pr where pr.id = auth.uid();
  if v_member_no is null then return; end if;
  return query
  select d.doc_key, d.name_en, d.name_vn, d.required, d.satisfied_by,
         h.terms_version_id, hv.version, h.granted, h.given_at,
         c.id, cv.version,
         -- Signed documents are never pending here; optional ones are never pending
         -- for never having been answered.
         case
           when d.satisfied_by = 'signature' then false
           when not d.required then false
           else (h.terms_version_id is null or h.granted = false or h.terms_version_id <> c.id)
         end
    from terms_documents d
    left join lateral (select current_terms_version(d.doc_key) as id) c on true
    left join terms_versions cv on cv.id = c.id
    left join lateral (
      select mc.terms_version_id, mc.granted, mc.given_at
        from member_terms_consents mc
       where mc.member_no = v_member_no and mc.doc_key = d.doc_key
       order by mc.given_at desc limit 1
    ) h on true
    left join terms_versions hv on hv.id = h.terms_version_id
   order by d.sort;
end $fn$;
revoke all on function my_consent_state() from public;
grant execute on function my_consent_state() to authenticated;

create or replace function member_consent_gaps()
  returns table (member_no varchar, full_name text, doc_key text,
                 held_version text, current_version text, granted boolean, given_at timestamptz)
  language plpgsql security definer set search_path = public stable as $fn$
begin
  if not is_admin_uid(auth.uid()) then raise exception 'admin only'; end if;
  return query
  select m.member_no, m.full_name, d.doc_key, hv.version, cv.version, h.granted, h.given_at
    from members m
   cross join (select * from terms_documents where required and satisfied_by = 'consent') d
    left join lateral (select current_terms_version(d.doc_key) as id) c on true
    left join terms_versions cv on cv.id = c.id
    left join lateral (
      select mc.terms_version_id, mc.granted, mc.given_at
        from member_terms_consents mc
       where mc.member_no = m.member_no and mc.doc_key = d.doc_key
       order by mc.given_at desc limit 1
    ) h on true
    left join terms_versions hv on hv.id = h.terms_version_id
   where c.id is not null                                   -- nothing published = nothing to chase
     and (h.terms_version_id is null or h.granted = false or h.terms_version_id <> c.id)
   order by m.member_no, d.doc_key;
end $fn$;
revoke all on function member_consent_gaps() from public;
grant execute on function member_consent_gaps() to authenticated;

-- Publish a version. Admin-only, and the ONLY way a document body enters the system.
create or replace function publish_terms_version(
  p_doc_key text, p_version text, p_effective date,
  p_title_en text, p_title_vn text, p_body text, p_body_vn text)
  returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  if not is_admin_uid(auth.uid()) then raise exception 'admin only'; end if;
  if not exists (select 1 from terms_documents where doc_key = p_doc_key) then
    raise exception 'unknown document — add it to terms_documents first';
  end if;
  insert into terms_versions (doc_key, version, effective_date, title_en, title_vn, body, body_vn, created_by)
  values (p_doc_key, p_version, p_effective, p_title_en, p_title_vn, p_body, p_body_vn, auth.uid())
  returning id into v_id;
  return v_id;
end $fn$;
revoke all on function publish_terms_version(text, text, date, text, text, text, text) from public;
grant execute on function publish_terms_version(text, text, date, text, text, text, text) to authenticated;

-- ═══ 5 · SELF-CHECK ════════════════════════════════════════════════════════
do $check$
declare v_missing text[] := '{}'; v_n int;
begin
  select count(*) into v_n from terms_documents;
  if v_n < 3 then v_missing := v_missing || 'terms_documents seed'; end if;
  if exists (select 1 from pg_constraint where conname = 'terms_versions_doc_key_check')
    then v_missing := v_missing || 'the old doc_key CHECK is still present'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_terms_versions_immutable')
    then v_missing := v_missing || 'immutability trigger'; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='terms_versions' and column_name='body_vn')
    then v_missing := v_missing || 'terms_versions.body_vn'; end if;
  if array_length(v_missing,1) > 0 then
    raise exception 'terms_documents self-check FAILED — %', array_to_string(v_missing, ', ');
  end if;
  raise notice 'terms_documents self-check passed — % documents registered.', v_n;
end $check$;
