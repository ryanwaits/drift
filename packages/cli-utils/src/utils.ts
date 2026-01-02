// TTY detection
export function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

/** Detect CI environments (GitHub Actions, GitLab CI, CircleCI, Travis, Jenkins, etc.) */
export function isCI(): boolean {
  return Boolean(
    process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.TRAVIS ||
      process.env.JENKINS_URL ||
      process.env.BUILDKITE ||
      process.env.TEAMCITY_VERSION ||
      process.env.TF_BUILD || // Azure Pipelines
      process.env.CODEBUILD_BUILD_ID || // AWS CodeBuild
      process.env.BITBUCKET_BUILD_NUMBER,
  );
}

export function isInteractive(): boolean {
  return isTTY() && !isCI();
}

export function supportsUnicode(): boolean {
  if (process.platform === 'win32') {
    return Boolean(process.env.WT_SESSION) || process.env.TERM_PROGRAM === 'vscode';
  }
  return process.env.TERM !== 'linux';
}

// Terminal dimensions
const MIN_TERMINAL_WIDTH = 40;
const MIN_TERMINAL_HEIGHT = 10;
const DEFAULT_TERMINAL_WIDTH = 80;
const DEFAULT_TERMINAL_HEIGHT = 24;

export function getTerminalWidth(): number {
  const width = process.stdout.columns || DEFAULT_TERMINAL_WIDTH;
  return Math.max(width, MIN_TERMINAL_WIDTH);
}

export function getTerminalHeight(): number {
  const height = process.stdout.rows || DEFAULT_TERMINAL_HEIGHT;
  return Math.max(height, MIN_TERMINAL_HEIGHT);
}

/** Get raw terminal width without minimum enforcement */
export function getRawTerminalWidth(): number {
  return process.stdout.columns || DEFAULT_TERMINAL_WIDTH;
}

/** Check if terminal is very narrow (less than 60 columns) */
export function isNarrowTerminal(): boolean {
  return getRawTerminalWidth() < 60;
}

// Time formatting
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatTimestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

// Cursor control (ANSI escape sequences)
export const cursor = {
  hide: '\x1B[?25l',
  show: '\x1B[?25h',
  up: (n = 1) => `\x1B[${n}A`,
  down: (n = 1) => `\x1B[${n}B`,
  forward: (n = 1) => `\x1B[${n}C`,
  back: (n = 1) => `\x1B[${n}D`,
  left: '\x1B[G',
  clearLine: '\x1B[2K',
  clearDown: '\x1B[J',
  save: '\x1B[s',
  restore: '\x1B[u',
};

// Output helpers
export function clearLine(): void {
  if (isTTY()) {
    process.stdout.write(cursor.clearLine + cursor.left);
  }
}

export function moveCursorUp(lines = 1): void {
  if (isTTY()) {
    process.stdout.write(cursor.up(lines));
  }
}

export function hideCursor(): void {
  if (isTTY()) {
    process.stdout.write(cursor.hide);
  }
}

export function showCursor(): void {
  if (isTTY()) {
    process.stdout.write(cursor.show);
  }
}

// Text truncation with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

// Pad string to width
export function padEnd(text: string, width: number): string {
  const visibleLength = stripAnsi(text).length;
  const padding = Math.max(0, width - visibleLength);
  return text + ' '.repeat(padding);
}

// Strip ANSI codes for length calculation
// biome-ignore lint/suspicious/noControlCharactersInRegex: Intentional ANSI escape sequence matching
const ANSI_REGEX = /\x1B\[[0-9;]*[a-zA-Z]/g;
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}
