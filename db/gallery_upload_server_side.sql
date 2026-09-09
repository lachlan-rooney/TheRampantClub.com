-- ═══════════════════════════════════════════════════════════════════════════
-- GALLERY UPLOADS · CLOSE THE CLIENT-DIRECT PATH.  REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Run this AFTER the deploy that routes gallery uploads through the server
-- (/api/members/events/[id]/media/upload). Before that deploy lands, dropping
-- the member INSERT policy breaks member uploads.
--
-- WHY. The gallery uploaded straight from the browser to the event-media bucket
-- with `contentType: file.type` — the type the BROWSER declared — no check on
-- the bytes, and no EXIF strip. A member posting a photo taken at home published
-- their GPS coordinates to anyone who downloaded it.
--
-- The route now re-encodes every image with sharp, which strips all metadata and
-- proves the bytes decode as an image. It runs as the service role, which
-- BYPASSES RLS — so member INSERT on this bucket is no longer needed by anything,
-- and while it exists the old unchecked path is still open to any client holding
-- the anon key.
--
-- THE BUCKET STAYS PUBLIC, deliberately. Gallery photos are members sharing with
-- each other; a signed URL per thumbnail would be miserable. Public was never the
-- problem — unchecked content and retained EXIF were. Reads are untouched.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

do $close$
declare r record; v_dropped int := 0; v_manual text[] := '{}';
begin
  for r in
    select policyname, cmd
      from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) like '%event-media%'
  loop
    if r.cmd = 'INSERT' then
      execute format('drop policy %I on storage.objects', r.policyname);
      raise notice 'dropped INSERT policy: %', r.policyname;
      v_dropped := v_dropped + 1;
    elsif r.cmd = 'ALL' then
      -- NOT dropped automatically: an ALL policy also grants SELECT/UPDATE/DELETE,
      -- and removing it blind could take away more than the upload path. Named
      -- here so a person decides.
      v_manual := v_manual || r.policyname;
    end if;
  end loop;

  raise notice 'client-direct INSERT policies removed: %', v_dropped;
  if array_length(v_manual,1) > 0 then
    raise warning 'FOR-ALL policies referencing event-media were left in place and still permit direct upload: %',
      array_to_string(v_manual, ', ');
  end if;
end $close$;

-- ═══ SELF-CHECK ════════════════════════════════════════════════════════════
do $check$
declare v_left int;
begin
  select count(*) into v_left from pg_policies
   where schemaname='storage' and tablename='objects'
     and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) like '%event-media%'
     and cmd in ('INSERT','ALL');
  if v_left > 0 then
    raise warning 'SELF-CHECK: % policy/policies still allow a direct write to event-media — see the warning above.', v_left;
  else
    raise notice 'SELF-CHECK: no policy permits a client to write to event-media directly.';
  end if;
end $check$;

commit;
