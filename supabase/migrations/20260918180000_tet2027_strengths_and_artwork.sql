-- =====================================================================
--  Tết 2027 — 55%, AND AN ARTWORK DATE THAT CAN BE MOVED
--  Migration: 20260918180000_tet2027_strengths_and_artwork.sql
--  Run after 20260918170000. Safe to re-run.
-- =====================================================================
--
--  Two things the owner asked for on 18 September, and one of them did not
--  work when it was asked for.
--
--  1. BOTTLING AT 55% AS WELL AS 50%. The board carried cask strength and
--     50% only, so a third option had nowhere to read its bottle count
--     from. Three more columns, on the end of the view (create or replace
--     view can add at the end, which is why they are there and not beside
--     their siblings).
--
--  2. THE ARTWORK DATE WOULD NOT MOVE. tet_countdown looks for an
--     overriding milestone only where kind = 'order_cutoff' — so a
--     milestone marked overrides_derived for the ARTWORK date was written,
--     stored, and quietly ignored. The artwork cut-off is the tightest
--     gate on the blends and the one most likely to be moved by a real
--     decision (printing the sleeves in Ho Chi Minh City rather than at
--     Huntly), so it has to be movable.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE BOARD LEARNS 55%
-- ---------------------------------------------------------------------
create or replace view public.tet_cask_board as
select
  c.cask_ref,
  c.distillery,
  c.region,
  c.vintage_year,
  c.age_years,
  c.cask_type,
  c.wood,
  c.abv_pct                                   as cask_abv_pct,
  c.status,
  c.tasting_note_en,
  c.tasting_note_vn,
  c.colour_hex,
  c.image_path,
  c.display_order,
  c.is_placeholder,
  (q_cs ->> 'bottles')::int                   as bottles_cask_strength,
  (q_cs ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_cask_strength,
  (q_cs ->> 'cask_total_vnd')::numeric        as total_vnd_cask_strength,
  (q_50 ->> 'bottles')::int                   as bottles_reduced,
  (q_50 ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_reduced,
  (q_50 ->> 'cask_total_vnd')::numeric        as total_vnd_reduced,
  (q_50 ->> 'bottles')::int - (q_cs ->> 'bottles')::int as extra_bottles,
  -- 55%: a middle option for a cask too weak for 50% to be worth it, and
  -- for anyone who wants the strength kept nearer the wood.
  (q_55 ->> 'bottles')::int                   as bottles_55,
  (q_55 ->> 'unit_inc_vat_vnd')::numeric      as unit_vnd_55,
  (q_55 ->> 'cask_total_vnd')::numeric        as total_vnd_55,
  (q_55 ->> 'bottles')::int - (q_cs ->> 'bottles')::int as extra_bottles_55
from public.tet_casks c
cross join lateral public.tet_quote_cask_public(c.cask_ref, null)  as q_cs
cross join lateral public.tet_quote_cask_public(c.cask_ref, 50.00) as q_50
-- A cask already at or below 55% cannot be reduced TO 55%: the quote would
-- answer cannot_increase_strength and the columns would be null. Ask for the
-- cask's own strength in that case, which is the honest answer — there is no
-- 55% option on a 51% cask.
cross join lateral public.tet_quote_cask_public(
  c.cask_ref, case when c.abv_pct > 55.0 then 55.00 else null end) as q_55
where c.is_active;

grant select on public.tet_cask_board to anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. THE ARTWORK DATE CAN BE OVERRIDDEN, LIKE THE OTHER TWO
-- ---------------------------------------------------------------------
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
  v_over_art   timestamptz;
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
  -- The line that was missing.
  select due_at into v_over_art from public.tet_milestones
   where is_active and overrides_derived and kind = 'artwork_cutoff'
     order by due_at limit 1;

  v_cask  := coalesce(v_over_cask::date,  v_cask);
  v_blend := coalesce(v_over_blend::date, v_blend);
  v_art   := coalesce(v_over_art::date,   v_art);

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
        'is_past',        (v_art < v_today),
        'overridden',     (v_over_art is not null))
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

-- =====================================================================
--  CHECK:
--    select public.tet_countdown() -> 'cutoffs';
--      → blend 2027-01-01 overridden, artwork 2027-01-01 overridden
--    select cask_ref, cask_abv_pct, bottles_cask_strength, bottles_55,
--           bottles_reduced
--      from public.tet_cask_board order by display_order;
--      → OCT-01 (60.1%): 70 · 76 · 84.  OCT-10 (51%): 70 · 70 · 71
-- =====================================================================
