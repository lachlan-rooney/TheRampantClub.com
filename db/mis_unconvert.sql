-- ─────────────────────────────────────────────────────────────────────────
-- MIS — the missing inverse of convert, + an atomic convert.
--
-- Context: a `members` row is created by convert (status Active) OR by
-- "Allocate provisional member no." (status Provisional). prospects link to
-- the member via prospects.converted_member_no (FK → members.member_no), and
-- prospects.stage is INDEPENDENT. Until now there was no way to UNDO an
-- allocate/convert: moving the prospect back to Lead left the members row +
-- the link in place (person in both tables at once — the TRC-M004 bug).
--
-- This file adds:
--   1. unconvert_prospect()  — the atomic inverse, WITH a safety guard so a
--      real Active member with data can NEVER be removed by this path.
--   2. convert_prospect()    — the existing convert, made atomic (one txn)
--      instead of 3-4 separate service-role calls.
--
-- Both are SECURITY DEFINER with a pinned search_path. A plpgsql function body
-- is one transaction: any RAISE rolls the whole thing back — no half-state.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. UN-CONVERT — delete the provisional member + null the link, atomically.
create or replace function unconvert_prospect(
  p_prospect_id text,
  p_actor       text default 'system'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_no text;
  v_stage     text;
  v_status    text;
  v_blocker   text;
begin
  -- 1. Load prospect + its link.
  select converted_member_no, stage
    into v_member_no, v_stage
    from prospects
   where prospect_id = p_prospect_id;
  if not found then
    raise exception 'prospect % not found', p_prospect_id;
  end if;
  if v_member_no is null then
    raise exception 'prospect % is not linked to a member — nothing to un-convert', p_prospect_id;
  end if;

  -- 2. Look up the member. A dangling link (member already gone) → just clear it.
  select status into v_status from members where member_no = v_member_no;
  if not found then
    update prospects
       set converted_member_no = null,
           stage = case when stage = 'Onboarded' then 'Lead' else stage end,
           updated_at = now()
     where prospect_id = p_prospect_id;
    return jsonb_build_object('ok', true, 'note', 'stale link cleared (member already absent)', 'member_no', v_member_no);
  end if;

  -- 3. SAFETY GUARD — status. Only Provisional / Pending-Signature may be removed.
  --    This is what makes the 3 real Active members un-touchable by this path.
  if v_status not in ('Provisional', 'Pending Signature') then
    raise exception 'refused: member % is status % — un-convert only removes Provisional / Pending-Signature members (this protects real members)', v_member_no, v_status;
  end if;

  -- 4. SAFETY GUARD — real data. If the member has accumulated ANY real
  --    membership data, refuse: it is no longer a throwaway provisional.
  v_blocker := null;
  if exists (select 1 from preferences            where member_no = v_member_no) then v_blocker := 'preferences';
  elsif exists (select 1 from visits              where member_no = v_member_no) then v_blocker := 'visits';
  elsif exists (select 1 from validation_events   where member_no = v_member_no) then v_blocker := 'validation_events';
  elsif exists (select 1 from harmony_observations where member_no = v_member_no) then v_blocker := 'harmony_observations';
  elsif exists (select 1 from preference_candidates where member_no = v_member_no) then v_blocker := 'preference_candidates';
  elsif exists (select 1 from bookings            where member_no = v_member_no) then v_blocker := 'bookings';
  elsif exists (select 1 from gifting             where member_no = v_member_no) then v_blocker := 'gifting';
  end if;
  if v_blocker is not null then
    raise exception 'refused: member % has rows in % — has real data, will not auto-remove', v_member_no, v_blocker;
  end if;

  -- 5. Null the FK link FIRST (the FK demands link-null before member-delete),
  --    and revert the stage if convert had pushed it to Onboarded.
  update prospects
     set converted_member_no = null,
         stage = case when stage = 'Onboarded' then 'Lead' else stage end,
         updated_at = now()
   where prospect_id = p_prospect_id;

  -- 6. Unlink any signing invitation (nullable FK, no on-delete → would block
  --    the delete for a Pending-Signature member). Row kept for audit.
  update signing_invitations
     set member_no = null
   where member_no = v_member_no;

  -- 7. Delete the now-unreferenced member.
  delete from members where member_no = v_member_no;

  -- 8. Audit — symmetric with how convert logs 'converted'.
  insert into prospect_activity (prospect_id, actor, event_type, from_value, to_value, note)
  values (p_prospect_id, p_actor, 'unconverted', v_member_no, null,
          format('Removed provisional member %s and returned prospect to Lead.', v_member_no));

  return jsonb_build_object('ok', true, 'removed_member_no', v_member_no, 'prospect_id', p_prospect_id);
end;
$$;

grant execute on function unconvert_prospect(text, text) to authenticated, service_role;


-- ── 2. CONVERT — the existing behaviour, made atomic (one transaction).
--    Same writes as the old multi-call route; just all-or-nothing now.
create or replace function convert_prospect(
  p_prospect_id text,
  p_tier        text,
  p_nickname    text default null,
  p_actor       text default 'system'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_no text;
  v_prospect  prospects%rowtype;
  v_nick      text;
  v_today     date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if p_tier not in ('Founding', 'Legacy', 'Pioneer', 'Corporate', 'Honorary') then
    raise exception 'invalid tier %', p_tier;
  end if;

  select * into v_prospect from prospects where prospect_id = p_prospect_id;
  if not found then
    raise exception 'prospect % not found', p_prospect_id;
  end if;

  v_nick := coalesce(nullif(p_nickname, ''), v_prospect.nickname);

  if v_prospect.converted_member_no is not null then
    -- Flip the existing provisional member to Active.
    v_member_no := v_prospect.converted_member_no;
    update members
       set status = 'Active', tier = p_tier, nickname = v_nick
     where member_no = v_member_no;
  else
    -- Mint a fresh member_no and create the Active row.
    v_member_no := mint_member_no();
    insert into members (member_no, full_name, nickname, tier, status, join_date, referred_by)
    values (v_member_no, v_prospect.full_name, v_nick, p_tier, 'Active', v_today, v_prospect.referred_by_name);
  end if;

  update prospects
     set stage = 'Onboarded',
         decision = 'Approved',
         decision_date = v_today,
         converted_member_no = v_member_no,
         updated_at = now()
   where prospect_id = p_prospect_id;

  insert into prospect_activity (prospect_id, actor, event_type, to_value, note)
  values (p_prospect_id, p_actor, 'converted', v_member_no, format('Converted to %s member %s.', p_tier, v_member_no));

  return jsonb_build_object('ok', true, 'member_no', v_member_no, 'tier', p_tier);
end;
$$;

grant execute on function convert_prospect(text, text, text, text) to authenticated, service_role;
