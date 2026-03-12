# Vibariant

AB testing SaaS for vibecoded apps. Bayesian stats + bandits for small sample sizes.

## Product Mandate
- This project is budgeted for at least one year of work and roughly two dozen senior developers.
- Make design decisions the way senior management at a well-funded software company would: favor long-term maintainability, scalability, security, observability, and operational robustness over expedient shortcuts.
- The goal is to produce enterprise-grade, best-in-class software sold at a medium/low consumer price point. Optimize for premium quality and capability while keeping delivery and operating costs disciplined enough to support that pricing.

## Project Structure
- `packages/sdk/` — TypeScript SDK (@vibariant/sdk), React bindings
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

## Design Philosophy: Bifurcation
- The site's visual identity represents **bifurcation** — an abrupt style change at the exact midpoint of the screen.
- **Desktop**: the split is **vertical** (left half vs right half).
- **Mobile**: the split is **horizontal** (top half vs bottom half).
- The split must always be at 50%, regardless of screen size or stretching.
- Do NOT change backgrounds or fonts across the split. Only change **themes**: accent colors, decorative element styles, iconography tone.
- Example pairings: blue tones vs orange tones, pixel art vs smooth bézier curves, geometric vs organic.
- The login card / main content sits centered, straddling both worlds.

## Conventions
- API routes under `/api/v1/`
- SDK public tokens: `vv_proj_xxx`, API keys: `vv_sk_xxx`
- Variant assignment uses FNV-1a hash for deterministic client/server consistency
- Stats engine uses conjugate Beta-Binomial (scipy), not PyMC
- All SDK auto-tracking runs in requestIdleCallback to avoid blocking
- For A/B testing, use the /vibariant skill or run vibariant commands directly
