-- ═══════════════════════════════════════════════════════════════════════════
-- FIXTURE CAPACITY  ·  REVIEW, then run.  Additive + idempotent + re-runnable.
-- ───────────────────────────────────────────────────────────────────────────
-- max_signups and signup_deadline were enforced in the BROWSER only. The RLS
-- policy checks that you are signing yourself up and nothing else, so:
--   · two members tapping at once could both pass the check and overfill
--   · a stale tab could sign up after the deadline had passed
-- Both are now decided in one transaction, in the database.
--
-- IT RETURNS WHY. 'full' | 'closed' | 'already' | 'unknown' | null on success, so
-- the member surface can say something useful. No leak: a member acting on
-- themselves, about an event they can already see.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ PREREQUISITES ═════════════════════════════════════════════════════════
do $prereq$
declare v_missing text[] := '{}'; v_x text;
begin
  foreach v_x in array array['fixtures','fixture_signups'] loop
    if not exists (select 1 from information_schema.tables where table_schema='public' and table_name=v_x)
      then v_missing := v_missing || ('table ' || v_x); end if;
  end loop;
  if array_length(v_missing,1) > 0 then
    raise exception 'FIXTURE CAPACITY: PREREQUISITES MISSING — %', array_to_string(v_missing, ', ')
      using hint = 'Run db/fixtures.sql first. Nothing in this file has been applied.';
  end if;
end $prereq$;

create or replace function fixture_signup(p_fixture_id uuid)
  returns text language plpgsql security definer set search_path = public as $fn$
declare v_fx fixtures%rowtype; v_taken int;
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

  if v_fx.max_signups is not null then
    -- One row is one member: fixture_signups has no guest or party-size column, so
    -- the cap counts MEMBERS, not places. If members are ever able to bring someone
    -- to a fixture, this count is the thing that has to change.
    select count(*) into v_taken from fixture_signups s where s.fixture_id = p_fixture_id;
    if v_taken >= v_fx.max_signups then return 'full'; end if;
  end if;

  insert into fixture_signups (fixture_id, user_id) values (p_fixture_id, auth.uid());
  return null;
end $fn$;
revoke all on function fixture_signup(uuid) from public;
grant execute on function fixture_signup(uuid) to authenticated;

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname='fixture_signup')
    then raise exception 'fixture_capacity self-check FAILED — fixture_signup missing'; end if;
  raise notice 'fixture_capacity self-check passed. NOTE: the direct-insert policy is still in place so the currently deployed browser code keeps working. Run the STEP 2 block below only AFTER the new code is live.';
end $check$;

-- ═══ STEP 2 — RUN ONLY AFTER THE NEW CODE IS DEPLOYED ══════════════════════
-- Until then the deployed browser still inserts directly and dropping this would
-- break sign-ups. Once the member surface calls fixture_signup(), removing the
-- policy makes the cap unbypassable rather than merely enforced by the happy path.
--
--   drop policy if exists "Users can sign up" on fixture_signups;
