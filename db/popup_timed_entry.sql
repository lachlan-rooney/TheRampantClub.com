-- ═══════════════════════════════════════════════════════════════════════════
-- TIMED ENTRY — the pop-up at Independence Palace, Fri 13 Nov 2026, 18:00–21:00
--                                                   Run this whole file ONCE.
-- ───────────────────────────────────────────────────────────────────────────
-- Supabase SQL editor, paste the lot, run. It installs five tables and six
-- functions, seeds the real evening's event with nine sessions, and PUBLISHES
-- NOTHING: no guest can reach it until a human presses Publish.
--
-- ══ HOW A PLACE IS TAKEN ══════════════════════════════════════════════════
-- Guests sign up ON THE CLUB'S OWN TABLET, at the stand, with staff beside
-- them. Nobody pre-books. So every booking is made by a person standing in a
-- crowd being told, out loud, that they have a place — which is the whole
-- reason the count is taken under a row lock and never in the browser.
--
-- popup_book() takes `for update` on the SESSION before it counts anything.
-- Two guests reaching for the last place cannot both be told yes: the second
-- waits, re-reads, and is offered the next session with room.
--
-- ══ THE CAP IS ADVISORY. A TICKET IS A PROMISE. ═══════════════════════════
-- The cap can move at any moment, including mid-evening, from 4 to 12. Raising
-- it promotes the waiting list at once. LOWERING IT CANCELS NOBODY: the
-- session is simply marked over capacity, and the owner decides who moves. The
-- DOOR NEVER CONSULTS THE CAP — a confirmed booking scans valid even if the
-- number under it has since changed. A promise made to a guest standing in
-- front of staff is not undone by an admin typing a smaller number.
--
-- ══ WHAT IS DELIBERATELY NULLABLE ═════════════════════════════════════════
-- `email`. A tablet in a crowd produces typos, and a booking must never be
-- lost to one. A guest who gives no address, or a wrong one, still has a
-- place, still appears on the door list, and still gets in by name. The email
-- carries a convenience (the QR), never the entitlement.
--
-- ══ AND WHAT ANON CAN READ ════════════════════════════════════════════════
-- Nothing. anon and authenticated are granted NOTHING on these tables. The one
-- public door is popup_public(), whose return type has no name, no email and
-- no ticket code in it — only how many places are left. There is nothing to
-- leak because there is nothing readable.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

-- ── THE EVENT, AND EVERY SETTING ──────────────────────────────────────────
-- Settings live ON THE EVENT, not in one global row. That is what lets a
-- throwaway rehearsal event sit beside the real one with its own session
-- length, its own cap and its own published flag, and be deleted afterwards
-- without touching a thing. A single settings row would have meant rehearsing
-- against the live evening's numbers.
create table if not exists popup_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_vn text,
  venue_en text not null,
  venue_vn text,
  event_date date not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',

  -- ── THE GRID ────────────────────────────────────────────────────────────
  session_minutes    int not null default 15 check (session_minutes between 5 and 240),
  changeover_minutes int not null default 5  check (changeover_minutes between 0 and 120),
  first_start        time not null default '18:00',
  last_finish        time not null default '21:00',

  -- ── CAPACITY ────────────────────────────────────────────────────────────
  -- Bookings open at four. One control moves every session; a session may
  -- still override it (popup_sessions.cap_override).
  default_cap int not null default 4  check (default_cap between 1 and 200),
  party_max   int not null default 2  check (party_max between 1 and 50),

  -- ── THE DOOR ────────────────────────────────────────────────────────────
  admit_early_minutes int not null default 10 check (admit_early_minutes >= 0),
  admit_late_minutes  int not null default 10 check (admit_late_minutes >= 0),
  allow_late_move     boolean not null default true,

  -- ── THE TWO SWITCHES, SEPARATE ON PURPOSE ───────────────────────────────
  -- `published` opens the evening to staff and the door. `public_bookings`
  -- opens the phone page to the world, and starts OFF: the tablet is the way
  -- in, and the owner decides if that ever changes.
  published        boolean not null default false,
  public_bookings  boolean not null default false,
  bookings_paused  boolean not null default false,

  -- ── "YOUR SESSION STARTS IN TEN MINUTES" ────────────────────────────────
  -- Not a morning reminder: with sign-up on the night there is nobody to send
  -- one to. Never sent for a session already started or a booking cancelled.
  reminder_lead_minutes int not null default 10 check (reminder_lead_minutes between 0 and 240),

  -- ── THE FOLLOW-UP, the morning after ────────────────────────────────────
  -- ⚠ THE COPY IS THE OWNER'S AND IS NOT WRITTEN HERE. These columns are
  -- empty on purpose: the two drafts had not arrived when this file was
  -- written, and composing them would have put my words in the club's mouth.
  -- Nothing sends until followup_approved_at is set from the admin.
  followup_send_at     timestamptz,
  followup_subject_en  text,
  followup_subject_vn  text,
  followup_full_en     text,   -- for guests who ticked the consent box
  followup_full_vn     text,
  followup_plain_en    text,   -- a plain thank-you for those who did not
  followup_plain_vn    text,
  membership_contact   text,
  followup_approved_at timestamptz,
  followup_approved_by uuid references profiles(id),
  followup_sent_at     timestamptz,

  created_at timestamptz not null default now()
);

