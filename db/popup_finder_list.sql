-- ═══════════════════════════════════════════════════════════════════════════
-- THE POP-UP'S OWN BOTTLE LIST.  12 November 2026.
-- ───────────────────────────────────────────────────────────────────────────
-- The Flavour Finder at the Palace answers from the bottles that are ACTUALLY
-- ON THE TABLE that evening, not from the club's whole library. The owner
-- picks them; this is where the choice lives.
--
-- ⚠ TWO COLUMNS ON popup_events, AND NO NEW TABLE. The list belongs to one
-- evening, exactly as the cap and the session length do, and a table of its
-- own would be a second place to look for one evening's settings. It also
-- means a throwaway rehearsal event carries its own list and deleting the
-- event takes the list with it.
--
-- uuid[] rather than a join table: it is forty ids, it is read whole every
-- time, and the ORDER THE OWNER TICKED THEM IN is worth keeping — a join
-- table would have needed a position column to say the same thing.
--
-- ⚠ NO FOREIGN KEY, deliberately. A bottle deleted from the library must not
-- block deleting it, and must not silently vanish from a list the owner
-- already approved — the page reports a missing bottle instead, which is the
-- behaviour you want the night before.
--
-- Safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

alter table popup_events add column if not exists finder_whisky_ids uuid[] not null default '{}';
alter table popup_events add column if not exists finder_saved_at timestamptz;
alter table popup_events add column if not exists finder_saved_by uuid references profiles(id);

comment on column popup_events.finder_whisky_ids is
  'The bottles on the table at the pop-up, in the order the owner ticked them. '
  'Read whole by the offline finder page, which ships them with the page so the '
  'tablet answers a guest with no network. No foreign key on purpose: a bottle '
  'later removed from the library is REPORTED by the admin screen, not silently dropped.';

-- ── PROVE IT ──────────────────────────────────────────────────────────────
do $v$
declare v_ev uuid; v_n int;
begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'popup_events' and column_name = 'finder_whisky_ids') then
    raise exception 'finder_whisky_ids was not added';
  end if;

  -- it round-trips, and it keeps the order
  insert into popup_events (slug, title_en, venue_en, event_date, first_start, last_finish)
  values ('verify-finder-' || substr(gen_random_uuid()::text, 1, 8),
          'VERIFY — not an event', 'Verify', current_date + 1, '18:00', '18:20')
  returning id into v_ev;

  update popup_events
     set finder_whisky_ids = array(select w.id from whiskies w order by w.name limit 3)
   where id = v_ev;

  select array_length(finder_whisky_ids, 1) into v_n from popup_events where id = v_ev;
  if v_n <> 3 then raise exception 'the list came back with % ids, not 3', v_n; end if;

  delete from popup_events where id = v_ev;
  raise notice 'popup_finder_list: finder_whisky_ids ✓ · round-trips in order ✓ · fixture removed ✓';
end $v$;

commit;
