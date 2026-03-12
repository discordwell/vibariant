# Vibariant Workflows

## Workflow 1: Create and Run an Experiment

```bash
# 1. Ensure authenticated
vibariant auth status --json

# 2. Create the experiment
vibariant experiments create --key checkout-cta --name "Checkout CTA" --variants control,urgent,social-proof --json

# 3. Start it running
vibariant experiments update <experiment-id> --status running --json

# 4. Generate SDK code with the experiment
vibariant codegen --framework next --experiment-key checkout-cta --variants control,urgent,social-proof --json

# 5. The --json output gives you the file contents to integrate
```

## Workflow 2: Check Results and Ship Winner

```bash
# 1. Check experiment status
vibariant experiments show checkout-cta --json

# 2. Look at decision_status in the response:
#    - "collecting_data" → need more traffic
#    - "keep_testing" → differences emerging but not yet conclusive
#    - "ready_to_ship" → winner identified, safe to ship
#    - "practically_equivalent" → no meaningful difference

# 3. When ready, update status to completed
vibariant experiments update <id> --status completed --json
```

## Workflow 3: Full Project Setup

```bash
# Non-interactive setup for a new project
vibariant init --yes --email dev@company.com --project-name "My SaaS" --skip-docker --api-url https://api.vibariant.com

# Or interactive
vibariant init
```

## Workflow 4: Quick Status Check

```bash
# Overview of all experiments
vibariant status --json

# Detailed look at a specific experiment
vibariant experiments show hero-headline --json
```

## Error Handling

- Exit code `2` means not authenticated — run `vibariant auth login`
- Exit code `3` means the resource was not found (wrong ID/key)
- Exit code `1` is a general error — check the `error` field in the JSON response
- All JSON errors follow: `{ "ok": false, "error": "descriptive message" }`

## Tips for AI Agents

1. Always use `--json` for parseable output
2. Use `--yes` to avoid interactive prompts that would block
3. You can look up experiments by key (e.g., `hero-headline`) or by UUID
4. The `codegen --json` command returns file contents without writing to disk — useful for reviewing before applying
5. The `experiments show` command combines experiment metadata with stats in one call
6. Project ID is stored after `vibariant init` — subsequent commands auto-resolve it
