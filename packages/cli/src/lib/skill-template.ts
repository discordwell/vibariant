/**
 * Bundled skill templates for Claude Code integration.
 * These get written to .claude/skills/vibariant/ in the user's project.
 *
 * Structure: SKILL.md is a lean router (~40 lines). Detailed docs live in
 * topic-specific files that Claude loads on demand.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';

export const CLAUDE_MD_LINE = '- For A/B testing, use the /vibariant skill or run vibariant commands directly';

export const AGENTS_MD_LINE = '- For A/B testing, run `vibariant` CLI commands. Use `--json` for structured output and `--yes` to skip prompts.';

/**
 * Shared CLI reference content used by AGENTS.md and copilot-instructions.md.
 * These tools don't have skill hierarchies, so we inline everything in one doc.
 */
export const AGENT_INSTRUCTIONS = `# Vibariant — A/B Testing CLI

This project uses the \`vibariant\` CLI for A/B testing. All commands support \`--json\` for structured output and \`--yes\` to skip interactive prompts.

## JSON Contract

All \`--json\` responses follow:
\`\`\`json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "..." }
\`\`\`
Exit codes: \`0\` success, \`1\` error, \`2\` not authenticated, \`3\` not found.

## Commands

| Task | Command |
|------|---------|
| Check auth | \`vibariant auth status --json\` |
| List projects | \`vibariant projects list --json\` |
| Create project | \`vibariant projects create "Name" --json\` |
| List experiments | \`vibariant experiments list --json\` |
| Create experiment | \`vibariant experiments create --key <key> --variants control,variant --json\` |
| Show experiment + stats | \`vibariant experiments show <id-or-key> --json\` |
| Update experiment | \`vibariant experiments update <id> --status running --json\` |
| Get results | \`vibariant experiments results <id> --json\` |
| Delete experiment | \`vibariant experiments delete <id> --json --yes\` |
| Generate SDK code | \`vibariant codegen --framework next --json\` |
| List goals | \`vibariant goals list --json\` |
| Confirm goal | \`vibariant goals confirm <goal-id> --json\` |
| Status overview | \`vibariant status --json\` |
| Full setup | \`vibariant init --yes --email <email> --project-name "Name"\` |

## Typical Workflow

\`\`\`bash
# 1. Check auth
vibariant auth status --json

# 2. Create + start experiment
vibariant experiments create --key checkout-cta --name "Checkout CTA" --variants control,urgent,social-proof --json
vibariant experiments update <id> --status running --json

# 3. Generate SDK code
vibariant codegen --framework next --experiment-key checkout-cta --variants control,urgent,social-proof --json

# 4. Check results (after traffic)
vibariant experiments show checkout-cta --json
# decision_status: collecting_data | keep_testing | ready_to_ship | practically_equivalent

# 5. Ship winner
vibariant experiments update <id> --status completed --json
\`\`\`

## Reading Stats

- **decision_status**: \`collecting_data\` → \`keep_testing\` → \`ready_to_ship\` or \`practically_equivalent\`
- **posterior_mean**: Bayesian estimate of true conversion rate
- **recommendation**: Plain-English action guidance
- A variant is "ready to ship" when expected loss < 0.5%

## Tips

- Always use \`--json\` for parseable output
- Use \`--yes\` to skip interactive prompts
- Experiments can be looked up by key (\`hero-headline\`) or UUID
- \`codegen --json\` returns file contents without writing to disk
- \`experiments show\` combines metadata + stats in one call
- Project ID auto-resolves after \`vibariant init\`
- \`experiments create\` creates in draft — follow with \`update --status running\`
`;

