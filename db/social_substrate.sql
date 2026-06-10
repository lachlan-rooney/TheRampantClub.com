-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE S0 — SOCIAL SUBSTRATE  ·  DESIGN FOR REVIEW — ⚠ DO NOT RUN YET ⚠
-- ───────────────────────────────────────────────────────────────────────────
-- The first deliberate member↔member data flows in a system that is member-own /
-- admin-only throughout. Review line-by-line; run only after sign-off; then the
-- minted-JWT matrix (cross-member reads → [], enumeration → [], decline-
-- invisibility, opted-out unreadability, blocked-path denial) BEFORE S1 builds.
--
-- IDENTITY: social actors are keyed by profiles.id (= auth.uid()) — works for
--   BOTH staff (is_admin, no member_no) and members (member_no via the 0a FK).
--   "is a member" = profile_member_no_uid(uid) is not null. Admin = is_admin_uid.
-- POSTURE: fail-closed. RLS is the privacy boundary, never a client filter.
--   Privileged WRITES (threads/messages/introductions/posts/notes) go through
--   service-role server routes (validation + rate limits) — there are NO member
--   INSERT policies for those; direct anon/member writes are denied by default.
--   Members self-manage only their own consents + blocks (below).
-- DEPENDS ON: is_admin_uid(uuid), profile_member_no_uid(uuid)  [already live].
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Recursion-safe helpers (SECURITY DEFINER → read past RLS, no policy loops) ──

-- Is `uid` a participant of this thread? (thread_participants RLS can't gate
-- itself without this — the classic self-reference recursion.)
create or replace function is_thread_party(p_thread uuid, p_uid uuid)
  returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from thread_participants tp where tp.thread_id = p_thread and tp.participant = p_uid);
$$;

-- Who may READ a thread: any participant, plus admins for CONCIERGE threads only
-- (the staff inbox). Admins are NOT auto-readers of member↔member direct threads.
create or replace function can_read_thread(p_thread uuid, p_uid uuid)
  returns boolean language sql security definer set search_path = public stable as $$
  select is_thread_party(p_thread, p_uid)
      or exists (select 1 from threads t where t.id = p_thread and t.kind = 'concierge' and is_admin_uid(p_uid));
$$;

-- Has A blocked B (either direction)? Honoured for direct threads + introductions.
create or replace function is_blocked_pair(p_a uuid, p_b uuid)
  returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from member_blocks b
    where (b.blocker = p_a and b.blocked = p_b) or (b.blocker = p_b and b.blocked = p_a)
  );
$$;

-- Per-feature consent (presence / palate_twin / attendance_visible / notes_public…).
create or replace function has_consent(p_uid uuid, p_feature text)
  returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from member_consents c where c.member = p_uid and c.feature = p_feature and c.enabled);
$$;

-- ── THREADS / PARTICIPANTS / MESSAGES ──────────────────────────────────────
create table if not exists threads (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('concierge','direct')),
  created_by      uuid references profiles(id),
  introduction_id uuid,                      -- direct threads: the accepted intro that spawned it (FK added after introductions)
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);
create table if not exists thread_participants (
  thread_id   uuid not null references threads(id) on delete cascade,
  participant uuid not null references profiles(id) on delete cascade,
  role        text not null check (role in ('member','staff')),
  last_read_at timestamptz,
  joined_at   timestamptz not null default now(),
  primary key (thread_id, participant)
);
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references threads(id) on delete cascade,
  sender     uuid not null references profiles(id),
  body       text not null,
  media_path text,                            -- storage object path (member-media bucket); null = text only
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_thread on messages(thread_id, created_at);
create index if not exists idx_thread_participants_p on thread_participants(participant);

alter table threads enable row level security;
alter table thread_participants enable row level security;
alter table messages enable row level security;

