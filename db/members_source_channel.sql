-- ═══════════════════════════════════════════════════════════════════════════
-- members.source_channel — carry acquisition source through conversion.
--                                                        REVIEW, then run.
-- ───────────────────────────────────────────────────────────────────────────
-- prospects.source_channel is well kept: 185 of 220 rows. It is then LOST at
-- conversion — members has no such column — so no analysis can ever ask which
-- channel produced the members the club actually has, or what any channel is
-- worth. Every month without this is another cohort that cannot be attributed
-- afterwards.
--
-- Additive: a nullable column and a one-time backfill from the prospects that
-- already converted. Nothing existing changes.
-- ═══════════════════════════════════════════════════════════════════════════

begin;
set local lock_timeout = '5s';

alter table public.members
  add column if not exists source_channel text;

comment on column public.members.source_channel is
  'How this member was acquired, copied from prospects.source_channel at conversion. Null for members created before this existed, or converted from a prospect whose channel was never recorded.';

-- BACKFILL from the prospects that already converted. 13 of 220 prospects
-- carry a converted_member_no, so this fills what it honestly can and leaves
-- the rest null rather than guessing.
update public.members m
   set source_channel = p.source_channel
  from public.prospects p
 where p.converted_member_no = m.member_no
   and p.source_channel is not null
   and m.source_channel is null;

commit;

-- ── CHECK ─────────────────────────────────────────────────────────────────
--   select source_channel, count(*) from public.members group by 1 order by 2 desc;
--   select count(*) from public.members where source_channel is null;
--
-- From here, both creation paths copy it:
--   app/api/admin/mis/prospects/[id]/allocate-member/route.ts
--   app/api/admin/mis/prospects/[id]/send-invitation/route.ts

-- ── THE WAY BACK ──────────────────────────────────────────────────────────
--   alter table public.members drop column if exists source_channel;
