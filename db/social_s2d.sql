-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE S2d — palate twins  ·  REVIEW, then run (after S0/S2a/S2b/S2c)
-- ───────────────────────────────────────────────────────────────────────────
-- The ONLY new object: a 'via' flag on introductions so a palate-match intro can
-- be MASKED (the double-blind — the recipient sees "a member whose palate is 87%
-- yours", not the requester's name, until they accept). Everything else reuses the
-- proven S2c machinery (silent decline, atomic-thread-on-accept, unique-pair).
-- Matching is computed server-side; NO vectors/identities ever reach a client.
-- The 'palate_twin' opt-in is the existing member_consents (own-write); the
-- threshold is tunable in lib/whisky/palate-twins.ts (PALATE_TWIN_THRESHOLD).
-- ═══════════════════════════════════════════════════════════════════════════

alter table introductions
  add column if not exists via text not null default 'directory'
  check (via in ('directory', 'palate_match'));