/** Map of filename → content for all skill files */
export const SKILL_FILES: Record<string, string> = {

  'SKILL.md': `---
name: vibariant
description: Manage A/B testing experiments with the Vibariant CLI. Use when creating experiments, checking results, generating SDK code, or managing the A/B testing workflow.
user_invocable: true
allowed-tools: Bash, Read, Grep
---

# Vibariant CLI — A/B Testing for Vibecoded Apps

All commands support \`--json\` (structured output) and \`--yes\` (skip prompts).

## JSON Contract

\`\`\`json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "..." }
\`\`\`
Exit codes: \`0\` success, \`1\` error, \`2\` not authenticated, \`3\` not found.

## Quick Reference

| Task | Command |
|------|---------|
| Check auth | \`vibariant auth status --json\` |
| List projects | \`vibariant projects list --json\` |
| Create project | \`vibariant projects create "Name" --json\` |
| List experiments | \`vibariant experiments list --json\` |
| Create experiment | \`vibariant experiments create --key <key> --variants control,variant --json\` |
| Show experiment + stats | \`vibariant experiments show <id-or-key> --json\` |
| Update experiment | \`vibariant experiments update <id> --status running --json\` |
| Get results | \`vibariant experiments results <id> --json\` |
| Generate SDK code | \`vibariant codegen --framework next --json\` |
| Full setup | \`vibariant init --yes --email <email> --project-name "Name"\` |
| Status overview | \`vibariant status --json\` |

## Detailed References

Read these when you need full flag details, response shapes, or examples:

- [auth.md](auth.md) — Login, logout, status, token auth
- [experiments.md](experiments.md) — CRUD, results, stats interpretation, decision statuses
- [projects.md](projects.md) — Project management
- [codegen.md](codegen.md) — SDK code generation, framework options, SDK integration patterns
- [goals.md](goals.md) — Goal detection and confirmation
- [workflows.md](workflows.md) — End-to-end workflow sequences, error handling, agent tips
`,

  'auth.md': `# Authentication Commands

## \`vibariant auth login\`

Authenticate via device-code magic link or direct JWT.

\`\`\`bash
# Interactive (prompts for email, sends magic link)
vibariant auth login

# Non-interactive with email
vibariant auth login --email user@example.com --json

# Direct JWT token (skip magic link entirely)
vibariant auth login --token <jwt> --api-url https://api.vibariant.com --json
\`\`\`

**Flags:** \`--email <email>\`, \`--token <jwt>\`, \`--api-url <url>\`, \`--json\`, \`--yes\`

**Response (\`--json\`):**
\`\`\`json
{ "ok": true, "data": { "email": "user@example.com", "apiUrl": "https://api.vibariant.com" } }
\`\`\`

Credentials stored in \`~/.vibariant/config.json\` (0600 permissions, 7-day expiry).

## \`vibariant auth status\`

Check if currently authenticated and whether the token is still valid.

\`\`\`bash
vibariant auth status --json
\`\`\`

**Response:**
\`\`\`json
{ "ok": true, "data": { "authenticated": true, "email": "user@example.com", "apiUrl": "...", "expiresAt": 1741..., "valid": true } }
\`\`\`

When not authenticated: \`{ "ok": true, "data": { "authenticated": false } }\` (exit 0, not an error).

## \`vibariant auth logout\`

Clear stored credentials.

\`\`\`bash
vibariant auth logout --json
\`\`\`
`,

  'experiments.md': `# Experiment Commands

All experiment commands auto-resolve the project ID from \`~/.vibariant/config.json\` (set by \`vibariant init\`). Override with \`--project-id <id>\`.

## \`vibariant experiments create\`

\`\`\`bash
vibariant experiments create --key hero-headline --name "Hero Headline" --variants control,bold,minimal --json
\`\`\`

**Flags:** \`--key <key>\` (required in \`--json\`/\`--yes\` mode), \`--name <name>\` (defaults to key), \`--variants <csv>\` (defaults to \`control,variant\`), \`--project-id <id>\`, \`--api-url <url>\`, \`--json\`, \`--yes\`

Creates in \`draft\` status. To start immediately, follow with:
\`\`\`bash
vibariant experiments update <id> --status running --json
\`\`\`

## \`vibariant experiments list\`

\`\`\`bash
vibariant experiments list --json
\`\`\`

**Response:** Array of experiments with \`id\`, \`key\`, \`name\`, \`status\`, \`variant_keys\`, \`traffic_percentage\`.

## \`vibariant experiments show\`

Combined experiment metadata + Bayesian stats in one call. Accepts ID or key.

\`\`\`bash
vibariant experiments show hero-headline --json
vibariant experiments show <uuid> --json
\`\`\`

**Response:**
\`\`\`json
{
  "ok": true,
  "data": {
    "experiment": { "id": "...", "key": "hero-headline", "status": "running", "variant_keys": ["control", "bold"], "traffic_percentage": 1.0 },
    "results": {
      "decision_status": "keep_testing",
      "variants": [
        { "variant_key": "control", "visitors": 50, "conversions": 5, "conversion_rate": 0.1, "posterior_mean": 0.0962 },
        { "variant_key": "bold", "visitors": 50, "conversions": 8, "conversion_rate": 0.16, "posterior_mean": 0.1538 }
      ],
      "recommendation": "Keep testing. Bold variant shows promise but needs more data."
    }
  }
}
\`\`\`

\`results\` is \`null\` for draft/paused experiments or when no data has been collected yet.

## \`vibariant experiments results\`

Detailed Bayesian results only (no experiment metadata).

\`\`\`bash
vibariant experiments results <id> --json
\`\`\`

## \`vibariant experiments update\`

\`\`\`bash
vibariant experiments update <id> --status running --json
vibariant experiments update <id> --name "New Name" --json
\`\`\`

**Status values:** \`draft\`, \`running\`, \`paused\`, \`completed\`

## \`vibariant experiments delete\`

\`\`\`bash
vibariant experiments delete <id> --json --yes
\`\`\`

Without \`--yes\` or \`--json\`, prompts for confirmation.

## Understanding Stats Output

**\`decision_status\`** — machine-readable verdict:
| Status | Meaning | Action |
|--------|---------|--------|
| \`collecting_data\` | Too few observations | Wait for more traffic |
| \`keep_testing\` | Differences emerging, not conclusive | Continue running |
| \`ready_to_ship\` | Winner identified (expected loss < 0.5%) | Ship the winner, complete the experiment |
| \`practically_equivalent\` | 95% HDI within ROPE | Variants are equivalent, pick either |

**\`posterior_mean\`** — Bayesian estimate of true conversion rate (more stable than raw \`conversion_rate\` at small samples).

**\`recommendation\`** — Plain-English action guidance.
`,

  'projects.md': `# Project Commands

## \`vibariant projects list\`

\`\`\`bash
vibariant projects list --json
\`\`\`

**Response:** Array of \`{ id, name, project_token, api_key }\`.

## \`vibariant projects create\`

\`\`\`bash
vibariant projects create "My App" --json
\`\`\`

**Response:**
\`\`\`json
{ "ok": true, "data": { "id": "...", "name": "My App", "project_token": "vv_proj_xxx", "api_key": "vv_sk_xxx" } }
\`\`\`

- \`project_token\` (\`vv_proj_xxx\`) — public, client-side safe, used in SDK
- \`api_key\` (\`vv_sk_xxx\`) — secret, server-side only

## \`vibariant projects show\`

\`\`\`bash
vibariant projects show <project-id> --json
\`\`\`

Exits with code \`3\` if not found.
`,

  'codegen.md': `# Code Generation & SDK Integration

## \`vibariant codegen\`

Generate SDK integration code. Auto-detects framework from the current directory, or specify explicitly.

\`\`\`bash
# Auto-detect framework, return file contents as JSON
vibariant codegen --json

# Specify framework
vibariant codegen --framework next --json
vibariant codegen --framework react --json
vibariant codegen --framework vanilla --json

# Include example experiment component
vibariant codegen --framework next --experiment-key hero-headline --variants control,bold --json

# Write files to disk (instead of JSON)
vibariant codegen --framework next --force

# Custom output directory
vibariant codegen --framework react --output-dir ./src --force
\`\`\`

**Flags:** \`--framework <next|react|vanilla>\`, \`--experiment-key <key>\`, \`--variants <csv>\`, \`--output-dir <dir>\`, \`--force\` (overwrite), \`--json\`, \`--yes\`

**Response (\`--json\`):**
\`\`\`json
{
  "ok": true,
  "data": {
    "files": [
      { "path": "/abs/path/vibariant.config.ts", "content": "export const vibariantConfig = ..." },
      { "path": "/abs/path/components/vibariant-provider.tsx", "content": "..." }
    ]
  }
}
\`\`\`

## Generated Files

| Framework | Files |
|-----------|-------|
| Next.js | \`vibariant.config.ts\`, \`components/vibariant-provider.tsx\` |
| React | \`vibariant.config.ts\`, \`vibariant-provider.tsx\` |
| Vanilla | \`vibariant.config.ts\`, \`vibariant.ts\` |

When \`--experiment-key\` is provided, also generates \`example-experiment.tsx\`.

## SDK Usage After Codegen

**Next.js / React** — wrap your app:
\`\`\`tsx
import { VibariantWrapper } from '@/components/vibariant-provider';
<VibariantWrapper>{children}</VibariantWrapper>
\`\`\`

**Use variants in components:**
\`\`\`tsx
import { useVariant } from '@vibariant/sdk/react';

function MyComponent() {
  const { variant } = useVariant('hero-headline', ['control', 'bold']);
  return variant === 'control' ? <OriginalHero /> : <BoldHero />;
}
\`\`\`

**Vanilla JS:**
\`\`\`ts
import { vibariant } from './vibariant';
const variant = vibariant.getVariant('hero-headline', ['control', 'bold']);
\`\`\`

## SDK Features

- \`<VibariantProvider>\` — React context, auto-initializes
- \`useVariant(key, variants)\` — deterministic variant assignment via FNV-1a hash
- Auto-tracking: clicks, scroll depth, form engagement, time on page
- All tracking runs in \`requestIdleCallback\` (never blocks UI)
- ~8kb gzipped
`,

  'goals.md': `# Goal Commands

Goals are auto-detected by the SDK from user interactions (clicks, form submissions, purchases). They need confirmation before counting as conversions.

## \`vibariant goals list\`

\`\`\`bash
vibariant goals list --json
\`\`\`

**Response:** Array of \`{ id, type, label, confirmed }\`.

## \`vibariant goals confirm\`

Mark a detected goal as a real conversion event.

\`\`\`bash
vibariant goals confirm <goal-id> --json
\`\`\`

Only confirmed goals count toward experiment conversion metrics.
`,

  'workflows.md': `# Workflows & Reference

## End-to-End: Create, Run, Ship

\`\`\`bash
# 1. Auth
vibariant auth status --json

# 2. Create experiment
vibariant experiments create --key checkout-cta --name "Checkout CTA" --variants control,urgent,social-proof --json

# 3. Start it
vibariant experiments update <id-from-step-2> --status running --json

# 4. Generate SDK integration code
vibariant codegen --framework next --experiment-key checkout-cta --variants control,urgent,social-proof --json

# 5. (integrate code, deploy, wait for traffic)

# 6. Check results
vibariant experiments show checkout-cta --json
# Look at decision_status: collecting_data -> keep_testing -> ready_to_ship

# 7. Ship winner
vibariant experiments update <id> --status completed --json
\`\`\`

## Quick Status Check

\`\`\`bash
vibariant status --json                          # overview of all experiments
vibariant experiments show hero-headline --json  # one experiment with stats
\`\`\`

## Full Project Setup

\`\`\`bash
# Non-interactive (CI / AI agent)
vibariant init --yes --email dev@company.com --project-name "My SaaS" --skip-docker --api-url https://api.vibariant.com

# Interactive (human)
vibariant init
\`\`\`

\`vibariant init\` handles: backend check, auth, project creation, SDK install, codegen, first experiment, and skill installation.

## Configuration

\`\`\`bash
vibariant config get api_url
vibariant config set api_url https://api.vibariant.com
\`\`\`

Keys: \`api_url\`, \`project_id\`, \`project_token\`, \`email\`.

## Error Handling

| Exit Code | Meaning | Fix |
|-----------|---------|-----|
| \`0\` | Success | — |
| \`1\` | General error | Check \`error\` field in JSON |
| \`2\` | Not authenticated | Run \`vibariant auth login\` |
| \`3\` | Not found | Check ID/key spelling |

## Tips for AI Agents

1. Always use \`--json\` for parseable output
2. Use \`--yes\` to skip interactive prompts that would block
3. Experiments can be looked up by key (\`hero-headline\`) or UUID
4. \`codegen --json\` returns file contents without writing to disk — review before applying
5. \`experiments show\` combines metadata + stats in one call
6. Project ID auto-resolves after \`vibariant init\` — no need to pass \`--project-id\`
7. \`experiments create\` creates in draft — follow with \`update --status running\` to start
`,
};

