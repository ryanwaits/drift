import { colors, getSymbols } from './colors';
import {
  clearLine,
  cursor,
  formatDuration,
  getTerminalWidth,
  hideCursor,
  isInteractive,
  isTTY,
  moveCursorUp,
  showCursor,
  supportsUnicode,
  truncate,
} from './utils';

export type StepStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped';

export interface Step {
  label: string;
  status: StepStatus;
  startTime?: number;
  endTime?: number;
}

export interface StepProgressOptions {
  /** Initial steps to display */
  steps?: string[];
  /** Show step numbers like [1/5] (default: true) */
  showNumbers?: boolean;
  /** Spinner interval in ms (default: 80) */
  spinnerInterval?: number;
}

export class StepProgress {
  private steps: Step[] = [];
  private showNumbers: boolean;
  private spinnerInterval: number;
  private spinnerFrames: readonly string[];
  private spinnerIndex = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private symbols = getSymbols(supportsUnicode());
  private lastRenderedLines = 0;
  private sigintHandler: (() => void) | null = null;

  constructor(options: StepProgressOptions = {}) {
    this.showNumbers = options.showNumbers ?? true;
    this.spinnerInterval = options.spinnerInterval ?? 80;
    this.spinnerFrames = supportsUnicode()
      ? (['◐', '◓', '◑', '◒'] as const)
      : (['-', '\\', '|', '/'] as const);

    if (options.steps) {
      this.steps = options.steps.map((label) => ({ label, status: 'pending' as const }));
    }
  }

  /** Start the step progress display */
  start(): this {
    if (!isInteractive()) return this;

    hideCursor();
    this.setupSignalHandler();
    this.render();

    this.timer = setInterval(() => {
      if (this.steps.some((s) => s.status === 'active')) {
        this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
        this.render();
      }
    }, this.spinnerInterval);

    return this;
  }

  /** Add a step dynamically */
  addStep(label: string): this {
    this.steps.push({ label, status: 'pending' });
    if (isInteractive()) this.render();
    return this;
  }

  /** Start a step (marks it as active) */
  startStep(index: number): this {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index].status = 'active';
      this.steps[index].startTime = Date.now();
      if (isInteractive()) {
        this.render();
      } else {
        const step = this.steps[index];
        const prefix = this.showNumbers ? `[${index + 1}/${this.steps.length}] ` : '';
        console.log(`${this.symbols.bullet} ${prefix}${step.label}...`);
      }
    }
    return this;
  }

  /** Complete a step successfully */
  completeStep(index: number): this {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index].status = 'completed';
      this.steps[index].endTime = Date.now();
      if (isInteractive()) {
        this.render();
      } else {
        const step = this.steps[index];
        const duration = this.getStepDuration(step);
        const prefix = this.showNumbers ? `[${index + 1}/${this.steps.length}] ` : '';
        console.log(`${colors.success(this.symbols.success)} ${prefix}${step.label}${duration}`);
      }
    }
    return this;
  }

  /** Mark a step as failed */
  failStep(index: number): this {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index].status = 'failed';
      this.steps[index].endTime = Date.now();
      if (isInteractive()) {
        this.render();
      } else {
        const step = this.steps[index];
        const prefix = this.showNumbers ? `[${index + 1}/${this.steps.length}] ` : '';
        console.log(`${colors.error(this.symbols.error)} ${prefix}${step.label}`);
      }
    }
    return this;
  }

  /** Skip a step */
  skipStep(index: number): this {
    if (index >= 0 && index < this.steps.length) {
      this.steps[index].status = 'skipped';
      if (isInteractive()) this.render();
    }
    return this;
  }

  /** Run through steps sequentially with async functions */
  async run<T>(
    tasks: { label: string; task: () => Promise<T> }[],
  ): Promise<{ results: T[]; failed: boolean }> {
    this.steps = tasks.map((t) => ({ label: t.label, status: 'pending' as const }));
    this.start();

    const results: T[] = [];
    let failed = false;

    for (let i = 0; i < tasks.length; i++) {
      if (failed) {
        this.skipStep(i);
        continue;
      }

      this.startStep(i);
      try {
        results.push(await tasks[i].task());
        this.completeStep(i);
      } catch {
        this.failStep(i);
        failed = true;
      }
    }

    this.stop();
    return { results, failed };
  }

  /** Stop the display (cleans up resources) */
  stop(): this {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.cleanup();
    return this;
  }

  /** Get current step index (first active, or first pending, or -1) */
  get currentStepIndex(): number {
    const activeIdx = this.steps.findIndex((s) => s.status === 'active');
    if (activeIdx >= 0) return activeIdx;
    return this.steps.findIndex((s) => s.status === 'pending');
  }

  private render(): void {
    if (!isTTY()) return;

    // Clear previous output
    if (this.lastRenderedLines > 0) {
      moveCursorUp(this.lastRenderedLines - 1);
      for (let i = 0; i < this.lastRenderedLines; i++) {
        clearLine();
        if (i < this.lastRenderedLines - 1) {
          process.stdout.write(cursor.down(1));
        }
      }
      moveCursorUp(this.lastRenderedLines - 1);
    }

    const width = getTerminalWidth();
    const lines: string[] = [];

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const prefix = this.showNumbers ? `[${i + 1}/${this.steps.length}] ` : '';
      const duration = this.getStepDuration(step);

      let symbol: string;
      let text: string;

      switch (step.status) {
        case 'completed':
          symbol = colors.success(this.symbols.success);
          text = `${prefix}${step.label}${duration}`;
          break;
        case 'failed':
          symbol = colors.error(this.symbols.error);
          text = `${prefix}${step.label}`;
          break;
        case 'active':
          symbol = colors.primary(this.spinnerFrames[this.spinnerIndex]);
          text = `${prefix}${step.label}`;
          break;
        case 'skipped':
          symbol = colors.muted(this.symbols.bullet);
          text = colors.muted(`${prefix}${step.label} (skipped)`);
          break;
        default: // pending
          symbol = colors.muted('○');
          text = colors.muted(`${prefix}${step.label}`);
      }

      lines.push(truncate(`${symbol} ${text}`, width));
    }

    process.stdout.write(lines.join('\n'));
    this.lastRenderedLines = lines.length;
  }

  private getStepDuration(step: Step): string {
    if (step.startTime && step.endTime) {
      const ms = step.endTime - step.startTime;
      return colors.muted(` (${formatDuration(ms)})`);
    }
    return '';
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
    // Move cursor to end of output
    if (isTTY() && this.lastRenderedLines > 0) {
      process.stdout.write('\n');
    }
  }
}

/** Create step progress with initial steps */
export function stepProgress(
  steps: string[],
  options?: Omit<StepProgressOptions, 'steps'>,
): StepProgress {
  return new StepProgress({ ...options, steps });
}
