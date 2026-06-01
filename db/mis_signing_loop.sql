-- Run once in the Supabase SQL editor, after db/mis_prospects.sql.
--
-- Wires the signing flow into the MIS pipeline. signing_invitations already
-- existed; we add nullable FKs so an invitation can trace back to the prospect
-- and the provisional member it was issued for.
--
-- After a prospect signs (via /api/sign), the existing route will look up
-- these columns and flip:
--   - members.status: 'Pending Signature' → 'Active', members.join_date = today
--   - prospects.stage: → 'Onboarded', decision = 'Approved', decision_date = today

alter table signing_invitations
  add column if not exists member_no   varchar(12) references members(member_no),
  add column if not exists prospect_id varchar(20) references prospects(prospect_id);

create index if not exists idx_signing_invitations_member   on signing_invitations (member_no);
create index if not exists idx_signing_invitations_prospect on signing_invitations (prospect_id);
