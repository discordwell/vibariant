# Workflows & Reference

## End-to-End: Create, Run, Ship

```bash
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
```

## Quick Status Check

```bash
vibariant status --json                          # overview of all experiments
vibariant experiments show hero-headline --json  # one experiment with stats
```

## Full Project Setup

```bash
# Non-interactive (CI / AI agent)
vibariant init --yes --email dev@company.com --project-name "My SaaS" --skip-docker --api-url https://api.vibariant.com

# Interactive (human)
vibariant init
```

`vibariant init` handles: backend check, auth, project creation, SDK install, codegen, first experiment, and skill installation.

## Configuration

```bash
vibariant config get api_url
vibariant config set api_url https://api.vibariant.com
```

Keys: `api_url`, `project_id`, `project_token`, `email`.

## Error Handling

| Exit Code | Meaning | Fix |
|-----------|---------|-----|
| `0` | Success | — |
| `1` | General error | Check `error` field in JSON |
| `2` | Not authenticated | Run `vibariant auth login` |
| `3` | Not found | Check ID/key spelling |

## Tips for AI Agents

1. Always use `--json` for parseable output
2. Use `--yes` to skip interactive prompts that would block
3. Experiments can be looked up by key (`hero-headline`) or UUID
4. `codegen --json` returns file contents without writing to disk — review before applying
5. `experiments show` combines metadata + stats in one call
6. Project ID auto-resolves after `vibariant init` — no need to pass `--project-id`
7. `experiments create` creates in draft — follow with `update --status running` to start
