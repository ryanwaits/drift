# Coverage and Health

Drift provides two related metrics: **coverage** (completeness) and **health** (completeness + accuracy combined).

## Coverage

Coverage measures the percentage of exports that have a JSDoc description.

```bash
drift coverage
```

An export is "documented" if it has:
- A non-empty `description` (the main JSDoc comment body), OR
- Meaningful JSDoc tags (excluding `@internal`)

### Formula

```
coverage = documented_exports / total_exports * 100
```

### Example Output

```json
{
  "score": 88,
  "documented": 22,
  "total": 25,
  "undocumented": ["parseConfig", "formatOutput", "validateInput"]
}
```

### Threshold Enforcement

Set a minimum coverage threshold:

```bash
drift coverage --min 80
```

Or in config:

```json
{
  "coverage": {
    "min": 80
  }
}
```

Exit code 1 if coverage is below the threshold.

### Ratcheting

Ratchet mode prevents coverage from regressing. When enabled, the effective minimum is the higher of `coverage.min` and the historical watermark (highest coverage ever recorded).

```json
{
  "coverage": {
    "min": 70,
    "ratchet": true
  }
}
```

If your coverage once hit 85%, the effective threshold becomes 85% even though `min` is 70%. This ensures coverage only goes up.

### Finding Undocumented Exports

```bash
drift list --undocumented
```

Returns all exports missing JSDoc descriptions.

---

## Health

Health is a weighted composite of two signals:

- **Completeness** (50%) -- same as coverage score
- **Accuracy** (50%) -- percentage of documented exports where JSDoc matches the actual signature (no drift)

```bash
drift health
```

This is the **default command** -- running bare `drift` shows health.

### Formula

```
completeness = documented / total * 100
accuracy     = (documented - drifted_exports) / documented * 100
health       = completeness * 0.5 + accuracy * 0.5
```

Where `drifted_exports` is the count of unique exports with at least one lint issue (not the total issue count).

### Example

A package with 25 exports, 22 documented, and 4 exports with drift issues:

```
completeness = 22/25 * 100 = 88%
accuracy     = (22-4)/22 * 100 = 82%
health       = 88 * 0.5 + 82 * 0.5 = 85%
```

### Output

```json
{
  "health": 85,
  "completeness": 88,
  "accuracy": 82,
  "totalExports": 25,
  "documented": 22,
  "undocumented": 3,
  "drifted": 4,
  "issues": [
    { "export": "parseConfig", "issue": "@param 'options' type mismatch" },
    { "export": "createClient", "issue": "@returns type mismatch" }
  ],
  "packageName": "my-lib",
  "packageVersion": "1.0.0",
  "min": 80
}
```

### Threshold Enforcement

```bash
drift health --min 80
```

Or use `drift scan --min 80` which includes health checking.

### Score Thresholds

| Range | Status |
|-------|--------|
| 80-100 | Good |
| 60-79 | Needs work |
| 0-59 | Poor |

---

## `drift scan` Combines Both

`drift scan` runs coverage, lint, prose drift, and health in a single pass:

```bash
drift scan --min 80
```

Its `health` field is the same computation as `drift health`. The `coverage.score` field matches `drift coverage`. Use `scan` when you want everything at once; use `coverage` or `health` individually for focused checks.

---

## Monorepo Mode

All three commands support `--all`:

```bash
drift coverage --all
drift health --all
drift scan --all
```

Batch output includes per-package scores and aggregate totals. Private packages are excluded by default; add `--private` to include them.

---

## Improving Your Scores

1. **Coverage**: Add JSDoc descriptions to exports listed by `drift list --undocumented`.
2. **Accuracy**: Fix lint issues shown by `drift lint`. Common issues are param name mismatches and stale return types after refactoring.
3. **Health**: Improve both coverage and accuracy. Fixing lint issues often has the biggest impact since accuracy is weighted 50%.

See [Drift Detection](./drift-detection.md) for the full list of drift types and how to interpret lint output.
