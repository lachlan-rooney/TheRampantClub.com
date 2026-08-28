-- Signing subsystem RLS hardening — CRITICAL SECURITY FIX
-- ---------------------------------------------------------------------------
-- Discovered by the backend connectivity/security audit (2026-08): both
-- `signing_invitations` and `signed_agreements` had partial/permissive RLS.
-- A logged-in NON-admin member (any authenticated club member) could:
--   • signing_invitations: SELECT every row — including `token`, the secret
--       that authorises signing a membership agreement at /sign/<token> — plus
--       UPDATE/INSERT rows (forge or redirect an invitation).
--   • signed_agreements:  SELECT every signed agreement's full PII —
--       full_name, email, mobile, date_of_birth, nationality, home_address,
--       company_name, signature image, signed PDF URL, even IP address.
--
-- Both tables are admin-managed. The only browser (authenticated) reader/writer
-- is the admin agreements page and the admin session routes (revoke/remind),
-- all of which pass is_admin_uid(). Every member-facing / public flow — the
-- /sign/[token] page, the POST /api/sign submission, send-invitation, the
-- dashboard, reports, and lib/signing — runs under the SERVICE ROLE, which
-- bypasses RLS entirely and is unaffected by these policies.
--
-- Fix: lock ALL client (authenticated) access on both tables to admins only.
-- Idempotent — drops whatever policies currently exist (names unknown, some
-- were created outside the repo) and recreates a single admin-all policy each.
-- Safe to re-run.

-- ── signing_invitations ────────────────────────────────────────────────────
alter table signing_invitations enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'signing_invitations'
  loop
    execute format('drop policy if exists %I on signing_invitations', pol.policyname);
  end loop;
end $$;

create policy "signing_invitations admin all"
  on signing_invitations
  for all
  to authenticated
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

-- ── signed_agreements ──────────────────────────────────────────────────────
alter table signed_agreements enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'signed_agreements'
  loop
    execute format('drop policy if exists %I on signed_agreements', pol.policyname);
  end loop;
end $$;

create policy "signed_agreements admin all"
  on signed_agreements
  for all
  to authenticated
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

-- ── storage bucket: signed_agreements ──────────────────────────────────────
-- The signed membership-agreement PDFs live in the `signed_agreements` bucket,
-- which was PUBLIC — so any PDF was downloadable by its (leaked) filename with
-- no auth at all. Make it private and grant object access to admins only. The
-- signing submission (POST /api/sign) uploads via the service role (bypasses
-- these policies); the admin agreements page downloads via createSignedUrl,
-- which needs the admin SELECT policy below once the bucket is private.
update storage.buckets set public = false where id = 'signed_agreements';

do $$
declare pol record;
begin
  -- Drop only the policies that target THIS bucket (leave other buckets alone).
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and qual like '%signed_agreements%'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "signed_agreements storage admin all"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'signed_agreements' and is_admin_uid(auth.uid()))
  with check (bucket_id = 'signed_agreements' and is_admin_uid(auth.uid()));
