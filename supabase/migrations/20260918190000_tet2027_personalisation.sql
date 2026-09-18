-- =====================================================================
--  Tết 2027 — THE DESIGN TRAVELS WITH THE ENQUIRY
--  Migration: 20260918190000_tet2027_personalisation.sql
--  Run after the others. Safe to re-run.
-- =====================================================================
--
--  The sleeve studio lets a buyer set the colour, put their logo on it and
--  write the line that goes underneath. That design is the most useful
--  thing in the whole enquiry — it is the conversation, already half had —
--  and tet_enquiries had nowhere to put it.
--
--  jsonb rather than columns: the shape will change as the studio grows
--  (a second colour, a box instead of a sleeve, a Vietnamese line as well
--  as an English one), and none of it is queried — it is read by a person
--  preparing a quote.
--
--  The logo itself is NOT in here. It goes to storage and only its path is
--  recorded: a base64 image in a jsonb column would bloat every read of
--  the table and end up in logs.
-- =====================================================================

alter table public.tet_enquiries
  add column if not exists personalisation jsonb not null default '{}'::jsonb;

comment on column public.tet_enquiries.personalisation is
  'The sleeve design as the buyer left it: {sleeve_hex, text_hex, company, message, logo_path}. '
  'logo_path points at the tet-artwork bucket; the image is never stored here.';

-- =====================================================================
--  CHECK:
--    select reference, personalisation from public.tet_enquiries
--     order by created_at desc limit 5;
-- =====================================================================