-- READ: only people who can read the thread (party, or admin-on-concierge). This
-- is what stops enumeration — you cannot read thread / participant / message
-- rows for a thread you're not party to. (No INSERT/UPDATE policies → writes are
-- service-role server routes only.)
drop policy if exists "read own threads" on threads;
create policy "read own threads" on threads for select to authenticated
  using (can_read_thread(id, auth.uid()));
drop policy if exists "read participants of own threads" on thread_participants;
create policy "read participants of own threads" on thread_participants for select to authenticated
  using (can_read_thread(thread_id, auth.uid()));
drop policy if exists "read messages of own threads" on messages;
create policy "read messages of own threads" on messages for select to authenticated
  using (can_read_thread(thread_id, auth.uid()));
-- A member may stamp their OWN last_read_at (read receipts) — the one direct write.
drop policy if exists "update own participant row" on thread_participants;
create policy "update own participant row" on thread_participants for update to authenticated
  using (participant = auth.uid()) with check (participant = auth.uid());

-- ── INTRODUCTIONS (member↔member; the gate to direct threads) ───────────────
-- A DECLINE IS SILENT: the requester must NEVER read 'declined'. Mechanism:
--   • base-table reads are for the RECIPIENT (to act) + admin only.
--   • the requester reads their own requests ONLY through introductions_for_me()
--     (SECURITY DEFINER), which maps declined → 'pending'. So a polite "no" is
--     indistinguishable from "no reply yet". The requester has no base-table read.
create table if not exists introductions (
  id          uuid primary key default gen_random_uuid(),
  requester   uuid not null references profiles(id) on delete cascade,
  recipient   uuid not null references profiles(id) on delete cascade,
  context     text,
  status      text not null default 'pending' check (status in ('pending','accepted','declined')),
  thread_id   uuid references threads(id) on delete set null,   -- set when accepted
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  check (requester <> recipient)
);
create index if not exists idx_introductions_recipient on introductions(recipient, status);
create index if not exists idx_introductions_requester on introductions(requester);
alter table introductions enable row level security;

-- Recipient sees PENDING requests addressed to them (and not from someone they've
-- blocked / who blocked them). Admin sees all. Requester gets NOTHING here.
drop policy if exists "recipient reads pending introductions" on introductions;
create policy "recipient reads pending introductions" on introductions for select to authenticated
  using (
    is_admin_uid(auth.uid())
    or (recipient = auth.uid() and status = 'pending' and not is_blocked_pair(requester, recipient))
  );

-- The requester's ONLY view — declined is masked to pending, so a decline never
-- surfaces. (App calls this; never selects the base table as requester.)
create or replace function introductions_for_me()
  returns table (id uuid, recipient uuid, context text, status text, created_at timestamptz)
  language sql security definer set search_path = public stable as $$
  select i.id, i.recipient, i.context,
         case when i.status = 'declined' then 'pending' else i.status end as status,
         i.created_at
  from introductions i
  where i.requester = auth.uid();
$$;

