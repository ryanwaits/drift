import { colors, getSymbols } from './colors';
import {
  clearLine,
  cursor,
  getTerminalWidth,
  hideCursor,
  isInteractive,
  isTTY,
  showCursor,
  stripAnsi,
  supportsUnicode,
  truncate,
} from './utils';

export interface MultiProgressBarConfig {
  /** Unique identifier for the bar */
  id: string;
  /** Label displayed before the bar */
  label: string;
  /** Total number of items (default: 100) */
  total?: number;
  /** Current value (default: 0) */
  current?: number;
}

interface ProgressBarState {
  id: string;
  label: string;
  total: number;
  current: number;
  status: 'active' | 'completed' | 'failed';
  startTime: number;
}

export interface MultiProgressOptions {
  /** Width of progress bars (default: auto) */
  barWidth?: number;
  /** Show percentage (default: true) */
  showPercent?: boolean;
  /** Show count (default: true) */
  showCount?: boolean;
  /** Spinner interval in ms (default: 80) */
  spinnerInterval?: number;
}

export class MultiProgress {
  private bars: Map<string, ProgressBarState> = new Map();
  private barOrder: string[] = [];
  private options: Required<Omit<MultiProgressOptions, 'barWidth'>> & { barWidth?: number };
  private spinnerFrames: readonly string[];
  private spinnerIndex = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastRenderedLines = 0;
  private symbols = getSymbols(supportsUnicode());
  private sigintHandler: (() => void) | null = null;
  private filledChar: string;
  private emptyChar: string;

  constructor(options: MultiProgressOptions = {}) {
    this.options = {
      barWidth: options.barWidth,
      showPercent: options.showPercent ?? true,
      showCount: options.showCount ?? true,
      spinnerInterval: options.spinnerInterval ?? 80,
    };

    this.spinnerFrames = supportsUnicode()
      ? (['◐', '◓', '◑', '◒'] as const)
      : (['-', '\\', '|', '/'] as const);

    const unicode = supportsUnicode();
    this.filledChar = unicode ? '█' : '#';
    this.emptyChar = unicode ? '░' : '-';
  }

  /** Start the multi-progress display */
  start(): this {
    if (!isInteractive()) return this;

    hideCursor();
    this.setupSignalHandler();

    this.timer = setInterval(() => {
      if (this.bars.size > 0 && [...this.bars.values()].some((b) => b.status === 'active')) {
        this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
        this.render();
      }
    }, this.options.spinnerInterval);

    return this;
  }

  /** Add a new progress bar */
  add(config: MultiProgressBarConfig): this {
    const state: ProgressBarState = {
      id: config.id,
      label: config.label,
      total: config.total ?? 100,
      current: config.current ?? 0,
      status: 'active',
      startTime: Date.now(),
    };

    this.bars.set(config.id, state);
    if (!this.barOrder.includes(config.id)) {
      this.barOrder.push(config.id);
    }

    if (!isInteractive()) {
      console.log(`${this.symbols.bullet} ${config.label}`);
    } else {
      this.render();
    }

    return this;
  }

  /** Update a progress bar */
  update(id: string, current: number, label?: string): this {
    const bar = this.bars.get(id);
    if (!bar) return this;

    bar.current = Math.min(current, bar.total);
    if (label !== undefined) bar.label = label;

    if (isInteractive()) {
      this.render();
    }

    return this;
  }

  /** Increment a progress bar */
  increment(id: string, amount = 1): this {
    const bar = this.bars.get(id);
    if (!bar) return this;
    return this.update(id, bar.current + amount);
  }

  /** Mark a bar as complete */
  complete(id: string, label?: string): this {
    const bar = this.bars.get(id);
    if (!bar) return this;

    bar.status = 'completed';
    bar.current = bar.total;
    if (label !== undefined) bar.label = label;

    if (!isInteractive()) {
      console.log(`${colors.success(this.symbols.success)} ${bar.label}`);
    } else {
      this.render();
    }

    return this;
  }

