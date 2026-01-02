import { colors, getSymbols } from './colors';
import {
  clearLine,
  formatDuration,
  getTerminalWidth,
  hideCursor,
  isInteractive,
  isTTY,
  showCursor,
  stripAnsi,
  supportsUnicode,
  truncate,
} from './utils';

export interface ProgressBarOptions {
  /** Total number of items (default: 100) */
  total?: number;
  /** Current value (default: 0) */
  current?: number;
  /** Label displayed before the bar */
  label?: string;
  /** Width of the bar (default: auto based on terminal) */
  width?: number;
  /** Show percentage (default: true) */
  showPercent?: boolean;
  /** Show count (e.g., 5/10) (default: true) */
  showCount?: boolean;
  /** Show ETA (default: true, only after 1s elapsed) */
  showETA?: boolean;
  /** Characters for bar fill and empty */
  chars?: { filled?: string; empty?: string };
}

export class ProgressBar {
  private total: number;
  private current: number;
  private label: string;
  private width: number | undefined;
  private showPercent: boolean;
  private showCount: boolean;
  private showETA: boolean;
  private filledChar: string;
  private emptyChar: string;
  private startTime: number | null = null;
  private lastRender = '';
  private symbols = getSymbols(supportsUnicode());
  private sigintHandler: (() => void) | null = null;
  private isComplete = false;

  constructor(options: ProgressBarOptions = {}) {
    this.total = options.total ?? 100;
    this.current = options.current ?? 0;
    this.label = options.label ?? '';
    this.width = options.width;
    this.showPercent = options.showPercent ?? true;
    this.showCount = options.showCount ?? true;
    this.showETA = options.showETA ?? true;

    const unicode = supportsUnicode();
    this.filledChar = options.chars?.filled ?? (unicode ? '█' : '#');
    this.emptyChar = options.chars?.empty ?? (unicode ? '░' : '-');
  }

  start(label?: string): this {
    if (label !== undefined) this.label = label;
    this.startTime = Date.now();
    this.current = 0;
    this.isComplete = false;

    if (!isInteractive()) {
      console.log(`${this.symbols.bullet} ${this.label}`);
      return this;
    }

    hideCursor();
    this.setupSignalHandler();
    this.render();
    return this;
  }

  update(current: number): this {
    this.current = Math.min(current, this.total);
    if (isInteractive()) {
      this.render();
    }
    return this;
  }

  increment(amount = 1): this {
    return this.update(this.current + amount);
  }

  setLabel(label: string): this {
    this.label = label;
    if (isInteractive()) {
      this.render();
    }
    return this;
  }

  setTotal(total: number): this {
    this.total = total;
    if (isInteractive()) {
      this.render();
    }
    return this;
  }

  complete(label?: string): this {
    if (label !== undefined) this.label = label;
    this.current = this.total;
    this.isComplete = true;

    if (!isInteractive()) {
      console.log(`${colors.success(this.symbols.success)} ${this.label}`);
    } else {
      clearLine();
      process.stdout.write(`${colors.success(this.symbols.success)} ${this.label}\n`);
    }

    this.cleanup();
    return this;
  }

  fail(label?: string): this {
    if (label !== undefined) this.label = label;
    this.isComplete = true;

    if (!isInteractive()) {
      console.log(`${colors.error(this.symbols.error)} ${this.label}`);
    } else {
      clearLine();
      process.stdout.write(`${colors.error(this.symbols.error)} ${this.label}\n`);
    }

    this.cleanup();
    return this;
  }

  get percentage(): number {
    return this.total === 0 ? 0 : Math.round((this.current / this.total) * 100);
  }

  get isDone(): boolean {
    return this.isComplete || this.current >= this.total;
  }

  private render(): void {
    if (!isTTY()) return;

    const termWidth = getTerminalWidth();
    const parts: string[] = [];

    // Label
    if (this.label) {
      parts.push(this.label);
    }

    // Build suffix parts
    const suffixParts: string[] = [];
    if (this.showPercent) {
      suffixParts.push(`${this.percentage}%`);
    }
    if (this.showCount) {
      suffixParts.push(`${this.current}/${this.total}`);
    }
    if (this.showETA && this.startTime) {
      const eta = this.calculateETA();
      if (eta) suffixParts.push(eta);
    }

    const suffix = suffixParts.length > 0 ? ` ${suffixParts.join(' ')}` : '';

    // Calculate bar width
    const labelLen = this.label ? stripAnsi(this.label).length + 1 : 0;
    const bracketLen = 2; // [ ]
    const suffixLen = stripAnsi(suffix).length;
    const minBarWidth = 10;
    const availableWidth = termWidth - labelLen - bracketLen - suffixLen - 1;
    const barWidth = this.width ?? Math.max(minBarWidth, Math.min(40, availableWidth));

    // Build bar
    const filledWidth = Math.round((this.current / this.total) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    const bar = `[${this.filledChar.repeat(filledWidth)}${this.emptyChar.repeat(emptyWidth)}]`;

    parts.push(bar);

    const line = truncate(parts.join(' ') + suffix, termWidth);

    // Render caching - only write if changed
    if (line !== this.lastRender) {
      clearLine();
      process.stdout.write(line);
      this.lastRender = line;
    }
  }

  private calculateETA(): string | null {
    if (!this.startTime || this.current === 0) return null;

    const elapsed = Date.now() - this.startTime;
    // Only show ETA after 1 second
    if (elapsed < 1000) return null;

    const rate = this.current / elapsed;
    const remaining = this.total - this.current;
    const etaMs = remaining / rate;

    return `ETA ${formatDuration(etaMs)}`;
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
  }
}

/** Create and start a progress bar in one call */
export function progressBar(
  label: string,
  total: number,
  options?: Omit<ProgressBarOptions, 'label' | 'total'>,
): ProgressBar {
  return new ProgressBar({ ...options, label, total }).start();
}