/**
 * Install AI agent integration files into the user's project directory.
 *
 * - Claude Code: .claude/skills/vibariant/ (hierarchical skill files) + CLAUDE.md hint
 * - OpenAI Codex: AGENTS.md (flat CLI reference)
 * - GitHub Copilot: .github/copilot-instructions.md (flat CLI reference)
 */
export function installSkill(projectDir: string): void {
  // ── Claude Code skill ──
  const skillDir = join(projectDir, '.claude', 'skills', 'vibariant');
  mkdirSync(skillDir, { recursive: true });

  for (const [filename, content] of Object.entries(SKILL_FILES)) {
    writeFileSync(join(skillDir, filename), content);
  }
  console.log(chalk.green('  installed: .claude/skills/vibariant/'));

  // Update or create CLAUDE.md
  const claudeMdPath = join(projectDir, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, 'utf-8');
    if (!existing.includes('/vibariant') && !existing.includes('vibariant skill')) {
      writeFileSync(claudeMdPath, existing.trimEnd() + '\n' + CLAUDE_MD_LINE + '\n');
      console.log(chalk.green('  updated: CLAUDE.md'));
    }
  } else {
    writeFileSync(claudeMdPath, `# Project\n\n${CLAUDE_MD_LINE}\n`);
    console.log(chalk.green('  created: CLAUDE.md'));
  }

  // ── OpenAI Codex (AGENTS.md) ──
  const agentsMdPath = join(projectDir, 'AGENTS.md');
  if (existsSync(agentsMdPath)) {
    const existing = readFileSync(agentsMdPath, 'utf-8');
    if (!existing.includes('vibariant')) {
      writeFileSync(agentsMdPath, existing.trimEnd() + '\n\n' + AGENT_INSTRUCTIONS);
      console.log(chalk.green('  updated: AGENTS.md'));
    }
  } else {
    writeFileSync(agentsMdPath, AGENT_INSTRUCTIONS);
    console.log(chalk.green('  created: AGENTS.md'));
  }

  // ── GitHub Copilot ──
  const copilotDir = join(projectDir, '.github');
  const copilotPath = join(copilotDir, 'copilot-instructions.md');
  if (!existsSync(copilotDir)) {
    mkdirSync(copilotDir, { recursive: true });
  }
  if (existsSync(copilotPath)) {
    const existing = readFileSync(copilotPath, 'utf-8');
    if (!existing.includes('vibariant')) {
      writeFileSync(copilotPath, existing.trimEnd() + '\n\n' + AGENT_INSTRUCTIONS);
      console.log(chalk.green('  updated: .github/copilot-instructions.md'));
    }
  } else {
    writeFileSync(copilotPath, AGENT_INSTRUCTIONS);
    console.log(chalk.green('  created: .github/copilot-instructions.md'));
  }
}
