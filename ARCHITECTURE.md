# Vibariant Architecture

## Overview
Vibariant is an AB testing SaaS purpose-built for vibecoding. It provides meaningful statistical guidance even with tiny sample sizes (~100 users, 1 conversion vs 0 conversions) using Bayesian inference and multi-armed bandits.

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
│          JS SDK (@vibariant/sdk)           │
│  - React Provider + hooks                    │
│  - Auto-tracking (clicks, scroll, forms)     │
│  - Smart goal detection (DOM heuristics)     │
│  - Event batching (fetch + sendBeacon)       │
│  - ~8kb gzipped full bundle                  │
└──────────────────────────────────────────────┘

┌──────────────────────┐  ┌───────────────────────┐
│   CLI (@vibariant/cli)│  │  MCP (@vibariant/mcp)│
│  - One-click setup   │  │  - Claude Code tools  │
│  - Experiment CRUD   │──│  - Same auth/config   │
│  - Device-code auth  │  │  - Code generation    │
│  npx @vibariant/cli  │  │  npx @vibariant/mcp   │
└──────────────────────┘  └───────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Dashboard | Next.js 15, TypeScript |
| API | FastAPI, Python 3.12, SQLAlchemy, Alembic |
| Stats | scipy, numpy (conjugate Beta-Binomial, no PyMC needed) |
| Database | PostgreSQL 16 |
| SDK | TypeScript, tsup (ESM + CJS) |
| CLI | TypeScript, Commander.js, Inquirer |
| MCP | TypeScript, @modelcontextprotocol/sdk |
| Auth | GitHub OAuth + email magic links + device-code flow, JWT |
| Deploy | Docker Compose on OVH VPS, Kamal proxy |

## Key Design Decisions

### Bayesian over Frequentist
Traditional AB testing requires thousands of observations for statistical significance. Bayesian inference provides useful posteriors even with 10-50 observations via informative priors and conjugate models.

### Thompson Sampling Bandits
Instead of fixed 50/50 splits, Top-Two Thompson Sampling automatically allocates more traffic to likely winners while maintaining minimum exploration (10% floor). This minimizes regret for apps with few users while ensuring all variants receive data.

### Proxy Metrics
When conversions are too sparse (1 vs 0), engagement signals (scroll depth, time on page, clicks, form engagement) serve as leading indicators, giving vibecoders actionable guidance before conversion data accumulates. Weights can be calibrated via OLS against historical conversion data. Winsorization and CUPED variance reduction are applied when available.

### Stats Engine v2 Enhancements
- **Expected Loss Epsilon Stopping**: Experiments declare "ready to ship" when the leading variant's expected loss falls below a configurable threshold (default 0.5%), reducing minimum viable sample from ~100 to ~30-50 visitors.
- **ROPE Decision Rules**: Region of Practical Equivalence testing declares variants "practically equivalent" when the 95% HDI of their difference falls within the ROPE, preventing wasted testing on negligible differences.
- **Adaptive Informative Priors**: Three-tier fallback chain (user-specified > project historical empirical Bayes > platform default Beta(1,19)). Historical priors use moment matching from past experiment results.
- **James-Stein Shrinkage**: Cross-experiment effect size correction pulls extreme estimates toward the project grand mean, combating winner's curse.
- **Structured Decisions**: Engine returns machine-readable decision status (collecting_data / keep_testing / ready_to_ship / practically_equivalent) alongside plain-English recommendations.

### Code-First Variants
Variants are defined in React components via `useVariant()` hooks, not in a visual editor. This matches how vibecoders work — they're already in the code.

### Deterministic Assignment
Both client (SDK) and server use FNV-1a hashing of `visitorId:experimentKey` for variant assignment. This ensures consistency even when the server is unreachable.

## Auth Model
- **Project token** (`vv_proj_xxx`): Public, client-side safe. Write events + read own assignments only.
- **API key** (`vv_sk_xxx`): Secret, server-side. Full API access for dashboard and management.

## CLI (`@vibariant/cli`)

Full-featured CLI for one-click setup and experiment management. Lives in `packages/cli/`.

### One-Click Setup
```bash
npx @vibariant/cli init
```
Handles: Docker backend startup, magic link auth, project creation, SDK installation, framework-detected code generation, and first experiment creation. Supports `--yes` for non-interactive mode.

### Commands
- `vibariant init` — Full setup wizard
- `vibariant auth login|logout|status` — Magic link authentication
- `vibariant projects list|create|show` — Project CRUD
- `vibariant experiments list|create|update|delete|results` — Experiment CRUD + stats
- `vibariant goals list|confirm` — Goal management
- `vibariant status` — Running experiments overview
- `vibariant config get|set` — CLI configuration
- `vibariant mcp` — Install MCP server config for Claude Code

All commands support `--api-url` and `--json` flags for scripting.

### CLI Auth Flow
Device-code flow similar to GitHub CLI: CLI gets a device_code, user verifies via email magic link, CLI polls until authorized. In dev mode (default SECRET_KEY), auto-completes instantly without email.

## MCP Server (`@vibariant/mcp`)

Model Context Protocol server for AI-assisted experiment management. Lives in `packages/mcp/`.

### Tools
| Tool | Description |
|------|-------------|
| `vibariant_auth` | Check auth status |
| `vibariant_list_projects` | List projects |
| `vibariant_create_project` | Create project |
| `vibariant_create_experiment` | Create + start experiment |
| `vibariant_list_experiments` | List experiments |
| `vibariant_get_results` | Get stats + recommendation |
| `vibariant_update_experiment` | Update status/config |
| `vibariant_generate_code` | Generate SDK integration code |

### Setup
```bash
npx @vibariant/cli mcp  # Writes to .claude/settings.json
```

Reads auth from `~/.vibariant/config.json` (shared with CLI).

## Deployment
Docker Compose on OVH VPS (54.37.226.6) behind Kamal proxy with auto-SSL via Let's Encrypt.
