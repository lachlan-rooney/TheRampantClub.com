-- ═══════════════════════════════════════════════════════════════════════════
-- A SIGNATURE IS THE NAME OR THE DRAWING — NOT NECESSARILY A PNG
-- ───────────────────────────────────────────────────────────────────────────
-- signature_data_url was NOT NULL. It holds a PNG data URL, rendered in the
-- BROWSER: for a drawn signature, the canvas the person drew on; for a TYPED
-- one, a canvas the page paints their name onto in a script face.
--
-- That makes a completed, agreed, legally-meaningful signing depend on
-- `canvas.toDataURL()` returning something. It usually does. When it does not —
-- a privacy extension that blocks canvas readback, a browser that refuses the
-- call, a ref that has not mounted — the function returns an empty string, and
-- the INSERT is rejected at the very last step: after the person has read both
-- documents, ticked every box, typed their name and pressed submit, and after
-- the PDF has been generated and the emails sent. They see a failure; the club
-- has their agreement nowhere.
--
-- The image was never the signature. For a typed signing the signature is
-- `typed_name` with `signature_method = 'typed'`; the PNG is a rendering of it.
-- So the column becomes nullable, and a CHECK takes its place that says the
-- real rule: a row must carry a signature in ONE of its two forms.
--
-- This is a WIDER guarantee than NOT NULL was, not a looser one. Before, a row
-- could have a PNG and no name; now it cannot have neither.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.signed_agreements') is null then
    raise exception 'signed_agreements does not exist here — wrong database?';
  end if;
  -- Refuse if any existing row would fail the new rule: the constraint must
  -- never be added by silently excusing a record that is already broken.
  if exists (select 1 from signed_agreements
              where coalesce(signature_data_url, '') = '' and coalesce(typed_name, '') = '') then
    raise exception 'a signature on file has neither a drawing nor a typed name — look at it before constraining';
  end if;
end $$;

alter table signed_agreements alter column signature_data_url drop not null;

alter table signed_agreements drop constraint if exists signed_agreements_has_a_signature;
alter table signed_agreements add constraint signed_agreements_has_a_signature
  check (coalesce(signature_data_url, '') <> '' or coalesce(typed_name, '') <> '');

comment on column signed_agreements.signature_data_url is
  'PNG data URL of the drawn signature, or of the typed name rendered in a script face. '
  'Nullable: for a typed signing the signature is typed_name — this is a picture of it, and a '
  'browser that refuses canvas readback must not be able to reject a completed agreement.';

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_nullable text; v_has_check boolean; v_rows int;
begin
  select is_nullable into v_nullable from information_schema.columns
   where table_name = 'signed_agreements' and column_name = 'signature_data_url';
  select exists (select 1 from pg_constraint where conname = 'signed_agreements_has_a_signature')
    into v_has_check;
  select count(*) into v_rows from signed_agreements;
  raise notice 'signature_data_url nullable: % · the has-a-signature check exists: % · % signature(s) on file',
    v_nullable, v_has_check, v_rows;
  if v_nullable <> 'YES' then raise exception 'the column is still NOT NULL'; end if;
  if not v_has_check then raise exception 'the replacement check did not take'; end if;
end $$;
