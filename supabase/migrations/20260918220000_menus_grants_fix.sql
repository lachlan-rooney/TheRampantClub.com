-- ═══════════════════════════════════════════════════════════════════════════
-- MENUS — CLOSING TWO DOORS THE FIRST MIGRATION LEFT OPEN
-- ───────────────────────────────────────────────────────────────────────────
-- Found by scripts/verify-menus.mjs against the real database, not by reading.
-- Both are the same mistake in two costumes: granting the right thing without
-- revoking the default that was already there.
--
-- 1. THE VIEWS WERE READABLE BY ANON.
--    20260918210000 said `grant select ... to authenticated`, which is true but
--    not sufficient: Supabase ships ALTER DEFAULT PRIVILEGES granting new
--    tables and views in `public` to anon AND authenticated. So the view was
--    born readable by anon, and granting it again to authenticated changed
--    nothing. The base tables escaped this only because that migration DID
--    revoke them from anon explicitly — the views were not in that list.
--
--    Effect while it stood: anyone on the internet with the (publishable) anon
--    key could read the club's dish list and member prices from PostgREST. Not
--    a cost leak — cost is not in the views — but not public information either.
--
-- 2. ANY MEMBER COULD RUN menu_placeholder_audit().
--    That migration said `revoke all on function ... from anon, authenticated`.
--    Postgres grants EXECUTE on every new function to PUBLIC, and anon and
--    authenticated inherit it through PUBLIC — revoking their direct grant
--    leaves the inherited one untouched. The function is SECURITY DEFINER, so
--    it ran as the owner and cheerfully told a member which dishes are made up
--    and which are priced but unconfirmed.
--
--    The rule worth remembering: to take EXECUTE away you revoke from PUBLIC,
--    not from the roles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · the views ──────────────────────────────────────────────────────────
revoke all on public.menu_plates_public from anon;
revoke all on public.menu_dining_public from anon;

-- Re-asserted so this file alone describes the intended end state.
grant select on public.menu_plates_public, public.menu_dining_public to authenticated;

-- ── 2 · the audit function ─────────────────────────────────────────────────
-- PUBLIC first; the two role revokes are belt and braces for the case where a
-- later migration grants one of them directly.
revoke all on function public.menu_placeholder_audit() from public;
revoke all on function public.menu_placeholder_audit() from anon;
revoke all on function public.menu_placeholder_audit() from authenticated;

-- The admin route calls this with the service role and must keep working.
grant execute on function public.menu_placeholder_audit() to service_role;
