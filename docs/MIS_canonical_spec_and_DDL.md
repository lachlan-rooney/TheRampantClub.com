# TRC MIS — Canonical Scoring Spec & DDL

Extracted from the live Apps Script (Master Intelligence Sheet, ID `1Z1XfrCemeKyO1etsJMNJfp54PK6hnmZIDK-7iQFm40Q`). This is the source of truth for the web migration — **build to what the sheet actually computes, not to the v2 plan doc**, then change deliberately where flagged below.

> **Companion document:** `MIS_scoring_and_ML_reference.md` — the model & ML narrative
> reference. This file is the **implementation contract**: formula, DDL, taxonomy, fixed
> enums, source-column map. The narrative file owns the survival-model derivation,
> propose-only governance, calibration, and dissertation-grade reasoning. Both must
> agree byte-for-byte on the formula, the four enums, the 9 categories, the lock
> taxonomy (§4 here / §4 there), the designed-λ table (§5 here / §5.1 there), and the
> provenance tag list (§6 here / §6 there).
> **If they disagree, the code is the tiebreaker.**

---

## 0. Discrepancies the build must resolve (decisions for Lachlan)

The codebase grew in layers and disagrees with itself in four places. Pick one of each before writing the migration; the recommended choice is the one that matches the data currently in the sheet.

1. **RESOLVED — build the full 6 variables now.** The legacy sheet computes only `S₀ × C × e^(−λt) × F`, but R and M are not fiction: both are pure functions of data already modelled — R from `validation_count`, M from member visit cadence (see §2). Building them into the view now costs nothing (with current data they evaluate to 1.0, so no existing score changes) and means the core formula is never altered again as the club scales. **Full model: `PS(t) = S₀ × C × e^(−λt) × F × R × M`.**

2. **RESOLVED — cap at the scale ceiling of 5, floor at 0.** With R and M in, the formula has three amplifiers (F, R, M) whose purpose is to let a moderately important preference rise in salience when it is certain, fresh, frequently relevant, reinforced, and from an engaged member. Capping at `S₀` would crush that signal, so it's wrong here (it was only sensible in the 4-variable world). Degraders C and e^(−λt) pull down from S₀; amplifiers push up; the result is clamped to the readable 0–5 scale. No artificial floor — non-zero-λ preferences should decay toward 0 so the revalidation flag fires; medical (λ=0) never decays and stays at full value.

3. **Two revalidation rules.** Tab-builder (richer): flag if `PS < 0.7·S₀ OR days>180 OR (S₀≥4 AND days>90)`. Enhancement writer (simpler): `days>180 → REVALIDATE, days>90 → Monitor`. *Recommendation: use the richer tab-builder rule — it's score-aware, which is the point of the system.*

4. **Category taxonomy has four conflicting lists.** The **9-category SETTINGS list is canonical** because it's what the actual member data (Mikey/Evan/Brandon) uses. The `_callClaude` enhancement prompt's list (`Health & Safety | Dietary | Beverage/Whisky | …`) and the stale column-note list (`Service & Environment`, `Communication`, …) are both **wrong** — discard them. The interview processor must emit only the 9 canonical values. **(Medical and identity preferences live in whichever ordinary category they naturally belong to and are locked at row level — see §4.)**

Also discard: the `K4` column note claiming decay values of `0.10 / 0.20 / 0.30`. It is stale. The real λ set is `0.000 / 0.002 / 0.005 / 0.010 / 0.020` (see §2).

---

## 1. The formula

```
PS(t) = S₀ × C × e^(−λ·t) × F × R × M
```

- `t` = whole days since the preference was last validated = `TODAY() − [Last Validated date]`
- `R`, `M` defined in §2; both default to 1.0 (no effect) until validation/visit history accrues
- Cap: `LEAST(5, …)` — the readable scale ceiling. Floor at 0 (no artificial floor).
- Legacy note: the old sheet ran the 4-variable form `S₀ × C × e^(−λt) × F` capped `MIN(5,…)`. The new model is a strict superset — with `R=M=1.0` it reproduces the old numbers exactly, then diverges upward only as preferences are reinforced and members engage.

