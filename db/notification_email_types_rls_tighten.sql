-- Tidy-up: notification_email_types read policy was `using (true)`, so anon and
-- any authenticated member could read the notification-type config (type names +
-- email_enabled flags). Low sensitivity, but there's no reason a member/anon
-- should see it. Restrict client reads to admins.
--
-- Safe: every functional read of this table happens inside SECURITY DEFINER
-- SQL functions / triggers (ops_make_notification, the membership-finance and
-- task-due notification paths) or via the service role — all of which bypass
-- RLS. Only direct PostgREST client reads are affected, and the sole legitimate
-- client reader is the admin (newsletter/report/notification settings UIs).

drop policy if exists "email types read" on notification_email_types;
create policy "email types admin read"
  on notification_email_types
  for select
  to authenticated
  using (is_admin_uid(auth.uid()));
