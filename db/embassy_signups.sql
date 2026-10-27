-- ═══════════════════════════════════════════════════════════════════════════
-- THE SPIRITS EMBASSY — the mailing list.            REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- Owner, 2026-10-27, for the launch event the same night: a second tab on the
-- kiosk collecting a name, an email, what the person is interested in, and
-- their agreement to receive marketing.
--
-- ═══ THIS TABLE HOLDS MARKETING CONSENT, SO IT RECORDS THE PROOF ═══════════
-- Not just "they agreed" but WHAT they agreed to, WHEN, and WHERE. A consent
-- row that cannot say which words were on the screen is not evidence of
-- anything:
--
--   consent_text      the exact sentence shown, stored verbatim on the row
--   consent_version   so a change of wording is visible in the data
--   consented_at      when
--   source            which surface took it (kiosk_embassy_tet, etc.)
--   device_label      which tablet, where that is known
--
-- The club learned this the hard way on membership terms: the register records
-- which version was signed (db/membership_terms, project_terms_v2). Same
-- principle, smaller stakes.
--
-- ⚠ MARKETING CONSENT IS NOT OPTIONAL AND NOT IMPLIED. The column is NOT NULL
--   with no default: a row cannot exist without an explicit true or false, so
--   nobody can be added to a list by a form that forgot to ask. The kiosk ships
--   the box UNTICKED.
--
-- ═══ INTERESTS ════════════════════════════════════════════════════════════
-- The five the owner named. A CHECK constraint rather than a lookup table,
-- because this is a leaflet's worth of options and a join would be ceremony:
--   shop_discount · events · whisky_club · tastings · b2b
--
-- ═══ ACCESS ═══════════════════════════════════════════════════════════════
-- RLS on, and NOBODY gets a policy except admins reading.
--
-- Writes go through /api/embassy/signup with the service role, never from the
-- browser. A kiosk stands unattended in a room full of guests: an anon INSERT
-- policy on a table of email addresses is an open door, and an anon SELECT
-- would hand the whole list to anyone who opened the console. The route is the
-- only way in, and it is the thing that can rate-limit.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

create table if not exists public.embassy_signups (
  id               uuid primary key default gen_random_uuid(),
  full_name        text        not null check (length(btrim(full_name)) between 1 and 120),
  email            text        not null check (position('@' in email) > 1 and length(email) <= 254),
  -- Lower-cased for the uniqueness check; the typed form is kept in `email`
  -- because people like to see their own capitalisation back.
  email_key        text        not null,
  interests        text[]      not null default '{}',
  marketing_consent boolean    not null,
  consent_text     text,
  consent_version  text        not null default 'embassy-1.0',
  consented_at     timestamptz,
  locale           text        not null default 'en' check (locale in ('en','vn')),
  source           text        not null default 'kiosk_embassy',
  device_label     text,
  note             text,
  created_at       timestamptz not null default now(),

  constraint embassy_interests_known check (
    interests <@ array['shop_discount','events','whisky_club','tastings','b2b']::text[]
  ),
  -- If they said yes, we must be able to show when and to what.
  constraint embassy_consent_evidenced check (
    marketing_consent = false or (consented_at is not null and consent_text is not null)
  )
);

-- ONE ROW PER EMAIL. A tablet at an event gets the same person twice: they
-- forget they signed, or a friend fills it in for them. The route upserts on
-- this, merging interests rather than making a second row.
create unique index if not exists embassy_signups_email_key_uniq
  on public.embassy_signups (email_key);
create index if not exists embassy_signups_created_idx
  on public.embassy_signups (created_at desc);

alter table public.embassy_signups enable row level security;

-- Admins read. Nobody else gets anything — not anon, not an authenticated
-- member. Writes are service-role only, through the API route.
drop policy if exists "admins read embassy signups" on public.embassy_signups;
create policy "admins read embassy signups" on public.embassy_signups
  for select to authenticated using (public.is_admin_uid(auth.uid()));

comment on table public.embassy_signups is
  'The Spirits Embassy mailing list, captured on the kiosk. Marketing consent is NOT NULL and is stored with the exact wording shown and when. Writes only via /api/embassy/signup (service role) — never from the browser.';
comment on column public.embassy_signups.consent_text is
  'The exact sentence the person agreed to, verbatim. Without it the row proves nothing.';

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
--   select count(*) from public.embassy_signups;
--
-- The constraint actually bites — this must FAIL:
--   insert into public.embassy_signups (full_name, email, email_key, marketing_consent)
--   values ('Test', 't@example.invalid', 't@example.invalid', true);
--   → ERROR: embassy_consent_evidenced
--
-- And an unknown interest must FAIL:
--   insert into public.embassy_signups (full_name, email, email_key, marketing_consent, interests)
--   values ('Test', 't2@example.invalid', 't2@example.invalid', false, array['free_beer']);
--   → ERROR: embassy_interests_known
--
-- Then: node scripts/verify-embassy-signup.mjs

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- ⚠ This drops real people's contact details and their consent record. Export
--   first if anyone has signed:
--     \copy (select * from public.embassy_signups) to 'embassy-signups.csv' csv header
--   drop table if exists public.embassy_signups;
