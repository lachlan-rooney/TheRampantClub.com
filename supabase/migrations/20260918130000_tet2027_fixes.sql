-- =====================================================================
--  Tết 2027 Programme — THREE CORRECTIONS
--  Migration: 20260918130000_tet2027_fixes.sql
--  Run AFTER the foundations and calendar migrations, before the seed.
-- =====================================================================
--
--  Written here rather than edited into the two files they correct, so
--  the originals stay exactly as handed over and every change is legible.
--
--  Reproduce the second fault before applying this, in the SQL editor:
--
--    set local role anon;
--    select public.tet_quote_blends_public('[{"sku":"DT-12YO","qty":50}]'::jsonb, true);
--    reset role;
--
--  Expect: permission denied for function tet_quote_blends.
--  After this migration the same three lines return a price.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE CLOCK IS SAIGON'S, NOT THE SERVER'S
-- ---------------------------------------------------------------------
-- tet_cutoffs() and tet_countdown() counted from current_date, which on
-- Supabase is UTC. Between midnight and 07:00 in Vietnam that is still
-- yesterday, so every countdown read a day high all night — and the cut-
-- offs are end-of-day in Ho Chi Minh City, which is the whole point.
create or replace function public.tet_today()
returns date language sql stable as $fn$
  select (now() at time zone coalesce(
    (select timezone from public.tet_programme where is_active limit 1),
    'Asia/Ho_Chi_Minh'))::date;
$fn$;

grant execute on function public.tet_today() to anon, authenticated;


create or replace function public.tet_cutoffs()
returns table (
  kind               text,
  applies_to         text,
  cutoff_date        date,
  days_remaining     integer,
  is_past            boolean
) language sql stable as $fn$
  with p as (select * from public.tet_active_programme()),
  base as (
    select
      p.*,
      (p.festival_date - p.delivery_before_festival_days)::date as in_hand_date,
      (p.local_delivery_weeks + p.clearance_weeks + p.transit_weeks + p.buffer_weeks) as common_weeks
    from p
  ),
  d as (
    select
      'order_cutoff'::text as kind, 'cask'::text as applies_to,
      (in_hand_date - ((common_weeks + bottling_lead_weeks_cask) * 7)::int)::date as cutoff_date
    from base
    union all
    select 'order_cutoff', 'blend',
      (in_hand_date - ((common_weeks + bottling_lead_weeks_blend) * 7)::int)::date
    from base
    union all
    select 'artwork_cutoff', 'blend',
      (in_hand_date - ((common_weeks + bottling_lead_weeks_blend
                        + sleeve_print_lead_weeks + artwork_approval_weeks) * 7)::int)::date
    from base
    union all
    select 'delivery', 'all', in_hand_date from base
    union all
    select 'festival', 'all', festival_date from base
  )
  select d.kind, d.applies_to, d.cutoff_date,
         (d.cutoff_date - public.tet_today())::int as days_remaining,
         (d.cutoff_date < public.tet_today())      as is_past
  from d
  order by d.cutoff_date;
$fn$;


-- Same body as the original, with every current_date replaced by the
-- club's own date. Output shape is unchanged.
create or replace function public.tet_countdown()
returns jsonb language plpgsql stable as $fn$
declare
  v_p     public.tet_programme;
  v_today date := public.tet_today();
  v_cask  date;
  v_blend date;
  v_art   date;
  v_hand  date;
  v_over_cask  timestamptz;
  v_over_blend timestamptz;
  v_next  jsonb;
begin
  v_p := public.tet_active_programme();
  if v_p.id is null then return jsonb_build_object('error', 'no_active_programme'); end if;

  select cutoff_date into v_cask  from public.tet_cutoffs()
    where kind = 'order_cutoff'  and applies_to = 'cask';
  select cutoff_date into v_blend from public.tet_cutoffs()
    where kind = 'order_cutoff'  and applies_to = 'blend';
  select cutoff_date into v_art   from public.tet_cutoffs()
    where kind = 'artwork_cutoff' and applies_to = 'blend';
  select cutoff_date into v_hand  from public.tet_cutoffs()
    where kind = 'delivery';

  select due_at into v_over_cask from public.tet_milestones
   where is_active and overrides_derived and kind = 'order_cutoff'
     and applies_to = 'cask' order by due_at limit 1;
  select due_at into v_over_blend from public.tet_milestones
   where is_active and overrides_derived and kind = 'order_cutoff'
     and applies_to = 'blend' order by due_at limit 1;

  v_cask  := coalesce(v_over_cask::date,  v_cask);
  v_blend := coalesce(v_over_blend::date, v_blend);

  select to_jsonb(x) into v_next from (
    select kind, applies_to, cutoff_date, days_remaining
    from public.tet_cutoffs()
    where not is_past and kind in ('order_cutoff', 'artwork_cutoff')
    order by cutoff_date limit 1
  ) x;

  return jsonb_build_object(
    'season',            v_p.season_label,
    'timezone',          v_p.timezone,
    'now',               now(),
    'festival_date',     v_p.festival_date,
    'days_to_festival',  (v_p.festival_date - v_today),
    'in_hand_date',      v_hand,
    'cutoffs', jsonb_build_object(
      'cask', jsonb_build_object(
        'date',           v_cask,
        'days_remaining', (v_cask - v_today),
        'is_past',        (v_cask < v_today),
        'overridden',     (v_over_cask is not null)),
      'blend', jsonb_build_object(
        'date',           v_blend,
        'days_remaining', (v_blend - v_today),
        'is_past',        (v_blend < v_today),
        'overridden',     (v_over_blend is not null)),
      'artwork', jsonb_build_object(
        'date',           v_art,
        'days_remaining', (v_art - v_today),
        'is_past',        (v_art < v_today))
    ),
    'next_gate',      v_next,
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', slug, 'kind', kind, 'applies_to', applies_to,
        'name_en', name_en, 'name_vn', name_vn,
        'note_en', note_en, 'note_vn', note_vn,
        'due_at', due_at, 'is_hard', is_hard,
        'days_remaining', (due_at::date - v_today)
      ) order by due_at)
      from public.tet_milestones where is_active), '[]'::jsonb),
    'is_placeholder', v_p.is_placeholder
  );