  /** Mark a bar as failed */
  fail(id: string, label?: string): this {
    const bar = this.bars.get(id);
    if (!bar) return this;

    bar.status = 'failed';
    if (label !== undefined) bar.label = label;

    if (!isInteractive()) {
      console.log(`${colors.error(this.symbols.error)} ${bar.label}`);
    } else {
      this.render();
    }

    return this;
  }

  /** Remove a bar from display */
  remove(id: string): this {
    this.bars.delete(id);
    this.barOrder = this.barOrder.filter((i) => i !== id);
    if (isInteractive()) {
      this.render();
    }
    return this;
  }

  /** Get a bar's current state */
  get(id: string): ProgressBarState | undefined {
    return this.bars.get(id);
  }

  /** Check if all bars are finished */
  get allDone(): boolean {
    if (this.bars.size === 0) return true;
    return [...this.bars.values()].every((b) => b.status !== 'active');
  }

  /** Stop the display */
  stop(): this {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.cleanup();
    return this;
  }

  private render(): void {
    if (!isTTY()) return;

    this.clearOutput();

    const width = getTerminalWidth();
    const lines: string[] = [];

    for (const id of this.barOrder) {
      const bar = this.bars.get(id);
      if (!bar) continue;

      const line = this.renderBar(bar, width);
      lines.push(line);
    }

    if (lines.length > 0) {
      process.stdout.write(lines.join('\n'));
      this.lastRenderedLines = lines.length;
    }
  }

  private renderBar(bar: ProgressBarState, termWidth: number): string {
    const parts: string[] = [];

    // Status symbol
    let symbol: string;
    switch (bar.status) {
      case 'completed':
        symbol = colors.success(this.symbols.success);
        break;
      case 'failed':
        symbol = colors.error(this.symbols.error);
        break;
      default:
        symbol = colors.primary(this.spinnerFrames[this.spinnerIndex]);
    }
    parts.push(symbol);

    // Label
    parts.push(bar.label);

    // Build suffix
    const suffixParts: string[] = [];
    if (this.options.showPercent) {
      const pct = bar.total === 0 ? 0 : Math.round((bar.current / bar.total) * 100);
      suffixParts.push(`${pct}%`);
    }
    if (this.options.showCount) {
      suffixParts.push(`${bar.current}/${bar.total}`);
    }

    const suffix = suffixParts.length > 0 ? ` ${suffixParts.join(' ')}` : '';

    // Calculate bar width
    const labelLen = stripAnsi(parts.join(' ')).length + 1;
    const bracketLen = 2;
    const suffixLen = stripAnsi(suffix).length;
    const minBarWidth = 10;
    const availableWidth = termWidth - labelLen - bracketLen - suffixLen - 1;
    const barWidth = this.options.barWidth ?? Math.max(minBarWidth, Math.min(30, availableWidth));

    // Build bar visualization
    const filledWidth = Math.round((bar.current / bar.total) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    const barViz = `[${this.filledChar.repeat(filledWidth)}${this.emptyChar.repeat(emptyWidth)}]`;

    parts.push(barViz);

    return truncate(parts.join(' ') + suffix, termWidth);
  }

  private clearOutput(): void {
    if (!isTTY() || this.lastRenderedLines === 0) return;

    // Move up and clear each line
    for (let i = 0; i < this.lastRenderedLines; i++) {
      if (i > 0) process.stdout.write(cursor.up(1));
      clearLine();
    }
    this.lastRenderedLines = 0;
  }

  private setupSignalHandler(): void {
    this.sigintHandler = () => {
      this.cleanup();
      process.exit(130);
    };
    process.on('SIGINT', this.sigintHandler);
  }

  private cleanup(): void {
    if (this.sigintHandler) {
      process.removeListener('SIGINT', this.sigintHandler);
      this.sigintHandler = null;
    }
    showCursor();
    if (isTTY() && this.lastRenderedLines > 0) {
      process.stdout.write('\n');
    }
  }
}

/** Create and start a multi-progress display */
export function multiProgress(options?: MultiProgressOptions): MultiProgress {
  return new MultiProgress(options).start();
}
