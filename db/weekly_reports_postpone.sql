-- Weekly report — emergency send postponement. Run once in the Supabase SQL editor.
--
-- When set, the auto-send cron holds the report until this time (capped at
-- 21:00 VN by the app). The send-window cron runs hourly 17:00–21:00 VN Monday
-- and dispatches the current version once send_postponed_to has passed.
alter table weekly_reports add column if not exists send_postponed_to timestamptz;
