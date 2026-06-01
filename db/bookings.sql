-- Run once in the Supabase SQL editor, after db/mis_pass2_guardian.sql.
--
-- Bookings — pre-arranged member visits. Sit beside visits without
-- depending on them; a booking flips to 'arrived' and gains a
-- linked_visit_id when the member taps in (or staff manually starts the
-- visit from the calendar).
--
-- Either start_time OR session_label can be set (or both). Calendar UI
-- renders whichever the team filled in.

create table if not exists bookings (
  booking_id      uuid primary key default gen_random_uuid(),
  member_no       varchar(12) not null references members(member_no) on delete cascade,
  booking_date    date        not null,
  start_time      time,                                       -- optional precise time
  end_time        time,                                       -- optional precise end
  session_label   varchar(20),                                -- 'early' | 'evening' | 'late' | custom
  space           varchar(40) not null,                       -- Lounge / Library / Bar / Cigar Terrace / Private Dining
  party_size      int default 1 check (party_size between 1 and 50),
  notes           text,
  status          varchar(20) not null default 'confirmed'
                  check (status in ('pending','confirmed','arrived','cancelled','no_show')),
  linked_visit_id uuid references visits(visit_id) on delete set null,
  created_by      text,
  arrived_at      timestamptz,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_bookings_date         on bookings (booking_date, start_time nulls last);
create index if not exists idx_bookings_member       on bookings (member_no, booking_date desc);
create index if not exists idx_bookings_space        on bookings (space, booking_date desc);
create index if not exists idx_bookings_status_today on bookings (status, booking_date) where status in ('confirmed','pending');

alter table bookings enable row level security;

drop policy if exists "admin all on bookings" on bookings;
create policy "admin all on bookings" on bookings
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- ── Convenience view: bookings_with_member ────────────────────────────
create or replace view bookings_with_member as
select
  b.*,
  m.full_name      as member_name,
  m.nickname       as member_nickname,
  m.tier           as member_tier,
  m.status         as member_status
from bookings b
join members m on m.member_no = b.member_no;

grant select on bookings_with_member to authenticated;

-- ── RPC: start_visit_for_member ───────────────────────────────────────
-- Atomic tap-to-start. Called on NFC scan and from the calendar's
-- "Start visit" button. Creates a fresh visit at phase='overture' with
-- overture_generated_at stamped, links to today's confirmed booking if
-- there's exactly one match, and flips that booking to 'arrived'.
-- Returns the new visit_id and (optionally) the booking_id matched.

create or replace function start_visit_for_member(
  p_member_no  varchar(12),
  p_actor      text default null
) returns table (visit_id uuid, booking_id uuid)
language plpgsql
as $$
declare
  v_visit_id    uuid;
  v_booking_id  uuid;
  v_booking_count int;
begin
  -- Pick the single confirmed/pending booking for today, if exactly one.
  -- Ambiguous matches (multiple bookings) skip the link — staff resolve
  -- in the calendar.
  select count(*) into v_booking_count
    from bookings
    where member_no = p_member_no
      and booking_date = current_date
      and status in ('confirmed','pending');
  if v_booking_count = 1 then
    select booking_id into v_booking_id
      from bookings
      where member_no = p_member_no
        and booking_date = current_date
        and status in ('confirmed','pending')
      limit 1
      for update;
  end if;

  insert into visits (
    member_no, visit_date, phase,
    overture_generated_at,
    arrival_time,
    logged_by
  ) values (
    p_member_no, current_date, 'overture',
    now(),
    now(),
    p_actor
  ) returning visit_id into v_visit_id;

  if v_booking_id is not null then
    update bookings
      set status          = 'arrived',
          arrived_at      = now(),
          linked_visit_id = v_visit_id,
          updated_at      = now()
      where booking_id = v_booking_id;
  end if;

  return query select v_visit_id, v_booking_id;
end;
$$;

grant execute on function start_visit_for_member(varchar, text) to authenticated;
