-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE S2b — The Snug: reactions + saved bottles  ·  REVIEW, then run (after S0/S2a)
-- ───────────────────────────────────────────────────────────────────────────
-- Two small tables. The feed itself is UNION-AT-READ in the route (posts +
-- snug tasting_notes merged by time) — no view, no denormalisation. Quiet counts:
-- RLS never exposes a public tally; only the item's owner (+ the reacting member,
-- + admin) can read reactions. Writes are route-only (toggle + emit).
-- ═══════════════════════════════════════════════════════════════════════════

-- Who owns a feed item (a post or a tasting note)? Lets the poster read the
-- reactions on THEIR item without a public leaderboard. Recursion-safe definer.
create or replace function owns_feed_item(p_type text, p_id uuid, p_uid uuid)
  returns boolean language sql security definer set search_path = public stable as $$
  select case p_type
    when 'post'         then exists (select 1 from posts where id = p_id and author = p_uid)
    when 'tasting_note' then exists (select 1 from tasting_notes where id = p_id and author = p_uid)
    else false end;
$$;

-- ── REACTIONS (🥃 raise_glass · 🔖 noted · 🤝 join_me) ──────────────────────
-- One row per (member, item, reaction). No member INSERT/DELETE policy — the
-- toggle route (service role) is the only writer + it emits the spine event.
create table if not exists reactions (
  id         uuid primary key default gen_random_uuid(),
  member     uuid not null references profiles(id) on delete cascade,
  item_type  text not null check (item_type in ('post','tasting_note')),
  item_id    uuid not null,
  reaction   text not null check (reaction in ('raise_glass','noted','join_me')),
  created_at timestamptz not null default now(),
  unique (member, item_type, item_id, reaction)
);
create index if not exists idx_reactions_item   on reactions(item_type, item_id);
create index if not exists idx_reactions_member on reactions(member);
alter table reactions enable row level security;

-- READ: a member sees their OWN reactions; an item's owner sees every reaction on
-- their item (to know who raised a glass); admin all. No public tally via RLS.
drop policy if exists "read reactions own/owner/admin" on reactions;
create policy "read reactions own/owner/admin" on reactions for select to authenticated
  using (
    member = auth.uid()
    or is_admin_uid(auth.uid())
    or owns_feed_item(item_type, item_id, auth.uid())
  );

-- ── SAVED BOTTLES (the 🔖 noted action saves a referenced whisky here) ───────
-- Personal list; the member self-manages, admin reads. (Self-manage is fine — it's
-- purely the member's own bookmark, like member_consents/blocks in S0.)
create table if not exists member_saved_whiskies (
  member     uuid not null references profiles(id) on delete cascade,
  whisky_id  uuid not null references whiskies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member, whisky_id)
);
alter table member_saved_whiskies enable row level security;
drop policy if exists "own saved whiskies" on member_saved_whiskies;
create policy "own saved whiskies" on member_saved_whiskies for all to authenticated
  using (member = auth.uid() or is_admin_uid(auth.uid())) with check (member = auth.uid());