-- ── A SESSION ─────────────────────────────────────────────────────────────
-- Generated from the settings by popup_generate_sessions(), never typed.
create table if not exists popup_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references popup_events(id) on delete cascade,
  idx int not null,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,

  -- Null means "whatever the event's cap is". A number here overrides it for
  -- this session alone.
  cap_override int check (cap_override is null or cap_override between 1 and 200),

  -- Closed by hand if a session has to be taken out of service.
  closed boolean not null default false,

  created_at timestamptz not null default now(),
  unique (event_id, idx),
  check (ends_at > starts_at)
);
create index if not exists popup_sessions_when on popup_sessions (event_id, starts_at);

-- ── A BOOKING ─────────────────────────────────────────────────────────────
create table if not exists popup_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id   uuid not null references popup_events(id) on delete cascade,
  session_id uuid not null references popup_sessions(id) on delete cascade,

  name text not null,
  -- ⚠ NULLABLE, AND THAT IS THE DESIGN. See the header: a typo on a tablet
  -- must not cost a guest their place, and staff can add a guest who would
  -- rather just give a name.
  email text,
  email_key text,
  party_size int not null default 1 check (party_size between 1 and 50),

  status text not null default 'confirmed'
         check (status in ('confirmed','waiting','cancelled')),

  -- THE TICKET. Eight hex characters: unguessable enough on its own, and
  -- typeable by a member of staff when a camera will not focus. 0-9 A-F has
  -- no O/I/L to misread. The HMAC signature that makes the QR tamper-proof is
  -- added by the application, which holds the secret; this is the thing it
  -- signs.
  ticket_code text not null,

  -- ⚠ THE IDEMPOTENCY KEY, and the reason a retry is safe. A request that
  -- times out may have SUCCEEDED. Without this, the tablet retrying would
  -- book the same guest twice and take two places. With it, a retry carrying
  -- the same attempt returns the original answer.
  attempt_id uuid,

  lang text not null default 'en' check (lang in ('en','vn')),
  source text not null default 'kiosk' check (source in ('kiosk','public','staff','door')),

  -- "I'd like to hear from The Rampant Club after tonight." Unticked by
  -- default, and it decides ONE thing: which of the two follow-up emails they
  -- receive. It never affects whether they get a place.
  consent_marketing boolean not null default false,
  -- The exact sentence that was on the screen. A consent record that cannot
  -- say what was agreed to is not evidence of anything.
  terms_text text,

  -- The door.
  admitted_at timestamptz,
  admitted_by text,
  admitted_offline boolean not null default false,

  -- Email state. A failure is recorded, never silent, and never costs a place.
  confirmation_sent_at timestamptz,
  reminder_sent_at     timestamptz,
  followup_sent_at     timestamptz,

  waiting_since timestamptz,
  promoted_at   timestamptz,
  moved_at      timestamptz,
  cancelled_at  timestamptz,
  cancel_reason text,

  device_hash text,
  created_at timestamptz not null default now(),

  unique (event_id, ticket_code)
);

