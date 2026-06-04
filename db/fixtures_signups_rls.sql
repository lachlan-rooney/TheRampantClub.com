-- Run once in the Supabase SQL editor. This is a REAL policy change (not a no-op)
-- — run it deliberately.
--
-- Fixtures: RLS-harden the signup roster. Before this, fixture_signups SELECT was
-- `using (true)` — any authenticated user could read who signed up (the admin-only
-- roster was UI-level only). This tightens SELECT so a member reads only THEIR OWN
-- signups; admins (via profiles.is_admin) read all. INSERT/DELETE are untouched
-- (members still sign up / cancel their own row). Service role bypasses RLS (the
-- public /sports counts API keeps working).
--
-- Dependency handled: the member view derives the "X/cap signed up" capacity count
-- from reading all signup rows — which own-only SELECT would break. So we add a
-- SECURITY DEFINER aggregate that returns COUNTS ONLY (no user_ids), giving members
-- the capacity number without exposing identities. The member page reads counts
-- from this function and own-state from the (now own-only) table SELECT.

begin;

-- (a) tighten SELECT — same policy name (so db/fixtures.sql's guarded capture
--     stays a no-op), new predicate: own rows OR admin.
drop policy if exists "Signups viewable by authenticated" on fixture_signups;
create policy "Signups viewable by authenticated" on fixture_signups
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true)
  );

-- (b) counts-only aggregate — SECURITY DEFINER so members get capacity counts
--     without the SELECT policy needing to expose rows. Returns ONLY (fixture_id,
--     count) — never user_id or any identity. search_path pinned (DEFINER hardening).
create or replace function fixture_signup_counts()
returns table (fixture_id uuid, signups bigint)
language sql security definer set search_path = public stable as $$
  select fixture_id, count(*) from fixture_signups group by fixture_id;
$$;
grant execute on function fixture_signup_counts() to authenticated;

commit;

-- Verify member-context behaviour (what a member's session sees):
--   set local role authenticated;
--   select set_config('request.jwt.claims', json_build_object('sub','<a-member-uuid>','role','authenticated')::text, true);
--   select * from fixture_signups;            -- should return ONLY that member's rows
--   select * from fixture_signup_counts();    -- should return full per-fixture counts (no user_ids)
