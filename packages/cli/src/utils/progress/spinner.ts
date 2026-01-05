import chalk, { type ChalkInstance } from 'chalk';
import { colors, getSymbols } from './colors';
import {
  clearLine,
  cursor,
  getTerminalWidth,
  hideCursor,
  isInteractive,
  isTTY,
  showCursor,
  supportsUnicode,
  truncate,
} from './utils';

export type SpinnerState = 'spinning' | 'success' | 'error' | 'stopped';

export type SpinnerColor = 'cyan' | 'yellow' | 'green' | 'red' | 'magenta' | 'blue' | 'white';

const spinnerColors: Record<SpinnerColor, ChalkInstance> = {
  cyan: chalk.cyan,
  yellow: chalk.yellow,
  green: chalk.green,
  red: chalk.red,
  magenta: chalk.magenta,
  blue: chalk.blue,
  white: chalk.white,
};

export interface SpinnerOptions {
  /** Text to display next to spinner */
  label?: string;
  /** Optional detail line below main label */
  detail?: string;
  /** Frame set: 'dots' (default) or 'circle' */
  style?: 'dots' | 'circle';
  /** Interval between frames in ms (default: 80) */
  interval?: number;
  /** Color for spinner frames (default: cyan) */
  color?: SpinnerColor;
}

const FRAME_SETS = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const,
  circle: ['◐', '◓', '◑', '◒'] as const,
};

const ASCII_FRAME_SET = ['-', '\\', '|', '/'] as const;

export class Spinner {
  private label: string;
  private detail: string | undefined;
  private frames: readonly string[];
  private interval: number;
  private colorFn: ChalkInstance;
  private frameIndex = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: SpinnerState = 'stopped';
  private symbols = getSymbols(supportsUnicode());
  private lastRenderedLines = 0;
  private sigintHandler: (() => void) | null = null;

  constructor(options: SpinnerOptions = {}) {
    this.label = options.label ?? '';
    this.detail = options.detail;
    this.interval = options.interval ?? 80;
    this.colorFn = spinnerColors[options.color ?? 'cyan'];

    const style = options.style ?? 'circle';
    this.frames = supportsUnicode() ? FRAME_SETS[style] : ASCII_FRAME_SET;
  }

  start(label?: string): this {
    if (label !== undefined) this.label = label;
    if (this.state === 'spinning') return this;

    this.state = 'spinning';
    this.frameIndex = 0;
    this.lastRenderedLines = 0;

    if (!isInteractive()) {
      // Non-TTY: just print the label once
      console.log(`${this.symbols.bullet} ${this.label}`);
      return this;
    }

    hideCursor();
    this.setupSignalHandler();
    this.render();

    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, this.interval);

    return this;
  }

  stop(): this {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = 'stopped';
    this.clearOutput();
    this.cleanup();
    return this;
  }

  success(label?: string): this {
    if (label !== undefined) this.label = label;
    this.finish('success');
    return this;
  }

  fail(label?: string): this {
    if (label !== undefined) this.label = label;
    this.finish('error');
    return this;
  }

  update(label: string): this {
    this.label = label;
    if (this.state === 'spinning' && isInteractive()) {
      this.render();
    }
    return this;
  }

  setDetail(detail: string | undefined): this {
    this.detail = detail;
    if (this.state === 'spinning' && isInteractive()) {
      this.render();
    }
    return this;
  }

  get isSpinning(): boolean {
    return this.state === 'spinning';
  }

  private finish(state: 'success' | 'error'): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = state;

    if (!isInteractive()) {
      const symbol = state === 'success' ? this.symbols.success : this.symbols.error;
      const colorFn = state === 'success' ? colors.success : colors.error;
      console.log(`${colorFn(symbol)} ${this.label}`);
    } else {
      this.clearOutput();
      const symbol = state === 'success' ? this.symbols.success : this.symbols.error;
      const colorFn = state === 'success' ? colors.success : colors.error;
      process.stdout.write(`${colorFn(symbol)} ${this.label}\n`);
    }

    this.cleanup();
  }

  private render(): void {
    if (!isTTY()) return;

    this.clearOutput();

    const frame = this.colorFn(this.frames[this.frameIndex]);
    const width = getTerminalWidth();
    const mainLine = truncate(`${frame} ${this.label}`, width);
    process.stdout.write(mainLine);

    let lines = 1;
    if (this.detail) {
      const detailLine = truncate(`  ${colors.muted(this.detail)}`, width);
      process.stdout.write(`\n${detailLine}`);
      lines = 2;
    }

    this.lastRenderedLines = lines;
  }

  private clearOutput(): void {
    if (!isTTY()) return;

    // Move up and clear all previously rendered lines
    for (let i = 0; i < this.lastRenderedLines; i++) {
      if (i > 0) process.stdout.write(cursor.up(1));
      clearLine();
    }
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

/** Create and start a spinner in one call */
export function spinner(label: string, options?: Omit<SpinnerOptions, 'label'>): Spinner {
  return new Spinner({ ...options, label }).start();
}
