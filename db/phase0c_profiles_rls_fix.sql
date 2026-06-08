-- ─────────────────────────────────────────────────────────────────────────
-- Phase 0c (Part 2) — fix TWO profiles RLS holes the diagnostic confirmed.
-- SECURITY-CRITICAL. Both are live now; armed the instant a member login exists.
--
-- 1. READ LEAK   — "Profiles viewable by authenticated" SELECT qual=true →
--                  every authenticated user reads EVERY profile.
-- 2. ESCALATION  — "Users can update own profile" UPDATE has with_check=NULL →
--                  a member could update their OWN row to is_admin=true (become
--                  admin) or change member_no (re-link to another member).
--
-- Fix preserves: member self-update of SAFE fields (display_name, preferred_dram,
-- preferences) and admin updates (incl. setting is_admin — the 0b linking path,
-- which runs via the service role / the admin UPDATE policy).
-- ─────────────────────────────────────────────────────────────────────────

-- ── Fix 1: the read leak (SELECT) ──────────────────────────────────────────
-- Own row, or admin (recursion-safe via is_admin_uid — a SECURITY DEFINER fn,
-- so it does NOT re-trigger this policy. A raw sub-select on profiles here would
-- recurse and error).
drop policy if exists "Profiles viewable by authenticated" on profiles;
drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles for select to authenticated
  using (id = auth.uid() or is_admin_uid(auth.uid()));

-- ── Fix 2: the escalation hole (member self-update) ─────────────────────────
-- Recursion-safe helper returning the caller's CURRENT member_no (SECURITY
-- DEFINER, bypasses RLS — mirrors is_admin_uid). Used to enforce member_no
-- unchanged: during the UPDATE it reads the pre-update (old) value.
create or replace function profile_member_no_uid(p_uid uuid)
  returns text language sql security definer set search_path = public stable as $$
  select member_no from profiles where id = p_uid;
$$;

-- A member updates their OWN row, but the new row MUST have is_admin = false
-- (no self-escalation) AND member_no unchanged (no self re-linking). Admins are
-- unaffected: their self/other updates pass via "Admins can update all profiles"
-- (permissive policies OR their WITH CHECK), so admins keep is_admin.
drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = false
    and member_no is not distinct from profile_member_no_uid(auth.uid())
  );

-- "Admins can update all profiles" (the existing admin UPDATE policy) is kept
-- unchanged — admins legitimately set is_admin (0b linking) and self-update.
