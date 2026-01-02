import { colors } from './colors';
import { clearLine, cursor, isTTY } from './utils';

/**
 * ProgressContext provides log interleaving for progress displays.
 * It pauses the progress display, prints the message, then restores.
 */
export interface ProgressContextOptions {
  /** Number of lines the progress display occupies */
  lines: number;
}

export class ProgressContext {
  private lines: number;
  private paused = false;

  constructor(options: ProgressContextOptions) {
    this.lines = options.lines;
  }

  /** Update the line count (call when progress display changes size) */
  setLines(lines: number): void {
    this.lines = lines;
  }

  /** Pause progress display, clearing its output temporarily */
  pause(): void {
    if (!isTTY() || this.paused || this.lines === 0) return;
    this.paused = true;

    // Move up and clear all progress lines
    for (let i = 0; i < this.lines; i++) {
      if (i > 0) process.stdout.write(cursor.up(1));
      clearLine();
    }
  }

  /** Resume progress display (caller must re-render) */
  resume(): void {
    this.paused = false;
  }

  /** Check if currently paused */
  get isPaused(): boolean {
    return this.paused;
  }

  /** Log a message, pausing progress display if needed */
  log(message: string): void {
    this.pause();
    console.log(message);
    this.resume();
  }

  /** Log an info message */
  info(message: string): void {
    this.log(`${colors.info('ℹ')} ${message}`);
  }

  /** Log a warning message */
  warn(message: string): void {
    this.log(`${colors.warning('⚠')} ${message}`);
  }

  /** Log an error message */
  error(message: string): void {
    this.log(`${colors.error('✗')} ${message}`);
  }

  /** Log a success message */
  success(message: string): void {
    this.log(`${colors.success('✓')} ${message}`);
  }
}

/** Create a progress context for log interleaving */
export function progressContext(lines: number): ProgressContext {
  return new ProgressContext({ lines });
}