-- ⚠ PARTIAL, ON BOTH COUNTS. Unique per event, only while the booking is
-- live, and only when there IS an address — a dozen staff-added guests with
-- no email must not collide with each other.
create unique index if not exists popup_bookings_one_per_email
  on popup_bookings (event_id, email_key)
  where email_key is not null and status in ('confirmed','waiting');

-- A retry must find its own earlier attempt.
create unique index if not exists popup_bookings_attempt
  on popup_bookings (event_id, attempt_id) where attempt_id is not null;

create index if not exists popup_bookings_session on popup_bookings (session_id, status, created_at);
create index if not exists popup_bookings_event on popup_bookings (event_id, created_at desc);

-- ── UNSUBSCRIBES ──────────────────────────────────────────────────────────
-- One click in the follow-up, recorded here, honoured by every later send.
-- ⚠ THIS IS NOT YET THE CLUB-WIDE SUPPRESSION LIST. newsletter_settings has a
-- `suppress` field of its own, and merging the two is a decision for the
-- owner rather than something to do quietly in a schema file.
create table if not exists popup_unsubscribes (
  email_key text primary key,
  event_id uuid references popup_events(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── WHAT WAS SENT TO A WHOLE SESSION ──────────────────────────────────────
-- "We are running ten minutes late." Recorded so a second message does not
-- repeat the first, and so the owner can see what guests were actually told.
create table if not exists popup_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references popup_events(id) on delete cascade,
  session_id uuid references popup_sessions(id) on delete set null,
  scope text not null check (scope in ('session','evening')),
  body_en text not null,
  body_vn text,
  sent_count int not null default 0,
  failed_count int not null default 0,
  sent_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ═══ RLS — DENY EVERYTHING, THEN LET ADMINS IN ════════════════════════════
-- No public policy on any of the five. The public shape comes from
-- popup_public() below, and that function chooses the columns.
alter table popup_events      enable row level security;
alter table popup_sessions    enable row level security;
alter table popup_bookings    enable row level security;
alter table popup_unsubscribes enable row level security;
alter table popup_messages    enable row level security;

do $pol$
declare t text;
begin
  foreach t in array array['popup_events','popup_sessions','popup_bookings','popup_unsubscribes','popup_messages'] loop
    execute format('drop policy if exists "admins manage %1$s" on %1$s', t);
    execute format($p$create policy "admins manage %1$s" on %1$s for all
      using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
      with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))$p$, t);
  end loop;
end $pol$;

