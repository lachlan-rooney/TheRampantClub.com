-- ═══════════════════════════════════════════════════════════════════════════
-- FIXTURE ATTENDEES  ·  REVIEW, then run.  Transactional + idempotent + re-runnable.
-- ───────────────────────────────────────────────────────────────────────────
-- 2026-09-15. Some people sign up in the portal; some sign up on Zalo through
-- the hotline. The golf trip is sold out and the portal did not know it, because
-- a place only existed if the member had logged in and tapped "Sign me up" — and
-- most members have no portal account at all (12 profiles, 5 linked).
--
-- So staff need to put people on an event themselves, and say "this is full"
-- before every name is in:
--
--   · fixture_signups.user_id becomes NULLABLE. A row can now name a MEMBER
--     (member_no) or just a NAME (attendee_name, someone not on the roster). Every
--     row still takes exactly one place, so fixture_signup_counts() and the cap
--     need no new arithmetic.
--   · source 'portal' | 'staff', note, added_by — so the admin list can say who
--     came in how, and "via Zalo" is written down rather than remembered.
--   · fixtures.is_full — the manual switch. Places can be gone before the names
--     are.
--   · fixture_signup() refuses when is_full, and treats a member staff already
--     added as 'already' — otherwise one person could hold two places.
--
-- PRIVACY. Names stay admin-only. Staff writes go through service-role routes,
-- so members gain NO new permission here. The SELECT policy is `user_id =
-- auth.uid() or admin`; a staff row with a null user_id matches nobody's uid, so
-- it is visible to admins only (asserted in the self-check below).
--
-- ORDER. Safe to run BEFORE or AFTER the deploy. The code reads these columns
-- only when they exist and otherwise behaves as it does today, saying "not set
-- up yet" on the new controls.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ PREREQUISITES ═════════════════════════════════════════════════════════
do $prereq$
declare v_missing text[] := '{}'; v_x text;
begin
  foreach v_x in array array['fixtures','fixture_signups','members','profiles'] loop
    if not exists (select 1 from information_schema.tables where table_schema='public' and table_name=v_x)
      then v_missing := v_missing || ('table ' || v_x); end if;
  end loop;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='profiles' and column_name='member_no')
    then v_missing := v_missing || 'column profiles.member_no'::text; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname='fixture_signup')
    then v_missing := v_missing || 'function fixture_signup (db/fixture_capacity.sql)'::text; end if;
  if array_length(v_missing,1) > 0 then
    raise exception 'FIXTURE ATTENDEES: PREREQUISITES MISSING — %', array_to_string(v_missing, ', ')
      using hint = 'Run db/fixtures.sql and db/fixture_capacity.sql first. Nothing in this file has been applied.';
  end if;
end $prereq$;

begin;

-- ═══ PART 1 · WHO A ROW CAN NAME ═══════════════════════════════════════════
-- Nullable: a guest on the Zalo list has no auth account and may never have one.
alter table fixture_signups alter column user_id drop not null;

-- varchar, to match members.member_no exactly. ON DELETE SET NULL, not cascade:
-- removing a member from the roster must not silently free their place on a trip
-- that is already paid for. The name snapshot below keeps the row identifiable.
alter table fixture_signups add column if not exists member_no varchar
  references members(member_no) on update cascade on delete set null;
-- For a staff-added MEMBER this is a snapshot of their name at the time, so the
-- row still says who it was if the member record later goes away.
alter table fixture_signups add column if not exists attendee_name text;
alter table fixture_signups add column if not exists note          text;
alter table fixture_signups add column if not exists added_by      text;
alter table fixture_signups add column if not exists source        text not null default 'portal';

alter table fixture_signups drop constraint if exists fixture_signups_source_check;
alter table fixture_signups add  constraint fixture_signups_source_check check (source in ('portal','staff'));

-- A place that names nobody cannot be checked against the list on the day.
alter table fixture_signups drop constraint if exists fixture_signups_identifies_someone;
alter table fixture_signups add  constraint fixture_signups_identifies_someone
  check (user_id is not null or member_no is not null or nullif(btrim(attendee_name), '') is not null);

