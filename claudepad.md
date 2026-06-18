# Session Summaries

## 2026-06-18T10:38Z — Vectorize Top-Two Thompson allocation (hot-path perf)
- **Perf fix (core hot path)**: `TopTwoThompsonSampler.get_allocation` (api/app/stats/bandits.py) ran a 10,000-iteration **Python loop** doing scalar `rng.beta()` calls per arm per round. It executes on *every* `analyze_experiment` call — i.e. every dashboard/CLI/API experiment-results load — and was the single biggest CPU cost in the pipeline (everything else: `probability_b_beats_a`, `expected_loss`, `probability_best`, `rope_decision` was already vectorized). Measured **34 ms/call → 1.3 ms/call (~27x)** for a 3-arm experiment.
- **Fix**: replaced the loop with vectorized numpy — two `(n_samples, n_variants)` `rng.beta(alphas, betas, size=...)` draw matrices (round 1 → arm1=argmax; round 2 with per-row `-inf` mask on arm1 → arm2=challenger) plus one `rng.random(n_samples)` coin vector, then `np.bincount`. The min-allocation floor-redistribution and final normalization blocks are preserved **byte-for-byte**. `select_variant` (single-draw live path) untouched; note live assignment uses deterministic FNV-1a (`assign_variant`), not the bandit, so this is purely the results-analysis path.
- **Why it's safe**: statistically equivalent Monte Carlo estimate — same distribution, differs from the old loop only by RNG draw order (so not bit-identical per-seed, but agrees within MC noise). The `n_variants == 1` case now early-returns `[1.0]` (equivalent: old loop counted arm0 every round → `[1.0]`).
- **Tests**: added `test_vectorised_matches_reference_loop` (parametrized, 4 scenarios incl. clear-winner/equal/3-arm/floor-stress) in api/tests/test_stats_v2.py — pins the *algorithm* via an independent un-vectorized reference loop the production impl must match within abs=0.02 at 50k samples. Guards against a future re-impl silently changing the distribution. All 8 existing TopTwo tests (exploration>standard, floor enforced, sums-to-1, reproducible, single-variant) still pass.
- **Verification**: pure-logic suite 235→239 passed; `app.main` imports clean; OpenAPI builds (16 paths). Code-reviewed via subagent (correctness-only): no concerns — broadcasting, per-row masking, dtype, reproducibility, and the preserved floor/normalize blocks all confirmed. Integration tests (e2e/cli_auth) still need a live server on :8001 — not run (unchanged).

## 2026-06-18T04:48Z — Fix stats-engine crash: conversions counted as events, not visitors
- **Bug fixed (500 on a core endpoint)**: `StatsEngine._count_conversions` (api/app/stats/engine.py) counted the *number of conversion events* (explicit `conversion` + confirmed `goal_completed`, summed), while `_count_visitors` counts *distinct* visitors. A visitor who fired >1 conversion event made `conversions > visitors`, so `BetaBinomial.update` raised `ValueError("successes cannot exceed trials")` → **500 on `GET /api/v1/experiments/{id}/results`**, breaking the whole experiment detail page. This is reachable under normal SDK use: the click/form trackers (packages/sdk/src/tracking/clicks.ts, forms.ts) emit a `goal_completed` on *every* matching click with no dedup, so clicking a confirmed-goal CTA twice (or firing both `conversion` + `goal_completed`) triggers it. Offline retry re-sends can also duplicate.
- **Fix**: `_count_conversions` now counts **distinct visitors who converted** (single query: `COUNT(DISTINCT visitor_id)` where assignment matches AND `(event_type='conversion' OR (event_type='goal_completed' AND payload->>'goalType' IN confirmed))`). This is the correct Beta-Binomial semantics (each visitor = one Bernoulli trial), fixes the prior double-counting of repeat converters, and guarantees `conversions <= visitors` (converters are a strict subset of assigned visitors — same event-level assignment predicate). `conversion_rate` is now always in [0,1].
- **Efficiency**: hoisted the confirmed-goal-types lookup out of the per-variant loop into `_get_confirmed_goal_types(project_id)` (was an N+1 — re-queried for every variant; now once per analysis).
- **Defense-in-depth**: added `conversions = min(conversions, visitors)` clamp before `prior.update()` so a public results request can never 500 from this class of bug regardless of future query changes. (Reviewer confirmed the SQL already guarantees the invariant; the clamp never silently hides data.)
- **Tests**: new api/tests/test_engine.py (6 cases) — first coverage of the ~250-line `analyze_experiment` orchestration. Subclasses `StatsEngine`, overrides the 4 DB helpers with canned data, backs it with a fake session (empty results → prior/shrinkage fall back to defaults), drives the real orchestration via `asyncio.run` (no live server). Proven to catch the regression: removing the clamp makes the overflow tests fail with the exact `ValueError`. Engine queries use Postgres JSONB ops so they can't run on SQLite — hence the override approach.
- **Also**: fixed an unrepresentative e2e fixture (test_e2e_flow.py) that sent `goal_completed` with `{"goal_id": ...}` — the SDK/engine use `goalType`. Cosmetic (the test only asserts `accepted`), but now matches the real contract.
- **Verification**: non-integration suite 229→235 passed; `app.main` imports clean; OpenAPI builds (16 paths). Code-reviewed via subagent: no blocking issues. Integration tests (test_e2e_flow/test_cli_auth) still need a live server on :8001 — not run here (unchanged).