-- ═══ GENERATING THE GRID ══════════════════════════════════════════════════
-- 15 + 5 from 18:00 gives nine sessions every 20 minutes, 18:00 to 20:40, the
-- last ending 20:55.
--
-- ⚠ IT REFUSES ONCE ANYBODY HAS BOOKED. Regenerating under a guest would move
-- the time they were promised out loud. Change the settings before you
-- publish, or move people by hand afterwards — never both.
create or replace function popup_generate_sessions(p_event_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_ev popup_events%rowtype;
  v_start timestamptz;
  v_end_limit timestamptz;
  v_step int;
  v_i int := 0;
  v_n int := 0;
begin
  select * into v_ev from popup_events where id = p_event_id;
  if not found then raise exception 'no such event'; end if;

  if exists (select 1 from popup_bookings b where b.event_id = p_event_id
              and b.status in ('confirmed','waiting')) then
    raise exception 'REFUSING: this event already has bookings'
      using hint = 'Regenerating would move a time a guest has already been told. Move people by hand instead.';
  end if;

  delete from popup_sessions where event_id = p_event_id;

  v_step := v_ev.session_minutes + v_ev.changeover_minutes;
  v_start := (v_ev.event_date + v_ev.first_start) at time zone v_ev.timezone;
  v_end_limit := (v_ev.event_date + v_ev.last_finish) at time zone v_ev.timezone;

  while v_start + make_interval(mins => v_ev.session_minutes) <= v_end_limit loop
    insert into popup_sessions (event_id, idx, starts_at, ends_at)
    values (p_event_id, v_i, v_start, v_start + make_interval(mins => v_ev.session_minutes));
    v_i := v_i + 1;
    v_n := v_n + 1;
    v_start := v_start + make_interval(mins => v_step);
  end loop;

  return v_n;
end $$;

-- ═══ THE PUBLIC SHAPE ═════════════════════════════════════════════════════
-- Everything a guest (or the tablet) is allowed to know. No name, no email, no
-- ticket code, no party sizes — only when a session is and how many places are
-- left. Sessions ALREADY STARTED ARE NOT RETURNED: the list always opens on
-- the next one with room.
drop function if exists popup_public(text);
create function popup_public(p_slug text)
returns table (
  session_id uuid,
  idx int,
  starts_at timestamptz,
  ends_at timestamptz,
  cap int,
  taken int,
  places_left int,
  is_full boolean,
  closed boolean,
  waiting int,
  party_max int,
  bookings_paused boolean
)
language sql security definer set search_path = public stable as $$
  select
    s.id, s.idx, s.starts_at, s.ends_at,
    coalesce(s.cap_override, e.default_cap) as cap,
    coalesce(t.taken, 0)::int               as taken,
    greatest(coalesce(s.cap_override, e.default_cap) - coalesce(t.taken, 0), 0)::int as places_left,
    coalesce(t.taken, 0) >= coalesce(s.cap_override, e.default_cap) as is_full,
    s.closed,
    coalesce(w.waiting, 0)::int as waiting,
    e.party_max,
    e.bookings_paused
  from popup_events e
  join popup_sessions s on s.event_id = e.id
  left join lateral (
    select sum(b.party_size) as taken from popup_bookings b
     where b.session_id = s.id and b.status = 'confirmed'
  ) t on true
  left join lateral (
    select sum(b.party_size) as waiting from popup_bookings b
     where b.session_id = s.id and b.status = 'waiting'
  ) w on true
  where e.slug = p_slug
    and e.published
    and s.starts_at > now()
  order by s.starts_at;
$$;

revoke all on function popup_public(text) from public;
grant execute on function popup_public(text) to anon, authenticated, service_role;

-- ═══ TAKING A PLACE ═══════════════════════════════════════════════════════
-- Reasons: no_session · not_published · paused · closed · started · too_big ·
--          duplicate · full
--
-- ⚠ THE LOCK IS THE WHOLE POINT. `for update` on the SESSION is taken before
-- the count is read, so two tablets — or a tablet and a phone — cannot both be
-- told yes for the last place.
--
-- On `duplicate` it returns the CLASHING session's start, so the tablet can
-- say "This email already has a place at HH:MM" rather than a bare refusal.
drop function if exists popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean);
create function popup_book(
  p_event_id uuid,
  p_session_id uuid,
  p_name text,
  p_email text,
  p_party int,
  p_lang text,
  p_consent boolean,
  p_terms text,
  p_source text,
  p_attempt uuid,
  p_allow_waiting boolean default true
)
returns table (
  ok boolean, reason text, booking_id uuid, status text, ticket_code text,
  session_id uuid, starts_at timestamptz, places_left int
)
language plpgsql security definer set search_path = public as $$
declare
  v_ev popup_events%rowtype;
  v_s  popup_sessions%rowtype;
  v_cap int; v_taken int; v_left int;
  v_key text; v_code text; v_id uuid; v_status text;
  v_clash popup_bookings%rowtype;
  v_prev popup_bookings%rowtype;
