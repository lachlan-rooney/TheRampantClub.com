-- ═══════════════════════════════════════════════════════════════════════════
-- HIẾU AND BÌNH ARE A COUPLE — the rota should know
-- ───────────────────────────────────────────────────────────────────────────
-- On the standing pattern Hiếu is off Sunday and Bình is off Monday, every
-- week, for ever. Nobody decided that; it fell out of two separate
-- arrangements made months apart. The effect is that two people who live
-- together never once have a day off at the same time, and a rota that quietly
-- does that is one people leave over.
--
-- ONCE A FORTNIGHT, not every week. Five people cover seven nights; taking two
-- of them off the same night twice a month is what the roster can absorb, and
-- the week it happens is built round it:
--
--   Bình's day off moves from Monday to Sunday, joining Hiếu
--   Mr Sĩ works that Sunday instead, and takes his day off on the Tuesday
--
-- Everything else holds — five evenings each, 47.5 hours each, a supervisor on
-- every night, and Mr Sĩ still closing every Saturday. Worked through before
-- it was written: the alternate week is Mon 4 · Tue 3 · Wed 4 · Thu 4 · Fri 4
-- · Sat 3 · Sun 3, which is the same 25 evening shifts, arranged differently.
--
-- The link is stored on BOTH people, so reading either one tells you. It is a
-- self-reference on team_members rather than a `couples` table: there is one
-- pair, and a table for one row is a table nobody maintains.
--
-- Deliberately NOT called `partner` alone — this records a ROTA arrangement the
-- rota has to honour, not anybody's private life, and the name should say so.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.team_members') is null then
    raise exception 'team_members does not exist here — wrong database?';
  end if;
end $$;

alter table team_members add column if not exists rota_partner uuid references team_members(id) on delete set null;

comment on column team_members.rota_partner is
  'Another member of staff this person should get a day off WITH, once a fortnight. Set on BOTH sides. '
  'Checked by checkWeek (lib/rota/policy.ts) as a WARNING, not a block: on five people covering seven nights '
  'it is the first thing that gives in a week where someone is ill, and a rule that reddens the whole rota '
  'for it gets switched off.';

-- Nobody is their own partner, and the link must point at somebody real (the
-- FK handles the second half).
alter table team_members drop constraint if exists team_members_rota_partner_not_self;
alter table team_members add constraint team_members_rota_partner_not_self
  check (rota_partner is null or rota_partner <> id);

-- Bình's Monday stops being FIXED — it has to be free to move to Sunday every
-- other week, and a fixed day off is absolute to the checker. Hiếu's Sunday
-- stays fixed: it is the day they meet on.
update team_members set fixed_days_off = null where display_name = 'Bình';

update team_members a set rota_partner = b.id
  from team_members b
 where a.display_name = 'Hiếu' and b.display_name = 'Bình';
update team_members a set rota_partner = b.id
  from team_members b
 where a.display_name = 'Bình' and b.display_name = 'Hiếu';

-- ── Proof, printed by the run ──────────────────────────────────────────────
do $$
declare v_pairs int; v_onesided int;
begin
  select count(*) into v_pairs from team_members where rota_partner is not null;
  -- A one-sided link is worse than none: the check reads from one person and
  -- would silently skip the other.
  select count(*) into v_onesided
    from team_members a
   where a.rota_partner is not null
     and not exists (select 1 from team_members b where b.id = a.rota_partner and b.rota_partner = a.id);
  raise notice 'staff with a rota partner: %', v_pairs;
  if v_onesided > 0 then
    raise exception '% one-sided partner link(s) — set it on both people or neither', v_onesided;
  end if;
  if v_pairs <> 2 then
    raise warning 'expected Hiếu and Bình to be linked and nobody else — check the names match the roster exactly';
  end if;
end $$;
