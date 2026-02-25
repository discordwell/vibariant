# VibeVariant Architecture

## Overview
VibeVariant is an AB testing SaaS purpose-built for vibecoding. It provides meaningful statistical guidance even with tiny sample sizes (~100 users, 1 conversion vs 0 conversions) using Bayesian inference and multi-armed bandits.

## System Architecture

```
┌──────────────────────────────────────────────┐
│            Dashboard (Next.js 15)            │
│  - Experiment results & insights             │
│  - Smart goal confirmation                   │
│  - Plain-English recommendations             │
│  - GitHub OAuth + email magic link auth      │
│  Port: 3000                                  │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│           API (FastAPI / Python 3.12)        │
│  - Event ingestion                           │
│  - Variant assignment (deterministic hash)   │
│  - Experiment CRUD                           │
│  - Auth (JWT)                                │
│  Port: 8000                                  │
└─────────┬────────────────────┬───────────────┘
          │                    │
┌─────────▼──────────┐  ┌─────▼───────────────┐
│   Stats Engine     │  │   PostgreSQL 16     │
│   (Python module)  │  │  Port: 5432         │
│  - Beta-Binomial   │  │  - events           │
│  - Thompson Sampling│  │  - experiments      │
│  - Proxy metrics   │  │  - visitors         │
│  - Expected loss   │  │  - projects/users   │
│                    │  │  - goals            │
└────────────────────┘  └─────────────────────┘

┌──────────────────────────────────────────────┐
│          JS SDK (@vibevariant/sdk)           │
│  - React Provider + hooks                    │
│  - Auto-tracking (clicks, scroll, forms)     │
│  - Smart goal detection (DOM heuristics)     │
│  - Event batching (fetch + sendBeacon)       │
│  - ~8kb gzipped full bundle                  │
└──────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Dashboard | Next.js 15, TypeScript |
| API | FastAPI, Python 3.12, SQLAlchemy, Alembic |
| Stats | scipy, numpy (conjugate Beta-Binomial, no PyMC needed) |
| Database | PostgreSQL 16 |
| SDK | TypeScript, tsup (ESM + CJS) |
| Auth | GitHub OAuth + email magic links, JWT |
| Deploy | Docker Compose on OVH VPS, Kamal proxy |

## Key Design Decisions

### Bayesian over Frequentist
Traditional AB testing requires thousands of observations for statistical significance. Bayesian inference provides useful posteriors even with 10-50 observations via informative priors and conjugate models.

### Thompson Sampling Bandits
Instead of fixed 50/50 splits, Thompson Sampling automatically allocates more traffic to likely winners while continuing to explore. This minimizes regret for apps with few users.

### Proxy Metrics
When conversions are too sparse (1 vs 0), engagement signals (scroll depth, time on page, clicks, form engagement) serve as leading indicators, giving vibecoders actionable guidance before conversion data accumulates.

### Code-First Variants
Variants are defined in React components via `useVariant()` hooks, not in a visual editor. This matches how vibecoders work — they're already in the code.

### Deterministic Assignment
Both client (SDK) and server use FNV-1a hashing of `visitorId:experimentKey` for variant assignment. This ensures consistency even when the server is unreachable.

## Auth Model
- **Project token** (`vv_proj_xxx`): Public, client-side safe. Write events + read own assignments only.
- **API key** (`vv_sk_xxx`): Secret, server-side. Full API access for dashboard and management.

## Deployment
Docker Compose on OVH VPS (54.37.226.6) behind Kamal proxy with auto-SSL via Let's Encrypt.
