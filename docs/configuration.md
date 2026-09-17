# Configuration

JSON only. No code execution. First match wins:

1. `--config <path>`
2. `drift.config.json` (walks up)
3. `package.json` `"drift"` key (walks up)
4. Built-in defaults

Hour one needs none.

```json
{
  "$schema": "https://unpkg.com/@driftdev/cli/schemas/drift.config.schema.json",
  "entry": "src/index.ts",
  "coverage": { "min": 80 },
  "docs": {
    "include": ["README.md", "docs/**/*.md"],
    "exclude": ["node_modules/**"]
  }
}
```

| Key | Job |
|-----|-----|
| `entry` | Override auto-detect |
| `coverage.min` | Coverage floor (same as `--min`) |
| `docs.include` / `docs.exclude` | Prose corpus |

Raise the floor by committing a higher `min`. `drift docs init` writes `docs.include` when no config exists.

Key coverage lives in `drift.docs.json`, not this file. See `drift docs`.