## 2026-06-17T21:54Z — Harden public SDK ingestion endpoints (events/init/goals)
- **Theme**: extends the prior commit's input-hardening from the authenticated experiment-config path to the three PUBLIC (project-token) SDK-facing endpoints, which had zero field validation.
- **Vulnerability class fixed**: oversized scalar strings overflowed their `String(N)` columns and surfaced as opaque DB-level **500s**; unbounded `/events` batches were a memory/DoS vector on a public endpoint. Both now return clean **422**s.
- **`/events`** (api/app/routers/events.py): `EventItem.visitor_id/session_id/event_type` bounded `1..255` (matches `String(255)` cols); `BatchEventsRequest.events` capped at `MAX_EVENTS_PER_BATCH=1000` (module constant w/ rationale — SDK flushes ~10, offline retry caps at 100, so 10x headroom). Empty batch still allowed (harmless no-op).
- **`/init`** (api/app/routers/init.py): `visitor_id` `1..255`; `session_id` optional, `1..255` when present. Note: length bounds only — no stripping/normalization, so client/server FNV-1a assignment parity is untouched.
- **`POST /goals`** (api/app/routers/goals.py): `GoalCreate.type` `1..100` (matches `String(100)`), `label` `1..255`; `GoalUpdate.label` optional `1..255`.
- **Scope discipline**: JSONB fields (`payload`, `experiment_assignments`, `attributes`, `trigger`) left intentionally unbounded (rich SDK payloads must pass) — locked in by an explicit test.
- **Tests**: new api/tests/test_ingestion_schema.py (36 pure-Pydantic cases, no DB — same fast tier as test_experiment_schema.py). Non-integration suite 193→229 passed. App + OpenAPI build verified; constraints now self-document in the public spec.
- **Reviewed** via subagent against the DB models AND the initial migration: all bounds match columns exactly, no off-by-one, no legitimate SDK input rejected (SDK uses 36-char UUIDs, event types ≤14 chars, goal type/label ≤~72 chars). No blockers.

