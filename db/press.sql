-- Run once in the Supabase SQL editor.
-- Press items: kits (downloads), releases (announcements), and mentions
-- (external coverage by other outlets).

create table if not exists press_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('kit', 'release', 'mention')),
  title text not null,
  outlet text,                           -- e.g. "Drinks Business" — for mentions
  body text,                             -- description, excerpt, or quote
  link text,                             -- external URL or download URL
  image_url text,                        -- optional cover / outlet logo
  published_at date,                     -- when it was issued / appeared
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists press_items_type_idx
  on press_items (type, published_at desc, sort_order);

alter table press_items enable row level security;

-- Anyone can read published items (the press page is public).
drop policy if exists "anon read published press" on press_items;
create policy "anon read published press" on press_items
  for select using (is_published = true);
