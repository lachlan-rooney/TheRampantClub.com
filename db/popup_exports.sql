-- ═══════════════════════════════════════════════════════════════════════════
-- THE DOWNLOAD REGISTER
-- ───────────────────────────────────────────────────────────────────────────
-- A CSV of tonight's guests is the most portable copy of personal data this
-- system produces: names, addresses, and who said they would like to hear
-- from the club. Once it is on somebody's laptop it is beyond every control
-- in here. So the one thing that CAN be kept is an honest answer to "who took
-- a copy, and when" — and this table is that answer.
--
-- ⚠ THE EXPORT REFUSES TO RUN IF IT CANNOT WRITE HERE. An unrecorded download
--   of guest emails is exactly the thing this exists to prevent, so a failure
--   to record is a failure to export, not a warning beside a file that
--   downloaded anyway.
--
-- ⚠ NO ROW IS EVER UPDATED OR DELETED BY THE APPLICATION. It is append-only
--   by use, like activity_events. Nothing in the code path holds a DELETE.
--
-- Run once. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists popup_exports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references popup_events(id) on delete cascade,

  -- 'all'       — every booking on the evening
  -- 'consented' — only those who ticked the box AND have not unsubscribed
  kind text not null check (kind in ('all', 'consented')),

  -- How many guest rows left the building. A count of 0 is worth seeing: it
  -- usually means somebody exported before the evening rather than after.
  rows_out int not null default 0,

  -- ⚠ BOTH, AND ON PURPOSE. The id is the truth; the address is what survives
  --   the account being renamed, disabled or deleted, and is what a person
  --   reading this register a year from now can actually act on.
  by_id    uuid,
  by_email text,

  at timestamptz not null default now()
);

create index if not exists popup_exports_by_event on popup_exports (event_id, at desc);

alter table popup_exports enable row level security;
drop policy if exists "admins manage popup_exports" on popup_exports;
create policy "admins manage popup_exports" on popup_exports for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ── WHAT THE RUN SHEET SHOWS UNDER THE TWO BUTTONS ───────────────────────
-- The last dozen downloads, newest first, in the words the screen uses.
drop function if exists popup_export_log(uuid, int);
create function popup_export_log(p_event_id uuid, p_limit int default 12)
returns table (kind text, rows_out int, by_email text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.kind, e.rows_out, e.by_email, e.at
    from popup_exports e
   where e.event_id = p_event_id
   order by e.at desc
   limit greatest(1, least(coalesce(p_limit, 12), 100));
$$;

-- ⚠ SUPABASE GRANTS EXECUTE TO anon AND authenticated AT CREATE TIME, and a
--   `revoke … from public` does NOT take those away. Both are named.
revoke all on function popup_export_log(uuid, int) from public, anon, authenticated;

-- ── PROOF ─────────────────────────────────────────────────────────────────
do $$
declare v_ev uuid; v_n int;
begin
  select id into v_ev from popup_events where slug = 'palace-2026-11-13';
  if v_ev is null then raise exception 'the evening is missing — run db/popup_timed_entry.sql first'; end if;

  insert into popup_exports (event_id, kind, rows_out, by_id, by_email)
  values (v_ev, 'all', 3, null, 'verify@localhost') returning 1 into v_n;

  select count(*) into v_n from popup_export_log(v_ev, 12) where by_email = 'verify@localhost';
  if v_n <> 1 then raise exception 'the register did not read back its own row (got %)', v_n; end if;

  -- a kind nobody offers must be refused by the database, not only the screen
  begin
    insert into popup_exports (event_id, kind, rows_out) values (v_ev, 'everyone', 0);
    raise exception 'a bad kind was accepted';
  exception when check_violation then null;
  end;

  delete from popup_exports where by_email = 'verify@localhost';
  select count(*) into v_n from popup_exports where event_id = v_ev;
  raise notice 'popup_exports ready · % real download(s) recorded so far', v_n;
end $$;
