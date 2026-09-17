# CI Integration

The Action runs `drift` — same check as local. Findings fail. Coverage below `--min` / `coverage.min` fails. Ghosts and gap growth fail when `drift.docs.json` is present.

```yaml
name: Drift
on: [pull_request]

jobs:
  drift:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: ryanwaits/drift/action@v1
        with:
          min-coverage: 80
```

Set `min-coverage` to your current score so the floor cannot drop. Raise it when you pay down the backlog.

## Without the Action

```bash
drift --min 80 --annotations
```

## Inputs

See [Action](./action.md). `check-all: true` for monorepos (`drift --all`).

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Pass |
| 1 | Findings, coverage below min, or key-coverage fail |
| 2 | Usage or internal error |
