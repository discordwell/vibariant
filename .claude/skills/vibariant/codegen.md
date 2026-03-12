# Code Generation & SDK Integration

## `vibariant codegen`

Generate SDK integration code. Auto-detects framework from the current directory, or specify explicitly.

```bash
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
```

**Flags:** `--framework <next|react|vanilla>`, `--experiment-key <key>`, `--variants <csv>`, `--output-dir <dir>`, `--force` (overwrite), `--json`, `--yes`

**Response (`--json`):**
```json
{
  "ok": true,
  "data": {
    "files": [
      { "path": "/abs/path/vibariant.config.ts", "content": "export const vibariantConfig = ..." },
      { "path": "/abs/path/components/vibariant-provider.tsx", "content": "..." }
    ]
  }
}
```

## Generated Files

| Framework | Files |
|-----------|-------|
| Next.js | `vibariant.config.ts`, `components/vibariant-provider.tsx` |
| React | `vibariant.config.ts`, `vibariant-provider.tsx` |
| Vanilla | `vibariant.config.ts`, `vibariant.ts` |

When `--experiment-key` is provided, also generates `example-experiment.tsx`.

## SDK Usage After Codegen

**Next.js / React** — wrap your app:
```tsx
import { VibariantWrapper } from '@/components/vibariant-provider';
<VibariantWrapper>{children}</VibariantWrapper>
```

**Use variants in components:**
```tsx
import { useVariant } from '@vibariant/sdk/react';

function MyComponent() {
  const { variant } = useVariant('hero-headline', ['control', 'bold']);
  return variant === 'control' ? <OriginalHero /> : <BoldHero />;
}
```

**Vanilla JS:**
```ts
import { vibariant } from './vibariant';
const variant = vibariant.getVariant('hero-headline', ['control', 'bold']);
```

## SDK Features

- `<VibariantProvider>` — React context, auto-initializes
- `useVariant(key, variants)` — deterministic variant assignment via FNV-1a hash
- Auto-tracking: clicks, scroll depth, form engagement, time on page
- All tracking runs in `requestIdleCallback` (never blocks UI)
- ~8kb gzipped
