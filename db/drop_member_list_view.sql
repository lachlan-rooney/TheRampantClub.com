-- Run once in the Supabase SQL editor.
--
-- The public.member_list view was flagged by Supabase advisors for two
-- security issues:
--   1. It exposes auth.users data (notably the email column) to the anon
--      and authenticated PostgREST roles.
--   2. It was created with SECURITY DEFINER, which bypasses the querying
--      user's permissions and RLS — so any logged-in member could read
--      every other member's email.
--
-- The admin member list page has been moved to a server-side endpoint
-- (/api/admin/members) that admin-checks the cookie session before
-- joining profiles with auth.users via the service role key.
--
-- After deploying the new endpoint, run this to remove the view:

drop view if exists public.member_list cascade;

-- (Optional sanity check) Confirm no other views or functions in the public
-- schema reference auth.users — adjust as needed:
--
--   select n.nspname as schema, c.relname as name, c.relkind
--     from pg_depend d
--     join pg_class c on c.oid = d.refobjid
--     join pg_namespace n on n.oid = c.relnamespace
--    where c.relname = 'users'
--      and n.nspname = 'auth';
