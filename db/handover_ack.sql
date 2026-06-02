-- Run once in the Supabase SQL editor.
--
-- Adds the handover-acknowledgement read receipt to closing checklists.
-- When the morning team opens MX Daily and reads the previous shift's
-- handover note, they tick "Read by [initials]" — that stamp goes back
-- to the closing sheet that was read, creating a two-way audit seam
-- (closing team wrote it · opening team confirmed receipt).
--
-- Immutability rule preserved: the upsert endpoint refuses any write
-- to a sealed sheet. These ack fields are written by a separate
-- endpoint (/api/admin/checklists/ack) that only touches these two
-- columns, leaving the snapshotted items + seal untouched.

begin;

alter table shift_checklists
  add column if not exists handover_acknowledged_by text,
  add column if not exists handover_acknowledged_at timestamptz;

commit;

-- Verify.
select column_name, data_type
  from information_schema.columns
 where table_name = 'shift_checklists'
   and column_name in ('handover_acknowledged_by', 'handover_acknowledged_at')
 order by column_name;