begin
  v_key := nullif(lower(btrim(coalesce(p_email, ''))), '');

  -- ── 0 · HAVE WE ALREADY ANSWERED THIS EXACT ATTEMPT? ──────────────────
  -- The retry path. Returned before any lock is taken, because the work is
  -- already done.
  if p_attempt is not null then
    select * into v_prev from popup_bookings
      where event_id = p_event_id and attempt_id = p_attempt;
    if found then
      select * into v_s from popup_sessions where id = v_prev.session_id;
      return query select true, null::text, v_prev.id, v_prev.status, v_prev.ticket_code,
                          v_prev.session_id, v_s.starts_at, null::int;
      return;
    end if;
  end if;

  select * into v_ev from popup_events where id = p_event_id;
  if not found then
    return query select false, 'no_session', null::uuid, null::text, null::text, null::uuid, null::timestamptz, null::int; return;
  end if;
  if not v_ev.published then
    return query select false, 'not_published', null::uuid, null::text, null::text, null::uuid, null::timestamptz, null::int; return;
  end if;
  if v_ev.bookings_paused then
    return query select false, 'paused', null::uuid, null::text, null::text, null::uuid, null::timestamptz, null::int; return;
  end if;

  -- ── 1 · ONE BOOKING PER ADDRESS, and say where the other one is ───────
  if v_key is not null then
    select * into v_clash from popup_bookings
      where event_id = p_event_id and email_key = v_key and status in ('confirmed','waiting')
      limit 1;
    if found then
      select * into v_s from popup_sessions where id = v_clash.session_id;
      return query select false, 'duplicate', v_clash.id, v_clash.status, null::text,
                          v_clash.session_id, v_s.starts_at, null::int;
      return;
    end if;
  end if;

  -- ── 2 · THE LOCK ──────────────────────────────────────────────────────
  select * into v_s from popup_sessions where id = p_session_id and event_id = p_event_id for update;
  if not found then
    return query select false, 'no_session', null::uuid, null::text, null::text, null::uuid, null::timestamptz, null::int; return;
  end if;
  if v_s.closed then
    return query select false, 'closed', null::uuid, null::text, null::text, v_s.id, v_s.starts_at, null::int; return;
  end if;
  if v_s.starts_at <= now() then
    return query select false, 'started', null::uuid, null::text, null::text, v_s.id, v_s.starts_at, null::int; return;
  end if;

  if p_party < 1 or p_party > v_ev.party_max then
    return query select false, 'too_big', null::uuid, null::text, null::text, v_s.id, v_s.starts_at, null::int; return;
  end if;

  v_cap := coalesce(v_s.cap_override, v_ev.default_cap);
  select coalesce(sum(party_size), 0) into v_taken
    from popup_bookings where session_id = v_s.id and status = 'confirmed';
  v_left := greatest(v_cap - v_taken, 0);

  -- A party must FIT. One place left and a party of two is not a booking.
  if p_party > v_left then
    if not p_allow_waiting then
      return query select false, 'full', null::uuid, null::text, null::text, v_s.id, v_s.starts_at, v_left; return;
    end if;
    v_status := 'waiting';
  else
    v_status := 'confirmed';
  end if;

  -- ── 3 · THE CODE. Retried on the vanishingly unlikely collision. ──────
  loop
    v_code := upper(replace(substr(gen_random_uuid()::text, 1, 9), '-', ''));
    exit when not exists (select 1 from popup_bookings where event_id = p_event_id and ticket_code = v_code);
  end loop;

  insert into popup_bookings (
    event_id, session_id, name, email, email_key, party_size, status, ticket_code,
    attempt_id, lang, source, consent_marketing, terms_text, waiting_since
  ) values (
    p_event_id, v_s.id, btrim(p_name), nullif(btrim(coalesce(p_email,'')),''), v_key,
    p_party, v_status, v_code, p_attempt, coalesce(p_lang,'en'), coalesce(p_source,'kiosk'),
    coalesce(p_consent,false), p_terms,
    case when v_status = 'waiting' then now() else null end
  ) returning id into v_id;

  return query select true, null::text, v_id, v_status, v_code, v_s.id, v_s.starts_at,
                      greatest(v_left - case when v_status='confirmed' then p_party else 0 end, 0);
end $$;

revoke all on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean) from public;
revoke all on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean) from anon;
revoke all on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean) from authenticated;
grant execute on function popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean) to service_role;

-- ═══ PROMOTING THE WAITING LIST ═══════════════════════════════════════════
-- Run on every cap raise, every cancellation and every move. Returns the rows
-- promoted so the caller can email each of them their ticket.
--
-- ⚠ IT SKIPS A PARTY TOO LARGE TO FIT, AND SAYS SO. Strict order sounds
-- fairer and strands two empty seats because the next party is three. The
-- skipped ids come back in `skipped` so the run sheet can show it, because a
-- queue that quietly reorders itself is worse than one that explains.
drop function if exists popup_promote(uuid);
create function popup_promote(p_session_id uuid)
returns table (promoted uuid[], skipped uuid[], places_left int)
language plpgsql security definer set search_path = public as $$
declare
  v_s popup_sessions%rowtype;
  v_ev popup_events%rowtype;
  v_cap int; v_taken int; v_left int;
  r popup_bookings%rowtype;
  v_promoted uuid[] := '{}';
  v_skipped uuid[] := '{}';
begin
  select * into v_s from popup_sessions where id = p_session_id for update;
  if not found then return query select '{}'::uuid[], '{}'::uuid[], 0; return; end if;
  select * into v_ev from popup_events where id = v_s.event_id;

  v_cap := coalesce(v_s.cap_override, v_ev.default_cap);
  select coalesce(sum(party_size), 0) into v_taken
    from popup_bookings where session_id = v_s.id and status = 'confirmed';
  v_left := greatest(v_cap - v_taken, 0);

  for r in
    select * from popup_bookings
     where session_id = v_s.id and status = 'waiting'
     order by coalesce(waiting_since, created_at) asc, created_at asc
  loop
    exit when v_left <= 0;
    if r.party_size <= v_left then
      update popup_bookings
         set status = 'confirmed', promoted_at = now()
       where id = r.id;
      v_left := v_left - r.party_size;
      v_promoted := v_promoted || r.id;
    else
      v_skipped := v_skipped || r.id;
    end if;
  end loop;

  return query select v_promoted, v_skipped, v_left;
end $$;

revoke all on function popup_promote(uuid) from public;
revoke all on function popup_promote(uuid) from anon;
revoke all on function popup_promote(uuid) from authenticated;
grant execute on function popup_promote(uuid) to service_role;

-- ═══ THE DOOR ═════════════════════════════════════════════════════════════
-- States: valid · early · late · used · cancelled · waiting · wrong_event ·
--         unknown
--
-- ⚠ IT NEVER CONSULTS THE CAP. A confirmed booking is a promise the club made
-- out loud at a stand; an admin lowering a number afterwards does not take it
-- back. Over-capacity is the owner's problem to solve before the door, never
-- the guest's to discover at it.
--
-- p_admit = false simply LOOKS. The scan page asks first, shows the guest, and
-- admits on a second call when staff tap — so a camera catching a code from a
-- pocket cannot silently burn a ticket.
drop function if exists popup_scan(uuid,text,boolean,text);
create function popup_scan(p_event_id uuid, p_code text, p_admit boolean, p_by text)
returns table (
  state text, booking_id uuid, name text, party_size int, status text,
  starts_at timestamptz, ends_at timestamptz, admitted_at timestamptz, session_idx int
)
language plpgsql security definer set search_path = public as $$
declare
  v_b popup_bookings%rowtype;
  v_s popup_sessions%rowtype;
  v_ev popup_events%rowtype;
  v_state text;
  -- ⚠ A PLAIN VARIABLE, NOT v_b.admitted_at. Assigning into a field of a
  -- %rowtype is valid plpgsql, but it cannot be checked by an offline parser
  -- with no catalog to resolve the row against — and this file is verified
  -- offline before anybody runs it. One local variable buys that check back.
  v_admitted timestamptz;
begin
  select * into v_ev from popup_events where id = p_event_id;
  select * into v_b from popup_bookings
    where event_id = p_event_id and ticket_code = upper(btrim(p_code));

  if not found then
    -- Is it a real code from ANOTHER event? Worth saying so: on the night, a
    -- rehearsal ticket in someone's inbox is the likeliest cause.
    if exists (select 1 from popup_bookings where ticket_code = upper(btrim(p_code))) then
      return query select 'wrong_event', null::uuid, null::text, null::int, null::text,
                          null::timestamptz, null::timestamptz, null::timestamptz, null::int;
    else
      return query select 'unknown', null::uuid, null::text, null::int, null::text,
                          null::timestamptz, null::timestamptz, null::timestamptz, null::int;
    end if;
    return;
  end if;

  select * into v_s from popup_sessions where id = v_b.session_id;

  v_admitted := v_b.admitted_at;

  if v_b.status = 'cancelled' then v_state := 'cancelled';
  elsif v_b.status = 'waiting' then v_state := 'waiting';
  elsif v_admitted is not null then v_state := 'used';
  elsif now() < v_s.starts_at - make_interval(mins => v_ev.admit_early_minutes) then v_state := 'early';
  elsif now() > v_s.ends_at + make_interval(mins => v_ev.admit_late_minutes) then v_state := 'late';
  else v_state := 'valid';
  end if;

  -- Admitting is allowed for valid, and for late when the owner has said a
  -- late guest may still come in. Early is never admitted by a scan: staff can
  -- simply wave them in and tick the list.
  if p_admit and v_admitted is null and v_b.status = 'confirmed'
     and (v_state = 'valid' or (v_state = 'late' and v_ev.allow_late_move)) then
    update popup_bookings set admitted_at = now(), admitted_by = p_by where id = v_b.id;
    v_admitted := now();
    v_state := 'valid';
  end if;

  return query select v_state, v_b.id, v_b.name, v_b.party_size, v_b.status,
                      v_s.starts_at, v_s.ends_at, v_admitted, v_s.idx;
end $$;

revoke all on function popup_scan(uuid,text,boolean,text) from public;
revoke all on function popup_scan(uuid,text,boolean,text) from anon;
revoke all on function popup_scan(uuid,text,boolean,text) from authenticated;
grant execute on function popup_scan(uuid,text,boolean,text) to service_role;

-- ═══ THE RUN SHEET ════════════════════════════════════════════════════════
-- One row per session, everything the owner watches the evening by. Admin
-- only: it carries counts, not names, but it is not a public shape.
drop function if exists popup_runsheet(uuid);
create function popup_runsheet(p_event_id uuid)
returns table (
  session_id uuid, idx int, starts_at timestamptz, ends_at timestamptz,
  cap int, booked int, parties int, arrived int, no_show int, waiting int,
  over_by int, closed boolean
)
language sql security definer set search_path = public stable as $$
  select
    s.id, s.idx, s.starts_at, s.ends_at,
    coalesce(s.cap_override, e.default_cap) as cap,
    coalesce(c.booked, 0)::int,
    coalesce(c.parties, 0)::int,
    coalesce(c.arrived, 0)::int,
    -- A no-show is only a no-show once the session has ended.
    case when now() > s.ends_at then coalesce(c.booked, 0) - coalesce(c.arrived, 0) else 0 end::int,
    coalesce(w.waiting, 0)::int,
    greatest(coalesce(c.booked, 0) - coalesce(s.cap_override, e.default_cap), 0)::int as over_by,
    s.closed
  from popup_events e
  join popup_sessions s on s.event_id = e.id
  left join lateral (
    select sum(b.party_size) as booked, count(*) as parties,
           sum(case when b.admitted_at is not null then b.party_size else 0 end) as arrived
      from popup_bookings b where b.session_id = s.id and b.status = 'confirmed'
  ) c on true
  left join lateral (
    select sum(b.party_size) as waiting from popup_bookings b
     where b.session_id = s.id and b.status = 'waiting'
  ) w on true
  where e.id = p_event_id
  order by s.starts_at;
$$;
revoke all on function popup_runsheet(uuid) from public;
revoke all on function popup_runsheet(uuid) from anon;
revoke all on function popup_runsheet(uuid) from authenticated;
grant execute on function popup_runsheet(uuid) to service_role;

-- ═══ SEEDING THE REAL EVENING ═════════════════════════════════════════════
-- Published false. Public bookings false. Cap four, as the owner asked.
insert into popup_events (
  slug, title_en, title_vn, venue_en, venue_vn, event_date,
  first_start, last_finish, session_minutes, changeover_minutes,
  default_cap, party_max, published, public_bookings
) values (
  'palace-2026-11-13',
  'The Rampant Club pop-up',
  'Pop-up của The Rampant Club',
  'Independence Palace, Ho Chi Minh City',
  'Dinh Độc Lập, Thành phố Hồ Chí Minh',
  date '2026-11-13',
  time '18:00', time '21:00', 15, 5,
  4, 2, false, false
)
on conflict (slug) do nothing;

select popup_generate_sessions(id) from popup_events where slug = 'palace-2026-11-13';

do $check$
declare v_n int; v_first timestamptz; v_last timestamptz;
begin
  select count(*), min(starts_at), max(starts_at) into v_n, v_first, v_last
    from popup_sessions s join popup_events e on e.id = s.event_id
   where e.slug = 'palace-2026-11-13';
  raise notice 'Seeded % sessions. First starts %, last starts %. NOT published.',
    v_n, v_first at time zone 'Asia/Ho_Chi_Minh', v_last at time zone 'Asia/Ho_Chi_Minh';
  if v_n <> 9 then
    raise exception 'Expected 9 sessions from 15+5 between 18:00 and 21:00, got %', v_n;
  end if;
end $check$;

commit;

-- ═══ VERIFY — run this after, and read it ═════════════════════════════════
-- 1 · The run sheet, in the clock the owner thinks in:
--
--   select idx, starts_at at time zone 'Asia/Ho_Chi_Minh' as starts,
--          ends_at   at time zone 'Asia/Ho_Chi_Minh' as ends
--     from popup_sessions s join popup_events e on e.id = s.event_id
--    where e.slug = 'palace-2026-11-13' order by idx;
--   → 18:00/18:15 · 18:20/18:35 · 18:40/18:55 · 19:00/19:15 · 19:20/19:35
--     19:40/19:55 · 20:00/20:15 · 20:20/20:35 · 20:40/20:55
--
-- 2 · Nothing is public while the switch is off — this is the line that
--     proves the tablet cannot leak an unpublished evening:
--
--   select count(*) from popup_public('palace-2026-11-13');   → 0
--
-- 3 · And a guest's details are not in the public shape at all. Absent, not
--     filtered — so this is a hard error, which is the point:
--
--   select name from popup_public('palace-2026-11-13');
--   → ERROR: column "name" does not exist
--
-- Then: /admin/popup to approve the run sheet, set the cap, and press Publish.
--
-- ═══ THE WAY BACK ═════════════════════════════════════════════════════════
-- drop function if exists popup_runsheet(uuid);
-- drop function if exists popup_scan(uuid,text,boolean,text);
-- drop function if exists popup_promote(uuid);
-- drop function if exists popup_book(uuid,uuid,text,text,int,text,boolean,text,text,uuid,boolean);
-- drop function if exists popup_public(text);
-- drop function if exists popup_generate_sessions(uuid);
-- drop table if exists popup_messages;
-- drop table if exists popup_unsubscribes;
-- drop table if exists popup_bookings;
-- drop table if exists popup_sessions;
-- drop table if exists popup_events;
