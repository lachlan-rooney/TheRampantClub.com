-- Per-member consumption ledger — the un-backfillable "what they actually drank"
-- signal. Append-only. Fed from the Harmony Log's bottle_depletion extraction
-- (harmony apply route) — the consumed delta is currently discarded; this
-- captures it. Empty until the Harmony Log is adopted nightly; built now so the
-- clock starts from the first logged pour (don't start an un-backfillable signal
-- late). Folds into member_taste_profiles via the derivation's consumption seam.

create table if not exists member_consumption (
  id                   uuid primary key default gen_random_uuid(),
  member_no            varchar(12) references members(member_no) on delete cascade,
  bottle_name          text,
  whisky_id            uuid references whiskies(id) on delete set null,   -- null: locker bottle not FK'd to catalogue
  consumed_on          date not null,
  amount_pct           int,                                               -- previous_fill - new_fill (the discarded delta)
  estimated_pours      int,
  source_extraction_id uuid,                                              -- harmony_extractions.id (audit link)
  created_at           timestamptz not null default now()
);
create index if not exists idx_member_consumption_member on member_consumption(member_no);
create index if not exists idx_member_consumption_whisky on member_consumption(whisky_id);

alter table member_consumption enable row level security;

drop policy if exists "admins rw member_consumption" on member_consumption;
create policy "admins rw member_consumption" on member_consumption for all
  using  (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- Member reads their OWN rows, keyed on the profiles.member_no FK (Phase 0a).
-- member_no null (admin/unlinked) → `= null` → no rows match (never all).
drop policy if exists "members read own consumption" on member_consumption;
create policy "members read own consumption" on member_consumption for select using (
  member_no = (select member_no from profiles where id = auth.uid())
);
