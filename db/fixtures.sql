-- Fixtures — sports-fixture calendar + member RSVP.
--
-- CAPTURE migration: these tables already exist in production but were never
-- version-controlled. This file captures them (schema + the exact RLS policies,
-- transcribed verbatim from pg_policies) so the schema is finally in db/.
--
-- It is a TRUE NO-OP against prod: create-table-if-not-exists skips the existing
-- tables, enable-RLS is idempotent, and every policy is guarded (created only if
-- absent). On a fresh database it reproduces the feature exactly. Re-runnable.
--
-- RLS (as in prod): fixtures — any authenticated user reads; only admins
-- (profiles.is_admin) insert/update/delete. fixture_signups — any authenticated
-- reads; a user inserts/deletes only their OWN signup (auth.uid() = user_id).
-- No anon policy on either → unauthenticated clients see nothing (this is why the
-- public /sports page must read counts via a server route, not a client read).

begin;

create table if not exists fixtures (
  id              uuid primary key default gen_random_uuid(),
  sport           text not null,            -- code uses: golf | tennis | padel | hash | other
  title           text not null,
  description     text,
  date            timestamptz not null,
  location        text,
  max_signups     integer,
  signup_deadline timestamptz,
  results         text,
  created_at      timestamptz not null default now()
);

create table if not exists fixture_signups (
  id            uuid primary key default gen_random_uuid(),
  fixture_id    uuid not null references fixtures(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  signed_up_at  timestamptz not null default now()
  -- (prod likely also has unique(fixture_id, user_id) preventing double-signup;
  --  not asserted here since it couldn't be introspected — add if confirmed.)
);

alter table fixtures        enable row level security;
alter table fixture_signups enable row level security;

-- Policies — verbatim from prod pg_policies, guarded so re-running is a no-op.
do $$
begin
  if not exists (select 1 from pg_policies where tablename='fixtures' and policyname='Fixtures viewable by authenticated') then
    execute $p$create policy "Fixtures viewable by authenticated" on fixtures for select to authenticated using (true)$p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='fixtures' and policyname='Admins can insert fixtures') then
    execute $p$create policy "Admins can insert fixtures" on fixtures for insert to authenticated with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))$p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='fixtures' and policyname='Admins can update fixtures') then
    execute $p$create policy "Admins can update fixtures" on fixtures for update to authenticated using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))$p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='fixtures' and policyname='Admins can delete fixtures') then
    execute $p$create policy "Admins can delete fixtures" on fixtures for delete to authenticated using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))$p$;
  end if;

  if not exists (select 1 from pg_policies where tablename='fixture_signups' and policyname='Signups viewable by authenticated') then
    -- own rows OR admin (hardened — see db/fixtures_signups_rls.sql)
    execute $p$create policy "Signups viewable by authenticated" on fixture_signups for select to authenticated using (user_id = auth.uid() or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))$p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='fixture_signups' and policyname='Users can sign up') then
    execute $p$create policy "Users can sign up" on fixture_signups for insert to authenticated with check (auth.uid() = user_id)$p$;
  end if;
  if not exists (select 1 from pg_policies where tablename='fixture_signups' and policyname='Users can remove own signup') then
    execute $p$create policy "Users can remove own signup" on fixture_signups for delete to authenticated using (auth.uid() = user_id)$p$;
  end if;
end$$;

-- Counts-only aggregate (members get capacity counts without seeing identities).
create or replace function fixture_signup_counts()
returns table (fixture_id uuid, signups bigint)
language sql security definer set search_path = public stable as $$
  select fixture_id, count(*) from fixture_signups group by fixture_id;
$$;
grant execute on function fixture_signup_counts() to authenticated;

commit;