-- ═══ PART 2 · NOBODY COUNTED TWICE ═════════════════════════════════════════
-- db/fixtures.sql could not confirm whether prod already has unique(fixture_id,
-- user_id). If ANY unique index already covers exactly those two columns it is
-- kept (NULLs are distinct under unique, so it does not block staff rows);
-- otherwise a partial one is created. Duplicates are reported by name rather than
-- surfacing as a bare index-build error.
do $uniq$
declare v_dupes int;
begin
  select count(*) into v_dupes from (
    select 1 from fixture_signups where user_id is not null group by fixture_id, user_id having count(*) > 1) d;
  if v_dupes > 0 then
    raise exception 'FIXTURE ATTENDEES: % (fixture, user) pairs are signed up more than once — resolve them first.', v_dupes;
  end if;
  select count(*) into v_dupes from (
    select 1 from fixture_signups where member_no is not null group by fixture_id, member_no having count(*) > 1) d;
  if v_dupes > 0 then
    raise exception 'FIXTURE ATTENDEES: % (fixture, member_no) pairs appear more than once — resolve them first.', v_dupes;
  end if;

  if not exists (
    select 1 from pg_index i
     where i.indrelid = 'public.fixture_signups'::regclass and i.indisunique
       and (select array_agg(a.attname::text order by a.attname::text)
              from unnest(i.indkey) k join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k)
           = array['fixture_id','user_id']
  ) then
    execute 'create unique index fixture_signups_fixture_user_uniq on fixture_signups (fixture_id, user_id) where user_id is not null';
  end if;
end $uniq$;

create unique index if not exists fixture_signups_fixture_member_uniq
  on fixture_signups (fixture_id, member_no) where member_no is not null;

-- ═══ PART 3 · THE MANUAL FULL SWITCH ═══════════════════════════════════════
alter table fixtures add column if not exists is_full boolean not null default false;
comment on column fixtures.is_full is
  'Staff say the event is full, whatever the count. Places can be gone (e.g. on Zalo) before every name is entered.';

