-- =====================================================================
--  Tết 2027 — ENQUIRIES (what a reservation is, before the casks are real)
--  Migration: 20260918160000_tet2027_enquiries.sql
-- =====================================================================
--
--  Every cask in the system is a placeholder: "Glen Placeholder", an
--  invented ABV, an invented ex-works price. A reservation against one of
--  those would flip a real row to 'pending', issue a reference number and
--  tell a buyer their cask is held — for a cask that does not exist.
--
--  So while the programme is provisional the page takes an ENQUIRY: who
--  they are, what caught their eye, and nothing that pretends to be a
--  commitment. No cask changes status. No price is quoted. When Huntly's
--  real list is in and the placeholder flags are cleared, the same form
--  becomes a reservation and tet_reserve_cask does its job.
--
--  The 18+ timestamp is recorded here too, non-nullable, for the same
--  reason it is non-nullable on reservations: it is the one fact the law
--  cares about and it should be impossible to store an enquiry without it.
-- =====================================================================

create sequence if not exists tet_enquiry_seq start 1;

create table if not exists public.tet_enquiries (
  id               uuid primary key default gen_random_uuid(),
  reference        text unique not null
                     default ('TET27-E-' || lpad(nextval('tet_enquiry_seq')::text, 4, '0')),

  -- Who ---------------------------------------------------------------
  company_name     text not null,
  contact_name     text not null,
  contact_email    text not null,
  contact_phone    text,
  tax_code         text,
  age_confirmed_at timestamptz not null,
  locale           text not null default 'en',

  -- What caught their eye ----------------------------------------------
  kind             tet_offer_category not null,
  cask_ref         text,                  -- text, not a foreign key: the cask
                                          -- list is provisional and will be
                                          -- replaced wholesale. The reference
                                          -- is a note of interest, not a hold.
  bottling_strength tet_bottling_strength,
  line_items       jsonb not null default '[]'::jsonb,
  total_bottles    integer,
  message          text,

  -- Process -------------------------------------------------------------
  status           text not null default 'new'
                     check (status in ('new', 'contacted', 'converted', 'closed')),
  converted_reservation_id uuid references public.tet_reservations(id) on delete set null,
  internal_notes   text,
  source           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tet_enquiries_status on public.tet_enquiries (status, created_at desc);

comment on table public.tet_enquiries is
  'Interest registered while the programme is provisional. Contact details are '
  'personal data: RLS is on with NO policies, so only the service role reads them.';

-- Same posture as tet_reservations: on, and no policies at all. anon and
-- authenticated get nothing; the app''s own server route uses service_role.
alter table public.tet_enquiries enable row level security;

drop trigger if exists tet_enquiries_touch on public.tet_enquiries;
create trigger tet_enquiries_touch before update on public.tet_enquiries
  for each row execute function public.tet_touch_updated_at();


-- ---------------------------------------------------------------------
-- IS THE PROGRAMME STILL PROVISIONAL?
-- ---------------------------------------------------------------------
-- One answer, in one place, so the page, the route and any future report
-- all agree on whether a price may be shown and whether a reservation may
-- be taken. True while ANY active cask, product or the programme itself
-- still carries the placeholder flag.
create or replace function public.tet_is_provisional()
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(
    (select is_placeholder from public.tet_programme where is_active limit 1)
    or exists (select 1 from public.tet_casks    where is_active and is_placeholder)
    or exists (select 1 from public.tet_products where is_active and is_placeholder),
  true);
$fn$;

grant execute on function public.tet_is_provisional() to anon, authenticated;

-- =====================================================================
--  CHECK:
--    select public.tet_is_provisional();          -- true today
--    select count(*) from public.tet_enquiries;   -- 0
-- =====================================================================
