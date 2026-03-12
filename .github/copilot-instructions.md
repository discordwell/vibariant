# Vibariant — A/B Testing CLI

This project uses the `vibariant` CLI for A/B testing. All commands support `--json` for structured output and `--yes` to skip interactive prompts.

## JSON Contract

All `--json` responses follow:
```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "..." }
```
Exit codes: `0` success, `1` error, `2` not authenticated, `3` not found.

## Commands

| Task | Command |
|------|---------|
| Check auth | `vibariant auth status --json` |
| List projects | `vibariant projects list --json` |
| Create project | `vibariant projects create "Name" --json` |
| List experiments | `vibariant experiments list --json` |
| Create experiment | `vibariant experiments create --key <key> --variants control,variant --json` |
| Show experiment + stats | `vibariant experiments show <id-or-key> --json` |
| Update experiment | `vibariant experiments update <id> --status running --json` |
| Get results | `vibariant experiments results <id> --json` |
| Delete experiment | `vibariant experiments delete <id> --json --yes` |
| Generate SDK code | `vibariant codegen --framework next --json` |
| List goals | `vibariant goals list --json` |
| Confirm goal | `vibariant goals confirm <goal-id> --json` |
| Status overview | `vibariant status --json` |
| Full setup | `vibariant init --yes --email <email> --project-name "Name"` |

## Typical Workflow

```bash
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
```

## Reading Stats

- **decision_status**: `collecting_data` → `keep_testing` → `ready_to_ship` or `practically_equivalent`
- **posterior_mean**: Bayesian estimate of true conversion rate
- **recommendation**: Plain-English action guidance
- A variant is "ready to ship" when expected loss < 0.5%

## Tips

- Always use `--json` for parseable output
- Use `--yes` to skip interactive prompts
- Experiments can be looked up by key (`hero-headline`) or UUID
- `codegen --json` returns file contents without writing to disk
- `experiments show` combines metadata + stats in one call
- Project ID auto-resolves after `vibariant init`
- `experiments create` creates in draft — follow with `update --status running`
