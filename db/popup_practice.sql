-- ═══════════════════════════════════════════════════════════════════════════
-- A PRACTICE EVENING.  12 November 2026, late.
-- ───────────────────────────────────────────────────────────────────────────
-- The real evening is unpublished, which is correct and which also means a
-- staff phone shows no sessions at all — so the first person handed one had
-- nothing to practise on. This gives her a whole evening to practise on,
-- labelled PRACTICE everywhere it appears, and wiped with one control.
--
-- ⚠ IT IS A REAL EVENT ROW, not a flag on the real one. Same tables, same
-- functions, same locks, same emails — the only difference is which row it
-- points at. A "practice mode" that took a different code path would be
-- rehearsing something other than Friday.
--
-- ⚠ AND A PHONE IS SWITCHED TO IT PER DEVICE, from the run sheet. Not an
-- environment variable, which would move every phone at once and need a
-- deploy; not a cookie, which the owner cannot set on somebody else's handset.
-- One phone can be practising while another is live.
--
-- Safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

-- ── WHICH EVENING THIS PHONE IS ON ────────────────────────────────────────
alter table kiosk_devices add column if not exists popup_slug text;
comment on column kiosk_devices.popup_slug is
  'Which pop-up evening this device is working on. NULL = the real one (POPUP_SLUG). '
  'Set to the practice slug from the run sheet to rehearse on a single handset '
  'without moving anybody else.';

-- ── SO EVERY SCREEN CAN SAY SO ────────────────────────────────────────────
alter table popup_events add column if not exists is_practice boolean not null default false;
comment on column popup_events.is_practice is
  'Shown as PRACTICE on every screen of every surface. It changes nothing else: '
  'the same functions, the same locks and the same real emails, because a rehearsal '
  'that behaves differently has not rehearsed anything.';

-- ── THE PRACTICE EVENING ──────────────────────────────────────────────────
insert into popup_events (
  slug, title_en, title_vn, venue_en, venue_vn, event_date,
  first_start, last_finish, session_minutes, changeover_minutes,
  default_cap, party_max, published, public_bookings, is_practice,
  admit_early_minutes, admit_late_minutes, reminder_lead_minutes
) values (
  'palace-practice',
  'PRACTICE — The Rampant Club pop-up',
  'TẬP DƯỢT — Pop-up của The Rampant Club',
  'Practice run', 'Buổi tập dượt',
  current_date, '18:00', '21:00', 15, 5,
  4, 2, true, false, true,
  10, 10, 10
) on conflict (slug) do update set
  published = true, is_practice = true, default_cap = 4, party_max = 2,
  bookings_paused = false;

-- ── ONE CONTROL: WIPE IT AND START AGAIN ──────────────────────────────────
-- Clears every practice booking and re-times the nine sessions to run from
-- the next twenty-minute mark, so the grid is always live enough to rehearse
-- on — some slots open, the current one admitting, the rest ahead.
--
-- ⚠ IT REFUSES TO TOUCH ANY EVENT THAT IS NOT MARKED is_practice. The one
-- thing this function must never be able to do is empty Friday.
drop function if exists popup_practice_reset();
create function popup_practice_reset()
returns table (ok boolean, bookings_removed int, sessions int, first_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_ev popup_events%rowtype;
  v_removed int := 0; v_n int := 0; v_base timestamptz; i int;
begin
  select e.* into v_ev from popup_events e where e.slug = 'palace-practice';
  if not found then
    return query select false, 0, 0, null::timestamptz; return;
  end if;
  if not v_ev.is_practice then
    raise exception 'refusing: % is not a practice event', v_ev.slug;
  end if;

  delete from popup_bookings b where b.event_id = v_ev.id;
  get diagnostics v_removed = row_count;
  delete from popup_messages m where m.event_id = v_ev.id;

  -- ⚠ THE FIRST SLOT MUST BE RUNNING RIGHT NOW, and the first version of this
  -- was not. It rounded down to the current TWENTY-minute block and started
  -- two minutes before it — so at 14:37 the first session ran 14:18–14:33 and
  -- had already finished. Anywhere past seventeen minutes into a block there
  -- was no live session at all, which is exactly what the verification caught.
  --
  -- Rounded to FIVE minutes instead: the base is then at most six minutes
  -- behind now (four from the rounding, two deliberate), so the first fifteen
  -- minute session always contains this moment, whatever the clock says.
  v_base := date_trunc('hour', now())
          + make_interval(mins => (floor(extract(minute from now()) / 5) * 5)::int)
          - interval '2 min';

  delete from popup_sessions s where s.event_id = v_ev.id;
  for i in 0..8 loop
    insert into popup_sessions (event_id, idx, starts_at, ends_at)
    values (v_ev.id, i,
            v_base + make_interval(mins => i * 20),
            v_base + make_interval(mins => i * 20 + 15));
    v_n := v_n + 1;
  end loop;

  return query select true, v_removed, v_n, v_base;
end $$;

revoke all on function popup_practice_reset() from public;
revoke all on function popup_practice_reset() from anon;
revoke all on function popup_practice_reset() from authenticated;
grant execute on function popup_practice_reset() to service_role;

commit;

-- ── PROVE IT ──────────────────────────────────────────────────────────────
do $v$
declare v_r record; v_ev uuid; v_real uuid; v_n int;
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'kiosk_devices' and column_name = 'popup_slug') then
    raise exception 'kiosk_devices.popup_slug was not added';
  end if;

  select e.id into v_ev from popup_events e where e.slug = 'palace-practice';
  if v_ev is null then raise exception 'the practice event was not created'; end if;

  select * into v_r from popup_practice_reset();
  if not v_r.ok or v_r.sessions <> 9 then
    raise exception 'the reset made % sessions, not 9', v_r.sessions;
  end if;

  -- the first slot is live, so the door has something to do.
  -- ⚠ IT SAYS WHAT IT FOUND. The first version raised a bare "no practice
  -- session is running right now", which is true and tells you nothing about
  -- why — the times it actually made are the whole diagnosis.
  if not exists (select 1 from popup_sessions s
                  where s.event_id = v_ev and s.starts_at <= now() and s.ends_at > now()) then
    raise exception 'no practice session is running right now (now %, sessions start %)',
      to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'),
      (select string_agg(to_char(s.starts_at at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'), ' ' order by s.idx)
         from popup_sessions s where s.event_id = v_ev);
  end if;

  -- ⚠ AND IT CANNOT TOUCH FRIDAY
  select e.id into v_real from popup_events e where e.slug = 'palace-2026-11-13';
  if v_real is not null then
    select count(*) into v_n from popup_sessions s where s.event_id = v_real;
    if v_n <> 9 then raise exception 'the real evening lost sessions: % left', v_n; end if;
    if (select e.published from popup_events e where e.id = v_real) then
      raise exception 'the real evening is published and must not be';
    end if;
  end if;

  raise notice 'popup_practice: device switch ✓ · practice evening ✓ · reset makes 9 live sessions ✓ · Friday untouched ✓';
end $v$;