**Score Health %** = `PS(t) / S₀` formatted as a percentage. (One legacy writer used `PS / (S₀·C·F)`; the `PS/S₀` version is canonical because it's what the dashboard reads.)

**Needs Revalidation** (canonical, score-aware):
```
flag "⚠ REVALIDATE" if:  PS < 0.7·S₀
                     OR  days_since > 180
                     OR  (S₀ ≥ 4 AND days_since > 90)
else "✓ OK"
```

---

## 2. Scoring inputs — exact derivation

These are the rules the interview processor (`callClaudeForPreferences`) applies. Reproduce them verbatim in the new interview-intake service so extraction stays identical post-migration.

### S₀ — Importance (integer 1–5)
| S₀ | Meaning | Linguistic signal | Consequence if wrong |
|----|---------|-------------------|----------------------|
| 5 | Absolute | "never/always/allergic/require" + emotion + repetition | Member angry — never surprise |
| 4 | Strong | "really prefer/strongly dislike/love/hate" + a reason/story | Disappointed |
| 3 | Moderate | "tend to/usually/enjoy" stated calmly | Mildly annoyed |
| 2 | Mild | "sometimes/don't mind/might be nice" | Wouldn't notice |
| 1 | Aware | "okay either way/no opinion" | Minimal |

### C — Confidence (enum: 1.00 / 0.75 / 0.50 / 0.25)
- `1.00` Explicit — member directly stated it
- `0.75` Observed — pattern seen 3+ times
- `0.50` Inferred — derived from related info
- `0.25` Speculative — one-off / uncertain
- At first interview almost everything is `1.00`. Modifiers: emotional language `+0.20`, repetition `+0.10`/mention, qualifier ("sometimes") `−0.20`, contradiction `−0.50`. Cap 1.00, floor 0.25.

### λ — Decay (enum: 0.000 / 0.002 / 0.005 / 0.010 / 0.020)
| λ | Class | Test |
|---|-------|------|
| 0.000 | Medical / dietary identity / declarative identity facts (see §4) | Same in 10 years? |
| 0.002 | Core personality / cultural identity / lifelong aesthetic | About who they *are*? |
| 0.005 | Established habit, consistent preference | Consistent across contexts? |
| 0.010 | Variable / emerging / mood-dependent | Could change in 2–3 months? |
| 0.020 | Temporary / seasonal / current situation | Different in 6 months? |
- When in doubt, choose the **slower** decay (lower number).

### F — Frequency modifier (enum: 0.8 / 1.0 / 1.2 / 1.5)
- `0.8` rarely · `1.0` monthly (default at interview) · `1.2` weekly/most visits · `1.5` daily/every visit
- Always `1.0` at initial interview; only changes after 3+ months of visit data.

### R — Reinforcement (computed, range 1.0–1.3)
Pure function of `validation_count` (column N). Not entered by staff or AI — derived in the view.
```
R = LEAST(1.3, 1.0 + 0.075 × (validation_count − 1))
```
- vc=1 → 1.000 (default, no reinforcement yet) · vc=2 → 1.075 · vc=3 → 1.150 · vc=4 → 1.225 · vc≥5 → 1.300 (cap)
- Each confirmed validation increments `validation_count`, so R climbs automatically as a preference is re-verified over time.
- *Alt form (diminishing-returns curve) if preferred later: `R = 1.0 + 0.3 × (1 − e^(−0.4·(validation_count−1)))`. Linear-capped is the default for legibility.*

### M — Member engagement (computed, range 0.8–1.5)
Pure function of member visit cadence. Derived in the view from a member-stats aggregate; **defaults to 1.0 whenever visit history is absent**, so new members and the pre-Harmony-Log state are never distorted.
```
M = 1.0                                                              when total_visits = 0 (or no visit data)
M = LEAST(1.5, GREATEST(0.8, 1.0 + 0.25 × (avg_visits_per_month − 1)))   otherwise
```
- avg_visits_per_month = 1 → 1.0 (neutral) · 2 → 1.25 · ≥3 → 1.50 (cap) · lapsed/low → floored at 0.8
- `avg_visits_per_month` = `total_visits / months_since_join` (matches the Directory's existing Avg Visits/Month formula).
- *Refinement for later: recency-weight M off `days_since_visit` rather than lifetime rate. Lifetime rate is the honest first cut and matches the plan's "frequent visitors" wording.*

### Cadence-aware adjustments (from non-verbal transcript tags)
- Physical emphasis `[Firmly] [Leans forward] [Points]` → S₀ +1
- Interruption `[Interrupts]` → S₀ minimum 4
- Emotional softening `[Softens] [Voice drops]` → λ = 0.002
- Hesitation `[Pauses] [Long pause]` → C −0.25
- Humour `[Laughs]` → S₀ −1
- Relief/reluctant `[Sheepish]` → λ = 0.010

Medical and declarative-identity preferences (see §4) are **always** S₀=5, C=1.00, λ=0.000 — enforced by code-deterministic guardrails, not by AI judgement.

---

## 3. The 9 canonical categories
```
Personal & Lifestyle
Food & Beverage
Whisky & Beverage
Social & Networking
Business & Productivity
Wellness & Comfort
Cultural & Intellectual
Family & Personal
Travel & Global
```
(Interview processor must emit exactly these strings. Note the sheet's `Whisky & Beverage` is its own category distinct from `Food & Beverage`.)

---

## 4. Permanence locks — row-level overrides, not categories

Some preferences must never decay. They are pinned to **S₀=5, C=1.00, λ=0.000** as a **row-level override applied inside the preference's natural category** — not via a separate category. ("Health & Safety" is not a category.) Three origins of a λ=0 lock are resolved in strict deterministic precedence:

**MEDICAL > IDENTITY > AI-PERMANENT**

The first two are **enforced in code** (content-detected, deterministic, never trusted to the AI). The third is the residual case where the AI itself judged a preference permanent and neither guardrail fired. Each carries a distinct provenance tag (§6).

| origin | trigger | bias | enforced by | nature |
|---|---|---|---|---|
| `forced_medical` | content-detected medical / allergy / dietary signal | over-catch (safe — a false lock is harmless) | `isMedicalPreference` in `lib/mis/extraction-decay.ts` | code-deterministic |
| `forced_identity` | content-detected declarative identity / relationship fact | under-catch (precision — a false lock is invisible and self-perpetuating) | `isIdentityPreference` in `lib/mis/extraction-decay.ts` | code-deterministic |
| `ai_permanent` | model emitted λ=0; neither guardrail fired | — | the AI's own judgement | model-judged residue |

**Bias contrast.** A false medical lock is harmless (the preference becomes a fact); a false identity lock is costly and invisible (a wrongly-permanent preference never decays and never flags for revalidation).

**Fact vs preference discriminator.** "I'm a peat man" stays a slow-decaying preference (taste); "my wife, Sophie" locks (relationship fact). Emphasis is not identity; relationship/identity structure is.

**Precedence example.** "I keep halal" is identity-flavoured but locks as `forced_medical` because medical detection runs first.

For the full bias reasoning, the consistency-analyser drift that motivated the identity guardrail, and the sentiment-anchored / structural-disqualifier examples, see narrative §4.

---

## 5. Designed λ per category

Every category has a **designed λ** — the decay-rate prior centre, before any learning. Allowed values are `{0.000, 0.002, 0.005, 0.010, 0.020}` day⁻¹ (half-lives ∞, ≈347, ≈139, ≈69, ≈35 days). The designed-λ map lives in `lib/mis/decay-priors.ts` as a single source of truth — imported by both the learning job and the extraction engine — so they cannot diverge.

| Category | Designed λ | Half-life | Basis |
|---|---|---|---|
| Whisky & Beverage | 0.005 | ≈139 d | modal of live rows (excl. medical zeros) |
| Food & Beverage | 0.005 | ≈139 d | modal of live rows |
| Cultural & Intellectual | 0.005 | ≈139 d | modal of live rows |
| Travel & Global | 0.005 | ≈139 d | modal of live rows (thin) |
| Personal & Lifestyle | 0.002 | ≈347 d | modal of live rows (medical zeros excluded) |
| Social & Networking | 0.002 | ≈347 d | modal of live rows |
| Business & Productivity | 0.002 | ≈347 d | operators set ~year half-life |
| Wellness & Comfort | 0.002 | ≈347 d | modal of live rows (sparse — reconsider once n_active > 20) |
| Family & Personal | 0.002 | ≈347 d | first-principles core-identity (no live rows yet) |

These values were re-anchored from the original specification to the modal values present in live data; in five of nine categories staff filed preferences as more durable (slower-decaying) than the specification assumed. The prior encodes what operators actually believe.

**Medical and identity locks (λ=0) are not in this table** — they are row-level overrides per §4 and are excluded from learning at the view layer because λ=0 cannot be fit.

For the v1-vs-operator anchoring reasoning and the implication that operator practice surfaced a finding, see narrative §5.1.

---

## 6. λ provenance tags (`lambda_origin`)

Every extracted preference is stamped with a `lambda_origin` recording where its decay rate came from. This is the audit trail — used by the consistency analyser, the per-factor rationale UI, and the dissertation appendix.

| tag | meaning | nature |
|---|---|---|
| `ai_specific` | model assigned a confident per-preference λ from transcript signal | model judgement |
| `category_baseline_learned` | no preference-specific signal; inherited the category's **learned** λ | the loop closing |
| `category_baseline_designed` | no preference-specific signal; inherited the category's **designed** λ | the seed |
| `forced_medical` | medical lock fired (§4) | code-deterministic |
| `forced_identity` | identity lock fired (§4) | code-deterministic |
| `ai_permanent` | model emitted λ=0; neither guardrail fired (§4) | model judgement |

A promotion on `/admin/decay-fit` flips a row's provenance from `category_baseline_designed` → `category_baseline_learned` for subsequent extractions — the visible signature of the loop closing.

For the closed-loop mechanics (live lookup, learned-over-designed merge, the ML governance), see narrative §6.

---

## 7. Source column map (for the migration scripts)

**PREFERENCE REGISTER** (22 cols). Data lives in A, D–N, S–V. **Formula columns B, C, O, P, Q, R are derived — never migrate them as data; recompute via the view.**

| Col | Field | Type |
|-----|-------|------|
| A | Member Name | data (FK by name) |
| B | Member No. | *formula (lookup)* |
| C | Tier | *formula (lookup)* |
| D | Category | data |
| E | Subcategory | data |
| F | Preference Name | data |
| G | Detail/Description | data |
| H | Verbatim Quote | data |
| I | S₀ | data (1–5) |
| J | C (Confidence) | data |
| K | λ (Decay) | data |
| L | F (Frequency) | data |
| M | Last Validated | data (date) |
| N | Validation Count | data (int) |
| O | Days Since | *formula* |
| P | Current PS(t) | *formula* |
| Q | Needs Revalidation | *formula* |
| R | Score Health % | *formula* |
| S | Source | data |
| T | Contradiction? | data (bool) |
| U | Logged By | data |
| V | Created Date | data (date) |

**DIRECTORY** (15 cols). Data in A–I, N, O. Formulas J–M derived from Harmony Log visit data.

| Col | Field | Type |
|-----|-------|------|
| A | Member No. | data (PK, `TRC-Mnnn`) |
| B | Full Name | data |
| C | Nickname/Preferred | data |
| D | Tier | data |
| E | Status | data |
| F | Join Date | data |
| G | Birthday | data |
| H | Email | data |
| I | Phone | data |
| J | Total Visits | *formula (count Harmony Log)* |
| K | Last Visit | *formula* |
| L | Days Since Visit | *formula* |
| M | Avg Visits/Month | *formula* |
| N | Referred By | data |
| O | Score 5 Flags | *formula (from Register)* |

**PROFILES** (44 cols) is a denormalised summary view of the Register — **do not migrate as a table.** Rebuild as a Postgres view or compute on read. Cols A–C are lookups; D–AO are keyword-bucketed preference summaries; AP=Total Score 5s, AQ=Score 5 List, AR=Last Updated.

Other sheets for **later passes** (not first build): `SALES PIPELINE` (prospect CRM, ~35 cols), `ACTION ITEMS` (per-member task list), `HARMONY LOG` + `GUARDIAN ANGEL` (Staff Operations sheet, feeds visit counts), `CALIBRATION`.

Current data volume is tiny — 3 members (M001 Mikey Brenker, M002 Evan Robertson, M003 Brandon Chew), Brandon ~67 preferences. **This is hand-verifiable; skip the two-week parallel-sync machinery from the v2 plan.**

---

## 8. DDL — paste into the build

```sql
-- ── MEMBERS (from DIRECTORY A–I, N) ──
CREATE TABLE members (
    member_no    VARCHAR(12) PRIMARY KEY,           -- 'TRC-M001'
    full_name    TEXT NOT NULL,
    nickname     TEXT,
    tier         VARCHAR(20) NOT NULL,              -- Founding/Legacy/Pioneer/Corporate/Honorary
    status       VARCHAR(20) NOT NULL DEFAULT 'Active',
    join_date    DATE,
    birthday     DATE,
    email        TEXT,
    phone        TEXT,
    referred_by  TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── PREFERENCES (from PREFERENCE REGISTER A, D–N, S–V) ──
-- Formula cols B,C,O,P,Q,R are NOT stored; computed by the view below.
CREATE TABLE preferences (
    preference_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_no       VARCHAR(12) NOT NULL REFERENCES members(member_no),
    category        VARCHAR(40) NOT NULL,           -- one of the 9 canonical values
    subcategory     TEXT,
    preference_name TEXT NOT NULL,
    detail          TEXT,
    verbatim_quote  TEXT,
    s0              SMALLINT NOT NULL CHECK (s0 BETWEEN 1 AND 5),
    confidence      NUMERIC(3,2) NOT NULL CHECK (confidence IN (1.00,0.75,0.50,0.25)),
    lambda          NUMERIC(5,3) NOT NULL CHECK (lambda IN (0.000,0.002,0.005,0.010,0.020)),
    frequency       NUMERIC(2,1) NOT NULL CHECK (frequency IN (0.8,1.0,1.2,1.5)),
    last_validated  DATE NOT NULL,
    validation_count INT NOT NULL DEFAULT 1,
    source          VARCHAR(30) DEFAULT 'Interview',
    contradiction   BOOLEAN DEFAULT FALSE,
    logged_by       TEXT,
    created_date    DATE DEFAULT CURRENT_DATE,
    status          VARCHAR(20) DEFAULT 'active',   -- active/invalidated/archived (v2 add)
    last_event_timestamp TIMESTAMPTZ                -- v2 add, feeds future R/M terms
);
CREATE INDEX idx_pref_member ON preferences(member_no);
CREATE INDEX idx_pref_category ON preferences(category);

-- ── VISITS — clean normalised target the Harmony Log migrates INTO ──
-- Columns mirror the Harmony Log fields the legacy system actually reads
-- (Member, Date, Space, Duration, Emotional State, Logged By, Notes).
-- The messy HARMONY LOG → visits mapping is a separate migration script,
-- written when that sheet is in scope; this table is the stable contract.
CREATE TABLE visits (
    visit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_no       VARCHAR(12) NOT NULL REFERENCES members(member_no),
    visit_date      DATE NOT NULL,
    space           TEXT,
    duration_min    INT,
    emotional_state TEXT,
    logged_by       TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_visits_member ON visits(member_no);
CREATE INDEX idx_visits_member_date ON visits(member_no, visit_date);

-- ── MEMBER STATS — visit aggregates feeding M. Reads visits directly. ──
-- While visits is empty, avg_visits_per_month is NULL → M falls back to 1.0.
-- No edit needed when visit data starts arriving; M activates automatically.
CREATE VIEW member_stats AS
SELECT
    m.member_no,
    COUNT(v.visit_id)                                                  AS total_visits,
    MAX(v.visit_date)                                                  AS last_visit,
    (CURRENT_DATE - MAX(v.visit_date))                                 AS days_since_visit,
    CASE
        WHEN m.join_date IS NULL OR COUNT(v.visit_id) = 0 THEN NULL
        ELSE COUNT(v.visit_id)::numeric
             / GREATEST((CURRENT_DATE - m.join_date)::numeric / 30.44, 1)
    END                                                                AS avg_visits_per_month
FROM members m
LEFT JOIN visits v ON v.member_no = m.member_no
GROUP BY m.member_no, m.join_date;

-- ── LIVE PS(t) — a VIEW, not an edge function. Full 6-variable model. ──
-- Scales to any member count: pure per-row arithmetic + one indexed join for M.
CREATE VIEW preference_scores AS
WITH scored AS (
    SELECT
        p.*,
        (CURRENT_DATE - p.last_validated)                              AS days_since,
        LEAST(1.3, 1.0 + 0.075 * (p.validation_count - 1))             AS r_reinforce,
        CASE
            WHEN ms.avg_visits_per_month IS NULL THEN 1.0
            ELSE LEAST(1.5, GREATEST(0.8, 1.0 + 0.25 * (ms.avg_visits_per_month - 1)))
        END                                                            AS m_engage
    FROM preferences p
    JOIN member_stats ms ON ms.member_no = p.member_no
    WHERE p.status = 'active'
)
SELECT
    scored.*,
    LEAST(5,
        s0 * confidence * EXP(-lambda * days_since) * frequency * r_reinforce * m_engage
    )                                                                  AS ps_t,
    ROUND(
        LEAST(5, s0 * confidence * EXP(-lambda * days_since) * frequency * r_reinforce * m_engage)
        / NULLIF(s0,0) * 100, 0
    )                                                                  AS score_health_pct,
    CASE
        WHEN LEAST(5, s0 * confidence * EXP(-lambda*days_since) * frequency * r_reinforce * m_engage)
             < 0.7 * s0
          OR days_since > 180
          OR (s0 >= 4 AND days_since > 90)
        THEN '⚠ REVALIDATE'
        ELSE '✓ OK'
    END                                                                AS needs_revalidation
FROM scored;
-- With current data (validation_count=1 → R=1.0; no visits → M=1.0) this reproduces
-- the legacy 4-variable scores exactly. R and M activate automatically as data accrues.

-- ── VALIDATION EVENTS (v2 — the ML layer's source; start logging from day one) ──
CREATE TABLE validation_events (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preference_id   UUID NOT NULL REFERENCES preferences(preference_id),
    member_no       VARCHAR(12) NOT NULL REFERENCES members(member_no),
    event_type      VARCHAR(30) NOT NULL,           -- confirmed/contradicted/revised/invalidated
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    days_since_last_validation INT NOT NULL,
    confidence_before NUMERIC(3,2),
    confidence_after  NUMERIC(3,2),
    staff_id        TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ve_pref ON validation_events(preference_id);
CREATE INDEX idx_ve_member ON validation_events(member_no);
CREATE INDEX idx_ve_type_ts ON validation_events(event_type, event_timestamp);

-- ── LEARNED DECAY CONSTANTS (v2 — output of the weekly fit; leave empty for now) ──
CREATE TABLE learned_decay_constants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category        VARCHAR(40) NOT NULL,
    learned_lambda  NUMERIC(8,6) NOT NULL,
    designed_lambda NUMERIC(8,6) NOT NULL,
    lambda_ci_lower NUMERIC(8,6),
    lambda_ci_upper NUMERIC(8,6),
    n_observations  INT NOT NULL,
    n_events        INT NOT NULL,
    half_life_days  NUMERIC(8,2),
    fit_timestamp   TIMESTAMPTZ NOT NULL,
    in_production   BOOLEAN DEFAULT FALSE,
    notes           TEXT
);
```

### Validation write contract (drives R, feeds the ML layer)
Every confirm/revise of a preference happens in **one transaction**:
```sql
-- 1. increment reinforcement + refresh the clock
UPDATE preferences
SET validation_count = validation_count + 1,
    last_validated   = CURRENT_DATE,
    last_event_timestamp = now()
WHERE preference_id = $1;

-- 2. log the event (the ONLY source the weekly λ-fit learns from)
INSERT INTO validation_events
    (preference_id, member_no, event_type, days_since_last_validation,
     confidence_before, confidence_after, staff_id, notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
```
Step 1 is what moves R upward over time; step 2 is the only record the learning layer reads. **Never do one without the other** — a confirm that skips the event log is invisible to the ML layer; an event that skips the increment leaves R stale.

### Migration keys on member_no, not name
The legacy sheet joins preferences → members **by member name** (Register column A), which is why the codebase carries `TRIM` workarounds and one-off trailing-space fixes. The migration must resolve each preference's name to its `member_no` once, at import, and store the FK. This permanently kills the trailing-space / name-mismatch class of bug — names can then change freely without orphaning preferences.

---

## 9. Member health index (optional admin metric — port as-is)
```
visit_score   = LEAST(visits/10, 1) * 30
recency_score = days_since<14 ?40 : <30 ?30 : <45 ?15 : 0
pref_score    = LEAST(pref_count/10, 1) * 30
health        = ROUND((visit+recency+pref)/100*50)/10        -- 0–5 scale
grade         = health>=4 'A' : >=3 'B' : >=2 'C' : 'D'
```
