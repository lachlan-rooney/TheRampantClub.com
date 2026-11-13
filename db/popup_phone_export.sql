-- ═══════════════════════════════════════════════════════════════════════════
-- THE THIRD EXPORT, AND A SETTING THAT DID NOTHING
-- ───────────────────────────────────────────────────────────────────────────
-- 1 · popup_exports.kind gains 'phone'. The register's CHECK is what makes a
--     kind nobody offers impossible, so a third button means widening it here
--     and not only in the screen. Without this the button would 500 at the
--     moment of the download, which is the right failure but a stupid one.
--
-- 2 · popup_events.membership_contact is DROPPED. It was stored, offered for
--     editing on two screens, and read by nothing: the address in the
--     follow-up is the one the owner typed into the body. A setting that
--     looks like it does something is worse than no setting, because the
--     first person to change it will believe they have changed the email.
--     The address now lives in exactly one place — the copy itself.
--
-- Run once. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table popup_exports drop constraint if exists popup_exports_kind_check;
alter table popup_exports add constraint popup_exports_kind_check
  check (kind in ('all', 'consented', 'phone'));

alter table popup_events drop column if exists membership_contact;

-- ── PROOF ─────────────────────────────────────────────────────────────────
do $$
declare v_ev uuid; v_n int;
begin
  select id into v_ev from popup_events where slug = 'palace-2026-11-13';
  if v_ev is null then raise exception 'the evening is missing'; end if;

  -- the new kind is accepted
  insert into popup_exports (event_id, kind, rows_out, by_email)
  values (v_ev, 'phone', 0, 'verify@localhost');
  -- the old two still are
  insert into popup_exports (event_id, kind, rows_out, by_email)
  values (v_ev, 'all', 0, 'verify@localhost'), (v_ev, 'consented', 0, 'verify@localhost');
  select count(*) into v_n from popup_exports where by_email = 'verify@localhost';
  if v_n <> 3 then raise exception 'the three kinds did not all store (got %)', v_n; end if;

  -- and one nobody offers is still refused BY THE DATABASE
  begin
    insert into popup_exports (event_id, kind, rows_out) values (v_ev, 'everyone', 0);
    raise exception 'a bad kind was accepted';
  exception when check_violation then null;
  end;

  delete from popup_exports where by_email = 'verify@localhost';

  -- the setting is gone, so nothing can read it by accident later
  select count(*) into v_n from information_schema.columns
   where table_name = 'popup_events' and column_name = 'membership_contact';
  if v_n <> 0 then raise exception 'membership_contact is still there'; end if;

  raise notice 'three export kinds, and membership_contact is gone';
end $$;
