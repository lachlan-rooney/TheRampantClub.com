-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE S2c — opt-in member directory  ·  REVIEW, then run (after S0/S2a/S2b)
-- ───────────────────────────────────────────────────────────────────────────
-- The ONLY new object. Discovery is consent-as-schema: a member appears in the
-- directory ONLY if they hold the 'discoverable' consent (member_consents — the
-- own-write toggle already exists from S0). SECURITY DEFINER so it can read across
-- profiles/consents, but it returns ONLY opted-in members — self excluded, blocked
-- pairs excluded (is_blocked_pair). An opted-OUT member is unreadable here; this is
-- not a client filter. Returns the raw palate vector — the short "sherried, peated"
-- signature is formatted in the route, no extra data leaves.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function member_directory()
  returns table (member_id uuid, display_name text, vector jsonb)
  language sql security definer set search_path = public stable as $$
  select p.id, p.display_name, coalesce(mtp.vector, '{}'::jsonb)
  from profiles p
  left join member_taste_profiles mtp on mtp.member_no = p.member_no
  where p.member_no is not null
    and p.id <> auth.uid()
    and has_consent(p.id, 'discoverable')
    and not is_blocked_pair(p.id, auth.uid());
$$;
