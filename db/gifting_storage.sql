-- Run once in the Supabase SQL editor, after db/gifting.sql.
--
-- Creates the private gift-photos Storage bucket and the four RLS
-- policies on storage.objects that gate read / insert / update / delete
-- behind profiles.is_admin = true.
--
-- The service-role key (used by our server routes) bypasses these
-- policies, so the existing app code keeps working even without RLS.
-- These policies matter when:
--   - a cookie-authenticated client reaches storage directly
--   - someone uploads via the dashboard
--   - we add any browser-to-storage flow that doesn't use signed URLs
-- Belt and suspenders.

-- ── Bucket ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('gift-photos', 'gift-photos', false)
on conflict (id) do nothing;

-- ── Policies on storage.objects ───────────────────────────────────────
drop policy if exists "Admin read gift-photos"   on storage.objects;
drop policy if exists "Admin write gift-photos"  on storage.objects;
drop policy if exists "Admin update gift-photos" on storage.objects;
drop policy if exists "Admin delete gift-photos" on storage.objects;

create policy "Admin read gift-photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'gift-photos'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

create policy "Admin write gift-photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gift-photos'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

create policy "Admin update gift-photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'gift-photos'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  )
  with check (
    bucket_id = 'gift-photos'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );

create policy "Admin delete gift-photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'gift-photos'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );
