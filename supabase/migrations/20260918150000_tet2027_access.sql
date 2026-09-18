-- =====================================================================
--  Tết 2027 — THE DOOR
--  Migration: 20260918150000_tet2027_access.sql
-- =====================================================================
--
--  The programme gets its own page on the public site, behind an 18+
--  confirmation and a shared password (owner's decision, 18 Sept 2026).
--  Not the member login: a corporate buyer is not a club member.
--
--  The password lives here rather than in an environment variable so it
--  can be changed with one line of SQL and no deploy — the same reason
--  the pricing model lives in the database.
--
--  It is stored as a bcrypt hash and never leaves Postgres: the check is
--  a function, so the app sends a candidate and gets back true or false.
--  Nothing anywhere can read the password back, including us.
--
--  FAIL CLOSED: the row starts with no hash, and tet_check_access returns
--  false until one is set. An unconfigured door is a shut door.
-- =====================================================================

create table if not exists public.tet_access (
  id            boolean primary key default true check (id),
  password_hash text,
  hint          text,          -- what to tell someone who asks, e.g. 'the one on the leaflet'
  updated_at    timestamptz not null default now(),
  updated_by    text
);

insert into public.tet_access (id) values (true) on conflict (id) do nothing;

-- RLS on, no policies: anon and authenticated get nothing at all.
-- service_role bypasses RLS, which is how the app's own route reads it.
alter table public.tet_access enable row level security;


-- The check. SECURITY DEFINER so it can read a table nobody else can, and
-- deliberately NOT granted to anon or authenticated — the app calls it
-- with the service-role key from a server route, which is also where the
-- attempt can be rate-limited. Granting it to the browser would hand
-- anyone an unlimited password oracle.
create or replace function public.tet_check_access(p_password text)
returns boolean
language sql stable security definer set search_path = public, extensions as $fn$
  select coalesce(
    password_hash is not null
    and length(coalesce(p_password, '')) > 0
    and password_hash = crypt(p_password, password_hash),
  false)
  from public.tet_access where id;
$fn$;

revoke all on function public.tet_check_access(text) from public;
revoke all on function public.tet_check_access(text) from anon, authenticated;


-- =====================================================================
--  SET THE PASSWORD  (run this, with your own words in the quotes)
--
--    update public.tet_access
--       set password_hash = crypt('a phrase you will remember', gen_salt('bf', 10)),
--           hint          = 'the phrase on the leaflet',
--           updated_at    = now(),
--           updated_by    = 'Lachlan'
--     where id;
--
--  Check it took — the first must be true, the second false:
--
--    select public.tet_check_access('a phrase you will remember'),
--           public.tet_check_access('wrong');
--
--  To close the door again entirely:
--
--    update public.tet_access set password_hash = null where id;
-- =====================================================================
