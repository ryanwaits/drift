# Badge Endpoint

Generate documentation health badge SVG for README embedding.

## Endpoint

```
GET /badge/:owner/:repo
GET /badge/:owner/:repo/drift
GET /badge/:owner/:repo/json
```

## Parameters

### Path

| Param | Description |
|-------|-------------|
| `owner` | GitHub owner/org |
| `repo` | Repository name |

### Query

| Param | Default | Description |
|-------|---------|-------------|
| `ref` / `branch` | `main` | Git ref or branch |
| `path` | `.doccov/doccov.json` | DocCov report path |
| `style` | `flat` | Badge style |

### Styles

- `flat` - Default flat style
- `flat-square` - Square corners
- `for-the-badge` - Large badge

## Response

**Content-Type:** `image/svg+xml`

**Cache:** 5 minutes, stale-if-error 1 hour

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="106" height="20">
  <!-- Badge SVG -->
</svg>
```

## Setup

1. Generate the DocCov report in your CI:
   ```bash
   doccov spec --package @your-org/pkg
   ```

2. Commit `.doccov/@your-org/pkg/doccov.json` to your repo

3. Add badge to README:
   ```markdown
   ![Docs](https://api.doccov.com/badge/owner/repo?path=.doccov/@your-org/pkg/doccov.json)
   ```

## Examples

### Single Package

```markdown
![Docs](https://api.doccov.com/badge/owner/repo?path=.doccov/my-package/doccov.json)
```

### Scoped Package

```markdown
![Docs](https://api.doccov.com/badge/owner/repo?path=.doccov/@doccov/sdk/doccov.json)
```

### Custom Branch

```markdown
![Docs](https://api.doccov.com/badge/owner/repo?path=.doccov/@doccov/sdk/doccov.json&branch=develop)
```

### Multiple Badges (Monorepo)

```markdown
![SDK](https://api.doccov.com/badge/owner/repo?path=.doccov/@doccov/sdk/doccov.json)
![CLI](https://api.doccov.com/badge/owner/repo?path=.doccov/@doccov/cli/doccov.json)
```

### Style Variants

```markdown
![Docs](https://api.doccov.com/badge/owner/repo?style=for-the-badge)
```

### Drift Badge

```markdown
![Drift](https://api.doccov.com/badge/owner/repo/drift)
```

## Health Score

The badge displays the **health score** from `doccov.json`, which combines:
- **Completeness**: % of exports with full documentation
- **Accuracy**: Penalty for drift issues (max 50%)
- **Examples**: Penalty for failing examples (max 30%)

## Errors

| Status | Description |
|--------|-------------|
| 404 | doccov.json not found |
| 429 | Rate limit exceeded |
| 500 | Server error |

Error badges show "not found" or "error" text.

## Rate Limiting

- 1000 requests/day per IP
