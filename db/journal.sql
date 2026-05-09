-- Run once in Supabase SQL editor.
-- Cellarmaster's Journal — long-form whisky entries written by admins,
-- read by members.

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  excerpt text,
  related_whisky_id uuid references whiskies(id) on delete set null,
  author_name text,
  cover_image_url text,
  is_published boolean not null default true,
  published_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists journal_entries_published_idx
  on journal_entries (is_published, published_at desc);

alter table journal_entries enable row level security;

-- Members (any authenticated user) can read published entries.
drop policy if exists "members read published journal" on journal_entries;
create policy "members read published journal" on journal_entries
  for select
  using (auth.uid() is not null and is_published = true);

-- Anyone can read published entries publicly (we'll gate the page itself
-- behind login but the policy stays open in case we ever expose them).
drop policy if exists "anon read published journal" on journal_entries;
create policy "anon read published journal" on journal_entries
  for select
  using (is_published = true);