-- threads.introduction_id FK (added now that introductions exists).
do $$ begin
  alter table threads add constraint threads_introduction_fk
    foreign key (introduction_id) references introductions(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ── POSTS (The Snug feed) ───────────────────────────────────────────────────
create table if not exists posts (
  id          uuid primary key default gen_random_uuid(),
  author      uuid references profiles(id) on delete set null,
  author_kind text not null check (author_kind in ('member','house')),
  kind        text not null default 'note' check (kind in ('note','announcement','question','other')),
  body        text not null,
  media_path  text,
  published   boolean not null default false,
  hidden      boolean not null default false,    -- admin moderation (soft-hide)
  hidden_by   uuid references profiles(id),
  hidden_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_posts_feed on posts(published, hidden, created_at desc);
alter table posts enable row level security;

-- Linked members read PUBLISHED, non-hidden posts. Authors read their own
-- (incl. drafts). Admins read all (moderation). Hidden → author + admin only.
drop policy if exists "read snug posts" on posts;
create policy "read snug posts" on posts for select to authenticated
  using (
    is_admin_uid(auth.uid())
    or author = auth.uid()
    or (published and not hidden and profile_member_no_uid(auth.uid()) is not null)
  );

-- ── TASTING NOTES (member, optional photo, private | snug) ──────────────────
create table if not exists tasting_notes (
  id           uuid primary key default gen_random_uuid(),
  author       uuid not null references profiles(id) on delete cascade,
  whisky_id    uuid references whiskies(id) on delete set null,
  note         text not null,
  flavour_tags jsonb not null default '[]'::jsonb,
  media_path   text,
  visibility   text not null default 'private' check (visibility in ('private','snug')),
  created_at   timestamptz not null default now()
);
create index if not exists idx_tasting_notes_author on tasting_notes(author);
create index if not exists idx_tasting_notes_whisky on tasting_notes(whisky_id);
alter table tasting_notes enable row level security;

-- Author reads own (any visibility); other LINKED MEMBERS read 'snug' notes;
-- admin all. (Visibility='snug' is the per-note opt-in — schema-level, not UI.)
drop policy if exists "read tasting notes" on tasting_notes;
create policy "read tasting notes" on tasting_notes for select to authenticated
  using (
    author = auth.uid()
    or is_admin_uid(auth.uid())
    or (visibility = 'snug' and profile_member_no_uid(auth.uid()) is not null)
  );

-- ── CONSENTS (per-feature opt-in; ENFORCED in RLS via has_consent()) ────────
create table if not exists member_consents (
  member     uuid not null references profiles(id) on delete cascade,
  feature    text not null,            -- presence | palate_twin | attendance_visible | notes_public | …
  enabled    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (member, feature)
);
alter table member_consents enable row level security;
-- A member reads + sets ONLY their own consents; admin reads all.
drop policy if exists "own consents rw" on member_consents;
create policy "own consents rw" on member_consents for all to authenticated
  using (member = auth.uid() or is_admin_uid(auth.uid()))
  with check (member = auth.uid());
-- NOTE: consent GATES other tables. e.g. when S-phases expose presence/visits/
-- taste to other members, those policies add: "… or (other-member AND
-- has_consent(owner, '<feature>'))". An opted-out member's rows stay UNREADABLE
-- to others at the RLS layer — never a client filter.

-- ── BLOCKS (honoured in introductions + direct threads at the RLS layer) ────
create table if not exists member_blocks (
  blocker    uuid not null references profiles(id) on delete cascade,
  blocked    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table member_blocks enable row level security;
-- A member manages (and reads) only their OWN block list; admin reads all.
drop policy if exists "own blocks rw" on member_blocks;
create policy "own blocks rw" on member_blocks for all to authenticated
  using (blocker = auth.uid() or is_admin_uid(auth.uid()))
  with check (blocker = auth.uid());
-- The block is consumed by is_blocked_pair() in the introductions read policy +
-- the introduction-create server route (denies a request toward a blocker).

-- ── NOTIFICATIONS ────────────────────────────────────────────────────────────
-- REUSE the existing `notifications` table (recipient → profiles.id, type,
-- event_id → activity_events, metadata, read, email_status). No new table.
-- New S1 types: 'concierge_reply', 'introduction_request', 'introduction_accepted'.
-- Payload hygiene: metadata holds a generic label + click-through link ONLY —
-- never the message body (lockscreen/badge safe). In-app only (email_status =
-- 'in_app_only') for S1.

-- ═══════════════════════════════════════════════════════════════════════════
-- WRITES: all privileged inserts (create thread, send message, create/accept/
-- decline introduction, publish/hide post, log note) are SERVER ROUTES using the
-- service role — they validate, rate-limit, emit to activity_events, and
-- enforce blocks. There are deliberately NO member INSERT policies above for
-- those tables → a direct client/anon insert is denied. Members self-write only
-- their own member_consents, member_blocks, and thread_participants.last_read_at.
-- ═══════════════════════════════════════════════════════════════════════════
