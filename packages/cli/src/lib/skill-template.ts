/**
 * Bundled skill templates for Claude Code integration.
 * These get written to .claude/skills/vibariant/ in the user's project.
 */

export const SKILL_MD = `---
name: vibariant
description: Manage A/B testing experiments with the Vibariant CLI. Use when creating experiments, checking results, generating SDK code, or managing the A/B testing workflow.
user_invocable: true
---

# Vibariant CLI — A/B Testing for Vibecoded Apps

Use the \`vibariant\` CLI to manage experiments. All commands support \`--json\` for structured output and \`--yes\` to skip interactive prompts.

## JSON Output Contract

All \`--json\` responses follow this envelope:
\`\`\`json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "..." }
\`\`\`

Exit codes: \`0\` success, \`1\` error, \`2\` not authenticated, \`3\` not found.

## Command Reference

### Authentication
\`\`\`bash
vibariant auth status --json
vibariant auth login --email user@example.com
vibariant auth login --token <jwt> --json
\`\`\`

### Projects
\`\`\`bash
vibariant projects list --json
vibariant projects create "My App" --json
vibariant projects show <project-id> --json
\`\`\`

### Experiments
\`\`\`bash
vibariant experiments list --json
vibariant experiments create --key hero-headline --name "Hero Headline" --variants control,bold,minimal --json
vibariant experiments show <id-or-key> --json
vibariant experiments results <id> --json
vibariant experiments update <id> --status running --json
vibariant experiments delete <id> --json --yes
\`\`\`

### Goals
\`\`\`bash
vibariant goals list --json
vibariant goals confirm <goal-id> --json
\`\`\`

### Status & Code Generation
\`\`\`bash
vibariant status --json
vibariant codegen --framework next --json
vibariant codegen --framework react --experiment-key hero-headline --variants control,bold --json
\`\`\`

### Full Setup
\`\`\`bash
vibariant init --yes --email user@example.com --project-name "My App"
\`\`\`

## Reading Results

- **decision_status**: \`collecting_data\` | \`keep_testing\` | \`ready_to_ship\` | \`practically_equivalent\`
- **posterior_mean**: Bayesian estimate of true conversion rate
- **recommendation**: Plain-English action guidance

A variant is "ready to ship" when expected loss < 0.5%.

## SDK Integration

After \`vibariant codegen\`, the SDK provides:
- \`<VibariantProvider>\` — React context wrapper
- \`useVariant(key, variants)\` — Hook returning assigned variant
- Auto-tracking via \`requestIdleCallback\`
`;

export const WORKFLOWS_MD = `# Vibariant Workflows

## Create and Run an Experiment

\`\`\`bash
vibariant auth status --json
vibariant experiments create --key checkout-cta --name "Checkout CTA" --variants control,urgent,social-proof --json
vibariant experiments update <experiment-id> --status running --json
vibariant codegen --framework next --experiment-key checkout-cta --variants control,urgent,social-proof --json
\`\`\`

## Check Results and Ship Winner

\`\`\`bash
vibariant experiments show checkout-cta --json
# Look at decision_status: collecting_data / keep_testing / ready_to_ship / practically_equivalent
vibariant experiments update <id> --status completed --json
\`\`\`

## Quick Status Check

\`\`\`bash
vibariant status --json
vibariant experiments show hero-headline --json
\`\`\`

## Tips for AI Agents

1. Always use \`--json\` for parseable output
2. Use \`--yes\` to avoid interactive prompts
3. Look up experiments by key or UUID
4. \`codegen --json\` returns file contents without writing to disk
5. \`experiments show\` combines metadata + stats in one call
6. Project ID is auto-resolved after \`vibariant init\`
`;

export const CLAUDE_MD_LINE = '- For A/B testing, use the /vibariant skill or run vibariant commands directly';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';

/**
 * Install the Vibariant Claude Code skill into the user's project directory.
 * Creates .claude/skills/vibariant/SKILL.md and workflows.md.
 * Appends a line to CLAUDE.md if it exists, or creates a minimal one.
 */
export function installSkill(projectDir: string): void {
  const skillDir = join(projectDir, '.claude', 'skills', 'vibariant');
  mkdirSync(skillDir, { recursive: true });

  const skillPath = join(skillDir, 'SKILL.md');
  const workflowsPath = join(skillDir, 'workflows.md');

  writeFileSync(skillPath, SKILL_MD);
  writeFileSync(workflowsPath, WORKFLOWS_MD);
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
}
