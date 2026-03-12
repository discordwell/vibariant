---
name: vibariant
description: Manage A/B testing experiments with the Vibariant CLI. Use when creating experiments, checking results, generating SDK code, or managing the A/B testing workflow.
user_invocable: true
---

# Vibariant CLI — A/B Testing for Vibecoded Apps

Use the `vibariant` CLI to manage experiments. All commands support `--json` for structured output and `--yes` to skip interactive prompts.

## JSON Output Contract

All `--json` responses follow this envelope:
```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "..." }
```

Exit codes: `0` success, `1` error, `2` not authenticated, `3` not found.

## Command Reference

### Authentication
```bash
# Check auth status
vibariant auth status --json

# Login with email (interactive)
vibariant auth login --email user@example.com

# Login with existing JWT token (non-interactive)
vibariant auth login --token <jwt> --json
```

### Projects
```bash
# List all projects
vibariant projects list --json

# Create a project
vibariant projects create "My App" --json

# Show project details
vibariant projects show <project-id> --json
```

### Experiments
```bash
# List experiments
vibariant experiments list --json

# Create an experiment
vibariant experiments create --key hero-headline --name "Hero Headline" --variants control,bold,minimal --json

# Show experiment with stats
vibariant experiments show <id-or-key> --json

# Get detailed results
vibariant experiments results <id> --json

# Update experiment status
vibariant experiments update <id> --status running --json

# Delete an experiment
vibariant experiments delete <id> --json --yes
```

### Goals
```bash
# List detected goals
vibariant goals list --json

# Confirm a goal
vibariant goals confirm <goal-id> --json
```

### Status Overview
```bash
# Quick overview of all experiments
vibariant status --json
```

### Code Generation
```bash
# Generate SDK integration code (auto-detects framework)
vibariant codegen --json

# Specify framework explicitly
vibariant codegen --framework next --json

# Include example experiment component
vibariant codegen --framework react --experiment-key hero-headline --variants control,bold --json

# Write files to disk instead of JSON
vibariant codegen --framework next --force
```

### Configuration
```bash
vibariant config get api_url
vibariant config set api_url https://api.vibariant.com
```

### Full Setup
```bash
# Interactive one-click setup
vibariant init

# Non-interactive setup
vibariant init --yes --email user@example.com --project-name "My App" --experiment hero-headline
```

## Reading Results

The `experiments show` and `experiments results` commands return Bayesian statistics:

- **decision_status**: `collecting_data` | `keep_testing` | `ready_to_ship` | `practically_equivalent`
- **posterior_mean**: The Bayesian estimate of the true conversion rate
- **conversion_rate**: Raw observed conversion rate
- **recommendation**: Plain-English action guidance

A variant is "ready to ship" when its expected loss falls below 0.5%.

## SDK Integration

After generating code with `vibariant codegen`, the SDK provides:
- `<VibariantProvider>` — React context wrapper
- `useVariant(key, variants)` — Hook returning the assigned variant
- Auto-tracking of clicks, scroll depth, form engagement via `requestIdleCallback`

Variants are assigned deterministically via FNV-1a hash of `visitorId:experimentKey`, consistent between client and server.