## 2026-06-17T11:56Z — Harden variant assignment + experiment input validation
- **Bug fixed**: `assign_variant` (api/app/services/assignment.py) raised `ZeroDivisionError` on empty `variant_keys` (`bucket % 0`) — a 500-error vector on the PUBLIC `POST /init` endpoint for the whole project. Now returns `None` (no assignment) defensively, so legacy/misconfigured rows can't crash ingestion.
- **Input validation**: added Pydantic v2 `Field`/`field_validator` to `ExperimentCreate`/`ExperimentUpdate` (api/app/routers/experiments.py): `variant_keys` non-empty (min_length=1) + unique + non-blank (stripped); `traffic_percentage`/`loss_threshold`/`rope_width` bounded [0,1]; `expected_conversion_rate` in (0,1); `prior_confidence` > 0; `key`/`name` length 1..255 (matches DB String(255)). Malformed experiments now 422 instead of silently corrupting stats or 500-ing later.
- **Conservative choice**: used `min_length=1` (not 2) so a single-variant rollout — currently working behavior — is preserved; only the empty list (the real crash) is rejected.
- **SDK docstring fix** (packages/sdk/src/core/assignment.ts): old comment described contiguous range-partitioning but the code does `bucket % len` (interleaved). Rewrote with correct worked examples + note that it MUST match the Python backend byte-for-byte. No behavior change.
- **CLI parity** (packages/cli): extracted `parseVariantKeys()` helper (lib/variants.ts) used by `experiments create` + `init`; trims/drops blanks like the dashboard (tolerates "a,,b"/trailing commas), defaults to control/variant on blank input. Deliberately does NOT dedup (lets API flag genuine mistakes).
- **Tests**: new api/tests/test_assignment.py (FNV-1a + assign_variant, locks cross-language hash parity with the SDK's exact values, covers empty-variant guard + traffic gating) and api/tests/test_experiment_schema.py (Pydantic validation, no DB). Moved the pure-logic FNV tests out of test_e2e_flow.py (which needs a live server). New CLI variants.test.ts.
- **Verification**: API non-integration 139→193 passed; SDK 59; CLI 65→74; MCP 29. Integration tests (test_e2e_flow/test_cli_auth) still need a live server on :8001 — unchanged, not run here. Code-reviewed via subagent: no blockers.

## 2026-03-12T12:30Z — Dogfood Vibariant + CLI auth + email service + deploy fixes
- Dogfooded Vibariant on vibariant.com: integrated SDK into landing page for hero CTA AB test
- Created `hero-cta` experiment (control="Start Free", variant="Get Started Free") with click tracking via `useTrack()`
- Added `VibariantWrapper` component wrapping landing page with `VibariantProvider`
- Implemented Resend email service (`api/app/core/email.py`): CLI verify emails + magic link emails
- Added CLI verify page (`/auth/cli-verify`): reads device_code+token from URL, calls cli-complete API
- Fixed CLI default API URL: changed from localhost:8000 to https://api.vibariant.com
- Fixed CLI auth poll timeout: 5min → 2 hours (per user request)
- Added `cliComplete()` to dashboard API client
- Rewrote `dashboard/Dockerfile` for monorepo: SDK copied into builder stage node_modules (deps stage COPY was silently lost by multi-stage builds)
- Added `packages/sdk/react/package.json` proxy directory for webpack subpath export compatibility
- Created `Wordmark` brand component, extracted from inline spans across nav/footer/sidebar/login
- Added `.dockerignore`, `docker-compose.prod.yml` env vars for RESEND_API_KEY + FROM_EMAIL
- Config: added RESEND_API_KEY, FROM_EMAIL, DASHBOARD_URL to API settings
- 3 new CLI tests for `getApiUrl()` defaults
- End-to-end CLI auth flow working in production (email → browser verify → poll → authenticated)
- Deployed and health-checked on ovh2

## 2026-03-12T02:40Z — Upgrade MCP server: 8 → 13 tools with CLI parity
- Migrated all tools from deprecated `server.tool()` to `server.registerTool()` with MCP annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- Added 5 new tools: `vibariant_delete_experiment`, `vibariant_experiment_show`, `vibariant_goals_list`, `vibariant_goals_confirm`, `vibariant_status`
- Added `generateCodeStructured()` to codegen.ts: returns `{ files: [{path, content}] }` instead of markdown
- Added 3 API methods to api.ts: `deleteExperiment`, `listGoals`, `confirmGoal` + 204 void response guard
- Extracted helpers (compact, resolveProjectId, aggregateStatus, findExperiment) to `helpers.ts` to avoid top-level await side effects in tests
- compact() now returns `{items, total, truncated}` when truncating arrays (prevents LLMs reasoning on incomplete data)
- Fixed create_experiment auto-start bug (now returns draft status matching CLI behavior)
- Fixed update_experiment truthiness check (`!== undefined` instead of `if (val)`)
- 29 MCP tests passing (13 codegen + 16 server helpers), 62 CLI tests still passing
- Updated ARCHITECTURE.md: "8 tools" → "13 tools"

## 2026-03-12T00:31Z — Restore MCP as opt-in secondary integration
- Recovered `packages/mcp/` from git history (commit 4a1d087): 8 MCP tools, API client, codegen
- New hidden `vibariant mcp-install` command with shared `installMcpConfig()` helper
- `vibariant init --mcp` flag: interactive prompt defaults to No, `--yes` without `--mcp` skips MCP
- Updated ARCHITECTURE.md: "Claude Code Integration" → "AI Agent Integration" with primary (CLI+skills) and secondary (MCP) sections
- Fixed Commander.js `.hidden()` incompatibility → used `addCommand(cmd, { hidden: true })`
- Fixed URL parameter injection in MCP api.ts (`encodeURIComponent` on projectId)
- Added `homeDir` option to `installMcpConfig` for testable global scope
- 67 tests passing (62 CLI including 7 new mcp-install tests, 5 MCP codegen tests)
- Code review: inherited issues (stale response in create_experiment, no timeout on API calls, top-level await) documented but not changed since files recovered verbatim

## 2026-03-11T16:40Z — CLI-first Claude integration (replace MCP)
- Deleted `packages/mcp/` entirely — CLI is now sole AI integration surface
- New `vibariant codegen` command: generates SDK integration code, `--json` returns file contents
- New `vibariant experiments show <id-or-key>`: combined experiment details + stats
- CLI hardening: consistent JSON envelope `{ok, data}` / `{ok, error}` on all commands, `--yes` flag to skip prompts, exit codes 0/1/2/3, stderr for human output in `--json` mode
- Created Claude Code skill at `.claude/skills/vibariant/SKILL.md` + `workflows.md`
- `vibariant init` now auto-installs skill + updates CLAUDE.md in user projects
- Skill template bundled in `packages/cli/src/lib/skill-template.ts`
- Removed `mcp-install.ts` command, cleaned all MCP references from ARCHITECTURE.md, landing page, memory
- 49 tests passing (22 new), clean build
- Code review fixes: if/else clarity after jsonError(), delete confirmation prompt, unused imports removed, detectEnvironment() deduplication

## 2026-03-11T—:—Z — Landing page implementation
- Built full marketing landing page at `/` replacing redirect-only page
- 7 new components in `dashboard/src/components/landing/`: BifurcationBackground, LandingNav, HeroSection, FeaturesSection, DemoSection, PricingSection, FooterSection
- Bifurcation strategy: fixed background layer (split line + gradient washes) + per-section SVG decorations (no clip-path)
- Interactive demo: live A/B simulation with Beta-Binomial Monte Carlo (2000 samples), auto-starts on scroll via IntersectionObserver, speed controls (1x/5x/10x)
- Auth-aware nav: shows "Start Free" or "Go to Dashboard" based on JWT in localStorage
- Pricing: Free/$0, Pro/$29, Team/$99 with feature comparison
- Code review fixes: MC samples 100→2000 (reduce jitter), derived state refactor (useMemo vs useState+useEffect), Winner label fix (A vs B), ARIA attributes (progressbar, aria-pressed, aria-disabled, aria-label)
- Smooth scroll via `scroll-behavior: smooth` in globals.css
- Build clean, deployed, wet tested in browser

## 2026-03-11T—:—Z — Login page bifurcation design
- Implemented bifurcation visual identity on login page: abrupt style split at screen center
- Desktop: vertical split (left=blue geometric, right=orange organic); Mobile: horizontal split
- GeometricSide component: pixel grid, stepped waveforms, circuit paths, angular brackets, "A" watermark
- OrganicSide component: S-curves, overlapping circles, sine waves, spiral, ellipses, "B" watermark
- Brand text updated: "Vib" blue, "ariant" orange; button gradient blue→orange
- CSS: `.bifurcation-a/.bifurcation-b` clip-path classes in globals.css, responsive via `@media (min-width: 768px)`
- Design philosophy recorded in CLAUDE.md
- Deployed to production (vibariant.com), verified live

## 2026-02-28T00:40Z — One-click CLI + MCP server shipped
- @vibariant/cli: full setup wizard, device-code auth, CRUD for projects/experiments/goals, framework detection, code generation
- @vibariant/mcp: 8 MCP tools for Claude Code integration (auth, projects, experiments, results, codegen)
- API: POST /projects, CLI device-code auth (cli-login/cli-poll/cli-complete), GET /auth/me
- npm workspaces root linking CLI, MCP, SDK packages
- Code review fixes applied: email mismatch security check, 0600 config permissions, credential expiry consistency, dead code removal, hardcoded path fix, docker template path fix
- 91 tests passing (SDK 59, CLI 27, MCP 5), committed as 4a1d087
- Remaining refactor opportunities: extract shared API client package, consolidate resolveProjectId helper

## 2026-02-26TXX:XXZ — Stats Engine v2 implementation complete
- All 10 phases implemented: epsilon stopping, ROPE, TopTwo Thompson, adaptive priors, calibration, winsorize/CUPED, shrinkage, API schemas, dashboard UX
- 135 tests passing (73 existing + 62 new), all backward compatible
- Dashboard builds clean with 5 new components + rewritten experiment detail page
- generate_recommendation() now returns dict instead of str (breaking change, existing tests updated)
- New DB migration: 4 columns on experiments + experiment_results table
- Code review agents launched for correctness + refactoring

## 2026-02-26T11:10Z — Phase 5 COMPLETE: deployed to OVH VPS
- All review fixes committed and pushed (25a470a, 0cfe60f)
- Docker images built on VPS, all 3 containers running (db healthy, api 8090, dashboard 3002)
- Kamal proxy routes added: vibariant.com → dashboard, api.vibariant.com → API
- TLS auto-provisioned via Let's Encrypt (will work once DNS is pointed)
- Pending: register vibariant.com domain, point DNS to 54.37.226.6 (A records for @, www, api)
- Pending: GitHub OAuth app setup (fill GITHUB_CLIENT_ID/SECRET in .env)

## 2026-02-26T10:15Z — Phase 5 review fixes + Suspense boundary fix
- Fixed CRITICALs: auth pages, port mismatch, loading spinners, logout race, Suspense boundaries
- Extracted completeLogin() helper to deduplicate auth flow
- Dashboard builds clean (11 routes)

## 2026-02-26T09:35Z — Phases 3-4 completed + code review fixes
- Phase 3 (SDK auto-tracking + goal detection) and Phase 4 (stats engine) completed by parallel agents
- Code review found 3 HIGH issues: proxy camelCase field mismatches (SDK sends maxDepth/activeTimeMs, proxy expected snake_case), engagement events not fetched by engine, unconfirmed goals counted as conversions
- All 3 HIGH issues fixed + 2 moderate refactors (shared MC sampling utility, unified goal-matching helper)
- 73 stats tests + 59 SDK tests passing, SDK builds clean
- Committed and pushed as cf215c2
- Phase 5 (dashboard polish + deployment) is next

# Key Findings

## API port
Default port is 8000. Docker compose exposes via API_PORT env var (default 8000).
Dashboard api.ts defaults to http://localhost:8000.

## Local PostgreSQL setup
Using local PG (not Docker) at localhost:5432. Database: vibariant, user: vibariant, password: localdev.
PostgreSQL binary at /opt/homebrew/Cellar/postgresql@16/16.11_1/bin/psql.

## Python dependencies
Installed with --break-system-packages flag on macOS Homebrew Python 3.12.

## Key file contracts
- SDK scroll: sends `maxDepth` (camelCase) in payload
- SDK engagement: sends `activeTimeMs` (milliseconds) as `engagement` event type
- Proxy: handles both camelCase (SDK) and snake_case formats
- Engine: fetches engagement events in addition to page_view/heartbeat
- Conversions: a visitor counts as converted if they fired an explicit `conversion` event OR a `goal_completed` of a confirmed goal type. The engine counts **distinct converting visitors** (not raw events) — Beta-Binomial treats each visitor as one Bernoulli trial, so conversions must stay <= visitors. (Counting events caused conversions>visitors → 500; fixed 2026-06-18.)
