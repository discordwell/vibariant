# Session Summaries

## 2026-02-26T10:15Z — Phase 5 review fixes + Suspense boundary fix
- Fixed CRITICAL: Created GitHub OAuth callback + magic link verify pages
- Fixed CRITICAL: API port mismatch (8001→8000 default in dashboard api.ts)
- Fixed HIGH: Infinite loading spinners on 3 dashboard pages when no project
- Fixed HIGH: Logout race condition (loggingOut guard)
- Added .dockerignore files for both api/ and dashboard/
- Fixed Next.js build failure: useSearchParams() wrapped in Suspense boundaries
- Dashboard builds clean (11 routes, all static except experiments/[id])
- Pending: commit + push, then deployment to OVH VPS

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
Using local PG (not Docker) at localhost:5432. Database: vibevariant, user: vibevariant, password: localdev.
PostgreSQL binary at /opt/homebrew/Cellar/postgresql@16/16.11_1/bin/psql.

## Python dependencies
Installed with --break-system-packages flag on macOS Homebrew Python 3.12.

## Key file contracts
- SDK scroll: sends `maxDepth` (camelCase) in payload
- SDK engagement: sends `activeTimeMs` (milliseconds) as `engagement` event type
- Proxy: handles both camelCase (SDK) and snake_case formats
- Engine: fetches engagement events in addition to page_view/heartbeat
- Conversions: only `conversion` events + `goal_completed` with confirmed goal types count
