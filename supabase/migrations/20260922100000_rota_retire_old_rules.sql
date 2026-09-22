-- =====================================================================
--  ROTA — THE OLD RULES, RETIRED
--  Migration: 20260922100000_rota_retire_old_rules.sql
--  Safe to re-run.
-- =====================================================================
--
--  The owner, 22 September: "get rid of all old rules". The new rota rules
--  (S1–S4, 40 weekly hours, two rest days, a close to 00:30) went live the
--  same day in lib/rota/policy.ts. The DATA the old rules left behind was
--  removed directly the same day — the Open and Close shift types, their
--  coverage targets, the switched-off demand rules, and every person's old
--  settings. Its values are kept in THE WAY BACK below.
--
--  This file is the STRUCTURE, which only SQL can change:
--    1. The database refused anyone having BOTH Saturday and Sunday as fixed
--       days off — the old "never both weekend days" rule. Under the new rules
--       three of the six cycle lines have the whole weekend off by design. The
--       check that each entry is a real weekday stays.
--    2. Four columns nothing reads any more: morning_weekday (the fixed office
--       day), always_shift (Mr Sĩ always closing), rota_partner (the
--       fortnightly shared day off), works_evenings (never read by any code).
--       No database function references any of them — checked before writing.
--    3. rota_scaling_rules, the demand rules switched off on 14 September and
--       read by nothing since.
--    4. weekly_hours was described as "Contracted hours per week". The
--       employment agreements state no working hours ("Theo yêu cầu của công
--       việc"), so the description was wrong, and it is replaced.
--
--  Past rota rows are NOT touched. rota_shifts.shift_name is a snapshot, not
--  a foreign key, so every historical Open and Close row keeps its name and
--  its times — that history is the record of what was rostered.
-- =====================================================================

-- 1. Fixed days off: real weekdays, any combination.
alter table team_members drop constraint if exists team_members_fixed_days_off_valid;
alter table team_members add constraint team_members_fixed_days_off_valid
  check (fixed_days_off is null or fixed_days_off <@ array[0,1,2,3,4,5,6]::smallint[]);

-- 2. The columns the old rules read. Dropping a column drops its checks too.
alter table team_members drop column if exists morning_weekday;
alter table team_members drop column if exists always_shift;
alter table team_members drop column if exists rota_partner;
alter table team_members drop column if exists works_evenings;

-- 3. The switched-off demand rules.
drop table if exists rota_scaling_rules;

-- 4. What weekly_hours actually is.
comment on column team_members.weekly_hours is
  'The rota''s weekly hours for this person: 40 under the rules of 2026-09-22. '
  'A Company rota rule, not a term of the employment agreement, which states no hours. '
  'NULL = not on the floor rota.';

-- =====================================================================
--  CHECK:
--    select column_name from information_schema.columns
--     where table_name = 'team_members'
--       and column_name in ('morning_weekday','always_shift','rota_partner','works_evenings');
--      → no rows
--    select to_regclass('public.rota_scaling_rules');           → null
--    update team_members set fixed_days_off = array[0,6]::smallint[]
--     where false;                                               → accepted
-- =====================================================================
--
--  THE WAY BACK — the values as they stood on 2026-09-22, before removal.
--  Re-add the columns first (db/rota_policy.sql, db/rota_partners.sql,
--  db/rota_cleaning.sql define them), then:
--
--   insert into rota_shift_types (name, sort_order, start_time, end_time, hours, break_minutes, weekdays) values ('Open', 0, '14:00:00', '22:00:00', 8, 0, null);
--   insert into rota_shift_types (name, sort_order, start_time, end_time, hours, break_minutes, weekdays) values ('Close', 2, '15:00:00', '00:00:00', 9, 0, null);
--   insert into rota_coverage_targets (shift_name, function, count) values ('Open', 'floor', 1);
--   insert into rota_coverage_targets (shift_name, function, count) values ('Close', 'floor', 1);
--   insert into rota_coverage_targets (shift_name, function, count) values ('Close', 'bar', 1);
--   insert into rota_coverage_targets (shift_name, function, count) values ('Close', 'host', 1);
--   update team_members set morning_weekday = null, always_shift = null, rota_partner = null, works_evenings = false, fixed_days_off = null where id = 'c0122133-a2b9-4aea-a2b7-ec60cd04a93f';  -- Mr Van
--   update team_members set morning_weekday = null, always_shift = null, rota_partner = null, works_evenings = false, fixed_days_off = null where id = '45e7a0e2-b237-4257-b69d-6fc612cbf3b1';  -- Miss Lan
--   update team_members set morning_weekday = null, always_shift = null, rota_partner = null, works_evenings = false, fixed_days_off = null where id = 'fb956c46-ae33-4af6-a6bb-493545e3f7c1';  -- Miss Chau
--   update team_members set morning_weekday = 3, always_shift = null, rota_partner = '2eabfe2f-6add-4aed-a94f-7f29ac9061e6', works_evenings = true, fixed_days_off = array[0]::smallint[] where id = 'cae8739d-6dda-4dfd-af59-23d1a43627be';  -- Hiếu
--   update team_members set morning_weekday = 4, always_shift = null, rota_partner = null, works_evenings = true, fixed_days_off = null where id = '1cb5ac3f-8ebd-4c1d-983b-432e82c72766';  -- Nhi
--   update team_members set morning_weekday = 5, always_shift = null, rota_partner = 'cae8739d-6dda-4dfd-af59-23d1a43627be', works_evenings = true, fixed_days_off = null where id = '2eabfe2f-6add-4aed-a94f-7f29ac9061e6';  -- Bình
--   update team_members set morning_weekday = 1, always_shift = 'Close', rota_partner = null, works_evenings = true, fixed_days_off = null where id = 'e9e3a307-cbe6-4e2f-bf9f-4319a1d24b34';  -- Mr Sĩ
--   update team_members set morning_weekday = 2, always_shift = null, rota_partner = null, works_evenings = true, fixed_days_off = null where id = 'f32db273-8cf7-44b3-858b-87c82f8beb68';  -- Tiên
--
--  rota_scaling_rules (recreate from db/rota_coverage.sql), rows as they stood:
--   (trigger_type, threshold, function, delta, active, sort_order)
--   ('day_covers', 24, 'bar', 1, false, 2)
--   ('event_present', 0, 'host', 1, false, 1)
--   ('session_covers', 12, 'floor', 1, false, 0)
