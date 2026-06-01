-- Flip every public view to security_invoker = true.
--
-- Postgres default for views is SECURITY DEFINER semantics: the view runs
-- with the permissions of its CREATOR (typically postgres), bypassing the
-- calling user's RLS on the underlying tables. Supabase's security advisor
-- flags every such view as CRITICAL because an authenticated-but-non-admin
-- user querying the view can read past the RLS we put on the base tables.
--
-- Setting security_invoker = true makes the view run with the CALLING
-- user's permissions, so the base-table RLS is honoured per query. This is
-- the correct posture for every view in this project — none of them are
-- intentional admin-bypass surfaces; they're all just denormalisations.
--
-- Idempotent. Safe to re-run. No data is touched, no view is dropped — only
-- the runtime privilege model changes. After applying, the Supabase
-- advisor's CRITICAL list for "Security Definer View" should clear.

alter view public.bookings_with_member      set (security_invoker = true);
alter view public.harmony_logs_with_counts  set (security_invoker = true);
alter view public.lockers_with_member       set (security_invoker = true);
alter view public.last_continuum_note       set (security_invoker = true);
alter view public.member_gifting_summary    set (security_invoker = true);
alter view public.member_stats              set (security_invoker = true);
alter view public.preference_scores         set (security_invoker = true);
alter view public.prospects_with_score      set (security_invoker = true);
alter view public.v_decay_confirmations     set (security_invoker = true);
alter view public.v_decay_contradictions    set (security_invoker = true);
alter view public.v_decay_live_exposure     set (security_invoker = true);

-- Verify — every public view should now show option 'security_invoker=true'.
select
  schemaname,
  viewname,
  case when 'security_invoker=true' = any(reloptions) then 'invoker' else 'definer (FIX NEEDED)' end as posture
from pg_views v
join pg_class c on c.relname = v.viewname and c.relkind = 'v'
where schemaname = 'public'
order by posture desc, viewname;
