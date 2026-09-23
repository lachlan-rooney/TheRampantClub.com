-- ═══════════════════════════════════════════════════════════════════════════
--  Migration: 20260923100000_menu_orders_note.sql
--  One note per order, written by the room, read by the server.
-- ───────────────────────────────────────────────────────────────────────────
--  Owner, 2026-09-23: refine the ordering process — "one note for the whole
--  order" ("no ice", "one of us is coeliac").
--
--  ONE NOTE, NOT ONE PER LINE, by the owner's choice: a tablet keyboard in a
--  bar is a bad place to type four times.
--
--  240 CHARACTERS. Long enough for a real instruction, short enough that it
--  cannot become an essay nobody reads on a busy pass. The tablet stops at the
--  same number, and the check is here as well because a limit only enforced by
--  a client is not a limit.
--
--  The allergy line on the menu stays where it is: this note is a convenience,
--  not the club's allergy process, which is a conversation with the team.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.menu_orders
  add column if not exists note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menu_orders_note_len'
  ) then
    alter table public.menu_orders
      add constraint menu_orders_note_len check (note is null or char_length(note) <= 240);
  end if;
end $$;

comment on column public.menu_orders.note is
  'One free-text note for the whole order, written on the room tablet (<=240 chars).';

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
-- alter table public.menu_orders drop constraint if exists menu_orders_note_len;
-- alter table public.menu_orders drop column if exists note;
