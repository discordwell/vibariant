# Session Summaries

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
- Conversions: only `conversion` events + `goal_completed` with confirmed goal types count
