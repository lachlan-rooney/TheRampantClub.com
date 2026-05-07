-- Run once in the Supabase SQL editor to support member cards.
-- The card itself stores nothing; the factory UID is the lookup key,
-- and all member data lives here.

alter table profiles
  add column if not exists card_uid text unique,
  add column if not exists card_issued_at timestamptz;

create index if not exists profiles_card_uid_idx on profiles (card_uid);

-- If you have a `member_list` view, recreate it to expose card_uid.
-- (Replace the SELECT with whatever your existing view actually selects.)
--
-- create or replace view member_list as
--   select id, email, display_name, member_number, admitted_at, locker_number,
--          preferred_dram, is_admin, card_uid, card_issued_at
--     from profiles;