-- ═══ PART 4 · THE DIRECT-INSERT POLICY, IF IT IS STILL THERE ═══════════════
-- db/fixture_capacity.sql left "Users can sign up" in place until its STEP 2.
-- With new columns it would let a member insert a row naming ANOTHER member_no
-- (taking that member's place through the unique index) or posing as staff. If
-- the policy exists it is narrowed to exactly what a self sign-up can be; if it
-- was already dropped, it stays dropped.
do $pol$
begin
  if exists (select 1 from pg_policies where tablename='fixture_signups' and policyname='Users can sign up') then
    execute 'drop policy "Users can sign up" on fixture_signups';
    execute $p$create policy "Users can sign up" on fixture_signups for insert to authenticated
      with check (
        auth.uid() = user_id
        and source = 'portal' and attendee_name is null and note is null and added_by is null
        and (member_no is null or member_no = (select pr.member_no from profiles pr where pr.id = auth.uid()))
      )$p$;
  end if;
end $pol$;

-- ═══ PART 5 · fixture_signup() ═════════════════════════════════════════════
-- Same lock, same order, same return codes. Two additions: is_full refuses as
-- 'full', and the caller's linked member_no counts as the caller.
create or replace function fixture_signup(p_fixture_id uuid)
  returns text language plpgsql security definer set search_path = public as $fn$
declare v_fx fixtures%rowtype; v_taken int; v_member_no varchar;
begin
  if auth.uid() is null then return 'auth'; end if;

  -- FOR UPDATE serialises concurrent sign-ups for THIS fixture. Without it, two
  -- members tapping together both read the same count and both insert — which is
  -- exactly how a cap of twenty ends up at twenty-one.
  select * into v_fx from fixtures f where f.id = p_fixture_id for update;
  if not found then return 'unknown'; end if;

  if v_fx.signup_deadline is not null and v_fx.signup_deadline < now() then
    return 'closed';
  end if;

  if exists (select 1 from fixture_signups s
              where s.fixture_id = p_fixture_id and s.user_id = auth.uid()) then
    return 'already';
  end if;

  -- Staff may have added this member from the Zalo list before their account was
  -- linked. That row IS their place: claim it for this login (so they see "You're
  -- in" and can withdraw) and refuse a second one.
  select pr.member_no into v_member_no from profiles pr where pr.id = auth.uid();
  if v_member_no is not null and exists (select 1 from fixture_signups s
              where s.fixture_id = p_fixture_id and s.member_no = v_member_no) then
    update fixture_signups set user_id = auth.uid()
     where fixture_id = p_fixture_id and member_no = v_member_no and user_id is null;
    return 'already';
  end if;

  if v_fx.is_full then return 'full'; end if;

  if v_fx.max_signups is not null then
    -- One row is one place, whoever added it: a portal sign-up, a member staff
    -- added, or a name from the Zalo list. There is still no party-size column —
    -- if members can ever bring someone, this count is the thing that changes.
    select count(*) into v_taken from fixture_signups s where s.fixture_id = p_fixture_id;
    if v_taken >= v_fx.max_signups then return 'full'; end if;
  end if;

  -- member_no is stored on portal rows too, so the (fixture, member_no) unique
  -- index also stops staff adding someone who already signed themselves up.
  insert into fixture_signups (fixture_id, user_id, member_no, source)
  values (p_fixture_id, auth.uid(), v_member_no, 'portal');
  return null;
exception when unique_violation then
  -- Staff added them in the instant between the check and the insert (staff
  -- writes do not take the row lock). Same answer as the check would have given.
  return 'already';
end $fn$;
revoke all on function fixture_signup(uuid) from public;
grant execute on function fixture_signup(uuid) to authenticated;

-- fixture_signup_counts() is deliberately NOT replaced: it already counts every
-- row per fixture, which now includes staff rows, and its (fixture_id, signups)
-- shape is what the member page and the weekly report read.

commit;

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_x text; v_pol text;
begin
  foreach v_x in array array['member_no','attendee_name','note','added_by','source'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name='fixture_signups' and column_name=v_x)
      then raise exception 'SELF-CHECK: fixture_signups.% missing', v_x; end if;
  end loop;
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='fixture_signups' and column_name='user_id' and is_nullable='NO')
    then raise exception 'SELF-CHECK: fixture_signups.user_id is still NOT NULL'; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='fixtures' and column_name='is_full')
    then raise exception 'SELF-CHECK: fixtures.is_full missing'; end if;
  if not exists (select 1 from pg_constraint where conname='fixture_signups_identifies_someone')
    then raise exception 'SELF-CHECK: identifies-someone check missing'; end if;
  if not exists (select 1 from pg_indexes where tablename='fixture_signups' and indexname='fixture_signups_fixture_member_uniq')
    then raise exception 'SELF-CHECK: member_no unique index missing'; end if;
  if not exists (select 1 from pg_proc where proname='fixture_signup' and prosrc like '%is_full%' and prosrc like '%v_member_no%')
    then raise exception 'SELF-CHECK: fixture_signup() was not replaced'; end if;
  if not exists (select 1 from pg_proc where proname='fixture_signup_counts')
    then raise exception 'SELF-CHECK: fixture_signup_counts() missing'; end if;

  -- The privacy claim: members read rows only by user_id, so a staff row with no
  -- user_id is unreachable for them.
  select qual into v_pol from pg_policies where tablename='fixture_signups' and cmd='SELECT' and policyname='Signups viewable by authenticated';
  if v_pol is null or v_pol not like '%auth.uid()%' or v_pol not like '%is_admin%' then
    raise exception 'SELF-CHECK: fixture_signups SELECT policy is not own-or-admin (found: %)', coalesce(v_pol, 'none');
  end if;
  if exists (select 1 from pg_policies where tablename='fixture_signups' and cmd='SELECT' and policyname <> 'Signups viewable by authenticated')
    then raise exception 'SELF-CHECK: an extra SELECT policy on fixture_signups could widen who sees rows — review it'; end if;

  raise notice 'FIXTURE ATTENDEES OK — % signup rows (% staff), % fixtures marked full; SELECT policy is own-or-admin; direct-insert policy %.',
    (select count(*) from fixture_signups),
    (select count(*) from fixture_signups where source = 'staff'),
    (select count(*) from fixtures where is_full),
    case when exists (select 1 from pg_policies where tablename='fixture_signups' and policyname='Users can sign up')
         then 'present and narrowed' else 'absent' end;
end $check$;

-- Verify as a member (not only as anon):
--   begin; set local role authenticated;
--   select set_config('request.jwt.claims', json_build_object('sub','<a-member-uuid>','role','authenticated')::text, true);
--   select * from fixture_signups;           -- only that member's own rows, never a staff-added name
--   select * from fixture_signup_counts();   -- counts include staff rows
--   rollback;
