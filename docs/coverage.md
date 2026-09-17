# Coverage

Coverage is the percentage of exports with a JSDoc description (or meaningful tags, excluding `@internal`).

```
coverage = documented / total * 100
```

`--min` / `coverage.min` is the floor. Findings (lint, ghosts, gap growth) fail even when coverage is high.

## External exports

External re-exports (`source.file === '<external>'`) are excluded from the denominator.

```json
{
  "score": 94,
  "documented": 142,
  "total": 151,
  "external": 12
}
```

Undocumented backlog: `drift list --undocumented`.
