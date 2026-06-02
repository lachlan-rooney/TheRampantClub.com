-- Run once in the Supabase SQL editor.
--
-- Gift edits — per-row audit trail of changes to a gift entry. Gifts
-- are an audit record of "what we gave a member, and why" — making them
-- editable risks rewriting that audit, so every edit also writes a
-- record HERE capturing the before-state, after-state, and which fields
-- actually changed. The gift row itself is the current truth; this
-- table is the trail of how it got there.

begin;

create table if not exists gift_edits (
  id              uuid primary key default gen_random_uuid(),
  gift_id         uuid not null references gifts(id) on delete cascade,
  edited_by       uuid,
  edited_by_email text,
  before_state    jsonb,
  after_state     jsonb,
  changed_fields  text[],  -- ['cost_vnd', 'description', …] — populated by API
  created_at      timestamptz not null default now()
);

create index if not exists idx_gift_edits_gift
  on gift_edits (gift_id, created_at desc);
create index if not exists idx_gift_edits_when
  on gift_edits (created_at desc);

alter table gift_edits enable row level security;

drop policy if exists "admin all on gift_edits" on gift_edits;
create policy "admin all on gift_edits" on gift_edits
  for all
  using      (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

commit;

-- Verify.
select count(*) as edits_so_far from gift_edits;