end;
$fn$;

grant execute on function public.tet_countdown() to anon, authenticated;
grant execute on function public.tet_cutoffs()   to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. THE PUBLIC WRAPPERS COULD NOT CALL WHAT THEY WRAP
-- ---------------------------------------------------------------------
-- Foundations §14 revokes EXECUTE on tet_quote_blends / tet_quote_cask
-- from anon and authenticated — correctly, so nobody can pass p_admin
-- => true and read the cost model. But the wrappers were SECURITY
-- INVOKER, so they ran AS THE CALLER and hit the same wall: every
-- browser price call would have failed with "permission denied for
-- function tet_quote_blends".
--
-- SECURITY DEFINER makes the wrapper run as its owner, which can call
-- the inner function. The admin flag is still unreachable: the wrapper
-- passes false and takes no parameter that could change it.
create or replace function public.tet_quote_blends_public(p_lines jsonb, p_sleeve boolean default true)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select public.tet_quote_blends(p_lines, p_sleeve, false);
$fn$;

create or replace function public.tet_quote_cask_public(p_cask_ref text, p_target_abv numeric default null)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select public.tet_quote_cask(p_cask_ref, p_target_abv, false);
$fn$;

revoke all on function public.tet_quote_blends_public(jsonb, boolean) from public;
revoke all on function public.tet_quote_cask_public(text, numeric)    from public;
grant execute on function public.tet_quote_blends_public(jsonb, boolean) to anon, authenticated;
grant execute on function public.tet_quote_cask_public(text, numeric)    to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. THE ORDERING GATE WAS NEVER WIRED IN
-- ---------------------------------------------------------------------
-- The calendar migration defines tet_assert_ordering_open and says it is
-- wired into both reservation paths. Nothing calls it, so a cask could
-- be reserved in December for a bottling slot that closed in October.
--
-- A trigger rather than an edit to the two reserve functions: it covers
-- every path into the table, including anything added later and anything
-- an admin inserts directly, which is exactly where a late promise would
-- otherwise slip in.
--
-- The deliberate exception: a staff member taking a late order KNOWINGLY
-- sets tet.allow_late for their transaction. Requiring that makes the
-- override a decision somebody made rather than an accident.
create or replace function public.tet_reservations_gate()
returns trigger language plpgsql as $fn$
begin
  if coalesce(current_setting('tet.allow_late', true), '') = 'on' then
    return new;
  end if;
  if not public.tet_ordering_open(new.kind) then
    raise exception 'ordering_closed_for_%', new.kind
      using hint = 'The last order date for this category has passed. '
                || 'A late order is a decision: set tet.allow_late = ''on'' for this transaction.';
  end if;
  return new;
end;
$fn$;

drop trigger if exists tet_reservations_gate on public.tet_reservations;
create trigger tet_reservations_gate before insert on public.tet_reservations
  for each row execute function public.tet_reservations_gate();


-- =====================================================================
--  AFTER RUNNING, CHECK ALL THREE
--
--    -- 1. the clock is Saigon's
--    select public.tet_today(), current_date;
--
--    -- 2. a browser can get a price
--    set local role anon;
--    select public.tet_quote_blends_public('[{"sku":"DT-12YO","qty":50}]'::jsonb, true);
--    select * from public.tet_cask_board order by display_order limit 3;
--    reset role;
--
--    -- 3. the gate bites (expect ordering_closed_for_cask once the date
--    --    has passed; before then it should succeed, which is also the
--    --    proof the trigger is not blocking everything)
--    select public.tet_ordering_open('cask'), public.tet_ordering_open('blend');
-- =====================================================================
