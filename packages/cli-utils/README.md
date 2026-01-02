# cli-utils

Shared CLI feedback components for terminal UX. Provides spinners, progress bars, and formatted output.

> **Internal package** - Used by `@doccov/cli` and `@openpkg-ts/extract` CLIs.

## Components

### Spinner

Simple animated spinner for async operations.

```typescript
import { spinner } from 'cli-utils';

const spin = spinner('Loading...');
await doAsyncWork();
spin.success('Done!');
// or spin.fail('Failed');
```

### Progress Bar

Progress indicator with ETA for iterative operations.

```typescript
import { progressBar } from 'cli-utils';

const bar = progressBar('Processing', 100);
for (let i = 0; i < 100; i++) {
  await processItem(i);
  bar.increment();
}
bar.complete('Processed 100 items');
```

Output: `Processing [████████████░░░░░░░░] 60% 60/100 ETA 2s`

### Step Progress

Multi-step progress for sequential operations.

```typescript
import { stepProgress } from 'cli-utils';

const steps = stepProgress(['Parse', 'Transform', 'Output']).start();
steps.startStep(0);
await parse();
steps.completeStep(0);
// ...
steps.stop();
```

### Summary

Formatted key-value output for results.

```typescript
import { summary } from 'cli-utils';

summary()
  .addKeyValue('Exports', 42)
  .addKeyValue('Coverage', '85%', 'pass')
  .addKeyValue('Drift', '3 issues', 'fail')
  .print();
```

## Utilities

### Terminal Detection

```typescript
import { isTTY, isCI, isInteractive, supportsUnicode } from 'cli-utils';

if (isInteractive()) {
  // Show animated output
} else {
  // Static output for CI/pipes
}
```

### Formatting

```typescript
import { colors, symbols, formatDuration, truncate } from 'cli-utils';

console.log(colors.success('Done!'));      // Green text
console.log(symbols.success);               // ✓
console.log(formatDuration(1500));          // "1.5s"
console.log(truncate('long text', 10));     // "long te..."
```

## Exports

### Components
- `Spinner` / `spinner()` - Animated spinner
- `ProgressBar` / `progressBar()` - Progress with ETA
- `StepProgress` / `stepProgress()` - Multi-step progress
- `MultiProgress` / `multiProgress()` - Multiple concurrent bars
- `Summary` / `summary()` - Formatted output

### Styling
- `colors` - Chalk color functions (success, error, warning, etc.)
- `symbols` - Unicode symbols (checkmarks, arrows, etc.)
- `getSymbols(unicode)` - Get symbols with ASCII fallback

### Utilities
- `isTTY()`, `isCI()`, `isInteractive()` - Environment detection
- `supportsUnicode()` - Unicode support detection
- `formatDuration(ms)` - Human-readable duration
- `truncate(str, width)` - Truncate with ellipsis
- `clearLine()`, `hideCursor()`, `showCursor()` - Terminal control

## License

MIT
