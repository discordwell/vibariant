# VibeVariant

AB testing SaaS for vibecoded apps. Bayesian stats + bandits for small sample sizes.

## Project Structure
- `packages/sdk/` — TypeScript SDK (@vibevariant/sdk), React bindings
- `api/` — FastAPI Python backend, stats engine, auth
- `dashboard/` — Next.js 15 dashboard

## Architecture
See ARCHITECTURE.md for system design.
See HUMAN.md for human's architecture requests and decisions.

## Development
- API: `cd api && uvicorn app.main:app --reload`
- Dashboard: `cd dashboard && npm run dev`
- SDK: `cd packages/sdk && npm run build`
- DB: `docker compose up db` (PostgreSQL)
- Full stack: `docker compose up`

## Conventions
- API routes under `/api/v1/`
- SDK public tokens: `vv_proj_xxx`, API keys: `vv_sk_xxx`
- Variant assignment uses FNV-1a hash for deterministic client/server consistency
- Stats engine uses conjugate Beta-Binomial (scipy), not PyMC
- All SDK auto-tracking runs in requestIdleCallback to avoid blocking
