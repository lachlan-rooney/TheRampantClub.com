-- Run once in the Supabase SQL editor.
--
-- Resets the lockers table to match the PHYSICAL wall layout:
--   Left side  (4 rows × 6 cols, rows A–D):  A-01..D-06   (24 lockers)
--   Right side (3 rows × 4 cols, rows A–C):  A-07..C-10   (12 lockers)
--   Total: 36 lockers.
--
-- Idempotent: re-running it does NOT lose member assignments, labels, notes,
-- status, or bottle contents on rows that already exist. It only:
--   • upserts the 36 layout rows with their correct position_row / position_col
--   • removes lockers that aren't part of the layout (e.g. stale A-07..A-12
--     entries from earlier 12-col seeds; their contents cascade-delete)

begin;

-- 1. Upsert the 36 layout rows.
with layout as (
  -- Left side: rows A–D, cols 1–6
  select
    (array['A','B','C','D'])[r]          as row_letter,
    r                                     as position_row,
    c                                     as position_col,
    (array['A','B','C','D'])[r] || '-' || lpad(c::text, 2, '0') as locker_no
  from generate_series(1, 4) r, generate_series(1, 6) c
  union all
  -- Right side: rows A–C, cols 7–10
  select
    (array['A','B','C'])[r]              as row_letter,
    r                                     as position_row,
    c                                     as position_col,
    (array['A','B','C'])[r] || '-' || lpad(c::text, 2, '0') as locker_no
  from generate_series(1, 3) r, generate_series(7, 10) c
)
insert into lockers (locker_no, position_row, position_col, status)
select locker_no, position_row, position_col, 'empty'
from layout
on conflict (locker_no) do update
  set position_row = excluded.position_row,
      position_col = excluded.position_col,
      updated_at   = now();

-- 2. Remove any lockers that aren't part of the layout. locker_contents
--    cascade-delete; member assignments simply detach (set null on members).
delete from lockers
where locker_no not in (
  select (array['A','B','C','D'])[r] || '-' || lpad(c::text, 2, '0')
    from generate_series(1, 4) r, generate_series(1, 6) c
  union all
  select (array['A','B','C'])[r] || '-' || lpad(c::text, 2, '0')
    from generate_series(1, 3) r, generate_series(7, 10) c
);

commit;

-- Verify: should return 36.
select count(*) as layout_lockers from lockers;
