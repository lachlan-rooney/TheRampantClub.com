-- Run once in the Supabase SQL editor, after db/mis_pass1.sql and
-- db/mis_pass2_validations.sql.
--
-- Switches visit "delete" to a soft archive so the audit trail is preserved.
-- Same pattern as preferences.status — but using a timestamp column here
-- because every archive event is interesting on its own.
--
-- Important: member_stats has to be replaced to exclude archived rows,
-- otherwise an archived visit would still inflate avg_visits_per_month
-- (and therefore M) for that member.

alter table visits
  add column if not exists archived_at timestamptz;

create index if not exists idx_visits_active
  on visits (member_no, visit_date)
  where archived_at is null;

-- ── member_stats — same column shape, just filtering archived rows ──
-- preference_scores depends on this view via a join; the column list is
-- identical so CREATE OR REPLACE works without touching preference_scores.

create or replace view member_stats as
select
  m.member_no,
  count(v.visit_id)                                                  as total_visits,
  max(v.visit_date)                                                  as last_visit,
  (current_date - max(v.visit_date))                                 as days_since_visit,
  case
    when m.join_date is null or count(v.visit_id) = 0 then null
    else count(v.visit_id)::numeric
         / greatest((current_date - m.join_date)::numeric / 30.44, 1)
  end                                                                as avg_visits_per_month
from members m
left join visits v
  on v.member_no   = m.member_no
 and v.archived_at is null
group by m.member_no, m.join_date;
